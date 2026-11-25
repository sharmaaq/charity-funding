import { runMockDiscovery } from './discovery.js';
import { isTimingPreview, withPreviewTiming } from './preview.js';
import { nextChangeAt, timingMarkers } from './timing.js';
import { createOrganisation, isOrgHash, parseOrgHash } from './org/index.js';
import { createApplication, isApplicationHash, parseApplicationHash, appHash, UNAVAILABLE_TEXT } from './application/index.js';
import {
  applyDiscovery,
  setBrief,
  availableActions,
  applyAction,
  diffState,
  effectiveSuitability,
  selectView,
  setHideUnsuitable,
  stateFromWorkspace,
} from './state.js';
import { filterGrants, searchWords } from './search.js';
import { NOTE_MAX } from './notes.js';
import { api } from './remote/http.js';
import { SIGN_OUT_HREF, cleanOldBrowserData, pickCharity, readLastCharity, splitWordmark, writeLastCharity } from './remote/session.js';
import { createRepository as createOrgRepository } from './org/repository.js';
import { createApplicationRepository } from './application/repository.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Test hooks: a fixed clock and a replaceable discovery runner (set before the app starts).
const injectedNow = window.__DEMO_NOW__ !== undefined && window.__DEMO_NOW__ !== null ? new Date(window.__DEMO_NOW__) : null;
const now = () => (injectedNow && !Number.isNaN(injectedNow.getTime()) ? new Date(injectedNow.getTime()) : new Date());
const runDiscovery = typeof window.__DEMO_RUN_DISCOVERY__ === 'function' ? window.__DEMO_RUN_DISCOVERY__ : runMockDiscovery;
const previewTiming = isTimingPreview(location.search);

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = getStorage();
const mainEl = document.getElementById('main');
const navEl = document.getElementById('main-nav');
const liveEl = document.getElementById('live');
const noticeEl = document.getElementById('storage-notice');
const titleEl = document.getElementById('view-heading');
const panelEl = document.getElementById('ai-panel');
const briefEl = document.getElementById('brief');
const briefErrorEl = document.getElementById('brief-error');
const discoverBtn = document.getElementById('discover-btn');
const aiStatusEl = document.getElementById('ai-status');
const brandLink = document.getElementById('brand-link');

// ---------- sign-in, charity and saved data ----------
const accountEl = document.getElementById('account');
const stripTitleEl = document.getElementById('strip-title');
const stripTextEl = document.getElementById('strip-text');

// Old browser-only storage is deleted, never migrated: the server holds all data now.
cleanOldBrowserData(storage);

function fatal(message) {
  mainEl.replaceChildren(h('p', { class: 'form-error', role: 'alert', 'data-testid': 'load-error', text: message }));
}

let me;
try {
  me = await api('/api/me');
} catch (e) {
  fatal(`The service could not be reached: ${e.message} Reload the page to try again.`);
  await new Promise(() => {}); // nothing else can run without a signed-in identity
}

const charity = pickCharity(me.charities, readLastCharity(storage));
renderAccount();
if (!charity) {
  fatal(me.isAdmin ? 'No charities have been created yet.' : `Your Google account (${me.email}) is not set up for any charity. Ask your administrator to add you.`);
  await new Promise(() => {});
}
writeLastCharity(storage, charity.id);
applyBranding();

const CID = charity.id;
let workspace;
try {
  workspace = await api(`/api/charities/${encodeURIComponent(CID)}/workspace`);
} catch (e) {
  fatal(`${charity.name} could not be loaded: ${e.message} Reload the page to try again.`);
  await new Promise(() => {});
}
// The grant cards of this charity. Everything else in the page reads this list.
const OPPS = workspace.opportunities;
const services = {
  org: createOrgRepository({ cid: CID, now: () => now() }),
  apps: createApplicationRepository({ cid: CID, userEmail: me.email }),
};
let state = stateFromWorkspace(workspace);
const SAVED_NOTES = Object.fromEntries(Object.entries(workspace.notes || {}).map(([id, n]) => [id, n.text]));
const NOTES = Object.fromEntries(Object.entries(workspace.notes || {}).map(([id, n]) => [id, { ...n }])); // { [grantId]: { text, updatedAt, updatedBy } }
let searchText = ''; // the word search; kept while switching tabs, cleared on reload
let storageOk = true;
const APPLICATION_DEFAULTS = workspace.applicationDefaults || null;

