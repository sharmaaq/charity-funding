import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.js';
import { createFakeKms, fakeTestKey } from './fake-kms.js';
import { createFakeRunner } from '../../server/ai/fake-runner.js';

const CID = 'your-place';
const base = `/api/charities/${CID}`;
const CLAUDE_KEY = 'sk-ant-api03-SYNTHETICKEY-abcd1234';
const OPENAI_KEY = 'sk-proj-SYNTHETICOPENAIKEY-wxyz9876';
const GEMINI_KEY = 'AIzaSySYNTHETICGEMINIKEY-0000';

let h;
let runner;
const kms = createFakeKms();
const seen = []; // every response body text, scanned for secrets at the end
test.before(async () => {
  runner = createFakeRunner({ delayMs: 1 });
  h = await startHarness({ ai: { runAI: (c, o) => runner(c, o), kms } });
});
test.after(() => h.close());

const call = async (...a) => { const r = await h.call(...a); seen.push(r.bytes.toString()); return r; };
const settings = async (user = 'a', cid = CID) => (await call(user, 'GET', `/api/charities/${cid}/ai/settings`)).body;
async function waitIdle() { while ((await h.call('a', 'GET', `${base}/discover/active`)).body.jobId) await new Promise((r) => setTimeout(r, 5)); }

test('nothing is connected at first: three providers, Claude and ChatGPT models are listed but unavailable', async () => {
  const s = await settings();
  assert.deepEqual(s.providers.map((p) => p.id), ['anthropic', 'openai', 'gemini']);
  assert.deepEqual(s.connections, { anthropic: { connected: false }, openai: { connected: false }, gemini: { connected: false } });
  assert.equal(s.keysAvailable, true);
  assert.deepEqual(s.models.filter((m) => m.available).map((m) => m.provider), ['gemini', 'gemini']);
  const claude = s.models.find((m) => m.id === 'claude:claude-opus-5-5');
  assert.equal(claude.available, false);
  assert.match(claude.note, /connect your Anthropic API key in Settings/);
  const refused = await call('a', 'POST', `${base}/discover`, { json: { model: 'claude:claude-opus-5-5' } });
  assert.equal(refused.status, 400);
  assert.match(refused.body.message, /Connect your own key/);
});

test('a key is checked with its provider first, then saved encrypted; only the last four characters come back', async () => {
  fakeTestKey.calls.length = 0;
  const res = await call('a', 'PUT', `${base}/ai/keys/anthropic`, { json: { key: `  ${CLAUDE_KEY}  ` } });
  assert.equal(res.status, 200);
  assert.deepEqual(fakeTestKey.calls, [['anthropic', CLAUDE_KEY]]);
  assert.equal(res.body.connections.anthropic.connected, true);
  assert.equal(res.body.connections.anthropic.last4, '1234');
  assert.equal(res.body.connections.anthropic.savedBy, 'a@test.example');
  assert.equal(res.body.connections.openai.connected, false);
  assert.equal(res.body.models.find((m) => m.id === 'claude:claude-sonnet-5-5').available, true);
  assert.equal(res.body.models.find((m) => m.id === 'openai:gpt-6.2-sol').available, false);
  // what is stored is the KMS blob, never the key
  const stored = await h.store.get(CID, 'meta', 'aiKeys');
  assert.match(stored.keys.anthropic.enc, /^fake:/);
  assert.ok(!JSON.stringify(stored).includes(CLAUDE_KEY));
  assert.ok(kms.calls.includes('encrypt'));
  // the development state viewer never shows the blob either
  const dump = await h.call('a', 'GET', `/api/dev/state/${CID}/meta`);
  assert.ok(!dump.bytes.toString().includes('fake:'));
  assert.ok(!dump.bytes.toString().includes(CLAUDE_KEY));
});

test('a rejected key is not saved; malformed keys and unknown providers are refused', async () => {
  const rejected = await call('a', 'PUT', `${base}/ai/keys/openai`, { json: { key: 'bad-key-0000000000000000' } });
  assert.equal(rejected.status, 400);
  assert.match(rejected.body.message, /rejected/);
  assert.equal((await settings()).connections.openai.connected, false);
  for (const key of ['', 'short', 'has a space in it 1234567890', 'x'.repeat(301), 5, null]) {
    assert.equal((await call('a', 'PUT', `${base}/ai/keys/openai`, { json: { key } })).status, 400, String(key));
  }
  assert.equal((await call('a', 'PUT', `${base}/ai/keys/mistral`, { json: { key: OPENAI_KEY } })).status, 404);
  assert.equal((await call('a', 'DELETE', `${base}/ai/keys/mistral`)).status, 404);
});

