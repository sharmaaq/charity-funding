// Organisation area controller: opens storage, seeds once, renders the routes into <main>.
// app.js stays the router and shell; it calls createOrganisation() and delegates #/organisation routes here.
import { h } from './dom.js';
import { OrgError, mapError, openDb } from './db.js';
import { createRepository, createSeedRepository } from './repository.js';
import { LIMITS } from './validation.js';
import { BIDS_HASH, DOCS_HASH, ORG_HOME } from './routes.js';
import { confirmDialog } from './views/dialog.js';
import { overviewSection } from './views/overview.js';
import { bidDetail, bidForm, bidNotFound, bidsPanel } from './views/bids.js';
import { documentsPanel } from './views/documents.js';
import { READ_ONLY_ID, STORAGE_NOTICE } from './views/common.js';

export { isOrgHash, parseOrgHash } from './routes.js';

const AREA_TITLE = 'Organisation information';

const PROBLEM_TEXT = {
  blocked: 'Another tab of this site is still using an older version of the organisation database. Close other tabs of this site, then choose Retry.',
  'unknown-schema': 'This browser holds organisation data saved by a different version of this app, so it cannot be opened safely here. Nothing has been changed or deleted.',
  corrupt: 'Some saved organisation records could not be read. Nothing has been changed or deleted, and your files are still stored in this browser.',
};