function applyBranding() {
  document.title = `${charity.name} - Grant discovery (demo)`;
  const wm = splitWordmark(charity.name);
  document.getElementById('wm-a').textContent = wm.a;
  document.getElementById('wm-b').textContent = wm.b;
  brandLink.setAttribute('aria-label', `${charity.name} organisation information`);
  const notice = charity.notice || {};
  stripTitleEl.textContent = notice.title || '';
  stripTextEl.textContent = notice.text || '';
}

function renderAccount() {
  const parts = [];
  if (me.charities.length > 1) {
    const select = h('select', { id: 'charity-switch', 'data-testid': 'charity-switch' },
      [...me.charities].sort((x, y) => x.name.localeCompare(y.name, 'en-GB')).map((c) => h('option', { value: c.id, selected: charity && c.id === charity.id ? true : null }, c.name)));
    select.addEventListener('change', () => {
      writeLastCharity(storage, select.value);
      history.replaceState(null, '', location.pathname);
      location.reload(); // loads the other charity's data and look together
    });
    parts.push(h('label', { class: 'sr-only', for: 'charity-switch', text: 'Charity' }), select);
  }
  parts.push(h('span', { class: 'who', 'data-testid': 'signed-in-as', text: `Signed in as ${me.email}` }), h('a', { href: SIGN_OUT_HREF, 'data-testid': 'sign-out' }, 'Sign out'));
  accountEl.replaceChildren(...parts);
  accountEl.hidden = false;
}

let keepMessage = false;
let pendingMessage = null;

const ROUTES = {
  '#/discovery/new': { area: 'discovery', view: 'new' },
  '#/discovery/watchlist': { area: 'discovery', view: 'watchlist' },
  '#/discovery/passed': { area: 'discovery', view: 'passed' },
  '#/planning': { area: 'planning' },
  '#/tracking': { area: 'tracking' },
};
const DEFAULT_ROUTE = '#/discovery/new';
const VIEW_LABELS = { new: 'New', watchlist: 'Watchlist', passed: 'Passed', planning: 'Planning & submission' };
const VIEW_HASH = {
  new: '#/discovery/new',
  watchlist: '#/discovery/watchlist',
  passed: '#/discovery/passed',
  planning: '#/planning',
};
const ACTION_LABELS = {
  watch: 'Watch',
  plan: 'Plan application',
  pass: 'Pass',
  restore: 'Restore to New',
  markSuitable: 'Mark suitable',
  abandon: 'Abandon',
};
const BUTTON_CLASS = { plan: 'btn primary', markSuitable: 'btn lime', pass: 'btn quiet', abandon: 'btn quiet' };
const AREA_TITLES = { discovery: 'Discovery', planning: 'Planning & submission', tracking: 'Tracking' };
const ORG_HOME = '#/organisation';
const ACTION_RESULT = {
  watch: 'watchlist',
  plan: 'planning',
  pass: 'passed',
  restore: 'new',
  abandon: 'passed',
};

// ---------- DOM helper ----------
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const MARKERS = {
  fresh: { label: 'New', icon: 'M12 2 L14.6 9.4 L22 12 L14.6 14.6 L12 22 L9.4 14.6 L2 12 L9.4 9.4 Z' },
  notes: { label: 'Has notes', icon: 'M5 19 L6 14 L16 4 L20 8 L10 18 Z M14 6 L18 10' },
  upcoming: { label: 'Upcoming', icon: 'M4 6 H20 V20 H4 Z M4 10.5 H20 M8.5 3 V7.5 M15.5 3 V7.5' },
  dueSoon: { label: 'Due soon', icon: 'M12 3 A9 9 0 1 0 12.01 3 Z M12 7.5 V12.5 L15.5 14.5' },
};

function markerBadge(kind) {
  const { label, icon } = MARKERS[kind];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', icon);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return h('span', { class: `marker marker-${kind}`, 'data-marker': kind }, svg, h('span', { text: label }));
}

function markersFor(grant) {
  const t = now();
  const timed = previewTiming ? withPreviewTiming(grant, t) : grant;
  const kinds = timingMarkers(timed, t);
  const out = [];
  if (state.freshId === grant.id) out.push('fresh');
  if (kinds.includes('upcoming')) out.push('upcoming');
  if (kinds.includes('dueSoon')) out.push('dueSoon');
  return out;
}

