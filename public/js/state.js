// Pure state logic: no DOM access. Imported by the browser app and the Node unit tests.

export const STORAGE_KEY = 'charity-funding.demo.v1';
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
  return { ...state, grants: { ...state.grants, [grantId]: next } };
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

function validState(data, fixtures) {
  if (!data || typeof data !== 'object' || data.version !== VERSION) return false;
  if (typeof data.hideUnsuitable !== 'boolean') return false;
  if (!data.grants || typeof data.grants !== 'object') return false;
  for (const g of fixtures) {
    const e = data.grants[g.id];
    if (!e || typeof e !== 'object') return false;
    if (!WORKFLOWS.includes(e.workflow) || typeof e.override !== 'boolean') return false;
  }
  return true;
}

export function load(storage, fixtures) {
  let raw;
  try {
    if (!storage) return { state: initialState(fixtures), storageAvailable: false };
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: initialState(fixtures), storageAvailable: false };
  }
  if (raw === null || raw === undefined) return { state: initialState(fixtures), storageAvailable: true };
  try {
    const data = JSON.parse(raw);
    if (validState(data, fixtures)) {
      // Keep only known grants: exactly one entry per fixture ID.
      const grants = {};
      for (const g of fixtures) {
        grants[g.id] = { workflow: data.grants[g.id].workflow, override: data.grants[g.id].override };
      }
      return { state: { version: VERSION, hideUnsuitable: data.hideUnsuitable, grants }, storageAvailable: true };
    }
  } catch {
    // fall through: unreadable data is discarded
  }
  return { state: initialState(fixtures), storageAvailable: true };
}

export function save(storage, state) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
