import { FIXTURES } from './fixtures.js';
import {
  availableActions,
  applyAction,
  effectiveSuitability,
  load,
  save,
  selectView,
  setHideUnsuitable,
} from './state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = getStorage();
const loaded = load(storage, FIXTURES);
let state = loaded.state;
let storageOk = loaded.storageAvailable;

const mainEl = document.getElementById('main');
const navEl = document.getElementById('main-nav');
const liveEl = document.getElementById('live');
const noticeEl = document.getElementById('storage-notice');
const titleEl = document.getElementById('view-heading');

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
function commit(next) {
  if (next === state) return false;
  state = next;
  if (storageOk && !save(storage, state)) storageOk = false;
  return true;
}

function updateNotice() {
  noticeEl.hidden = storageOk;
}

// ---------- announcements ----------
function announce(text, hash, linkText) {
  liveEl.replaceChildren(text + ' ', h('a', { href: hash }, linkText));
}

function grantById(id) {
  return FIXTURES.find((g) => g.id === id);
}

function doAction(grantId, action) {
  const grant = grantById(grantId);
  const next = applyAction(state, FIXTURES, grantId, action);
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
    if (location.hash !== VIEW_HASH.planning) {
      location.hash = VIEW_HASH.planning; // hashchange triggers render
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

function grantItem(grant, entry, actionNames) {
  const actions = actionNames.map((a) =>
    h('button', {
      type: 'button',
      class: BUTTON_CLASS[a] || 'btn',
      'data-action': a,
      'aria-label': `${ACTION_LABELS[a]}: ${grant.name}`,
      onclick: () => doAction(grant.id, a),
    }, ACTION_LABELS[a]),
  );
  const eff = effectiveSuitability(grant, entry);
  return h('li', { class: 'grant', 'data-id': grant.id, 'data-suitability': eff },
    h('div', { class: 'c-grant' },
      h('h2', { text: grant.name }),
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
    h('details', null,
      h('summary', { text: 'Details and sources' }),
      h('div', null,
        h('p', null, h('strong', null, 'Original assessment: '), grant.assessment === 'suitable' ? 'Suitable' : 'Unsuitable'),
        h('p', { class: 'original-reason' }, h('strong', null, 'Original reason: '), grant.reason),
        eff === 'override' ? h('p', null, 'The manager override reflects a decision in this browser, not a change to the funder\'s rules.') : null,
        h('p', null, h('strong', null, 'Source evidence:')),
        h('ul', null, grant.sources.map((s) => h('li', null, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label)))),
      ),
    ),
  );
}

function grantList(grants, actionsFor) {
  return h('div', { class: 'grants-wrap' },
    h('div', { class: 'grants-head', 'aria-hidden': 'true' },
      h('span', { text: 'Grant' }), h('span', { text: 'Amount and timing' }), h('span', { text: 'Suitability' }), h('span', { text: 'Actions' })),
    h('ul', { class: 'grants', 'aria-label': 'Grants' },
      grants.map((g) => grantItem(g, state.grants[g.id], actionsFor(g, state.grants[g.id])))),
  );
}

function renderDiscovery(view) {
  const counts = {};
  for (const v of ['new', 'watchlist', 'passed']) counts[v] = selectView(state, FIXTURES, v).total;
  const sel = selectView(state, FIXTURES, view);
  const filterable = view === 'new' || view === 'watchlist';

  const tabs = h('ul', { class: 'tabs', 'aria-label': 'Discovery views' },
    ['new', 'watchlist', 'passed'].map((v) =>
      h('li', null,
        h('a', { href: VIEW_HASH[v], 'aria-current': v === view ? 'page' : null, 'data-tab': v },
          VIEW_LABELS[v], h('span', { class: 'count', 'aria-label': `${counts[v]} grants`, text: String(counts[v]) })))),
  );

  const parts = [tabs];

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

  if (sel.visible.length > 0) {
    parts.push(grantList(sel.visible, (g, e) => availableActions(g, e)));
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
  const sel = selectView(state, FIXTURES, 'planning');
  const parts = [
    placeholderNotice(),
    h('p', null, 'Grants you chose to plan an application for in Discovery appear here. Nothing on this page is submitted anywhere.'),
  ];
  if (sel.visible.length > 0) {
    parts.push(grantList(sel.visible, () => ['abandon']));
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

function renderTracking() {
  return [
    placeholderNotice(),
    h('p', null, 'Applications and funding outcomes will be followed here in a later iteration. There are no records in this demo.'),
    h('div', { class: 'template-grid' },
      templateSection('Application status', 'Future iteration: submitted applications and their status will be listed here. Nothing has been submitted.'),
      templateSection('Outcomes', 'Future iteration: funding decisions and awarded amounts will be shown here. No outcomes exist in this demo.')),
  ];
}

function renderNav(route) {
  const items = [
    ['Discovery', VIEW_HASH.new, route.area === 'discovery'],
    ['Planning & submission', VIEW_HASH.planning, route.area === 'planning'],
    ['Tracking', '#/tracking', route.area === 'tracking'],
  ];
  navEl.setAttribute('aria-label', 'Main');
  navEl.replaceChildren(...items.map(([label, href, current]) =>
    h('a', { href, 'aria-current': current ? 'page' : null }, label)));
}

function currentRoute() {
  const hash = location.hash;
  if (ROUTES[hash]) return ROUTES[hash];
  return ROUTES[DEFAULT_ROUTE];
}

function render(opts = {}) {
  const route = currentRoute();
  renderNav(route);
  let parts;
  if (route.area === 'discovery') parts = renderDiscovery(route.view);
  else if (route.area === 'planning') parts = renderPlanning();
  else parts = renderTracking();
  titleEl.textContent = AREA_TITLES[route.area];
  mainEl.replaceChildren(...parts);
  updateNotice();
  if (pendingMessage) {
    announce(pendingMessage.text, pendingMessage.hash, pendingMessage.link);
    pendingMessage = null;
  }
  if (opts.focus !== false) titleEl.focus({ preventScroll: true });
}

window.addEventListener('hashchange', () => {
  if (!ROUTES[location.hash]) {
    history.replaceState(null, '', DEFAULT_ROUTE);
  }
  if (!keepMessage && !pendingMessage) liveEl.replaceChildren();
  keepMessage = false;
  render();
});

if (!ROUTES[location.hash]) history.replaceState(null, '', DEFAULT_ROUTE);
render({ focus: false });
