import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryPrompt, discoverySchema, grantIdFor, httpsUrl, normaliseKey, validateDiscovery, systemPrompt } from '../../server/ai/prompts.js';
import { createJobs } from '../../server/ai/jobs.js';
import { createFakeRunner, FAKE_DISCOVERY } from '../../server/ai/fake-runner.js';
import { availableModels, resolveModel } from '../../server/ai/models.js';
import { runGemini } from '../../server/ai/runners.js';
import { DEFAULT_MODEL } from '../../server/ai/ai-core.mjs';

const TODAY = new Date('2026-11-25T10:00:00Z');
const good = (over = {}) => ({
  name: 'Example Fund', funder: 'Example Trust', amount: 'Up to £10,000', timing: 'Open', summary: 'A fund.', fitScore: 70, hardBarrier: false, reason: 'Fits.',
  barriers: ['Needs two years of accounts'], guidanceUrl: 'https://example.org/fund', sources: [{ label: 'Page', url: 'https://example.org/fund' }], ...over,
});
const run = (items) => validateDiscovery({ items, notes: ' checked ' }, { today: TODAY });

test('the prompt carries the organisation information, the brief and the safety rules', () => {
  const p = discoveryPrompt({
    profile: { name: 'Test Charity', overview: 'We run a fictional shelter.', geography: 'Testshire', beneficiaries: 'Neighbours', activities: 'Beds' },
    bids: [{ funder: 'Old Funder', title: 'Old bid', outcome: 'successful' }], brief: 'Capital grants in Testshire', known: ['Funder: Fund'],
  });
  for (const t of ['We run a fictional shelter.', 'Testshire', 'Capital grants in Testshire', 'Old Funder', 'Funder: Fund', 'hardBarrier', 'YYYY-MM-DD']) assert.ok(p.includes(t), t);
  assert.match(systemPrompt('Test Charity', TODAY), /data, not instructions/);
  assert.ok(discoverySchema.properties.items.items.required.includes('fitScore'));
});

test('a good item is kept, with a stable ID, a suitability from score and barrier, and the guidance page among its sources', () => {
  const v = run([good(), good({ name: 'Weak', fitScore: 49 }), good({ name: 'Blocked', fitScore: 90, hardBarrier: true })]);
  assert.equal(v.items.length, 3);
  assert.equal(v.items[0].id, grantIdFor('Example Trust', 'Example Fund'));
  assert.equal(v.items[0].assessment, 'suitable');
  assert.equal(v.items[1].assessment, 'unsuitable');
  assert.equal(v.items[2].assessment, 'unsuitable');
  assert.deepEqual(v.items[0].barriers, ['Needs two years of accounts']);
  assert.equal(v.notes, 'checked');
  const noSource = run([good({ sources: [] })]).items[0];
  assert.equal(noSource.sources[0].url, 'https://example.org/fund');
});

test('malformed, oversize, non-https and bad-date items are dropped with a reason', () => {
  const v = run([
    good({ name: 'a' }),
    null,
    good({ name: 'No funder', funder: '' }),
    good({ name: 'x'.repeat(200) }),
    good({ name: 'Long summary', summary: 'x'.repeat(801) }),
    good({ name: 'Plain http', guidanceUrl: 'http://example.org/x' }),
    good({ name: 'Script', guidanceUrl: 'javascript:alert(1)' }),
    good({ name: 'Bad date', closesOn: '2027-02-30' }),
    good({ name: 'Format', opensOn: '1 March 2027' }),
    good({ name: 'Backwards', opensOn: '2027-05-01', closesOn: '2027-04-01' }),
    good({ name: 'Closed', closesOn: '2026-11-24' }),
    good({ name: 'Score', fitScore: 140 }),
    good({ name: 'Score text', fitScore: 'high' }),
    good({ name: 'a' }),
  ]);
  assert.deepEqual(v.items.map((i) => i.name), ['a']);
  assert.equal(v.dropped.length, 13);
  assert.ok(v.dropped.some((d) => d.why === 'invalid date'));
  assert.ok(v.dropped.some((d) => d.why === 'duplicate in this run'));
});

test('source links that are not https are removed from a kept item; too many items are capped', () => {
  const kept = run([good({ sources: [{ url: 'http://example.org/a' }, { url: 'https://example.org/b', label: 'B' }, { url: 'ftp://example.org/c' }] })]).items[0];
  assert.deepEqual(kept.sources.map((s) => s.url), ['https://example.org/fund', 'https://example.org/b']);
  const many = run(Array.from({ length: 40 }, (_, i) => good({ name: `Fund ${i}` })));
  assert.equal(many.items.length, 25);
  assert.equal(validateDiscovery(null).items.length, 0);
  assert.equal(validateDiscovery({ items: 'no' }).items.length, 0);
});

