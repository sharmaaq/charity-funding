// The HTTP API through the real server: everything that must be rejected is rejected before a browser starts.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../../server.js';
import { createApi } from '../../server/api.js';
import { exampleRun } from './fixture.js';

let server;
let port;
let base;
let runnerCalls = 0;
let runnerImpl = null;
const api = createApi({
  probe: async () => ({ ok: true }),
  log: () => {},
  runDemo: async (args) => { runnerCalls += 1; return runnerImpl(args); },
});

test.before(async () => {
  server = createServer({ api });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});
test.after(() => new Promise((r) => server.close(r)));
test.beforeEach(() => { runnerCalls = 0; runnerImpl = async () => ({ receipt: { reference: 'DEMO-x', payloadHash: 'h', target: 'controlled-test-portal', confirmedAt: 't' }, files: [], metrics: { peakRssBytes: 0, blockedRequests: 0 } }); });

function form(r, { manifest = r.manifest, extra = [], files = r.files, manifestText } = {}) {
  const fd = new FormData();
  fd.append('manifest', manifestText ?? JSON.stringify(manifest));
  for (const role of ['proposal', 'accounts']) if (files[role]) fd.append(role, new Blob([files[role].bytes], { type: files[role].mimeType }), files[role].filename);
  for (const [k, v] of extra) fd.append(k, v);
  return fd;
}
const headers = (r, over = {}) => ({ Origin: base, 'Idempotency-Key': r.attemptId, 'X-Submission-Schema': 'submission.v1', ...over });
const post = (r, opts = {}) => fetch(`${base}/api/submission-demo-runs`, { method: 'POST', headers: headers(r, opts.headers), body: opts.body || form(r, opts) });

async function lines(res) {
  const text = await res.text();
  return text.trim().split('\n').map((l) => JSON.parse(l));
}

test('capabilities: demo available, live unavailable with blockers, no-store, no paths or secrets', async () => {
  const res = await fetch(`${base}/api/submission-capabilities`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.schemaVersion, 'submission.v1');
  const a = body.adapters[0];
  assert.deepEqual([a.grantId, a.adapterId, a.demoAvailable, a.liveAvailable, a.maxFiles, a.maxFileBytes, a.maxAggregateFileBytes], ['G-001', 'garfield-weston-regular-core-demo.v1', true, false, 2, 10485760, 20971520]);
  assert.ok(a.liveBlockers.includes('Authenticated current form mapping not verified'));
  assert.doesNotMatch(JSON.stringify(body), /[A-Z]:\\|\/home\/|\/app\/|ms-playwright/);
});