function svgIcon(kind) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '3');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  // check mark, or warning triangle with exclamation
  path.setAttribute('d', kind === 'unsuitable' ? 'M12 3 L22 20 H2 Z M12 9 V14 M12 17.5 V17.6' : 'M4 12.5 L9.5 18 L20 6');
  svg.append(path);
  return svg;
}

// ---------- persistence ----------
// The screen updates at once; each change is then written to the server in order. A failed write shows the notice, and the
// next change tries again. html[data-pending] counts writes still on their way (the tests wait for it to reach 0).
let saveChain = Promise.resolve();
let pendingSaves = 0;
function sendOp(op) {
  const base = `/api/charities/${encodeURIComponent(CID)}`;
  if (op.type === 'decision') return api(`${base}/decisions/${encodeURIComponent(op.id)}`, { method: 'PUT', json: op.value, keepalive: true });
  return api(`${base}/discovery-settings`, { method: 'PUT', json: op.patch, keepalive: true });
}
function commit(next) {
  if (next === state) return false;
  const ops = diffState(state, next);
  state = next;
  for (const op of ops) {
    pendingSaves += 1;
    document.documentElement.dataset.pending = String(pendingSaves);
    saveChain = saveChain.then(() => sendOp(op)).then(
      () => { storageOk = true; },
      () => { storageOk = false; },
    ).then(() => {
      pendingSaves -= 1;
      document.documentElement.dataset.pending = String(pendingSaves);
      updateNotice();
    });
  }
  return true;
}
document.documentElement.dataset.pending = '0';

// ---------- notes (REQ-039) ----------
const NOTE_DELAY_MS = 1000;
const NOTE_RETRY_MS = 5000;
const noteTimers = new Map(); // grantId -> timer for the next save
const noteSent = new Map(); // grantId -> the text last known saved on the server
const noteStatus = new Map(); // grantId -> 'saving' | 'saved' | 'failed'
const hasNote = (id) => Boolean(NOTES[id] && NOTES[id].text);
const savedNoteText = (id) => (noteSent.has(id) ? noteSent.get(id) : (SAVED_NOTES[id] || ''));

function showNoteStatus(id) {
  const el = document.querySelector(`[data-note-status="${CSS.escape(id)}"]`);
  if (!el) return;
  const st = noteStatus.get(id);
  el.textContent = st === 'saved' ? 'Saved' : st === 'failed' ? 'Not saved, will retry' : st === 'saving' ? 'Saving...' : '';
  el.dataset.state = st || '';
}

function refreshNoteMarker(id) {
  for (const li of document.querySelectorAll(`li.grant[data-id="${CSS.escape(id)}"]`)) {
    const box = li.querySelector('.markers');
    const cur = box && box.querySelector('.marker-notes');
    if (hasNote(id) && box && !cur) box.append(markerBadge('notes'));
    else if (!hasNote(id) && cur) cur.remove();
  }
}

function saveNote(id) {
  clearTimeout(noteTimers.get(id));
  noteTimers.delete(id);
  const text = hasNote(id) ? NOTES[id].text : '';
  if (text === savedNoteText(id)) return;
  noteStatus.set(id, 'saving');
  showNoteStatus(id);
  pendingSaves += 1;
  document.documentElement.dataset.pending = String(pendingSaves);
  saveChain = saveChain.then(() => api(`/api/charities/${encodeURIComponent(CID)}/notes/${encodeURIComponent(id)}`, { method: 'PUT', json: { text }, keepalive: true })).then(
    () => {
      storageOk = true;
      noteSent.set(id, text);
      noteStatus.set(id, (hasNote(id) ? NOTES[id].text : '') === text ? 'saved' : 'saving');
    },
    () => {
      noteStatus.set(id, 'failed');
      noteTimers.set(id, setTimeout(() => saveNote(id), NOTE_RETRY_MS));
    },
  ).then(() => {
    pendingSaves -= 1;
    document.documentElement.dataset.pending = String(pendingSaves);
    showNoteStatus(id);
    updateNotice();
  });
}

