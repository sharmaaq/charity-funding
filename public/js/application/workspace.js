// The application workspace: header, actions, status strip, section navigation, one section of fields at a time,
// finance check and the source drawer. It renders from the controller's session and never touches storage itself.
import { h, uid, formatDateTime } from '../org/dom.js';
import { SECTIONS, REVIEW_SECTION, fieldById, fieldsInSection, formatPence, sectionLabel } from './schema.js';
import { ORIGIN_CHIP, ORIGIN_NOTE, SOURCE_KIND, STATUS, fmtTime } from './labels.js';
import { sourceHref } from './prefill.js';
import { buildField } from './fields.js';
import { PLANNING_HASH, reviewHash } from './routes.js';

export const HEADING = 'Prepare your Garfield Weston application';
export const INTRO = 'Answer once here. We will prepare the documents and demonstrate transferring them into an application portal. This demo does not send an application to the funder.';

export function statusStrip(counts) {
  const item = (key, n) => h('li', { class: 'strip-item', 'data-status': key, 'data-count': String(n) },
    h('span', { class: 'strip-mark', 'aria-hidden': 'true', text: STATUS[key].mark }),
    h('span', { class: 'strip-label', text: STATUS[key].label }),
    h('strong', { class: 'strip-n', text: String(n) }));
  return h('ul', { class: 'status-strip', 'aria-label': 'Answer status', 'data-testid': 'status-strip' },
    item('missing', counts.missing), item('review', counts.review), item('confirmed', counts.confirmed));
}

