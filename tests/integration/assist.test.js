import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.js';
import { createFakeRunner } from '../../server/ai/fake-runner.js';

const CID = 'your-place';
const base = `/api/charities/${CID}`;
let h;
let runner;
const ai = { runAI: (choice, opts) => runner(choice, opts) };
test.before(async () => { h = await startHarness({ ai }); });
test.after(() => h.close());
test.beforeEach(() => { runner = createFakeRunner({ delayMs: 5 }); });

async function events(user, jobId, cid = CID) {
  const res = await h.call(user, 'GET', `/api/charities/${cid}/jobs/${jobId}/events`);
  assert.equal(res.status, 200);
  return res.bytes.toString().split('\n\n').filter((b) => b.startsWith('data:')).map((b) => JSON.parse(b.slice(5)));
}
const ws = async (user = 'a') => (await h.call(user, 'GET', `${base}/workspace`)).body;

test('assess: streams markdown, saves it with date and model, and the workspace marks the card Assessed', async () => {
  assert.equal((await h.call('a', 'GET', `${base}/assessments/G-002`)).body.assessment, null);
  const start = await h.call('a', 'POST', `${base}/opportunities/G-002/assess`, { json: { model: 'gemini:gemini-4-carbon' } });
  assert.equal(start.status, 200);
  const evs = await events('a', start.body.jobId);
  assert.ok(evs.some((e) => e.type === 'text'));
  const text = evs.filter((e) => e.type === 'text').map((e) => e.text).join('');
  assert.match(text, /^## Verdict/);
  const done = evs.at(-1);
  assert.equal(done.type, 'done');
  assert.equal(done.result.assessment.text, text);
  const saved = (await h.call('both', 'GET', `${base}/assessments/G-002`)).body;
  assert.equal(saved.assessment.text, text);
  assert.equal(saved.assessment.model, 'gemini-4-carbon');
  assert.equal(saved.assessment.by, 'a@test.example');
  assert.match(saved.assessment.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(saved.jobId, null);
  const call = runner.calls.at(-1);
  assert.equal(call.task, 'assess');
  assert.equal(call.web, true);
  assert.ok(call.prompt.includes('Reaching Communities England'));
  assert.ok(call.prompt.includes('Your Place is a demo charity'));
  const w = await ws();
  assert.ok(w.assessed['G-002'].at);
  assert.equal(w.assessed['G-001'], undefined);
});

test('re-assess replaces the saved assessment; one run per grant at a time', async () => {
  runner = createFakeRunner({ delayMs: 80, reply: () => '## Verdict\n**Watch**' });
  const first = await h.call('a', 'POST', `${base}/opportunities/G-002/assess`, { json: {} });
  assert.equal(first.status, 200);
  assert.equal((await h.call('a', 'GET', `${base}/assessments/G-002`)).body.jobId, first.body.jobId);
  const again = await h.call('both', 'POST', `${base}/opportunities/G-002/assess`, { json: {} });
  assert.equal(again.status, 409);
  const other = await h.call('both', 'POST', `${base}/opportunities/G-003/assess`, { json: {} });
  assert.equal(other.status, 200);
  await events('a', first.body.jobId);
  await events('both', other.body.jobId);
  assert.equal((await h.call('a', 'GET', `${base}/assessments/G-002`)).body.assessment.text, '## Verdict\n**Watch**');
  assert.equal((await h.call('a', 'GET', `${base}/assessments/G-002`)).body.assessment.by, 'a@test.example');
});

test('a failing assessment keeps the earlier one; unknown grants and models are refused', async () => {
  const before = (await h.call('a', 'GET', `${base}/assessments/G-002`)).body.assessment;
  runner = createFakeRunner({ delayMs: 1, fail: 'Gemini: quota exceeded' });
  const start = await h.call('a', 'POST', `${base}/opportunities/G-002/assess`, { json: {} });
  assert.deepEqual((await events('a', start.body.jobId)).at(-1), { type: 'error', error: 'Gemini: quota exceeded' });
  assert.deepEqual((await h.call('a', 'GET', `${base}/assessments/G-002`)).body.assessment, before);
  assert.equal((await h.call('a', 'POST', `${base}/opportunities/G-999/assess`, { json: {} })).status, 404);
  assert.equal((await h.call('a', 'GET', `${base}/assessments/G-999`)).status, 404);
  assert.equal((await h.call('a', 'POST', `${base}/opportunities/G-002/assess`, { json: { model: 'openai:gpt-6.2-sol' } })).status, 400);
});

test('a discussion about a grant: the first message carries the context, history grows, the model can change', async () => {
  runner = createFakeRunner({ delayMs: 5 });
  const created = await h.call('a', 'POST', `${base}/threads`, { json: { grantId: 'G-002', text: 'Should we apply?' } });
  assert.equal(created.status, 200);
  const t = created.body.thread;
  assert.equal(t.title, 'Reaching Communities England');
  assert.equal(t.grantId, 'G-002');
  assert.deepEqual(t.messages.map((m) => m.role), ['user']);
  const evs1 = await events('a', created.body.jobId);
  assert.equal(evs1.at(-1).type, 'done');
  const first = runner.calls.at(-1);
  assert.equal(first.task, 'chat');
  assert.ok(first.prompt.includes('Should we apply?'));
  assert.ok(first.prompt.includes('Reaching Communities England'));
  assert.ok(first.prompt.includes('Your Place is a demo charity'));
  assert.ok(first.prompt.includes('## Verdict')); // the saved assessment of G-002 travels with it
  assert.deepEqual(first.history, []);

  const second = await h.call('both', 'POST', `${base}/threads/${t.id}/messages`, { json: { text: 'What about the budget?', model: 'gemini:gemini-4-carbon' } });
  assert.equal(second.status, 200);
  await events('both', second.body.jobId);
  const call2 = runner.calls.at(-1);
  assert.equal(call2.choice.model, 'gemini-4-carbon');
  assert.equal(call2.prompt, 'What about the budget?');
  assert.deepEqual(call2.history.map((m) => m.role), ['user', 'assistant']);
  assert.ok(call2.history[0].text.includes('Should we apply?') && call2.history[0].text.includes('Context for this discussion'));

  const full = (await h.call('a', 'GET', `${base}/threads/${t.id}`)).body;
  assert.deepEqual(full.thread.messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(full.thread.messages[3].model, 'gemini-4-carbon');
  assert.equal(full.thread.messages[2].text, 'What about the budget?');
  assert.equal(full.jobId, null);
  assert.equal(full.thread.context, undefined); // the stored context is never sent to the browser
});

test('a discussion with no grant, list order, rename, delete and the busy rule', async () => {
  runner = createFakeRunner({ delayMs: 60 });
  const created = await h.call('a', 'POST', `${base}/threads`, { json: { text: 'Ask about funding for a new roof' } });
  const id = created.body.thread.id;
  assert.equal(created.body.thread.grantId, null);
  assert.equal(created.body.thread.title, 'Ask about funding for a new roof');
  const busy = await h.call('a', 'POST', `${base}/threads/${id}/messages`, { json: { text: 'again' } });
  assert.equal(busy.status, 409);
  assert.equal((await h.call('a', 'DELETE', `${base}/threads/${id}`)).status, 409);
  await events('a', created.body.jobId);
  const list = (await h.call('a', 'GET', `${base}/threads`)).body.threads;
  assert.equal(list[0].id, id); // newest first
  assert.equal(list[0].messageCount, 2);
  assert.ok(list.every((x) => x.messages === undefined && x.context === undefined));
  const renamed = await h.call('both', 'PATCH', `${base}/threads/${id}`, { json: { title: '  New   roof  ' } });
  assert.equal(renamed.body.thread.title, 'New roof');
  assert.equal((await h.call('a', 'PATCH', `${base}/threads/${id}`, { json: { title: '' } })).status, 400);
  assert.equal((await h.call('a', 'PATCH', `${base}/threads/${id}`, { json: { title: 'x'.repeat(121) } })).status, 400);
  assert.equal((await h.call('a', 'DELETE', `${base}/threads/${id}`)).status, 200);
  assert.equal((await h.call('a', 'GET', `${base}/threads/${id}`)).status, 404);
  assert.equal((await h.call('a', 'DELETE', `${base}/threads/${id}`)).status, 404);
});

test('messages are validated; an unknown grant is refused; a failed answer leaves the question and the next send still works', async () => {
  runner = createFakeRunner({ delayMs: 1 });
  assert.equal((await h.call('a', 'POST', `${base}/threads`, { json: { text: '   ' } })).status, 400);
  assert.equal((await h.call('a', 'POST', `${base}/threads`, { json: { text: 'x'.repeat(8001) } })).status, 400);
  assert.equal((await h.call('a', 'POST', `${base}/threads`, { json: { text: 'hi', grantId: 'G-999' } })).status, 404);
  runner = createFakeRunner({ delayMs: 1, fail: 'Gemini: busy' });
  const created = await h.call('a', 'POST', `${base}/threads`, { json: { text: 'First question' } });
  assert.equal((await events('a', created.body.jobId)).at(-1).type, 'error');
  const id = created.body.thread.id;
  assert.deepEqual((await h.call('a', 'GET', `${base}/threads/${id}`)).body.thread.messages.map((m) => m.role), ['user']);
  runner = createFakeRunner({ delayMs: 1 });
  const next = await h.call('a', 'POST', `${base}/threads/${id}/messages`, { json: { text: 'Second question' } });
  await events('a', next.body.jobId);
  const call = runner.calls.at(-1);
  assert.deepEqual(call.history, []); // the unanswered first question is merged into this prompt
  assert.ok(call.prompt.includes('First question') && call.prompt.includes('Second question'));
});

test('everything is per charity: another charity and strangers see nothing', async () => {
  const mine = (await h.call('a', 'GET', `${base}/threads`)).body.threads;
  assert.ok(mine.length > 0);
  assert.deepEqual((await h.call('b', 'GET', '/api/charities/our-time/threads')).body.threads, []);
  assert.equal((await h.call('b', 'GET', `${base}/threads`)).status, 404);
  assert.equal((await h.call('b', 'GET', `/api/charities/our-time/threads/${mine[0].id}`)).status, 404);
  assert.equal((await h.call('b', 'PATCH', `/api/charities/our-time/threads/${mine[0].id}`, { json: { title: 'x' } })).status, 404);
  assert.equal((await h.call('b', 'POST', `/api/charities/our-time/threads/${mine[0].id}/messages`, { json: { text: 'x' } })).status, 404);
  assert.equal((await h.call('b', 'DELETE', `/api/charities/our-time/threads/${mine[0].id}`)).status, 404);
  assert.equal((await h.call('b', 'GET', '/api/charities/our-time/assessments/G-002')).status, 404); // Our Time has no such grant
});