function noteEditor(grant) {
  const id = grant.id;
  const inputId = `note-${id}`;
  const ta = h('textarea', { id: inputId, rows: 4, maxlength: String(NOTE_MAX), 'data-testid': 'note-input', 'aria-describedby': `${inputId}-status` });
  ta.value = hasNote(id) ? NOTES[id].text : '';
  ta.addEventListener('input', () => {
    if (ta.value === '') delete NOTES[id];
    else NOTES[id] = { ...(NOTES[id] || {}), text: ta.value };
    refreshNoteMarker(id);
    noteStatus.delete(id);
    showNoteStatus(id);
    clearTimeout(noteTimers.get(id));
    noteTimers.set(id, setTimeout(() => saveNote(id), NOTE_DELAY_MS));
  });
  ta.addEventListener('blur', () => { if (noteTimers.has(id)) saveNote(id); });
  const status = h('span', { class: 'note-status', id: `${inputId}-status`, role: 'status', 'data-note-status': id, 'data-testid': 'note-status' });
  queueMicrotask(() => showNoteStatus(id));
  return h('div', { class: 'note-box' }, h('label', { for: inputId, text: 'Notes' }), ta, status);
}

window.addEventListener('pagehide', () => { for (const id of [...noteTimers.keys()]) saveNote(id); });

function updateNotice() {
  noticeEl.hidden = storageOk;
}

// ---------- announcements ----------
function announce(text, hash, linkText) {
  if (!hash) liveEl.replaceChildren(text);
  else liveEl.replaceChildren(text + ' ', h('a', { href: hash }, linkText));
}

function grantById(id) {
  return OPPS.find((g) => g.id === id);
}

function doAction(grantId, action) {
  const grant = grantById(grantId);
  if (action === 'abandon' && application.isRunActive(grantId)) {
    announce(`${grant.name} cannot be abandoned while its demo run is in progress. Wait for the run to finish.`);
    return;
  }
  const next = applyAction(state, OPPS, grantId, action);
  if (!commit(next)) return;
  let message;
  if (action === 'markSuitable') {
    message = { text: `${grant.name} marked suitable by manager override. It can now be watched or planned.`, hash: VIEW_HASH.new, link: 'Go to New' };
  } else {
    const dest = ACTION_RESULT[action];
    message = {
      text: `${grant.name} moved to ${VIEW_LABELS[dest]}.`,
      hash: VIEW_HASH[dest],
      link: `Go to ${VIEW_LABELS[dest]}`,
    };
  }
  pendingMessage = message;
  if (action === 'plan') {
    keepMessage = true;
    // G-001 has a real application workspace; every other grant keeps the Planning list.
    const dest = grantId === 'G-001' ? appHash(grantId) : VIEW_HASH.planning;
    if (location.hash !== dest) {
      location.hash = dest; // hashchange triggers render
      return;
    }
  }
  render();
}

function doFilter(hide) {
  if (commit(setHideUnsuitable(state, hide))) {
    pendingMessage = null;
    liveEl.replaceChildren();
    render();
  }
}

// ---------- rendering ----------
function suitabilityBadge(grant, entry) {
  const eff = effectiveSuitability(grant, entry);
  const text = eff === 'suitable' ? 'Suitable' : eff === 'unsuitable' ? 'Unsuitable' : 'Suitable - manager override';
  return h('span', { class: `badge ${eff}` }, svgIcon(eff), h('span', { text }));
}

function reasonText(grant, entry) {
  const eff = effectiveSuitability(grant, entry);
  if (eff === 'override') {
    return `Manager override: marked suitable by the fundraising manager. Original recommendation: ${grant.reason}`;
  }
  return grant.reason;
}