export function buildWorkspace(sess, api) {
  const widgets = new Map();
  const gid = sess.grantId;
  const titleId = uid('app-h');

  // ---------- header and actions ----------
  const saveEl = h('p', { class: 'save-state', 'data-testid': 'save-state', role: 'status', 'aria-live': 'off' });
  const saveAlert = h('div', { class: 'form-error save-alert', role: 'alert', hidden: true });
  const conflictBox = h('div', { class: 'form-error conflict-box', role: 'alert', hidden: true });
  const notice = h('div', { class: 'notice', role: 'status', hidden: true, 'data-testid': 'store-notice' });
  const stripHost = h('div', { class: 'strip-host' });

  const mkBtn = (cls, text, onclick, attrs = {}) => h('button', { type: 'button', class: `btn ${cls}`.trim(), text, onclick, ...attrs });
  const exampleBtn = mkBtn('', 'Load worked demo example', () => api.loadExample(exampleBtn));
  const refreshBtn = mkBtn('', 'Refresh suggestions', () => api.refresh(refreshBtn));
  const docBtn = mkBtn('', 'Use information from a document', () => api.useDocument(docBtn));
  const saveBtn = mkBtn('', 'Save draft', () => api.saveDraft());
  const reviewBtn = mkBtn('primary', 'Review application', () => api.goReview());
  const back = h('a', { class: 'btn', href: PLANNING_HASH, text: 'Back to planning' });

  const header = h('div', { class: 'app-head' },
    h('h2', { id: titleId, tabindex: '-1', 'data-focus': '', text: HEADING }),
    h('span', { class: 'demo-tag', text: 'Demo' }));
  const intro = h('p', { class: 'app-intro', text: INTRO });
  const bar = h('div', { class: 'app-bar' },
    h('div', { class: 'app-bar-main' }, back, saveBtn, reviewBtn),
    h('div', { class: 'app-bar-tools', role: 'group', 'aria-label': 'Prefill tools' }, exampleBtn, refreshBtn, docBtn),
    saveEl);

  // ---------- navigation ----------
  const navList = h('ol', { class: 'app-nav-list' });
  const navEl = h('nav', { class: 'app-nav', 'aria-label': 'Application sections' }, navList);
  const selectId = uid('app-sel');
  const select = h('select', { id: selectId, 'data-testid': 'section-select' });
  select.addEventListener('change', () => {
    if (select.value === REVIEW_SECTION.id) { api.goReview(); return; }
    api.goSection(select.value);
  });
  const selectWrap = h('div', { class: 'app-nav-select' }, h('label', { for: selectId, text: 'Section' }), select);

  const navItems = new Map();
  for (const s of SECTIONS) {
    const count = h('span', { class: 'count nav-count' });
    const btn = h('button', { type: 'button', class: 'nav-item', 'data-section': s.id, onclick: () => api.goSection(s.id) }, h('span', { class: 'nav-label', text: s.label }), count);
    navItems.set(s.id, { btn, count });
    navList.append(h('li', null, btn));
    select.append(h('option', { value: s.id, text: s.label }));
  }
  navList.append(h('li', null, h('a', { class: 'nav-item', 'data-section': REVIEW_SECTION.id, href: reviewHash(gid), onclick: (ev) => { ev.preventDefault(); api.goReview(); } }, h('span', { class: 'nav-label', text: REVIEW_SECTION.label }))));
  select.append(h('option', { value: REVIEW_SECTION.id, text: REVIEW_SECTION.label }));

  // ---------- section body ----------
  const main = h('div', { class: 'app-main', 'data-testid': 'section-panel' });
  const finHost = h('div');

  // ---------- drawer ----------
  const drawerTitleId = uid('drawer-title');
  const drawerBody = h('div', { class: 'drawer-body' });
  const drawerClose = h('button', { type: 'button', class: 'btn', text: 'Close source details', onclick: () => closeDrawer(true) });
  const drawer = h('aside', { class: 'app-drawer', hidden: true, 'aria-labelledby': drawerTitleId, 'data-testid': 'source-drawer', tabindex: '-1' },
    h('div', { class: 'drawer-head' }, h('h3', { id: drawerTitleId, tabindex: '-1' }), drawerClose), drawerBody);
  let drawerTrigger = null;
  drawer.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); closeDrawer(true); } });

  const layout = h('div', { class: 'app-layout' }, navEl, selectWrap, main, drawer);
  const root = h('section', { class: 'org-panel app-workspace', 'aria-labelledby': titleId, 'data-testid': 'application-workspace' },
    header, intro, notice, bar, saveAlert, conflictBox, stripHost, layout);

  // ---------- sections ----------
  function fieldApi() {
    return {
      session: sess,
      edit: (id, input, refs) => api.edit(id, input, refs),
      confirm: (id) => api.confirm(id),
      touch: (id) => api.touch(id),
      flush: () => api.flush(),
      openSource,
    };
  }

  function renderSection(focusFieldId) {
    widgets.clear();
    const sid = sess.section;
    const idx = SECTIONS.findIndex((s) => s.id === sid);
    const body = [h('h3', { class: 'section-title', tabindex: '-1', 'data-testid': 'section-title', text: sectionLabel(sid) })];
    const fa = fieldApi();
    for (const fd of fieldsInSection(sid)) {
      const ev = sess.eval.fields[fd.id];
      if (!ev || !ev.applicable) continue;
      const w = buildField(fd, fa);
      widgets.set(fd.id, w);
      body.push(w.el);
    }
    if (sid === 'documents') {
      body.push(h('p', { class: 'panel-note', text: 'The proposal PDF is created from your confirmed answers in the next update. For now, choose the accounts document here.' }));
    }
    if (sid === 'finances') { finHost.replaceChildren(buildFinance()); body.push(finHost); }
    const prev = idx > 0 ? mkBtn('', `Previous: ${SECTIONS[idx - 1].label}`, () => api.goSection(SECTIONS[idx - 1].id)) : null;
    const next = idx < SECTIONS.length - 1
      ? mkBtn('primary', `Next: ${SECTIONS[idx + 1].label}`, () => api.next(SECTIONS[idx + 1].id), { 'data-testid': 'next-section' })
      : mkBtn('primary', 'Next: Review and submit', () => api.next('review'), { 'data-testid': 'next-section' });
    body.push(h('div', { class: 'section-actions' }, prev, next));
    main.replaceChildren(...body);
    updateAll();
    if (focusFieldId && widgets.has(focusFieldId)) widgets.get(focusFieldId).control && widgets.get(focusFieldId).control.focus();
  }

  function buildFinance() {
    const dl = h('dl', { class: 'fin-grid' });
    const row = (key, label, note) => {
      const dd = h('dd', { 'data-fin': key });
      dl.append(h('div', { class: 'fin-row' }, h('dt', null, label, note ? h('span', { class: 'fin-note', text: ` ${note}` }) : null), dd));
      return dd;
    };
    const cells = {
      expense: row('expense', 'Planned expenditure', '(E)'),
      target: row('target', 'Target income', '(T)'),
      secured: row('secured', 'Secured income', '(S)'),
      gap: row('gap', 'Current unsecured gap', '(E minus S, never below zero)'),
      surplus: row('surplus', 'Target surplus or shortfall', '(T minus E)'),
      request: row('request', 'Amount requested'),
      within: row('within', 'Request within the gap'),
    };
    const box = h('section', { class: 'fin-summary', 'aria-label': 'Finance check', 'data-testid': 'finance-summary' },
      h('h4', { text: 'Finance check' }),
      h('p', { class: 'field-hint', text: 'The grant you are asking for is not counted as secured income.' }), dl);
    box._update = () => {
      const f = sess.eval.finance;
      const known = f.hasIncome || f.hasExpense;
      cells.expense.textContent = f.hasExpense ? formatPence(f.expensePence) : 'No rows yet';
      cells.target.textContent = f.hasIncome ? formatPence(f.targetPence) : 'No rows yet';
      cells.secured.textContent = f.hasIncome ? formatPence(f.securedPence) : 'No rows yet';
      cells.gap.textContent = known && f.complete ? formatPence(f.gapPence) : 'Not available until both tables are complete';
      cells.surplus.textContent = known && f.complete ? (f.targetSurplusPence >= 0 ? `${formatPence(f.targetSurplusPence)} surplus` : `${formatPence(-f.targetSurplusPence)} shortfall`) : 'Not available until both tables are complete';
      cells.request.textContent = f.requestPence !== null ? formatPence(f.requestPence) : 'No amount stated';
      cells.within.textContent = f.requestWithinGap === null ? 'Not checked yet' : f.requestWithinGap ? 'Yes' : 'No: the request is more than the gap';
    };
    box._update();
    return box;
  }

  function updateNav() {
    const sid = sess.section;
    for (const [id, n] of navItems) {
      const sec = sess.eval.sections[id];
      const todo = sec.missing + sec.review;
      n.count.textContent = String(todo);
      n.count.setAttribute('aria-label', `${sec.missing} missing, ${sec.review} need review`);
      n.count.dataset.todo = String(todo);
      if (id === sid) n.btn.setAttribute('aria-current', 'step'); else n.btn.removeAttribute('aria-current');
    }
    select.value = sid;
  }

  function updateStrip() {
    stripHost.replaceChildren(statusStrip(sess.eval.counts));
  }

  function updateSave() {
    const st = sess.saveState;
    saveEl.dataset.state = st;
    saveBtn.disabled = st === 'saving';
    if (st === 'saved') saveEl.textContent = sess.savedAt ? `Saved at ${fmtTime(sess.savedAt)}` : 'Saved';
    else if (st === 'saving') saveEl.textContent = 'Saving...';
    else if (st === 'conflict') saveEl.textContent = 'Not saved';
    else if (st === 'error') {
      saveEl.replaceChildren('Not saved ', h('button', { type: 'button', class: 'link-btn', text: 'Retry', onclick: () => api.retry() }));
    } else saveEl.textContent = '';
    if (st === 'error' && sess.lastError) { saveAlert.textContent = `${sess.lastError.message} Your answers are still on this page.`; saveAlert.hidden = false; }
    else saveAlert.hidden = true;
    if (st === 'conflict') {
      conflictBox.replaceChildren(
        h('p', { text: 'This application was changed in another tab or window since you opened it. Your edits are still here and nothing has been lost.' }),
        h('div', { class: 'actions-row' },
          mkBtn('', 'Keep my edits', () => api.keepMine(), { 'data-testid': 'conflict-keep' }),
          mkBtn('', 'Use the saved version', () => api.useSaved(), { 'data-testid': 'conflict-reload' })));
      conflictBox.hidden = false;
    } else conflictBox.hidden = true;
  }

  function updateNotice() {
    if (sess.catalogueProblem) {
      notice.replaceChildren(h('strong', { text: 'Suggestions and documents are not available. ' }), `The organisation store could not be read (${sess.catalogueProblem.message}) so prefill, source checks and the document list are limited. You can still answer questions and use the worked demo example. `, h('button', { type: 'button', class: 'link-btn', text: 'Retry', onclick: () => api.reloadSources() }));
      notice.hidden = false;
    } else notice.hidden = true;
  }

  function updateAll() {
    widgets.forEach((w) => w.update());
    updateStrip();
    updateNav();
    updateSave();
    updateNotice();
    const fin = finHost.firstChild;
    if (fin && fin._update) fin._update();
    if (!drawer.hidden && sess.drawerField) renderDrawer();
  }

  // ---------- source drawer ----------
  function renderDrawer() {
    const id = sess.drawerField;
    const fd = fieldById(id);
    if (!fd) return;
    const a = sess.answers[id] || null;
    const ev = sess.eval.fields[id];
    const has = a && ((a.value !== null && a.value !== undefined) || a.raw);
    drawer.querySelector('h3').textContent = `Source for: ${fd.label}`;
    const items = [];
    const st = ev ? STATUS[ev.status] : null;
    items.push(h('p', { class: 'drawer-status', 'data-status': ev ? ev.status : '' }, h('strong', { text: 'Status: ' }), st ? st.label : ''));
    if (ev && ev.reasons.length) items.push(h('ul', { class: 'drawer-reasons' }, ev.reasons.filter((r) => r !== 'invalid').map((r) => h('li', { text: REASONS_PLAIN[r] || r }))));
    if (!has) {
      items.push(h('p', { text: 'There is no answer for this question yet, so there is no source to show.' }));
    } else {
      items.push(h('p', null, h('strong', { text: 'Origin: ' }), ORIGIN_CHIP[a.origin] || a.origin));
      items.push(h('p', { class: 'origin-note', text: ORIGIN_NOTE[a.origin] || '' }));
      if (a.editedAt) items.push(h('p', { class: 'sub', text: `Last edited ${formatDateTime(a.editedAt)}.` }));
      if (a.confirmedAt) items.push(h('p', { class: 'sub', text: `Confirmed ${formatDateTime(a.confirmedAt)}.` }));
      else if (!(fd.fixed)) items.push(h('p', { class: 'sub', text: 'Not confirmed yet.' }));
      for (const ref of a.sourceRefs || []) {
        const href = sourceHref(ref);
        const stale = sess.stale[id];
        items.push(h('div', { class: 'drawer-source', 'data-kind': ref.kind },
          h('p', null, h('strong', { text: `${SOURCE_KIND[ref.kind] || 'Source'}: ` }), ref.title || ''),
          ref.synthetic ? h('p', { class: 'synthetic', text: 'Synthetic demo content.' }) : null,
          ref.reportingPeriod ? h('p', { class: 'sub', text: `Period: ${ref.reportingPeriod}` }) : null,
          ref.updatedAt ? h('p', { class: 'sub', text: `Source version recorded: ${/^\d{4}-\d{2}-\d{2}T/.test(ref.updatedAt) ? formatDateTime(ref.updatedAt) : ref.updatedAt}` }) : null,
          ref.locator ? h('p', null, h('strong', { text: 'Page or section: ' }), ref.locator) : null,
          ref.excerpt ? h('div', null, h('p', { class: 'sub' }, h('strong', { text: 'Excerpt you supplied:' })), h('p', { class: 'prewrap excerpt', text: ref.excerpt })) : null,
          stale && ref.recordId ? h('p', { class: 'form-error', role: 'status', text: stale === 'removed' ? 'Source removed: this source no longer exists in the store. The answer text is kept.' : 'Source changed since this answer was filled in. The answer text is kept; check it, then confirm or replace it.' }) : null,
          href ? h('p', null, h('a', { href, text: ref.kind === 'profile' ? 'Open the organisation profile' : ref.kind === 'bid' ? 'Open the past bid' : 'Open the document store' })) : null));
      }
      if ((a.sourceRefs || []).length === 0 && a.origin === 'manager') items.push(h('p', { class: 'sub', text: 'No other source: this is your own wording or choice.' }));
    }
    const actions = [];
    if (has && ev && ev.status === 'review' && !ev.reasons.includes('invalid') && !fd.fixed) {
      actions.push(mkBtn('primary', 'Confirm this answer', () => api.confirm(id), { 'data-testid': 'drawer-confirm' }));
    }
    if (has && !fd.fixed) actions.push(mkBtn('', 'Clear this answer', () => { api.clear(id); }, { 'data-testid': 'drawer-clear' }));
    if (actions.length) items.push(h('div', { class: 'actions-row' }, actions));
    drawerBody.replaceChildren(...items);
  }

  function openSource(fieldId, trigger) {
    drawerTrigger = trigger;
    sess.drawerField = fieldId;
    drawer.hidden = false;
    layout.classList.add('drawer-open');
    renderDrawer();
    document.querySelectorAll('.source-chip[aria-expanded="true"]').forEach((c) => c.setAttribute('aria-expanded', 'false'));
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    drawer.querySelector('h3').focus();
    drawer.scrollIntoView({ block: 'nearest' });
  }
  function closeDrawer(returnFocus) {
    drawer.hidden = true;
    layout.classList.remove('drawer-open');
    sess.drawerField = null;
    document.querySelectorAll('.source-chip[aria-expanded="true"]').forEach((c) => c.setAttribute('aria-expanded', 'false'));
    if (returnFocus && drawerTrigger && drawerTrigger.isConnected) drawerTrigger.focus();
    drawerTrigger = null;
  }

  renderSection();
  return {
    el: root,
    updateAll,
    updateSave,
    renderSection,
    closeDrawer,
    headingEl: header.querySelector('h2'),
    focusField(id) { const w = widgets.get(id); if (w) w.focus(); },
    focusSectionTitle() { const t = main.querySelector('.section-title'); if (t) t.focus(); },
    hasField: (id) => widgets.has(id),
    widget: (id) => widgets.get(id),
  };
}

const REASONS_PLAIN = {
  'suggested-draft': 'This is a suggested draft. Edit it or confirm it. It may contain notes written for you.',
  'synthetic-demo': 'This is an illustrative demo answer. Confirm it during demo review.',
  profile: 'Prefilled from the organisation profile. Confirm it still applies.',
  'historical-bid': 'Prefilled from a past bid. Confirm it is still true.',
  unconfirmed: 'Not yet confirmed.',
  'unknown-answer': 'You answered "Not sure yet", so this still needs a real answer.',
  'source-changed': 'The source changed after this was filled in.',
  'source-removed': 'The source was removed.',
};
