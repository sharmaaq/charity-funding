// Real Chromium against the real test portal. Every negative case must end without a completed receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDemo, RunError, STEPS } from '../../server/demo-runner.js';
import { exampleRun } from './fixture.js';

async function run(opts = {}) {
  const r = await exampleRun();
  if (opts.edit) opts.edit(r);
  const events = [];
  let cleanup = null;
  const hooks = { ...(opts.hooks || {}), afterCleanup: (x) => { cleanup = x; } };
  try {
    const out = await runDemo({ manifest: r.manifest, flat: r.flat, files: r.files, emit: (step, status) => events.push(`${step}:${status}`), faults: opts.faults, deadlineMs: opts.deadlineMs, signal: opts.signal, hooks });
    return { out, events, cleanup, r };
  } catch (error) {
    return { error, events, cleanup, r };
  }
}

async function assertCleanedUp(cleanup) {
  assert.ok(cleanup, 'cleanup ran');
  if (cleanup.browser) assert.equal(cleanup.browser.isConnected(), false, 'browser closed');
  if (cleanup.portal) await assert.rejects(fetch(cleanup.portal.startUrl), 'portal listener closed');
}

test('fills, uploads real bytes, reviews, submits once and verifies a DEMO receipt', async () => {
  const { out, events, cleanup, r } = await run();
  assert.equal(out.receipt.reference, `DEMO-${r.attemptId}`);
  assert.equal(out.receipt.payloadHash, r.manifest.payloadHash);
  assert.equal(out.receipt.target, 'controlled-test-portal');
  assert.deepEqual(out.files.map((f) => f.sha256), r.manifest.attachments.map((a) => a.sha256), 'the portal hashed exactly the bytes in the package');
  assert.deepEqual(events.filter((e) => e.endsWith(':complete')).map((e) => e.split(':')[0]), STEPS.filter((s) => s !== 'check'));
  assert.equal(cleanup.portal.state.submits, 1);
  assert.equal(cleanup.portal.state.pages.request['request.amountPence'], '50000.00', 'pence become pounds without separators');
  assert.equal(cleanup.blocked.length, 0);
  assert.ok(out.metrics.durationMs < 90000);
  await assertCleanedUp(cleanup);
});

const failures = [
  ['a missing control stops with PORTAL_SCHEMA_CHANGED', { faults: { missingField: 'org.postcode' } }, 'PORTAL_SCHEMA_CHANGED', 'org.postcode'],
  ['a duplicated control stops; nothing is chosen by position', { faults: { duplicateField: 'contact.email' } }, 'PORTAL_SCHEMA_CHANGED', 'contact.email'],
  ['a new required question stops before anything is written on that page', { faults: { extraRequiredField: { page: 'compliance', key: 'compliance.newQuestion' } } }, 'PORTAL_SCHEMA_CHANGED', 'compliance.newQuestion'],
  ['an upload rejection stops at the upload step', { faults: { rejectUpload: true } }, 'UPLOAD_REJECTED', null],
  ['a receipt with the wrong hash is never reported as completed', { faults: { receiptHashWrong: true } }, 'RECEIPT_MISMATCH', null],
  ['a lost final response is unconfirmed and is not clicked again', { faults: { dropSubmitResponse: true } }, 'SUBMIT_UNCONFIRMED', null],
];
for (const [name, opts, code, fieldPath] of failures) {
  test(name, async () => {
    const { error, events, cleanup } = await run(opts);
    assert.ok(error instanceof RunError, `expected a RunError, got ${error}`);
    assert.equal(error.code, code);
    if (fieldPath) assert.equal(error.fieldPath, fieldPath);
    assert.ok(!events.includes('verify:complete'));
    assert.ok(cleanup.portal.state.submits <= 1, 'submit is never repeated');
    if (code === 'SUBMIT_UNCONFIRMED') assert.equal(cleanup.portal.state.submits, 1);
    if (code !== 'SUBMIT_UNCONFIRMED' && code !== 'RECEIPT_MISMATCH') assert.equal(cleanup.portal.state.receipt, null);
    await assertCleanedUp(cleanup);
  });
}

test('a portal that stops answering hits the deadline and reports TIMEOUT', async () => {
  const { error, cleanup } = await run({ faults: { hangOn: 'request' }, deadlineMs: 3000 });
  assert.equal(error.code, 'TIMEOUT');
  assert.equal(cleanup.portal.state.receipt, null);
  await assertCleanedUp(cleanup);
});

test('an abort (client disconnect) stops the run and cleans up', async () => {
  const ac = new AbortController();
  const { error, cleanup } = await run({ signal: ac.signal, hooks: { beforeSubmit: () => ac.abort('disconnected') } });
  assert.equal(error.code, 'ABORTED');
  assert.equal(cleanup.portal.state.submits, 0);
  await assertCleanedUp(cleanup);
});

test('a browser crash is reported as BROWSER_CRASHED, never as completed', async () => {
  const { error, cleanup } = await run({ hooks: { beforeSubmit: ({ browser }) => browser.close() } });
  assert.equal(error.code, 'BROWSER_CRASHED');
  assert.equal(cleanup.portal.state.submits, 0);
  await assertCleanedUp(cleanup);
});

test('network boundary: the run browser cannot reach any other host, and answer text cannot inject markup', async () => {
  const { out, cleanup } = await run({
    edit: (r) => {
      const role = '<img src="https://www.blackbaud.com/x.png"> Fundraising Manager';
      r.flat['contact.role'] = role;
      r.manifest.answers.contact.role = role;
    },
    // Sub-resource requests to other hosts from inside the run browser: each must be blocked by the route.
    hooks: { afterOpen: async ({ page }) => { await page.setContent('<img src="https://www.blackbaud.com/a.png"><link rel="stylesheet" href="http://example.com/x.css">'); } },
  });
  assert.ok(out.receipt, 'the run still completes');
  assert.ok(cleanup.blocked.some((u) => u.startsWith('https://www.blackbaud.com')));
  assert.ok(cleanup.blocked.some((u) => u.startsWith('http://example.com')));
  assert.ok(!cleanup.blocked.some((u) => u.includes('x.png')), 'the answer was rendered as text, so no image was requested');
  assert.equal(cleanup.portal.state.pages.organisation['contact.role'], '<img src="https://www.blackbaud.com/x.png"> Fundraising Manager');
});

test('parallel attempts are isolated: separate portals, sessions and receipts', async () => {
  const [a, b] = await Promise.all([run(), run()]);
  assert.ok(a.out && b.out);
  assert.notEqual(a.out.receipt.reference, b.out.receipt.reference);
  assert.notEqual(a.cleanup.portal.origin, b.cleanup.portal.origin);
  assert.equal(a.cleanup.portal.state.submits, 1);
  assert.equal(b.cleanup.portal.state.submits, 1);
  await assertCleanedUp(a.cleanup);
  await assertCleanedUp(b.cleanup);
});