function grantItem(grant, entry, actionNames, showMarkers = false, extra = null) {
  const actions = actionNames.map((a) =>
    h('button', {
      type: 'button',
      class: BUTTON_CLASS[a] || 'btn',
      'data-action': a,
      'aria-label': `${ACTION_LABELS[a]}: ${grant.name}`,
      // Abandon is unavailable while a demo run for this grant is in progress (abandoning would not stop it).
      disabled: a === 'abandon' && application.isRunActive(grant.id) ? true : null,
      title: a === 'abandon' && application.isRunActive(grant.id) ? 'Unavailable while the demo run is in progress' : null,
      onclick: () => doAction(grant.id, a),
    }, ACTION_LABELS[a]),
  );
  const eff = effectiveSuitability(grant, entry);
  return h('li', { class: 'grant', 'data-id': grant.id, 'data-suitability': eff },
    h('div', { class: 'c-grant' },
      h('div', { class: 'name-row' }, h('h2', { text: grant.name }),
        h('span', { class: 'markers' }, [...(showMarkers ? markersFor(grant) : []), ...(hasNote(grant.id) ? ['notes'] : [])].map(markerBadge))),
      h('p', { class: 'funder', text: grant.funder }),
      h('p', { class: 'summary', text: grant.summary }),
      h('a', { class: 'link', href: grant.guidanceUrl, target: '_blank', rel: 'noopener noreferrer' }, `${grant.guidanceLabel} (opens in a new tab)`),
    ),
    h('div', { class: 'money' },
      h('p', { class: 'amount', text: grant.amount }),
      h('p', { class: 'timing', text: grant.timing }),
    ),
    h('div', { class: 'suit' },
      suitabilityBadge(grant, entry),
      h('p', { class: 'reason', text: reasonText(grant, entry) }),
    ),
    h('div', { class: 'actions' }, actions),
    extra ? h('div', { class: 'app-extra' }, extra(grant)) : null,
    h('details', null,
      h('summary', { text: 'Details and sources' }),
      h('div', null,
        h('p', null, h('strong', null, 'Original assessment: '), grant.assessment === 'suitable' ? 'Suitable' : 'Unsuitable'),
        h('p', { class: 'original-reason' }, h('strong', null, 'Original reason: '), grant.reason),
        eff === 'override' ? h('p', null, 'The manager override reflects a decision made in this workspace, not a change to the funder\'s rules.') : null,
        h('p', null, h('strong', null, 'Source evidence:')),
        h('ul', null, grant.sources.map((s) => h('li', null, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label)))),
        noteEditor(grant),
      ),
    ),
  );
}

function grantList(grants, actionsFor, showMarkers = false, extra = null) {
  return h('div', { class: 'grants-wrap' },
    h('div', { class: 'grants-head', 'aria-hidden': 'true' },
      h('span', { text: 'Grant' }), h('span', { text: 'Amount and timing' }), h('span', { text: 'Suitability' }), h('span', { text: 'Actions' })),
    h('ul', { class: 'grants', 'aria-label': 'Grants' },
      grants.map((g) => grantItem(g, state.grants[g.id], actionsFor(g, state.grants[g.id]), showMarkers, extra))),
  );
}

function searchActive() {
  return searchWords(searchText).length > 0;
}

function searchBar() {
  const input = h('input', { type: 'search', id: 'grant-search', 'data-testid': 'search', autocomplete: 'off', value: searchText });
  input.addEventListener('input', () => {
    searchText = input.value;
    render({ focus: false });
    const next = document.getElementById('grant-search');
    if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
  });
  return h('div', { class: 'search' }, h('label', { for: 'grant-search', text: 'Search grants' }), input);
}

function noMatch() {
  return h('div', { class: 'empty', 'data-testid': 'no-match' },
    h('p', null, h('strong', { text: `No grants match "${searchText}".` })),
    h('button', { type: 'button', class: 'btn', 'data-testid': 'clear-search', onclick: () => { searchText = ''; render({ focus: false }); document.getElementById('grant-search')?.focus(); } }, 'Clear search'));
}

function countLabel(view) {
  const inView = OPPS.filter((g) => state.grants[g.id] && state.grants[g.id].workflow === view);
  const total = inView.length;
  if (!searchActive()) return { text: String(total), aria: `${total} grants` };
  const m = filterGrants(inView, NOTES, searchText).length;
  return { text: `${m} of ${total}`, aria: `${m} of ${total} grants match` };
}

