import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../public/js/fixtures.js';
import {
  STORAGE_KEY,
  ACTIONS,
  initialState,
  effectiveSuitability,
  availableActions,
  applyAction,
  setHideUnsuitable,
  selectView,
  load,
  save,
} from '../../public/js/state.js';

const grantOf = (id) => FIXTURES.find((g) => g.id === id);
const act = (s, id, a) => applyAction(s, FIXTURES, id, a);
const wf = (s, id) => s.grants[id].workflow;

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}
const throwingStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

test('initial state: six in New, filter off, no overrides', () => {
  const s = initialState(FIXTURES);
  assert.equal(Object.keys(s.grants).length, 6);
  assert.equal(s.hideUnsuitable, false);
  for (const g of FIXTURES) assert.deepEqual(s.grants[g.id], { workflow: 'new', override: false });
  assert.equal(selectView(s, FIXTURES, 'new').visible.length, 6);
});

test('effective suitability', () => {
  const s = initialState(FIXTURES);
  assert.equal(effectiveSuitability(grantOf('G-001'), s.grants['G-001']), 'suitable');
  assert.equal(effectiveSuitability(grantOf('G-004'), s.grants['G-004']), 'unsuitable');
  assert.equal(effectiveSuitability(grantOf('G-004'), { workflow: 'new', override: true }), 'override');
});

test('transition table: every allowed row', () => {
  const s0 = initialState(FIXTURES);
  // watch: new -> watchlist
  assert.equal(wf(act(s0, 'G-001', 'watch'), 'G-001'), 'watchlist');
  // plan: new -> planning, watchlist -> planning
  assert.equal(wf(act(s0, 'G-001', 'plan'), 'G-001'), 'planning');
  assert.equal(wf(act(act(s0, 'G-001', 'watch'), 'G-001', 'plan'), 'G-001'), 'planning');
  // pass: new -> passed, watchlist -> passed
  assert.equal(wf(act(s0, 'G-001', 'pass'), 'G-001'), 'passed');
  assert.equal(wf(act(act(s0, 'G-001', 'watch'), 'G-001', 'pass'), 'G-001'), 'passed');
  // markSuitable: stays in new, override set
  const m = act(s0, 'G-004', 'markSuitable');
  assert.deepEqual(m.grants['G-004'], { workflow: 'new', override: true });
  // restore: passed -> new
  assert.equal(wf(act(act(s0, 'G-001', 'pass'), 'G-001', 'restore'), 'G-001'), 'new');
  // abandon: planning -> passed
  assert.equal(wf(act(act(s0, 'G-001', 'plan'), 'G-001', 'abandon'), 'G-001'), 'passed');
});

test('every disallowed action leaves state unchanged (same reference)', () => {
  const s0 = initialState(FIXTURES);
  const states = {
    newSuitable: [s0, 'G-001'],
    newUnsuitable: [s0, 'G-004'],
    watchlist: [act(s0, 'G-001', 'watch'), 'G-001'],
    passed: [act(s0, 'G-001', 'pass'), 'G-001'],
    planning: [act(s0, 'G-001', 'plan'), 'G-001'],
    overridden: [act(s0, 'G-004', 'markSuitable'), 'G-004'],
  };
  let checked = 0;
  for (const [, [s, id]] of Object.entries(states)) {
    const grant = grantOf(id);
    const allowed = availableActions(grant, s.grants[id]);
    for (const a of ACTIONS) {
      if (allowed.includes(a)) continue;
      assert.strictEqual(act(s, id, a), s, `${a} on ${JSON.stringify(s.grants[id])} ${id}`);
      checked++;
    }
  }
  assert.ok(checked > 15);
  // Unknown grant and unknown action
  assert.strictEqual(act(s0, 'G-999', 'pass'), s0);
  assert.strictEqual(act(s0, 'G-001', 'bogus'), s0);
  // Unsuitable grant cannot reach Watchlist or Planning without an override
  assert.strictEqual(act(s0, 'G-004', 'watch'), s0);
  assert.strictEqual(act(s0, 'G-004', 'plan'), s0);
  // markSuitable is only for an unsuitable grant without an override
  assert.strictEqual(act(s0, 'G-001', 'markSuitable'), s0);
  const over = act(s0, 'G-004', 'markSuitable');
  assert.strictEqual(act(over, 'G-004', 'markSuitable'), over);
});

test('available actions follow the spec table', () => {
  const s0 = initialState(FIXTURES);
  assert.deepEqual(availableActions(grantOf('G-001'), s0.grants['G-001']), ['watch', 'plan', 'pass']);
  assert.deepEqual(availableActions(grantOf('G-004'), s0.grants['G-004']), ['markSuitable', 'pass']);
  assert.deepEqual(availableActions(grantOf('G-001'), act(s0, 'G-001', 'watch').grants['G-001']), ['plan', 'pass']);
  assert.deepEqual(availableActions(grantOf('G-001'), act(s0, 'G-001', 'pass').grants['G-001']), ['restore']);
  assert.deepEqual(availableActions(grantOf('G-001'), act(s0, 'G-001', 'plan').grants['G-001']), ['abandon']);
});

test('unsuitable: Watch and Plan unavailable until Mark suitable; reason stays on fixture', () => {
  const s0 = initialState(FIXTURES);
  const g = grantOf('G-004');
  const before = availableActions(g, s0.grants['G-004']);
  assert.ok(!before.includes('watch') && !before.includes('plan'));
  const s1 = act(s0, 'G-004', 'markSuitable');
  const after = availableActions(g, s1.grants['G-004']);
  assert.ok(after.includes('watch') && after.includes('plan') && after.includes('pass'));
  assert.ok(!after.includes('markSuitable'));
  assert.equal(effectiveSuitability(g, s1.grants['G-004']), 'override');
  assert.equal(g.assessment, 'unsuitable');
  assert.match(g.reason, /500,000/);
  const s2 = act(act(s1, 'G-004', 'watch'), 'G-004', 'plan');
  assert.equal(wf(s2, 'G-004'), 'planning');
});

