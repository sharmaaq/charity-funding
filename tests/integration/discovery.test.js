import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.js';
import { createFakeRunner } from '../../server/ai/fake-runner.js';

const CID = 'your-place';
const base = `/api/charities/${CID}`;

// One server for the file. `runner` is swapped per test; its calls are recorded.
let h;
let runner;
const ai = { runAI: (choice, opts) => runner(choice, opts) };
test.before(async () => { h = await startHarness({ ai }); });
test.after(() => h.close());
test.beforeEach(() => { runner = createFakeRunner({ delayMs: 5 }); });

async function events(user, jobId, cid = CID) {
  const res = await h.call(user, 'GET', `/api/charities/${cid}/jobs/${jobId}/events`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  return res.bytes.toString().split('\n\n').filter((b) => b.startsWith('data:')).map((b) => JSON.parse(b.slice(5)));
}
const ws = async (user = 'a', cid = CID) => (await h.call(user, 'GET', `/api/charities/${cid}/workspace`)).body;
async function discover(user = 'a', json = {}) {
  const res = await h.call(user, 'POST', `${base}/discover`, { json });
  if (res.status !== 200) return { res };
  return { res, evs: await events(user, res.body.jobId) };
}

test('a run adds new AI cards, updates a matching card, keeps decisions, and records what was searched', async () => {
  await h.call('a', 'PUT', `${base}/decisions/G-002`, { json: { workflow: 'watchlist', override: false } });
  const before = await ws();
  const { res, evs } = await discover();
  assert.equal(res.status, 200);
  assert.deepEqual(evs.at(-1), { type: 'done', result: { new: 2, updated: 1, dropped: 1 } });
  assert.ok(evs.some((e) => e.type === 'tool' && e.detail === 'fake grants for charities'));
  const w = await ws();
  assert.equal(w.opportunities.length, before.opportunities.length + 2);
  const g2 = w.opportunities.find((o) => o.id === 'G-002');
  const g2before = before.opportunities.find((o) => o.id === 'G-002');
  assert.equal(g2.fitScore, 71);
  assert.deepEqual(g2.barriers, ['Needs a qualifying project']);
  assert.equal(g2.reason, g2before.reason); // wording and suitability of an existing card are kept
  assert.equal(g2.assessment, g2before.assessment);
  assert.ok(g2.sources.length > g2before.sources.length);
  assert.deepEqual(w.grants['G-002'], { workflow: 'watchlist', override: false }); // the manager's decision is untouched
  const fresh = w.opportunities.find((o) => o.foundBy === 'ai' && o.name === 'Example Neighbourhood Fund');
  assert.equal(fresh.fitScore, 84);
  assert.equal(fresh.assessment, 'suitable');
  assert.equal(fresh.opensOn, '2026-10-01');
  assert.match(fresh.foundAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(w.grants[fresh.id].workflow, 'new');
  assert.equal(w.freshId, fresh.id);
  const blocked = w.opportunities.find((o) => o.name === 'Example Capital Grant');
  assert.equal(blocked.assessment, 'unsuitable');
  assert.deepEqual(blocked.barriers, ['Minimum income of £5m']);
  assert.ok(!w.opportunities.some((o) => /Insecure/.test(o.name)));
  assert.equal(w.lastRun.counts.new, 2);
  assert.deepEqual(w.lastRun.queries, ['fake grants for charities', 'fake neighbourhood funding']);
  assert.equal(w.lastRun.sources[0].url, 'https://example.org/fake-source');
  assert.equal(w.lastRun.model, 'gemini-3.8-flash');
  assert.equal(w.lastRun.by, 'a@test.example');
});

test('a second run does not duplicate cards or reset a decision on an AI card', async () => {
  const w1 = await ws();
  const fresh = w1.opportunities.find((o) => o.name === 'Example Neighbourhood Fund');
  await h.call('a', 'PUT', `${base}/decisions/${fresh.id}`, { json: { workflow: 'passed', override: false } });
  await h.call('a', 'PUT', `${base}/notes/${fresh.id}`, { json: { text: 'keep me' } });
  const { evs } = await discover();
  assert.deepEqual(evs.at(-1).result, { new: 0, updated: 3, dropped: 1 });
  const w2 = await ws();
  assert.equal(w2.opportunities.length, w1.opportunities.length);
  assert.equal(w2.grants[fresh.id].workflow, 'passed');
  assert.equal(w2.notes[fresh.id].text, 'keep me');
});

test('the prompt carries the organisation information and the saved brief; the model choice is used', async () => {
  await h.call('a', 'PUT', `${base}/discovery-settings`, { json: { brief: 'Brief marker 12345 for capital grants' } });
  const { evs } = await discover('a', { model: 'gemini:gemini-4-carbon' });
  assert.equal(evs.at(-1).type, 'done');
  const call = runner.calls.at(-1);
  assert.equal(call.choice.model, 'gemini-4-carbon');
  assert.equal(call.task, 'discover');
  assert.equal(call.web, true);
  assert.ok(call.prompt.includes('Brief marker 12345 for capital grants'));
  assert.ok(call.prompt.includes('Your Place is a demo charity'));
  assert.ok(call.prompt.includes('Bridgeway Foundation'));
  assert.ok(!call.prompt.includes('Our Time'));
});

test('only one run per charity at a time; another charity is not blocked', async () => {
  runner = createFakeRunner({ delayMs: 150 });
  const first = await h.call('a', 'POST', `${base}/discover`, { json: {} });
  assert.equal(first.status, 200);
  const active = await h.call('both', 'GET', `${base}/discover/active`);
  assert.equal(active.body.jobId, first.body.jobId);
  const second = await h.call('both', 'POST', `${base}/discover`, { json: {} });
  assert.equal(second.status, 409);
  assert.equal(second.body.message, 'A discovery run is already in progress.');
  await h.call('b', 'PUT', '/api/charities/our-time/discovery-settings', { json: { brief: 'Our Time brief' } });
  const other = await h.call('b', 'POST', '/api/charities/our-time/discover', { json: {} });
  assert.equal(other.status, 200);
  assert.equal((await events('a', first.body.jobId)).at(-1).type, 'done');
  await events('b', other.body.jobId, 'our-time');
  assert.equal((await h.call('a', 'GET', `${base}/discover/active`)).body.jobId, null);
  assert.equal((await discover()).res.status, 200); // free again
});

test('a charity with no brief cannot run; bad or unavailable models are refused', async () => {
  await h.call('a', 'PUT', `${base}/discovery-settings`, { json: { brief: '   ' } });
  const empty = await h.call('a', 'POST', `${base}/discover`, { json: {} });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.message, 'Enter your discovery criteria first.');
  await h.call('a', 'PUT', `${base}/discovery-settings`, { json: { brief: 'Something' } });
  assert.equal((await h.call('a', 'POST', `${base}/discover`, { json: { model: 'claude:claude-opus-5-5' } })).status, 400);
  assert.equal((await h.call('a', 'POST', `${base}/discover`, { json: { model: 'rubbish' } })).status, 400);
  assert.equal((await h.call('a', 'POST', `${base}/discover`, { json: { model: 42 } })).status, 200);
  while ((await h.call('a', 'GET', `${base}/discover/active`)).body.jobId) await new Promise((r) => setTimeout(r, 10));
});

test('a failing model ends the run with a message and changes nothing', async () => {
  runner = createFakeRunner({ delayMs: 1, fail: 'Gemini: quota exceeded' });
  const before = JSON.stringify(await ws());
  const { evs } = await discover();
  assert.deepEqual(evs.at(-1), { type: 'error', error: 'Gemini: quota exceeded' });
  assert.equal(JSON.stringify(await ws()), before);
  assert.equal((await h.call('a', 'GET', `${base}/discover/active`)).body.jobId, null);
});

test('an answer that is not usable is asked for again once, then the run fails cleanly', async () => {
  let n = 0;
  const bad = async (choice, opts) => { n += 1; return { text: 'sorry', structured: null, searches: [], sources: [], provider: choice.provider, model: choice.model }; };
  runner = bad;
  const { evs } = await discover();
  assert.equal(n, 2);
  assert.match(evs.at(-1).error, /expected format/);
});

test('model menu: built-in Gemini models for a member; a stranger gets 404', async () => {
  const m = await h.call('a', 'GET', `${base}/ai/models`);
  assert.equal(m.status, 200);
  assert.equal(m.body.default, 'gemini:gemini-3.8-flash');
  assert.deepEqual(m.body.models.filter((x) => x.available).map((x) => x.id), ['gemini:gemini-3.8-flash', 'gemini:gemini-4-carbon']);
  assert.equal(m.body.models.length, 6); // Claude and ChatGPT are listed too, but not available until a key is connected
  assert.equal(m.body.models.find((x) => x.provider === 'claude').available, false);
  assert.equal((await h.call('b', 'GET', `${base}/ai/models`)).status, 404);
});

test('a run and its events belong to the charity: strangers and other charities get 404', async () => {
  await h.call('a', 'PUT', `${base}/discovery-settings`, { json: { brief: 'Something else' } });
  const { res } = await discover();
  const jobId = res.body.jobId;
  assert.equal((await h.call('b', 'POST', `${base}/discover`, { json: {} })).status, 404);
  assert.equal((await h.call('b', 'GET', `${base}/jobs/${jobId}/events`)).status, 404);
  assert.equal((await h.call('b', 'GET', `/api/charities/our-time/jobs/${jobId}/events`)).status, 404); // right charity, wrong job
  assert.equal((await h.call('nobody', 'GET', `${base}/discover/active`)).status, 404);
});