function renderDiscovery(view) {
  const counts = {};
  for (const v of ['new', 'watchlist', 'passed']) counts[v] = countLabel(v);
  const sel = selectView(state, OPPS, view);
  const filterable = view === 'new' || view === 'watchlist';

  const tabs = h('ul', { class: 'tabs', 'aria-label': 'Discovery views' },
    ['new', 'watchlist', 'passed'].map((v) =>
      h('li', null,
        h('a', { href: VIEW_HASH[v], 'aria-current': v === view ? 'page' : null, 'data-tab': v },
          VIEW_LABELS[v], h('span', { class: 'count', 'aria-label': counts[v].aria, text: counts[v].text })))),
  );

  const parts = [];
  if (previewTiming) {
    parts.push(h('p', { class: 'preview-notice', 'data-testid': 'preview-notice' },
      'Timing preview: the opening and closing dates used for markers on this page are synthetic examples, not funder dates. ',
      h('a', { href: location.pathname + (location.hash || DEFAULT_ROUTE) }, 'Back to the normal view')));
  }
  parts.push(tabs);
  parts.push(searchBar());

  if (filterable) {
    const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Suitability filter', 'data-testid': 'filter' },
      h('button', { type: 'button', 'data-filter': 'all', 'aria-pressed': String(!state.hideUnsuitable), onclick: () => doFilter(false) }, 'Show all'),
      h('button', { type: 'button', 'data-filter': 'hide', 'aria-pressed': String(state.hideUnsuitable), onclick: () => doFilter(true) }, 'Hide unsuitable'),
    );
    const toolbar = h('div', { class: 'toolbar' }, h('span', { class: 'filter-label', text: 'Suitability:' }), seg);
    if (sel.hiddenCount > 0) {
      toolbar.append(h('p', { class: 'hidden-note', 'data-testid': 'hidden-note' },
        h('span', { text: `${sel.hiddenCount} unsuitable hidden` }),
        h('button', { type: 'button', class: 'btn', 'data-testid': 'hidden-show-all', onclick: () => doFilter(false) }, 'Show all')));
    }
    parts.push(toolbar);
  }

  const shown = filterGrants(sel.visible, NOTES, searchText);
  if (shown.length > 0) {
    parts.push(grantList(shown, (g, e) => availableActions(g, e), true));
  } else if (searchActive() && sel.visible.length > 0) {
    parts.push(noMatch());
  } else if (sel.hiddenCount === 0) {
    parts.push(emptyState(view));
  }
  return parts;
}

function emptyState(view) {
  if (view === 'new') {
    return h('div', { class: 'empty', 'data-testid': 'empty' },
      h('p', null, h('strong', null, 'No grants waiting in New.')),
      h('p', null, 'Check the ', h('a', { href: VIEW_HASH.watchlist }, 'Watchlist'), ' or ', h('a', { href: VIEW_HASH.passed }, 'Passed'), ' tabs. A passed grant can be restored to New.'));
  }
  if (view === 'watchlist') {
    return h('div', { class: 'empty', 'data-testid': 'empty' },
      h('p', null, h('strong', null, 'Nothing on the Watchlist yet.')),
      h('p', null, 'Choose Watch on a suitable grant in New to keep it here.'));
  }
  return h('div', { class: 'empty', 'data-testid': 'empty' },
    h('p', null, h('strong', null, 'No passed grants.')),
    h('p', null, 'Grants you Pass or Abandon appear here, and can be restored to New.'));
}

function placeholderNotice() {
  return h('p', { class: 'placeholder-notice', text: 'Placeholder - future iteration' });
}

function templateSection(title, text) {
  return h('section', { class: 'template-section' }, h('h2', { text: title }), h('p', { text }));
}

function renderPlanning() {
  const sel = selectView(state, OPPS, 'planning');
  const parts = [
    placeholderNotice(),
    h('p', null, 'Grants you chose to plan an application for in Discovery appear here. Nothing on this page is submitted anywhere.'),
  ];
  const shown = filterGrants(sel.visible, NOTES, searchText);
  if (sel.visible.length > 0) parts.push(searchBar());
  if (shown.length > 0) {
    parts.push(grantList(shown, () => ['abandon'], false, (g) => (g.id === 'G-001'
      ? application.planningCard(g.id)
      : h('p', { class: 'app-unavailable', 'data-testid': 'app-unavailable', text: UNAVAILABLE_TEXT }))));
  } else if (sel.visible.length > 0) {
    parts.push(noMatch());
  } else {
    parts.push(h('div', { class: 'empty', 'data-testid': 'empty' },
      h('p', null, h('strong', null, 'No grants selected for planning.')),
      h('p', null, 'Select a suitable grant from ', h('a', { href: VIEW_HASH.new }, 'Discovery'), ' and choose Plan application.')));
  }
  parts.push(h('div', { class: 'template-grid' },
    templateSection('Application preparation', 'Future iteration: this section will help the team gather the documents, budget and project description a funder asks for. It is a description only and has no fields yet.'),
    templateSection('Submission', 'Future iteration: this section will record how and when an application is sent to the funder. Nothing can be submitted from this demo.')));
  return parts;
}

// Demo receipts and attempt history (S3-001). Funding outcomes remain out of scope.
function renderTracking() {
  return [application.trackingView()];
}

function renderNav(route) {
  const items = [
    ['Discovery', VIEW_HASH.new, route.area === 'discovery'],
    ['Planning & submission', VIEW_HASH.planning, route.area === 'planning' || route.area === 'application'],
    ['Tracking', '#/tracking', route.area === 'tracking'],
  ];
  navEl.setAttribute('aria-label', 'Main');
  navEl.replaceChildren(...items.map(([label, href, current]) =>
    h('a', { href, 'aria-current': current ? 'page' : null }, label)));
}