test('Pass then Restore keeps the override; Plan, Abandon, Restore returns to New', () => {
  let s = act(initialState(FIXTURES), 'G-004', 'markSuitable');
  s = act(act(s, 'G-004', 'pass'), 'G-004', 'restore');
  assert.deepEqual(s.grants['G-004'], { workflow: 'new', override: true });
  s = act(act(act(s, 'G-004', 'plan'), 'G-004', 'abandon'), 'G-004', 'restore');
  assert.deepEqual(s.grants['G-004'], { workflow: 'new', override: true });
  const t = act(act(act(initialState(FIXTURES), 'G-002', 'plan'), 'G-002', 'abandon'), 'G-002', 'restore');
  assert.equal(wf(t, 'G-002'), 'new');
});

test('repeating any action leaves exactly one entry per grant ID', () => {
  for (const a of ACTIONS) {
    for (const g of FIXTURES) {
      let s = initialState(FIXTURES);
      for (let i = 0; i < 4; i++) s = act(s, g.id, a);
      assert.equal(Object.keys(s.grants).length, 6);
      const total = ['new', 'watchlist', 'passed', 'planning'].reduce(
        (n, v) => n + selectView(s, FIXTURES, v).total,
        0,
      );
      assert.equal(total, 6);
    }
  }
  // double Plan: second is a no-op
  const once = act(initialState(FIXTURES), 'G-001', 'plan');
  assert.strictEqual(act(once, 'G-001', 'plan'), once);
});

test('actions do not mutate the previous state', () => {
  const s0 = initialState(FIXTURES);
  const snapshot = JSON.stringify(s0);
  act(s0, 'G-001', 'pass');
  act(s0, 'G-004', 'markSuitable');
  setHideUnsuitable(s0, true);
  assert.equal(JSON.stringify(s0), snapshot);
});

test('filter: New shows three, hiddenCount 3, total 6; toggling changes no workflow state', () => {
  const s0 = initialState(FIXTURES);
  const s1 = setHideUnsuitable(s0, true);
  const v = selectView(s1, FIXTURES, 'new');
  assert.deepEqual(v.visible.map((g) => g.id), ['G-001', 'G-002', 'G-003']);
  assert.equal(v.hiddenCount, 3);
  assert.equal(v.total, 6);
  assert.deepEqual(s1.grants, s0.grants);
  assert.deepEqual(setHideUnsuitable(s1, false).grants, s0.grants);
  assert.strictEqual(setHideUnsuitable(s1, true), s1);
});

test('filter: Passed and Planning are unfiltered; overridden grants stay visible', () => {
  let s = setHideUnsuitable(initialState(FIXTURES), true);
  s = act(s, 'G-005', 'pass');
  const passed = selectView(s, FIXTURES, 'passed');
  assert.equal(passed.visible.length, 1);
  assert.equal(passed.hiddenCount, 0);
  const nw = selectView(s, FIXTURES, 'new');
  assert.equal(nw.total, 5);
  assert.equal(nw.hiddenCount, 2);
  s = act(s, 'G-004', 'markSuitable');
  const nw2 = selectView(s, FIXTURES, 'new');
  assert.ok(nw2.visible.some((g) => g.id === 'G-004'));
  assert.equal(nw2.hiddenCount, 1);
  assert.equal(nw2.total, 5);
  // watchlist hides nothing when empty
  assert.deepEqual(selectView(s, FIXTURES, 'watchlist'), { visible: [], hiddenCount: 0, total: 0 });
});

test('save then load round-trips', () => {
  const st = memoryStorage();
  let s = initialState(FIXTURES);
  s = act(act(s, 'G-004', 'markSuitable'), 'G-001', 'watch');
  s = setHideUnsuitable(s, true);
  assert.equal(save(st, s), true);
  assert.ok(STORAGE_KEY in st.data);
  const r = load(st, FIXTURES);
  assert.equal(r.storageAvailable, true);
  assert.deepEqual(r.state, s);
});

test('missing, corrupt, wrong-version, incomplete data and throwing storage all give a usable state', () => {
  const init = initialState(FIXTURES);
  assert.deepEqual(load(memoryStorage(), FIXTURES), { state: init, storageAvailable: true });
  assert.deepEqual(load(memoryStorage({ [STORAGE_KEY]: '{not json' }), FIXTURES).state, init);
  assert.deepEqual(load(memoryStorage({ [STORAGE_KEY]: 'null' }), FIXTURES).state, init);
  const wrong = JSON.stringify({ ...act(init, 'G-001', 'pass'), version: 2 });
  assert.deepEqual(load(memoryStorage({ [STORAGE_KEY]: wrong }), FIXTURES).state, init);
  const missing = act(init, 'G-001', 'pass');
  delete missing.grants['G-006'];
  assert.deepEqual(load(memoryStorage({ [STORAGE_KEY]: JSON.stringify(missing) }), FIXTURES).state, init);
  const badWf = JSON.parse(JSON.stringify(init));
  badWf.grants['G-001'].workflow = 'bogus';
  assert.deepEqual(load(memoryStorage({ [STORAGE_KEY]: JSON.stringify(badWf) }), FIXTURES).state, init);

  const r = load(throwingStorage, FIXTURES);
  assert.equal(r.storageAvailable, false);
  assert.deepEqual(r.state, init);
  assert.equal(save(throwingStorage, init), false);
  assert.equal(load(null, FIXTURES).storageAvailable, false);
  assert.equal(save(null, init), false);
});