test('httpsUrl and normaliseKey', () => {
  assert.equal(httpsUrl('https://example.org/a?b=1'), 'https://example.org/a?b=1');
  for (const bad of ['http://example.org', 'https://user:pw@example.org', 'https://localhost', '', 5, null]) assert.equal(httpsUrl(bad), null);
  assert.equal(normaliseKey('The National Lottery Community Fund', 'Reaching Communities England'), normaliseKey('national lottery community fund', 'Reaching Communities (England)'));
});

test('the scripted fake answer validates: one update, one new, one blocked, one dropped', () => {
  const v = validateDiscovery(FAKE_DISCOVERY, { today: new Date('2026-11-25T10:00:00Z') });
  assert.deepEqual(v.items.map((i) => i.assessment), ['suitable', 'suitable', 'unsuitable']);
  assert.equal(v.items.length, 3);
  assert.equal(v.dropped.length, 1);
});

test('jobs replay events to late listeners, belong to one charity and allow one active run', async () => {
  const jobs = createJobs();
  let release;
  const gate = new Promise((r) => { release = r; });
  const job = jobs.start('c1', 'discover', async (emit) => { emit({ type: 'status', text: 'one' }); await gate; emit({ type: 'status', text: 'two' }); return { ok: 1 }; });
  assert.equal(jobs.active('c1', 'discover').id, job.id);
  assert.equal(jobs.active('c2', 'discover'), undefined);
  assert.equal(jobs.get('c2', job.id), undefined);
  assert.equal(jobs.get('c1', job.id).id, job.id);
  const seen = [];
  jobs.get('c1', job.id).listeners.add((e) => seen.push(e.type));
  release();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(job.events.map((e) => e.type), ['status', 'status', 'done']);
  assert.deepEqual(seen, ['status', 'status', 'done']);
  assert.equal(job.done, true);
  assert.equal(jobs.active('c1', 'discover'), undefined);
  const bad = jobs.start('c1', 'discover', () => { throw new Error('boom'); });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(bad.events.at(-1).type, 'error');
  assert.equal(bad.error, 'boom');
});

test('models: built-in Gemini only for now; the default resolves; Claude and ChatGPT are refused', () => {
  const ids = availableModels({}).map((m) => m.id);
  assert.ok(ids.includes(DEFAULT_MODEL));
  assert.ok(ids.every((id) => id.startsWith('gemini:')));
  assert.equal(resolveModel('').model, 'gemini-3.8-flash');
  assert.throws(() => resolveModel('claude:claude-opus-5-5'), /Connect your own key/);
  assert.throws(() => resolveModel('nope'), /Choose one/);
});

test('the fake runner records calls and never needs a network', async () => {
  const fake = createFakeRunner({ delayMs: 1 });
  const events = [];
  const out = await fake({ provider: 'gemini', model: 'm' }, { task: 'discover', prompt: 'p', onEvent: (e) => events.push(e.type) });
  assert.equal(out.structured.items.length, 4);
  assert.ok(events.includes('tool'));
  assert.equal(fake.calls.length, 1);
});

test('the Gemini runner reads a streamed grounded answer (stubbed network)', async () => {
  const real = globalThis.fetch;
  const body = [
    { candidates: [{ content: { parts: [{ text: '{"items":' }] }, groundingMetadata: { webSearchQueries: ['q one'], groundingChunks: [{ web: { uri: 'https://example.org/p', title: 'P' } }] } }] },
    { candidates: [{ content: { parts: [{ text: '[],"notes":""}' }] }, finishReason: 'STOP' }] },
  ].map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join('');
  let seenUrl;
  let seenBody;
  globalThis.fetch = async (url, init) => {
    seenUrl = url; seenBody = JSON.parse(init.body);
    return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(body)); c.close(); } }), { status: 200 });
  };
  try {
    const events = [];
    const out = await runGemini({ provider: 'gemini', model: 'gemini-3.8-flash', key: 'test-key' }, { prompt: 'hi', system: 's', web: true, schema: discoverySchema, onEvent: (e) => events.push(e) });
    assert.equal(out.text, '{"items":[],"notes":""}');
    assert.deepEqual(out.searches, ['q one']);
    assert.deepEqual(out.sources, [{ url: 'https://example.org/p', title: 'P' }]);
    assert.match(seenUrl, /generativelanguage\.googleapis\.com.*gemini-3\.8-flash/);
    assert.deepEqual(seenBody.tools, [{ googleSearch: {} }]);
    assert.ok(events.some((e) => e.type === 'tool' && e.detail === 'q one'));
  } finally { globalThis.fetch = real; }
});