function currentRoute() {
  const hash = location.hash;
  if (ROUTES[hash]) return ROUTES[hash];
  const org = isOrgHash(hash) ? parseOrgHash(hash) : null;
  if (org) return { area: 'organisation', org };
  const app = isApplicationHash(hash) ? parseApplicationHash(hash) : null;
  if (app) return { area: 'application', app };
  return ROUTES[DEFAULT_ROUTE];
}

function isKnownHash(hash) {
  return Boolean(ROUTES[hash] || (isOrgHash(hash) && parseOrgHash(hash)) || (isApplicationHash(hash) && parseApplicationHash(hash)));
}

function fallbackHash(hash) {
  if (isApplicationHash(hash)) return VIEW_HASH.planning;
  return isOrgHash(hash) ? ORG_HOME : DEFAULT_ROUTE;
}

// The organisation area (#/organisation...) lives in js/org/ and renders itself into <main>.
const organisation = createOrganisation({
  services,
  mount: mainEl,
  titleEl,
  now,
  announce: (text) => announce(text),
  announceNext: (text) => { pendingMessage = { text }; },
  navigate: (hash) => {
    if (location.hash === hash) render();
    else location.hash = hash; // hashchange triggers render
  },
});

// The application workspace (#/planning/<grant>/application...) lives in js/application/ and renders itself into <main>.
const application = createApplication({
  services,
  applicationDefaults: APPLICATION_DEFAULTS,
  funderPages: workspace.funderPages || [],
  mount: mainEl,
  titleEl,
  now,
  announce: (text) => announce(text),
  navigate: (hash) => {
    if (location.hash === hash) render();
    else location.hash = hash; // hashchange triggers render
  },
  getGrant: (id) => {
    const g = grantById(id);
    const e = state.grants[id];
    return g && e ? { id, name: g.name, funder: g.funder, funderPageId: g.funderPageId || null, workflow: e.workflow } : null;
  },
});

// Re-render Planning when a demo run starts or ends, so Abandon and the card status follow it.
application.onRunChange((run) => {
  if ((run.phase !== 'running' || run.events.length === 0) && currentRoute().area === 'planning') render({ focus: false });
});

function setBrandActive(on) {
  if (on) brandLink.setAttribute('aria-current', 'page');
  else brandLink.removeAttribute('aria-current');
}

function render(opts = {}) {
  const route = currentRoute();
  renderNav(route);
  if (route.area === 'application') {
    clearTimeout(tickTimer);
    tickTimer = null;
    organisation.hide();
    setBrandActive(false);
    panelEl.hidden = true;
    updateNotice();
    if (pendingMessage) {
      announce(pendingMessage.text, pendingMessage.hash, pendingMessage.link);
      pendingMessage = null;
    }
    application.show(route.app, { focus: opts.focus !== false });
    return;
  }
  if (route.area === 'organisation') {
    application.hide();
    clearTimeout(tickTimer);
    tickTimer = null;
    setBrandActive(true);
    panelEl.hidden = true;
    if (pendingMessage) {
      announce(pendingMessage.text, pendingMessage.hash, pendingMessage.link);
      pendingMessage = null;
    }
    organisation.show(route.org, { focus: opts.focus !== false });
    return;
  }
  organisation.hide();
  application.hide();
  setBrandActive(false);
  let parts;
  if (route.area === 'discovery') parts = renderDiscovery(route.view);
  else if (route.area === 'planning') parts = renderPlanning();
  else parts = renderTracking();
  titleEl.textContent = AREA_TITLES[route.area];
  panelEl.hidden = route.area !== 'discovery';
  mainEl.replaceChildren(...parts);
  updateNotice();
  if (pendingMessage) {
    announce(pendingMessage.text, pendingMessage.hash, pendingMessage.link);
    pendingMessage = null;
  }
  if (opts.focus !== false && document.activeElement !== briefEl) titleEl.focus({ preventScroll: true });
  scheduleTick();
}

// ---------- AI discovery panel (static markup in index.html, updated in place, never re-created) ----------
const BRIEF_HELP_ID = 'brief-help';
const SAVE_DELAY_MS = 400;
let saveTimer = null;
let busy = false;

briefEl.value = typeof state.brief === 'string' ? state.brief : '';