test('a connected key is used for that charity only, resolved on every request', async () => {
  const run = await call('a', 'POST', `${base}/discover`, { json: { model: 'claude:claude-opus-5-5' } });
  assert.equal(run.status, 200);
  await waitIdle();
  const c = runner.calls.at(-1).choice;
  assert.equal(c.provider, 'claude');
  assert.equal(c.model, 'claude-opus-5-5');
  assert.equal(c.key, CLAUDE_KEY);
  // a built-in model carries no key
  await call('a', 'POST', `${base}/discover`, { json: {} });
  await waitIdle();
  assert.equal(runner.calls.at(-1).choice.key, undefined);
  // another charity sees nothing and cannot use the model
  const other = await settings('b', 'our-time');
  assert.equal(other.connections.anthropic.connected, false);
  await h.call('b', 'PUT', '/api/charities/our-time/discovery-settings', { json: { brief: 'Our Time brief' } });
  assert.equal((await call('b', 'POST', '/api/charities/our-time/discover', { json: { model: 'claude:claude-opus-5-5' } })).status, 400);
});

test('any member can connect ChatGPT and a Gemini key; the Gemini key moves the built-in models to it', async () => {
  assert.equal((await call('both', 'PUT', `${base}/ai/keys/openai`, { json: { key: OPENAI_KEY } })).status, 200);
  const g = await call('both', 'PUT', `${base}/ai/keys/gemini`, { json: { key: GEMINI_KEY } });
  assert.equal(g.body.connections.gemini.last4, '0000');
  assert.equal(g.body.connections.openai.savedBy, 'both@test.example');
  assert.match(g.body.models.find((m) => m.id === 'gemini:gemini-3.8-flash').note, /your Gemini API key/);
  await call('a', 'POST', `${base}/discover`, { json: { model: 'gemini:gemini-3.8-flash' } });
  await waitIdle();
  assert.equal(runner.calls.at(-1).choice.key, GEMINI_KEY);
  await call('a', 'POST', `${base}/discover`, { json: { model: 'openai:gpt-6.2-sol' } });
  await waitIdle();
  assert.equal(runner.calls.at(-1).choice.key, OPENAI_KEY);
});

test('assessment and discussion use the same per-request key resolution', async () => {
  const a = await call('a', 'POST', `${base}/opportunities/G-002/assess`, { json: { model: 'claude:claude-sonnet-5-5' } });
  assert.equal(a.status, 200);
  await h.call('a', 'GET', `/api/charities/${CID}/jobs/${a.body.jobId}/events`);
  assert.equal(runner.calls.at(-1).choice.key, CLAUDE_KEY);
  const t = await call('a', 'POST', `${base}/threads`, { json: { text: 'hello', model: 'openai:gpt-6.2-astra' } });
  await h.call('a', 'GET', `/api/charities/${CID}/jobs/${t.body.jobId}/events`);
  assert.equal(runner.calls.at(-1).choice.key, OPENAI_KEY);
});

test('removing a key makes its models unavailable again at once', async () => {
  const res = await call('both', 'DELETE', `${base}/ai/keys/anthropic`);
  assert.equal(res.status, 200);
  assert.equal(res.body.connections.anthropic.connected, false);
  assert.equal(res.body.models.find((m) => m.id === 'claude:claude-opus-5-5').available, false);
  assert.equal((await call('a', 'POST', `${base}/discover`, { json: { model: 'claude:claude-opus-5-5' } })).status, 400);
  assert.equal((await call('a', 'DELETE', `${base}/ai/keys/anthropic`)).status, 200); // removing twice is harmless
  assert.equal((await h.store.get(CID, 'meta', 'aiKeys')).keys.anthropic, undefined);
});

test('non-members get 404 and change nothing; writes must be same-origin', async () => {
  const before = JSON.stringify(await h.store.get(CID, 'meta', 'aiKeys'));
  for (const [m, p, o] of [['GET', '/ai/settings'], ['PUT', '/ai/keys/anthropic', { json: { key: CLAUDE_KEY } }], ['DELETE', '/ai/keys/openai']]) {
    const r = await call('b', m, base + p, o);
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, { code: 'NOT_FOUND', message: 'Not found.' });
  }
  assert.equal(JSON.stringify(await h.store.get(CID, 'meta', 'aiKeys')), before);
  assert.equal((await h.call('a', 'PUT', `${base}/ai/keys/anthropic`, { json: { key: CLAUDE_KEY }, origin: false })).status, 403);
});

test('no response ever contained a key or an encrypted blob', () => {
  const all = seen.join('\n');
  for (const secret of [CLAUDE_KEY, OPENAI_KEY, GEMINI_KEY, '"enc"', 'fake:']) assert.ok(!all.includes(secret), secret);
  assert.ok(all.length > 1000);
});

test('without a KMS, connecting a key is refused with a clear message and models stay built-in only', async () => {
  const bare = await startHarness({ ai: { kms: null } });
  try {
    const r = await bare.call('a', 'PUT', `${base}/ai/keys/anthropic`, { json: { key: CLAUDE_KEY } });
    assert.equal(r.status, 503);
    assert.match(r.body.message, /not available/);
    const s = (await bare.call('a', 'GET', `${base}/ai/settings`)).body;
    assert.equal(s.keysAvailable, false);
    assert.equal((await bare.call('a', 'PUT', `${base}/ai/keys/nope`, { json: { key: CLAUDE_KEY } })).status, 404);
  } finally { await bare.close(); }
});
