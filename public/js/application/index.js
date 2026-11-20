// Application area controller: opens storage, loads or creates the one draft for a grant, renders the workspace and
// the review screen, and autosaves. app.js stays the router and shell and delegates #/planning/<grant>/application
// routes here, the same way it delegates #/organisation routes to js/org/index.js.
import { h, formatDateTime } from '../org/dom.js';
import { mapError } from '../org/db.js';
import { confirmDialog } from '../org/views/dialog.js';
import { GRANT_ID, evaluate, fieldById, sectionOf, SECTIONS } from './schema.js';
import { confirmAnswer, applySuggestion, editedAnswersThatWouldChange, isEdited, manualExcerptAnswer, mergeAnswers, setManagerAnswer } from './answers.js';
import { buildSuggestions, diffSuggestions, documentRef, initialAnswers, refreshedRefs, staleMap } from './prefill.js';
import { buildExampleAnswers } from './example.js';
import { ACCOUNTS_EXAMPLE_FILENAME, ACCOUNTS_EXAMPLE_PERIOD, ACCOUNTS_EXAMPLE_TAG, ACCOUNTS_EXAMPLE_TITLE, buildAccountsExample } from './accounts-example.js';
import { refreshDialog, excerptDialog } from './dialogs.js';
import { buildWorkspace } from './workspace.js';
import { buildReview } from './review.js';
import { PLANNING_HASH, appHash, fieldHash, reviewHash } from './routes.js';
import { activeRunForGrant, subscribe } from './submission-client.js';
import { buildTracking } from './tracking.js';

export { isApplicationHash, parseApplicationHash, appHash, reviewHash } from './routes.js';
export const UNAVAILABLE_TEXT = 'Application preparation not yet available for this funder';

const SAVE_DELAY_MS = 750;
const AREA_TITLE = 'Planning & submission';
const WORKFLOW_PLACE = {
  new: { label: 'New', hash: '#/discovery/new' },
  watchlist: { label: 'Watchlist', hash: '#/discovery/watchlist' },
  passed: { label: 'Passed', hash: '#/discovery/passed' },
  planning: { label: 'Planning & submission', hash: PLANNING_HASH },
};

export function stageOf(counts) {
  if (counts.missing > 0) return 'Incomplete';
  if (counts.review > 0) return 'Needs review';
  return 'Confirmed';
}