export function createOrganisation({ mount, titleEl, now, announce, announceNext, navigate }) {
  let dirty = false;
  let token = 0;
  let current = null; // { route }
  let repoPromise = null;
  const ui = { results: null };

  window.addEventListener('beforeunload', (ev) => {
    if (dirty) {
      ev.preventDefault();
      ev.returnValue = '';
    }
  });

  const testHooks = () => globalThis.__ORG_TEST_HOOKS__ || {};

  // Opens the database and seeds once. Never deletes or recreates anything to recover from an error.
  function ensureRepo() {
    if (!repoPromise) {
      repoPromise = (async () => {
        let db;
        try {
          db = await openDb();
        } catch (e) {
          const err = mapError(e);
          // Cannot be opened at all: show the sample content from memory, read-only.
          if (err.code === 'unavailable' || err.code === 'unknown') return { repo: createSeedRepository({ now }), readOnly: true, problem: err };
          return { repo: null, readOnly: true, problem: err };
        }
        try {
          const repo = createRepository(db, { now, limits: { ...LIMITS, ...(testHooks().limits || {}) }, hooks: testHooks });
          await repo.seedOnce();
          return { repo, readOnly: false, problem: null };
        } catch (e) {
          db.close();
          return { repo: null, readOnly: true, problem: mapError(e) };
        }
      })();
    }
    return repoPromise;
  }

  function makeCtx(info) {
    return {
      repo: info.repo,
      readOnly: info.readOnly,
      ui,
      now,
      announce,
      announceNext,
      navigate,
      isDirty: () => dirty,
      setDirty: (v) => { dirty = !!v; },
      confirm: confirmDialog,
      confirmDiscard: (trigger) => confirmDialog({
        title: 'Discard your changes?',
        message: 'You have unsaved changes. If you discard them, what you typed or chose is lost.',
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
        returnFocus: trigger,
      }),
      rerender: (opts) => render(current.route, { keepUi: true, ...opts }),
    };
  }

  function problemView(problem) {
    const text = PROBLEM_TEXT[problem.code] || `Organisation information could not be loaded. ${problem.message} Your saved data was not changed.`;
    return h('section', { class: 'org-panel', 'aria-labelledby': 'problem-heading' },
      h('h2', { id: 'problem-heading', tabindex: '-1', 'data-focus': '', text: 'Organisation information is not available' }),
      h('p', { class: 'form-error', role: 'alert', text }),
      h('button', { type: 'button', class: 'btn primary', text: 'Retry', onclick: () => { repoPromise = null; render(current.route, {}); } }),
      h('p', { class: 'sub', text: 'Grant triage in Discovery is not affected.' }));
  }

  function readOnlyBanner() {
    return h('div', { class: 'notice', id: READ_ONLY_ID, role: 'status', 'data-testid': 'read-only-note' },
      h('strong', { text: 'Read-only: saving is unavailable in this browser. ' }),
      'Your browser did not allow this site to open its local storage database (IndexedDB), so nothing can be uploaded, edited or saved here. The sample content below is shown for review only. Grant triage in Discovery is not affected.');
  }

  function tabs(route, bidCount, docCount) {
    const onDocs = route.page === 'documents';
    const tab = (href, label, count, active) => h('li', null,
      h('a', { href, 'aria-current': active ? 'page' : null, 'data-tab': label === 'Documents' ? 'documents' : 'bids' },
        label, h('span', { class: 'count', 'aria-label': `${count} ${label === 'Documents' ? 'documents' : 'past bids'}`, text: String(count) })));
    return h('ul', { class: 'tabs', 'aria-label': 'Organisation sections' },
      tab(BIDS_HASH, 'Past bids', bidCount, !onDocs), tab(DOCS_HASH, 'Documents', docCount, onDocs));
  }

  async function build(route, info) {
    const ctx = makeCtx(info);
    const parts = [];
    if (info.readOnly && info.repo) parts.push(readOnlyBanner());
    const profile = await ctx.repo.getProfile();
    if (!profile) throw new OrgError('corrupt', 'The organisation profile record is missing.');

    if (route.page === 'bids' || route.page === 'documents') {
      const [bids, docs, usage] = await Promise.all([ctx.repo.listBids(), ctx.repo.listDocuments(), ctx.repo.usage()]);
      parts.push(overviewSection(ctx, profile));
      parts.push(tabs(route, bids.length, docs.length));
      parts.push(route.page === 'bids' ? bidsPanel(ctx, bids) : documentsPanel(ctx, docs, usage));
    } else {
      parts.push(overviewSection(ctx, profile, { collapsed: true }));
      if (route.page === 'bid-new') parts.push(bidForm(ctx, null));
      else {
        const bid = await ctx.repo.getBid(route.id);
        if (!bid) parts.push(bidNotFound());
        else parts.push(route.page === 'bid-edit' ? bidForm(ctx, bid) : bidDetail(ctx, bid));
      }
    }
    return parts;
  }

  async function render(route, { focus = true, keepUi = false } = {}) {
    const mine = ++token;
    current = { route };
    if (!keepUi) ui.results = null;
    dirty = false;
    titleEl.textContent = AREA_TITLE;
    if (!mount.querySelector('.org-panel')) {
      mount.replaceChildren(h('p', { class: 'loading', role: 'status', text: 'Loading organisation information...' }));
    }
    const info = await ensureRepo();
    if (mine !== token) return;
    let parts;
    try {
      parts = info.repo ? await build(route, info) : [problemView(info.problem)];
    } catch (e) {
      parts = [problemView(mapError(e))];
    }
    if (mine !== token) return;
    parts.push(h('p', { class: 'storage-note', 'data-testid': 'org-storage-notice', text: STORAGE_NOTICE }));
    mount.replaceChildren(...parts);
    if (focus) {
      const sel = typeof focus === 'string' ? focus : null;
      const target = (sel && mount.querySelector(sel)) || mount.querySelector('[data-focus]') || titleEl;
      target.focus({ preventScroll: false });
    }
  }

  return {
    // route: { page, id? } from parseOrgHash. opts.focus: false keeps focus where it is.
    show: (route, opts = {}) => render(route, opts),
    hide() {
      token += 1;
      dirty = false;
      current = null;
      ui.results = null;
    },
    isDirty: () => dirty,
    discard() { dirty = false; },
    confirmLeave: () => confirmDialog({
      title: 'Leave without saving?',
      message: 'You have unsaved changes on this page. If you leave, they are lost.',
      confirmLabel: 'Leave and discard',
      cancelLabel: 'Stay on this page',
    }),
  };
}

export { ORG_HOME };
