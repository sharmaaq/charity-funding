// Pure state logic: no DOM access. Imported by the browser app and the Node unit tests.

export const VERSION = 1;
export const WORKFLOWS = ['new', 'watchlist', 'passed', 'planning'];
export const ACTIONS = ['watch', 'plan', 'pass', 'restore', 'markSuitable', 'abandon'];

export function initialState(fixtures) {
  const grants = {};
  for (const g of fixtures) grants[g.id] = { workflow: 'new', override: false };
  return { version: VERSION, hideUnsuitable: false, grants };
}

export function effectiveSuitability(grant, entry) {
  if (grant.assessment === 'suitable') return 'suitable';
  return entry && entry.override ? 'override' : 'unsuitable';
}

export function availableActions(grant, entry) {
  if (!entry) return [];
  const suitable = effectiveSuitability(grant, entry) !== 'unsuitable';
  switch (entry.workflow) {
    case 'new':
      return suitable ? ['watch', 'plan', 'pass'] : ['markSuitable', 'pass'];
    case 'watchlist':
      return suitable ? ['plan', 'pass'] : ['pass'];
    case 'passed':
      return ['restore'];
    case 'planning':
      return ['abandon'];
    default:
      return [];
  }
}

const TARGET = { watch: 'watchlist', plan: 'planning', pass: 'passed', restore: 'new', abandon: 'passed' };

export function applyAction(state, fixtures, grantId, action) {
  const grant = fixtures.find((g) => g.id === grantId);
  const entry = state.grants[grantId];
  if (!grant || !entry) return state;
  if (!availableActions(grant, entry).includes(action)) return state;
  const next = action === 'markSuitable' ? { ...entry, override: true } : { ...entry, workflow: TARGET[action] };
  const result = { ...state, grants: { ...state.grants, [grantId]: next } };
  if (state.freshId === grantId) delete result.freshId; // the manager acted on the freshly discovered grant
  return result;
}

// The grant a demo discovery run marks as New: the first in fixture order that is still
// in the New workflow state and not effectively unsuitable.
export function discoveryCandidate(state, fixtures) {
  const found = fixtures.find((g) => {
    const e = state.grants[g.id];
    return e && e.workflow === 'new' && effectiveSuitability(g, e) !== 'unsuitable';
  });
  return found ? found.id : null;
}

export function applyDiscovery(state, fixtures) {
  const grantId = discoveryCandidate(state, fixtures);
  if (!grantId) return { state, grantId: null };
  if (state.freshId === grantId) return { state, grantId };
  return { state: { ...state, freshId: grantId }, grantId };
}

export function setBrief(state, text) {
  if (state.brief === text) return state;
  return { ...state, brief: text };
}

export function setHideUnsuitable(state, value) {
  const hide = Boolean(value);
  if (state.hideUnsuitable === hide) return state;
  return { ...state, hideUnsuitable: hide };
}

export function selectView(state, fixtures, view) {
  const inView = fixtures.filter((g) => state.grants[g.id] && state.grants[g.id].workflow === view);
  const filtered = state.hideUnsuitable && (view === 'new' || view === 'watchlist');
  const visible = filtered
    ? inView.filter((g) => effectiveSuitability(g, state.grants[g.id]) !== 'unsuitable')
    : inView;
  return { visible, hiddenCount: inView.length - visible.length, total: inView.length };
}

// The saved workspace (what GET /api/charities/{cid}/workspace returns) as the state object the screens use.
export function stateFromWorkspace(ws) {
  const grants = {};
  for (const o of ws.opportunities || []) {
    const e = (ws.grants || {})[o.id] || {};
    grants[o.id] = { workflow: WORKFLOWS.includes(e.workflow) ? e.workflow : 'new', override: e.override === true };
  }
  const state = { version: VERSION, hideUnsuitable: ws.hideUnsuitable === true, grants };
  if (typeof ws.freshId === 'string' && grants[ws.freshId]) state.freshId = ws.freshId;
  if (typeof ws.brief === 'string') state.brief = ws.brief;
  return state;
}

// The writes needed to turn `prev` into `next`: one decision per changed grant (separate records, so two people
// deciding on different grants never overwrite each other) and one settings patch for brief, filter and fresh marker.
export function diffState(prev, next) {
  const ops = [];
  for (const [id, e] of Object.entries(next.grants)) {
    const p = prev.grants[id];
    if (!p || p.workflow !== e.workflow || p.override !== e.override) ops.push({ type: 'decision', id, value: { workflow: e.workflow, override: e.override } });
  }
  const patch = {};
  if (prev.hideUnsuitable !== next.hideUnsuitable) patch.hideUnsuitable = next.hideUnsuitable;
  if ((prev.brief ?? null) !== (next.brief ?? null) && typeof next.brief === 'string') patch.brief = next.brief;
  if ((prev.freshId ?? null) !== (next.freshId ?? null)) patch.freshId = next.freshId ?? null;
  if (Object.keys(patch).length) ops.push({ type: 'settings', patch });
  return ops;
}