test('capabilities: when the browser cannot start, demoAvailable is false with a reason, and runs get 503', async () => {
  const s = createServer({ api: createApi({ probe: async () => ({ ok: false, reason: 'The headless browser could not be started on this server.' }), log: () => {}, runDemo: async () => { throw new Error('must not run'); } }) });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${s.address().port}`;
  const a = (await (await fetch(`${b}/api/submission-capabilities`)).json()).adapters[0];
  assert.equal(a.demoAvailable, false);
  assert.match(a.demoUnavailableReason, /could not be started/);
  const r = await exampleRun();
  const res = await fetch(`${b}/api/submission-demo-runs`, { method: 'POST', headers: { ...headers(r), Origin: b }, body: form(r) });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, 'RUNNER_UNAVAILABLE');
  await new Promise((x) => s.close(x));
});

test('a valid run streams NDJSON: seq from 1, one terminal event, then the stream closes', async () => {
  runnerImpl = async ({ emit }) => { emit('prepare', 'started'); emit('prepare', 'complete'); return { receipt: { reference: 'DEMO-a', payloadHash: 'p', target: 'controlled-test-portal', confirmedAt: 't' }, files: [], metrics: { peakRssBytes: 1, blockedRequests: 0 } }; };
  const r = await exampleRun();
  const res = await post(r);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/x-ndjson/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const ev = await lines(res);
  assert.deepEqual(ev.map((e) => e.seq), ev.map((_, i) => i + 1));
  assert.ok(ev.every((e) => e.attemptId === r.attemptId && typeof e.at === 'string'));
  assert.deepEqual(ev[0], { ...ev[0], type: 'step', step: 'check', status: 'complete' });
  assert.equal(ev.filter((e) => e.type === 'completed' || e.type === 'failed').length, 1);
  assert.equal(ev.at(-1).type, 'completed');
});

test('a failing run ends with exactly one failed event carrying a safe message and no stack', async () => {
  const { RunError } = await import('../../server/demo-runner.js');
  runnerImpl = async () => { throw new RunError('UPLOAD_REJECTED', 'upload', 'The demo portal rejected the upload.'); };
  const r = await exampleRun();
  const ev = await lines(await post(r));
  const last = ev.at(-1);
  assert.deepEqual([last.type, last.code, last.step, last.retryable], ['failed', 'UPLOAD_REJECTED', 'upload', false]);
  assert.doesNotMatch(JSON.stringify(ev), /at .*\.js:\d+/);
});

const rejections = [
  ['wrong origin', (r) => ({ headers: { Origin: 'https://evil.example' } }), 403, 'ORIGIN_REJECTED'],
  ['no origin', (r) => ({ headers: { Origin: '' } }), 403, 'ORIGIN_REJECTED'],
  ['missing schema header', (r) => ({ headers: { 'X-Submission-Schema': '' } }), 400, 'MALFORMED'],
  ['Idempotency-Key not equal to attemptId', (r) => ({ headers: { 'Idempotency-Key': crypto.randomUUID() } }), 400, 'MALFORMED'],
  ['mode=live', (r) => ({ manifest: { ...r.manifest, mode: 'live' } }), 400, 'MODE_NOT_SUPPORTED'],
  ['unknown adapter', (r) => ({ manifest: { ...r.manifest, adapterId: 'other.v1' } }), 400, 'UNKNOWN_ADAPTER'],
  ['unknown top-level key', (r) => ({ manifest: { ...r.manifest, target: 'https://example.com' } }), 400, 'MALFORMED'],
  ['missing key', (r) => { const { review, ...m } = r.manifest; return { manifest: m }; }, 400, 'MALFORMED'],
  ['unknown answer key', (r) => ({ manifest: { ...r.manifest, answers: { ...r.manifest.answers, org: { ...r.manifest.answers.org, secretNotes: 'x' } } } }), 422, 'UNKNOWN_FIELD'],
  ['malformed JSON', () => ({ manifestText: '{"schemaVersion":' }), 400, 'MALFORMED'],
  ['money as a string', (r) => ({ manifest: { ...r.manifest, answers: { ...r.manifest.answers, request: { ...r.manifest.answers.request, amountPence: '5000000' } } } }), 422, 'VALIDATION_FAILED'],
  ['request of GBP 100,000', (r) => ({ manifest: { ...r.manifest, answers: { ...r.manifest.answers, request: { ...r.manifest.answers.request, amountPence: 10000000 } } } }), 422, 'VALIDATION_FAILED'],
  ['an unknown compliance answer', (r) => ({ manifest: { ...r.manifest, answers: { ...r.manifest.answers, compliance: { ...r.manifest.answers.compliance, ukTaxResident: 'unknown' } } } }), 422, 'VALIDATION_FAILED'],
  ['unconfirmed review', (r) => ({ manifest: { ...r.manifest, review: { ...r.manifest.review, demoTransfer: false } } }), 422, 'NOT_CONFIRMED'],
  ['review hash differs from payload hash', (r) => ({ manifest: { ...r.manifest, review: { ...r.manifest.review, reviewedPayloadHash: 'b'.repeat(64) } } }), 409, 'HASH_CONFLICT'],
  ['answer changed after review (server recomputes the hash)', (r) => ({ manifest: { ...r.manifest, answers: { ...r.manifest.answers, request: { ...r.manifest.answers.request, title: 'Changed after review' } } } }), 422, 'PAYLOAD_HASH_MISMATCH'],
  ['file bytes changed after review', (r) => { const b = new Uint8Array(r.files.accounts.bytes); b[b.length - 2] ^= 1; return { files: { ...r.files, accounts: { ...r.files.accounts, bytes: b } } }; }, 422, 'FILE_HASH_MISMATCH'],
  ['missing accounts part', (r) => ({ files: { proposal: r.files.proposal } }), 400, 'MALFORMED'],
  ['an extra file part', (r) => ({ extra: [['other', new Blob([new Uint8Array([1])]), 'x.bin']] }), 400, 'MALFORMED'],
  ['the manifest sent twice', (r) => ({ extra: [['manifest', '{}']] }), 400, 'MALFORMED'],
  ['a text file renamed to .pdf', (r) => { const t = new TextEncoder().encode('not a pdf'); return { files: { ...r.files, accounts: { ...r.files.accounts, bytes: t } }, manifest: { ...r.manifest, attachments: [r.manifest.attachments[0], { ...r.manifest.attachments[1], sizeBytes: t.length }] } }; }, 415, 'UNSUPPORTED_FILE'],
];
for (const [name, make, status, code] of rejections) {
  test(`rejected before any browser starts: ${name}`, async () => {
    const r = await exampleRun();
    const res = await post(r, make(r));
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.code, code);
    assert.equal(typeof body.message, 'string');
    assert.equal(runnerCalls, 0);
  });
}

test('not multipart: 415', async () => {
  const r = await exampleRun();
  const res = await fetch(`${base}/api/submission-demo-runs`, { method: 'POST', headers: { ...headers(r), 'Content-Type': 'application/json' }, body: JSON.stringify(r.manifest) });
  assert.equal(res.status, 415);
  assert.equal(runnerCalls, 0);
});

test('an 11 MB file is rejected with 413 while streaming, and a declared 22 MB body is refused up front', async () => {
  const r = await exampleRun();
  const big = new Uint8Array(11 * 1024 * 1024);
  big.set(r.files.proposal.bytes.subarray(0, 5));
  const res = await post(r, { files: { ...r.files, proposal: { ...r.files.proposal, bytes: big } } });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, 'TOO_LARGE');
  const declared = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/submission-demo-runs', method: 'POST', headers: { ...headers(r), 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': String(22 * 1024 * 1024) } }, (res2) => { res2.resume(); resolve(res2.statusCode); });
    req.on('error', reject);
    req.write('--x\r\n');
    setTimeout(() => req.destroy(), 500);
  }).catch(() => 'reset');
  assert.equal(declared, 413);
  assert.equal(runnerCalls, 0);
});

test('one run at a time: a second request while busy gets 429 with Retry-After; the same attempt again gets 409', async () => {
  let release;
  runnerImpl = () => new Promise((resolve) => { release = () => resolve({ receipt: { reference: 'DEMO-b', payloadHash: 'p', target: 'controlled-test-portal', confirmedAt: 't' }, files: [], metrics: { peakRssBytes: 1, blockedRequests: 0 } }); });
  const r = await exampleRun();
  const first = await post(r);
  assert.equal(first.status, 200);
  const again = await post(r);
  assert.equal(again.status, 409);
  assert.equal((await again.json()).code, 'ATTEMPT_IN_FLIGHT');
  const other = await exampleRun();
  const busy = await post(other);
  assert.equal(busy.status, 429);
  assert.equal(busy.headers.get('retry-after'), '30');
  release();
  await lines(first);
  runnerImpl = async () => ({ receipt: { reference: 'DEMO-d', payloadHash: 'p', target: 'controlled-test-portal', confirmedAt: 't' }, files: [], metrics: { peakRssBytes: 1, blockedRequests: 0 } });
  const after = await post(other);
  assert.equal(after.status, 200);
  await lines(after);
});

test('reusing an attempt ID for a different package is a 409 conflict', async () => {
  const r = await exampleRun();
  await lines(await post(r));
  const changed = await exampleRun({ attemptId: r.attemptId });
  changed.manifest.payloadHash = 'c'.repeat(64);
  changed.manifest.review.reviewedPayloadHash = 'c'.repeat(64);
  const res = await post(changed);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'HASH_CONFLICT');
});

test('a client disconnect aborts the run and frees the worker', async () => {
  let aborted;
  const seen = new Promise((resolve) => { aborted = resolve; });
  runnerImpl = ({ signal }) => new Promise((_, reject) => { signal.addEventListener('abort', () => { aborted(signal.reason); reject(Object.assign(new Error('x'), { code: 'ABORTED' })); }); });
  const r = await exampleRun();
  const ac = new AbortController();
  const res = await fetch(`${base}/api/submission-demo-runs`, { method: 'POST', headers: headers(r), body: form(r), signal: ac.signal });
  assert.equal(res.status, 200);
  ac.abort();
  assert.equal(await seen, 'disconnected');
  await new Promise((x) => setTimeout(x, 50));
  runnerImpl = async () => ({ receipt: { reference: 'DEMO-c', payloadHash: 'p', target: 'controlled-test-portal', confirmedAt: 't' }, files: [], metrics: { peakRssBytes: 1, blockedRequests: 0 } });
  const next = await post(await exampleRun());
  assert.equal(next.status, 200);
  await lines(next);
});

test('methods and unknown paths: no CORS, no preflight acceptance', async () => {
  assert.equal((await fetch(`${base}/api/submission-demo-runs`)).status, 405);
  const pre = await fetch(`${base}/api/submission-demo-runs`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-submission-schema' } });
  assert.equal(pre.status, 405);
  assert.equal(pre.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(`${base}/api/submission-capabilities`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/api/anything`)).status, 404);
  assert.equal((await fetch(`${base}/`)).status, 200, 'static site unchanged');
});

test('the real stack: real server, real runner, real Chromium, streamed to a verified DEMO receipt', async () => {
  const s = createServer({ api: createApi({ log: () => {} }) });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${s.address().port}`;
  const cap = (await (await fetch(`${b}/api/submission-capabilities`)).json()).adapters[0];
  assert.equal(cap.demoAvailable, true, 'Chromium starts on this machine');
  const r = await exampleRun();
  const res = await fetch(`${b}/api/submission-demo-runs`, { method: 'POST', headers: { ...headers(r), Origin: b }, body: form(r) });
  assert.equal(res.status, 200);
  const ev = await lines(res);
  const steps = ev.filter((e) => e.type === 'step' && e.status === 'complete').map((e) => e.step);
  assert.deepEqual(steps, ['check', 'prepare', 'open', 'fill', 'upload', 'review', 'submit', 'verify']);
  const done = ev.at(-1);
  assert.equal(done.type, 'completed');
  assert.equal(done.receipt.reference, `DEMO-${r.attemptId}`);
  assert.equal(done.receipt.payloadHash, r.manifest.payloadHash);
  assert.deepEqual(done.evidence.files.map((f) => f.sha256), r.manifest.attachments.map((a) => a.sha256));
  await new Promise((x) => s.close(x));
});
