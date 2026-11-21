// Real Chromium against the real test portal. Draft-only: no case may ever perform a final submission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDemo, RunError, STEPS } from '../../server/demo-runner.js';
import { exampleRun } from './fixture.js';
import { demoAdapter } from '../../server/adapters/gwf-demo.js';
import { liveAdapter } from '../../server/adapters/gwf-live-readiness.js';

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

test('fills, uploads real bytes, reviews, saves ONE draft, never submits, and verifies the draft read-back', async () => {
  const { out, events, cleanup, r } = await run();
  assert.equal(out.receipt.reference, `DEMO-${r.attemptId}`);
  assert.equal(out.receipt.payloadHash, r.manifest.payloadHash);
  assert.equal(out.receipt.target, 'controlled-test-portal');
  assert.equal(out.receipt.kind, 'draft');
  assert.deepEqual(out.files.map((f) => f.sha256), r.manifest.attachments.map((a) => a.sha256), 'the portal hashed exactly the bytes in the package');
  assert.deepEqual(events.filter((e) => e.endsWith(':complete')).map((e) => e.split(':')[0]), STEPS.filter((s) => s !== 'check'));
  assert.equal(cleanup.portal.state.submits, 0, 'the portal final submission counter stays at zero');
  assert.equal(cleanup.portal.state.drafts, 1);
  assert.equal(cleanup.portal.state.receipt, null, 'no submission receipt exists');
  assert.ok(!cleanup.portal.state.requests.some((q) => q.endsWith('/submit')), 'no request ever reached the submit endpoint');
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
  ['a draft read-back with the wrong hash is never reported as completed', { faults: { draftHashWrong: true } }, 'DRAFT_MISMATCH', null],
  ['a lost save-draft response is unconfirmed and is not clicked again', { faults: { dropDraftResponse: true } }, 'DRAFT_UNCONFIRMED', null],
];
for (const [name, opts, code, fieldPath] of failures) {
  test(name, async () => {
    const { error, events, cleanup } = await run(opts);
    assert.ok(error instanceof RunError, `expected a RunError, got ${error}`);
    assert.equal(error.code, code);
    if (fieldPath) assert.equal(error.fieldPath, fieldPath);
    assert.ok(!events.includes('verify:complete'));
    assert.equal(cleanup.portal.state.submits, 0, 'final submit is never used');
    assert.ok(cleanup.portal.state.drafts <= 1, 'save draft is never repeated');
    if (code === 'DRAFT_UNCONFIRMED') assert.equal(cleanup.portal.state.drafts, 1);
    if (code !== 'DRAFT_UNCONFIRMED' && code !== 'DRAFT_MISMATCH') assert.equal(cleanup.portal.state.draft, null);
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
  const { error, cleanup } = await run({ signal: ac.signal, hooks: { beforeSaveDraft: () => ac.abort('disconnected') } });
  assert.equal(error.code, 'ABORTED');
  assert.equal(cleanup.portal.state.submits, 0);
  await assertCleanedUp(cleanup);
});

test('a browser crash is reported as BROWSER_CRASHED, never as completed', async () => {
  const { error, cleanup } = await run({ hooks: { beforeSaveDraft: ({ browser }) => browser.close() } });
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
  assert.equal(a.cleanup.portal.state.drafts, 1);
  assert.equal(b.cleanup.portal.state.drafts, 1);
  assert.equal(a.cleanup.portal.state.submits + b.cleanup.portal.state.submits, 0);
  await assertCleanedUp(a.cleanup);
  await assertCleanedUp(b.cleanup);
});

// ---- Phase 2: draft-only boundary (spec REQ-037) ----

test('the runner action registry has no submit action', () => {
  assert.ok(!STEPS.includes('submit'));
  assert.ok(STEPS.includes('save-draft'));
  assert.equal(typeof demoAdapter.submit, 'undefined', 'the demo adapter exposes no submit');
  assert.equal(typeof demoAdapter.saveDraft, 'function');
  assert.ok(!Object.keys(demoAdapter).some((k) => /submit/i.test(k)));
});

test('pressing Enter in the final-submit form of the portal does not submit: the request filter blocks it', async () => {
  const { out, cleanup } = await run({
    hooks: {
      beforeSaveDraft: async ({ page }) => {
        // Implicit submission: Enter in a text field of the final-submit form sends that form's POST to /submit.
        await page.locator('main [data-form="final-submit"] input[name="reviewedPayloadHash"]').fill('x');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
      },
    },
  });
  assert.equal(cleanup.portal.state.submits, 0, 'the portal counted no submission');
  assert.ok(cleanup.blocked.some((u) => u.startsWith('POST ') && /\/submit$/.test(u)), 'the POST to /submit was blocked by the request filter');
  assert.ok(!cleanup.portal.state.requests.some((q) => q.endsWith('/submit')));
  assert.equal(out, undefined, 'the page is left on a blocked navigation, so the run does not report success');
});

test('a direct POST to the portal submit endpoint from the runner context is blocked by the request filter', async () => {
  const { cleanup } = await run({
    hooks: {
      beforeSaveDraft: async ({ page, portal }) => {
        const url = `${portal.origin}/portal/${await page.locator('main').getAttribute('data-portal-token')}/submit`;
        await page.setContent(`<form method="post" action="${url}"><input name="reviewedPayloadHash" value="x"><input name="demoTransfer" value="on"><button type="submit" id="go">go</button></form>`);
        await page.locator('#go').click();
        await page.waitForTimeout(400);
      },
    },
  });
  assert.equal(cleanup.portal.state.submits, 0);
  assert.equal(cleanup.portal.state.receipt, null);
  assert.ok(cleanup.blocked.some((u) => u.startsWith('POST ') && u.endsWith('/submit')));
  assert.ok(!cleanup.portal.state.requests.some((q) => q.endsWith('/submit')), 'the portal never saw the request');
});

test('live adapter submit() throws FINAL_SUBMISSION_DISABLED for any input', async () => {
  const inputs = [undefined, null, {}, { confirm: true }, { override: true, enable: true, mode: 'live' }, 'submit', 42, [{ allowSubmit: 1 }]];
  const saved = { ...process.env };
  process.env.ALLOW_FINAL_SUBMISSION = '1';
  process.env.ENABLE_LIVE_SUBMIT = 'true';
  try {
    for (const input of inputs) {
      await assert.rejects(() => liveAdapter.submit(input, input, input), (e) => e.code === 'FINAL_SUBMISSION_DISABLED');
    }
    await assert.rejects(() => liveAdapter.submit(), (e) => e.code === 'FINAL_SUBMISSION_DISABLED');
  } finally {
    for (const k of ['ALLOW_FINAL_SUBMISSION', 'ENABLE_LIVE_SUBMIT']) if (!(k in saved)) delete process.env[k];
  }
});