function saveBrief() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const text = briefEl.value;
  if (text === (typeof state.brief === 'string' ? state.brief : '')) return;
  commit(setBrief(state, text));
  updateNotice();
}

function showBriefError(message) {
  briefErrorEl.textContent = message;
  briefErrorEl.hidden = !message;
  if (message) {
    briefEl.setAttribute('aria-invalid', 'true');
    briefEl.setAttribute('aria-describedby', BRIEF_HELP_ID + ' brief-error');
  } else {
    briefEl.removeAttribute('aria-invalid');
    briefEl.setAttribute('aria-describedby', BRIEF_HELP_ID);
  }
}

function setBusy(on) {
  busy = on;
  discoverBtn.disabled = on;
  briefEl.readOnly = on;
  aiStatusEl.replaceChildren();
  if (on) aiStatusEl.append(h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', { text: 'Discovering grants...' }));
}

briefEl.addEventListener('input', () => {
  if (busy) return;
  showBriefError('');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBrief, SAVE_DELAY_MS);
});
window.addEventListener('pagehide', saveBrief);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveBrief();
  else if (currentRoute().area !== 'organisation' && currentRoute().area !== 'application') render({ focus: false });
});

function showFreshResult(grantId) {
  pendingMessage = { text: 'Demo discovery complete - 1 grant marked as new.' };
  if (location.hash !== VIEW_HASH.new) {
    keepMessage = true;
    location.hash = VIEW_HASH.new; // hashchange triggers render
  } else {
    render();
  }
  const el = document.querySelector('li.grant[data-id="' + grantId + '"]');
  if (el) el.scrollIntoView({ block: 'nearest' });
}

async function onDiscover() {
  if (busy) return;
  saveBrief();
  const brief = briefEl.value;
  if (brief.trim() === '') {
    showBriefError('Enter your discovery criteria first.');
    briefEl.focus();
    return;
  }
  showBriefError('');
  setBusy(true);
  let failed = false;
  try {
    await runDiscovery({ brief, delayMs: 1000 });
  } catch {
    failed = true;
  }
  setBusy(false);
  if (failed) {
    announce('Discovery could not be completed. Please try again.');
    discoverBtn.focus();
    return;
  }
  const result = applyDiscovery(state, OPPS);
  if (result.grantId === null) {
    announce('No demo grant available to rediscover. Restore a suitable grant to New to repeat the demo.');
    discoverBtn.focus();
    return;
  }
  commit(result.state);
  updateNotice();
  showFreshResult(result.grantId);
}
discoverBtn.addEventListener('click', onDiscover);

// ---------- marker refresh at the next London midnight or closing instant ----------
let tickTimer = null;
function scheduleTick() {
  clearTimeout(tickTimer);
  tickTimer = null;
  if (injectedNow) return; // a fixed test clock never advances
  const t = now();
  const delay = Math.min(Math.max(nextChangeAt(OPPS, t).getTime() - t.getTime() + 250, 1000), 2 ** 31 - 1);
  tickTimer = setTimeout(() => render({ focus: false }), delay);
}

let shownHash = null; // the hash of the route currently on screen
let leaving = false; // a "leave without saving?" dialog is open

window.addEventListener('hashchange', async () => {
  if (!isKnownHash(location.hash)) {
    history.replaceState(null, '', fallbackHash(location.hash));
  }
  if (leaving) return;
  // Leaving the application area: its autosave is flushed first; only a failed save asks before discarding.
  if (application.isDirty() && location.hash !== shownHash && !isApplicationHash(location.hash)) {
    leaving = true;
    const saved = await application.flush();
    const leave = saved ? true : await application.confirmLeave();
    leaving = false;
    if (!leave) {
      history.replaceState(null, '', shownHash); // stay: the answers are untouched
      return;
    }
    application.discard();
  }
  if (organisation.isDirty() && location.hash !== shownHash) {
    leaving = true;
    const leave = await organisation.confirmLeave();
    leaving = false;
    if (!leave) {
      history.replaceState(null, '', shownHash); // stay: the form and its input are untouched
      return;
    }
    organisation.discard();
  }
  shownHash = location.hash;
  if (!keepMessage && !pendingMessage) liveEl.replaceChildren();
  keepMessage = false;
  render();
});

if (!isKnownHash(location.hash)) history.replaceState(null, '', fallbackHash(location.hash));
shownHash = location.hash;
render({ focus: false });