// getGrant(id) -> { id, name, funder, workflow } | null   (provided by app.js; the controller never changes triage state)
export function createApplication({ mount, titleEl, now, announce, navigate, getGrant, services, applicationDefaults = null }) {
  let token = 0;
  let sess = null;
  let view = null; // { kind: 'workspace' | 'review', ui? }
  let servicesPromise = null;
  const nowIso = () => now().toISOString();

  window.addEventListener('beforeunload', (ev) => {
    if (isDirty()) { ev.preventDefault(); ev.returnValue = ''; }
  });
  window.addEventListener('pagehide', () => { if (isDirty()) flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && isDirty()) flush(); });

  // ---------- storage ----------
  // The repositories are clients of the charity-scoped API, created by app.js for the current charity. Problems surface as
  // typed errors from the first call; nothing is deleted or recreated to recover from one.
  function ensureServices() {
    if (!servicesPromise) servicesPromise = Promise.resolve({ org: services.org, apps: services.apps, problem: null });
    return servicesPromise;
  }

  async function loadCatalogue(svc) {
    try {
      return { catalogue: await svc.org.catalogue(), problem: null };
    } catch (e) {
      return { catalogue: null, problem: mapError(e) };
    }
  }

  // ---------- model ----------
  function recompute() {
    sess.stale = staleMap(sess.answers, sess.catalogue);
    sess.eval = evaluate(sess.answers, { stale: sess.stale });
  }

  // ---------- saving ----------
  const isDirty = () => !!(sess && (sess.dirty || sess.saveState === 'saving'));

  function schedule() {
    clearTimeout(sess.timer);
    sess.timer = setTimeout(() => flush(), SAVE_DELAY_MS);
  }

  function flush() {
    if (!sess) return Promise.resolve(true);
    const s = sess;
    clearTimeout(s.timer);
    s.timer = null;
    s.chain = (s.chain || Promise.resolve()).then(() => doSave(s));
    return s.chain;
  }

  async function doSave(s) {
    if (!s.dirty) return true;
    if (s.saveState === 'conflict') return false;
    s.saveState = 'saving';
    paintSave(s);
    const answersAtSave = s.answers;
    try {
      const svc = await ensureServices();
      const rec = await svc.apps.save(s.app.id, { expectedRevision: s.app.draftRevision, answers: answersAtSave });
      s.app = rec;
      s.lastError = null;
      s.saveState = 'saved';
      s.savedAt = rec.updatedAt;
      if (s.answers === answersAtSave) s.dirty = false;
      else { s.saveState = 'saving'; schedule(); } // newer edits arrived while this save was in flight
      paintSave(s);
      return true;
    } catch (e) {
      const err = mapError(e);
      if (err.code === 'conflict') s.saveState = 'conflict';
      else { s.saveState = 'error'; s.lastError = err; }
      paintSave(s);
      return false;
    }
  }

  function paintSave(s) {
    if (s === sess && view && view.ui) view.ui.updateSave();
  }

  // Re-run everything that depends on the answers, and queue a save.
  function afterChange(fieldId, { rerender = false } = {}) {
    sess.dirty = true;
    if (sess.saveState !== 'conflict') { sess.saveState = 'saving'; schedule(); }
    recompute();
    if (!view || !view.ui) return;
    const fd = fieldId && fieldById(fieldId);
    if (rerender || (fd && fd.controls)) view.ui.renderSection(fieldId || undefined);
    else view.ui.updateAll();
  }

  // ---------- actions offered to the views ----------
  const api = {
    edit(id, input, refs) {
      sess.answers = setManagerAnswer(sess.answers, id, input, nowIso(), refs || []);
      afterChange(id);
    },
    confirm(id) {
      const cur = sess.answers[id];
      if (!cur) return;
      sess.answers = confirmAnswer(sess.answers, id, nowIso(), refreshedRefs(cur.sourceRefs, sess.catalogue));
      afterChange(id);
      if (view && view.ui) view.ui.updateAll();
    },
    clear(id) {
      sess.answers = setManagerAnswer(sess.answers, id, { value: null }, nowIso(), []);
      afterChange(id, { rerender: true });
    },
    touch(id) {
      sess.touched.add(id);
      const w = view && view.ui && view.ui.widget(id);
      if (w) w.update();
    },
    flush,
    async saveDraft() {
      const ok = await flush();
      if (ok) announce('Draft saved.');
    },
    retry() { return flush(); },
    goSection(id) {
      if (!SECTIONS.some((s) => s.id === id)) return;
      sess.section = id;
      view.ui.closeDrawer(false);
      view.ui.renderSection();
      view.ui.focusSectionTitle();
    },
    async next(target) {
      sess.validated.add(sess.section);
      await flush();
      if (target === 'review') api.goReview();
      else api.goSection(target);
    },
    async goReview() {
      await flush();
      navigate(reviewHash(sess.grantId));
    },
    async keepMine() {
      try {
        const svc = await ensureServices();
        const latest = await svc.apps.get(sess.app.id);
        if (!latest) throw new Error('The application no longer exists.');
        sess.app = latest;
        sess.saveState = 'saving';
        sess.dirty = true;
        paintSave(sess);
        await flush();
      } catch (e) {
        sess.saveState = 'error';
        sess.lastError = mapError(e);
        paintSave(sess);
      }
    },
    async useSaved() {
      const svc = await ensureServices();
      const latest = await svc.apps.get(sess.app.id);
      if (!latest) return;
      sess.app = latest;
      sess.answers = latest.answers;
      sess.dirty = false;
      sess.saveState = 'saved';
      sess.savedAt = latest.updatedAt;
      recompute();
      view.ui.renderSection();
    },
    // Used by the review screen's package panel.
    services: ensureServices,
    nowIso,
    announce,
    // A completed receipt is immutable. A revised draft is a new revision of the same answers; the next review starts
    // with both confirmations clear, and only a changed package can be run again (no automatic second submission).
    async reviseDraft() {
      try {
        const ok = await flush();
        if (!ok) throw new Error('Your latest changes could not be saved.');
        const svc = await ensureServices();
        sess.app = await svc.apps.save(sess.app.id, { expectedRevision: sess.app.draftRevision, answers: sess.answers });
        announce(`Revised draft created as revision ${sess.app.draftRevision}. The demo receipt for the earlier package is kept unchanged.`);
        navigate(appHash(sess.grantId));
      } catch (e) {
        announce(`The revised draft was not created. ${mapError(e).message}`);
      }
    },
    // Stores (or, with null, removes) the manager's own proposal PDF. Saves any pending edits first, then bumps the draft
    // revision, so the review is rebuilt and both confirmations are cleared by the caller.
    async setReplacement(replacement) {
      const ok = await flush();
      if (!ok) throw new Error('Your latest changes could not be saved, so the proposal was not changed. Go back to the form and save first.');
      const svc = await ensureServices();
      if (!svc.apps) throw svc.problem || new Error('Storage is not available.');
      const rec = await svc.apps.setProposalReplacement(sess.app.id, { expectedRevision: sess.app.draftRevision, replacement });
      sess.app = rec;
      return rec;
    },
    async loadExample(trigger) {
      // The worked example selects a synthetic accounts PDF. It is added to the document store once (found again by its
      // tag on every later load, never duplicated); the profile and every other stored document are left alone.
      let accountsDoc = null;
      let accountsProblem = null;
      try {
        accountsDoc = await ensureExampleAccounts();
      } catch (e) {
        accountsProblem = mapError(e);
      }
      await reloadSources(false);
      const incoming = buildExampleAnswers(nowIso(), accountsDoc);
      const clash = editedAnswersThatWouldChange(sess.answers, incoming);
      if (clash.length) {
        const ok = await confirmDialog({
          title: 'Load the worked demo example?',
          message: `This replaces ${clash.length} ${clash.length === 1 ? 'answer' : 'answers'} you entered or edited with fictional example values. Your organisation profile and stored documents are not changed.`,
          confirmLabel: 'Replace my answers',
          cancelLabel: 'Keep my answers',
          returnFocus: trigger,
        });
        if (!ok) return;
      }
      sess.answers = mergeAnswers(sess.answers, incoming);
      afterChange(null, { rerender: true });
      announce(accountsProblem ? `Worked demo example loaded, but the synthetic accounts document could not be stored: ${accountsProblem.message}` : 'Worked demo example loaded. Every value in it is fictional.');
    },
    async refresh(trigger) {
      await reloadSources(false);
      if (!sess.catalogue) { announce('Suggestions could not be refreshed because the organisation store could not be read.'); return; }
      const suggestions = buildSuggestions(sess.catalogue.profile, applicationDefaults);
      const changes = diffSuggestions(sess.answers, suggestions);
      const chosen = await refreshDialog({ changes, trigger });
      if (!chosen.length) return;
      let next = sess.answers;
      for (const id of chosen) {
        const s = suggestions[id];
        next = applySuggestion(next, id, { ...s, sourceRefs: refreshedRefs(s.sourceRefs, sess.catalogue) });
      }
      sess.answers = next;
      afterChange(null, { rerender: true });
      announce(`Applied ${chosen.length} suggested ${chosen.length === 1 ? 'change' : 'changes'}. They stay unconfirmed until you confirm them.`);
    },
    async useDocument(trigger) {
      await reloadSources(false);
      if (!sess.catalogue) { announce('Documents could not be listed because the organisation store could not be read.'); return; }
      const svc = await ensureServices();
      const res = await excerptDialog({ docs: sess.catalogue.documents, trigger, repo: svc.org });
      if (!res) return;
      if (isEdited(sess.answers[res.fieldId]) && sess.answers[res.fieldId].value !== res.excerpt) {
        const ok = await confirmDialog({
          title: 'Replace your answer?',
          message: `You have already written an answer for "${fieldById(res.fieldId).label}". Using this excerpt replaces it.`,
          confirmLabel: 'Replace my answer',
          cancelLabel: 'Keep my answer',
          returnFocus: trigger,
        });
        if (!ok) return;
      }
      const ref = documentRef(res.doc, { locator: res.locator, excerpt: res.excerpt });
      sess.answers = manualExcerptAnswer(sess.answers, res.fieldId, { excerpt: res.excerpt, ref }, nowIso());
      sess.section = sectionOf(res.fieldId);
      afterChange(res.fieldId, { rerender: true });
      view.ui.focusField(res.fieldId);
      announce(`Used your excerpt for "${fieldById(res.fieldId).label}". It is labelled as supplied by you from a document.`);
    },
    reloadSources: () => reloadSources(true),
  };

  async function reloadSources(paint) {
    const svc = await ensureServices();
    if (!svc.org) return;
    const { catalogue, problem } = await loadCatalogue(svc);
    if (!sess) return;
    sess.catalogue = catalogue;
    sess.catalogueProblem = problem;
    recompute();
    if (paint && view && view.ui) view.ui.renderSection();
    else if (view && view.ui) view.ui.updateAll();
  }

  // The stored synthetic accounts PDF for the worked example, created on first use. Resolves the document record.
  async function ensureExampleAccounts() {
    const svc = await ensureServices();
    if (!svc.org) throw svc.problem || new Error('The document store is not available.');
    const docs = await svc.org.listDocuments();
    const found = docs.find((d) => (d.tags || []).includes(ACCOUNTS_EXAMPLE_TAG));
    if (found) return found;
    const bytes = await buildAccountsExample();
    const file = new File([bytes], ACCOUNTS_EXAMPLE_FILENAME, { type: 'application/pdf' });
    return svc.org.uploadDocument(file, {
      category: 'financial',
      title: ACCOUNTS_EXAMPLE_TITLE,
      description: 'Synthetic demo example, not a real submission or filing. Created for the worked demo example.',
      period: ACCOUNTS_EXAMPLE_PERIOD,
      tags: [ACCOUNTS_EXAMPLE_TAG, 'synthetic'],
    });
  }

  // ---------- views ----------
  function simplePanel(headingText, ...children) {
    return h('section', { class: 'org-panel', 'aria-labelledby': 'app-note-heading' },
      h('h2', { id: 'app-note-heading', tabindex: '-1', 'data-focus': '', text: headingText }), ...children);
  }

  function put(el, focus) {
    mount.replaceChildren(el);
    if (focus) {
      const t = mount.querySelector('[data-focus]') || titleEl;
      t.focus({ preventScroll: false });
    }
  }

  function problemView(problem) {
    return simplePanel('Your application cannot be opened',
      h('p', { class: 'form-error', role: 'alert', text: `${problem.message} Nothing was changed or deleted, and no unsaved application was created.` }),
      h('button', { type: 'button', class: 'btn primary', text: 'Retry', onclick: () => { servicesPromise = null; show(current.route, {}); } }),
      h('p', null, h('a', { href: PLANNING_HASH, text: 'Back to planning' })));
  }

  let current = null;

  async function show(route, { focus = true } = {}) {
    const mine = ++token;
    current = { route };
    titleEl.textContent = AREA_TITLE;
    const grant = getGrant(route.grantId);
    if (!grant || route.grantId !== GRANT_ID) {
      view = null;
      put(simplePanel(grant ? `${grant.name}` : 'Application', h('p', { 'data-testid': 'not-available', text: UNAVAILABLE_TEXT }), h('p', null, h('a', { href: PLANNING_HASH, text: 'Back to planning' }))), focus);
      return;
    }
    if (grant.workflow !== 'planning') {
      view = null;
      const place = WORKFLOW_PLACE[grant.workflow] || WORKFLOW_PLACE.new;
      put(simplePanel('This grant is not in Planning', h('p', { 'data-testid': 'not-in-planning', text: `${grant.funder} ${grant.name} is currently in ${place.label}, not in Planning & submission. Nothing has been changed.` }), h('p', null, h('a', { href: place.hash, text: `Go to ${place.label}` }))), focus);
      return;
    }
    if (!sess || sess.grantId !== route.grantId || !mount.querySelector('.app-workspace, .app-review')) {
      mount.replaceChildren(h('p', { class: 'loading', role: 'status', text: 'Opening your application...' }));
    }
    const svc = await ensureServices();
    if (mine !== token) return;
    if (svc.problem) { view = null; put(problemView(svc.problem), focus); return; }
    try {
      const { catalogue, problem } = await loadCatalogue(svc);
      if (mine !== token) return;
      if (!sess || sess.grantId !== route.grantId) {
        let app = await svc.apps.getByGrant(route.grantId);
        if (!app) app = (await svc.apps.getOrCreate(route.grantId, initialAnswers(catalogue ? catalogue.profile : null, nowIso(), applicationDefaults))).application;
        if (mine !== token) return;
        sess = {
          grantId: route.grantId, app, answers: app.answers, catalogue, catalogueProblem: problem, section: SECTIONS[0].id,
          touched: new Set(), validated: new Set(), drawerField: null, saveState: 'saved', savedAt: app.updatedAt,
          dirty: false, lastError: null, timer: null, chain: null, stale: {}, eval: null,
        };
      } else {
        sess.catalogue = catalogue;
        sess.catalogueProblem = problem;
      }
      recompute();
    } catch (e) {
      view = null;
      put(problemView(mapError(e)), focus);
      return;
    }
    if (route.page === 'review') {
      view = { kind: 'review' };
      put(buildReview(sess, api), focus);
      return;
    }
    if (route.field && fieldById(route.field)) sess.section = sectionOf(route.field);
    else if (route.section && SECTIONS.some((s) => s.id === route.section)) sess.section = route.section;
    const ui = buildWorkspace(sess, api);
    view = { kind: 'workspace', ui };
    put(ui.el, false);
    if (route.field && fieldById(route.field)) {
      ui.focusField(route.field);
      history.replaceState(null, '', appHash(route.grantId));
    } else if (focus) ui.headingEl.focus({ preventScroll: false });
  }

  // ---------- planning list card for G-001 ----------
  function planningCard(grantId) {
    const text = h('p', { class: 'app-card-text', 'data-testid': 'application-status', text: 'Checking for a saved draft...' });
    const open = h('a', { class: 'btn primary', href: appHash(grantId), 'data-testid': 'open-application', text: 'Open application' });
    const card = h('div', { class: 'app-card', 'data-testid': 'application-card' }, text, open);
    (async () => {
      const svc = await ensureServices();
      if (svc.problem) { text.textContent = 'Application storage is not available in this browser, so a draft cannot be saved here.'; return; }
      try {
        const app = await svc.apps.getByGrant(grantId);
        if (!app) { text.textContent = 'No application draft yet. Open the application to start one.'; return; }
        const { catalogue } = await loadCatalogue(svc);
        const ev = evaluate(app.answers, { stale: staleMap(app.answers, catalogue) });
        text.replaceChildren(
          h('strong', { 'data-testid': 'card-stage', text: `Stage: ${stageOf(ev.counts)}` }),
          h('span', { 'data-testid': 'card-saved', text: ` · Last saved ${formatDateTime(app.updatedAt)}` }),
          h('span', { 'data-testid': 'card-missing', text: ` · ${ev.counts.missing} missing` }),
          h('span', { 'data-testid': 'card-review', text: ` · ${ev.counts.review} need review` }));
        const receipts = (await svc.apps.listReceipts()).filter((r) => r.applicationId === app.id);
        if (activeRunForGrant(grantId)) text.append(h('span', { 'data-testid': 'card-demo', text: ' · Demo run in progress' }));
        else if (receipts.length) text.append(h('span', { 'data-testid': 'card-demo', text: ` · Completed demo (${receipts[0].reference}), nothing sent to the funder` }));
      } catch (e) {
        text.textContent = `The saved draft could not be read: ${mapError(e).message}`;
      }
    })();
    return card;
  }

  return {
    show,
    hide() {
      token += 1;
      if (sess) clearTimeout(sess.timer);
      sess = null;
      view = null;
      current = null;
    },
    isDirty,
    flush,
    discard() { if (sess) { sess.dirty = false; sess.saveState = 'saved'; clearTimeout(sess.timer); } },
    isRunActive: (grantId) => !!activeRunForGrant(grantId),
    onRunChange: subscribe,
    trackingView: () => buildTracking({ services: ensureServices, getGrant }),
    confirmLeave: () => confirmDialog({
      title: 'Leave without saving?',
      message: 'Your latest changes could not be saved. If you leave this page they are lost.',
      confirmLabel: 'Leave and discard',
      cancelLabel: 'Stay on this page',
    }),
    planningCard,
  };
}

export { fieldHash };
