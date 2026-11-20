// Organisation area controller: opens storage, seeds once, renders the routes into <main>.
// app.js stays the router and shell; it calls createOrganisation() and delegates #/organisation routes here.
import { h } from './dom.js';
import { OrgError, mapError } from './db.js';
import { BIDS_HASH, DOCS_HASH, ORG_HOME } from './routes.js';
import { confirmDialog } from './views/dialog.js';
import { overviewSection } from './views/overview.js';
import { bidDetail, bidForm, bidNotFound, bidsPanel } from './views/bids.js';
import { documentsPanel } from './views/documents.js';
import { STORAGE_NOTICE } from './views/common.js';

export { isOrgHash, parseOrgHash } from './routes.js';

const AREA_TITLE = 'Organisation information';

const PROBLEM_TEXT = {
  unavailable: 'The server could not be reached, so organisation information cannot be loaded. Check your connection, then choose Retry. Nothing was changed.',
  corrupt: 'Some saved organisation records could not be read. Nothing has been changed or deleted.',
};

export function createOrganisation({ mount, titleEl, now, announce, announceNext, navigate, services }) {
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

  // The repository is a client of the charity-scoped API (created by app.js for the current charity). Storage problems
  // surface as typed errors from the first call; nothing is deleted or recreated to recover from one.
  function ensureRepo() {
    if (!repoPromise) repoPromise = Promise.resolve({ repo: services.org, readOnly: false, problem: null });
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
