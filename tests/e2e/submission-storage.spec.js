// S3-001 Phase C, desktop only: concurrency, interruption, persistence failure, retries and revised drafts.
// Where a fault is needed it is injected at the network boundary (page.route) or through the repository's test hook;
// the app code paths are the real ones.
import { test, expect } from '@playwright/test';
import { readStore, readyReview, gotoSection, confirmBoth } from './package-helpers.js';

const RUNS = '**/api/submission-demo-runs';
const ndjson = (attemptId, events) => `${events.map((e, i) => JSON.stringify({ seq: i + 1, attemptId, at: new Date().toISOString(), ...e })).join('\n')}\n`;

test('an interrupted stream is "not confirmed"; a deliberate retry reuses the same attempt and gives one receipt', async ({ page }) => {
  test.setTimeout(120000);
  await readyReview(page);
  await confirmBoth(page);
  let calls = 0;
  await page.route(RUNS, async (route) => {
    calls += 1;
    const id = route.request().headers()['idempotency-key'];
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/x-ndjson' }, body: ndjson(id, [{ type: 'step', step: 'check', status: 'complete' }, { type: 'step', step: 'prepare', status: 'started' }]) });
  });
  await page.getByTestId('run-demo').click();
  const failed = page.getByTestId('run-failed');
  await expect(failed).toHaveAttribute('data-state', 'interrupted_unknown');
  await expect(failed).toContainText('not confirmed');
  await expect(page.getByTestId('run-complete')).toHaveCount(0);
  const [first] = await readStore(page, 'submissionAttempts');
  expect(first.state).toBe('interrupted_unknown');
  expect(await readStore(page, 'submissionReceipts')).toHaveLength(0);
  expect(calls).toBe(1);

  await page.unroute(RUNS);
  await page.getByTestId('retry-run').click();
  await expect(page.getByTestId('run-complete')).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId('receipt-reference')).toHaveText(`DEMO-${first.id}`);
  const attempts = await readStore(page, 'submissionAttempts');
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ id: first.id, state: 'demo_completed', tries: 2 });
  expect(attempts[0].history[0].state).toBe('interrupted_unknown');
  expect(await readStore(page, 'submissionReceipts')).toHaveLength(1);
});

test('a malformed stream, a foreign attempt ID or a receipt for another package never completes', async ({ page }) => {
  await readyReview(page);
  await confirmBoth(page);
  const variants = [
    (id) => ndjson(id, [{ type: 'step', step: 'check', status: 'complete' }]).replace('"seq":1', '"seq":5'),
    () => ndjson('00000000-0000-4000-8000-000000000000', [{ type: 'step', step: 'check', status: 'complete' }]),
    (id) => ndjson(id, [{ type: 'step', step: 'check', status: 'complete' }, { type: 'completed', mode: 'demo', receipt: { reference: `DEMO-${id}`, payloadHash: 'f'.repeat(64), target: 'controlled-test-portal', confirmedAt: new Date().toISOString() } }]),
  ];
  for (const [i, make] of variants.entries()) {
    await page.unroute(RUNS);
    await page.route(RUNS, (route) => route.fulfill({ status: 200, headers: { 'Content-Type': 'application/x-ndjson' }, body: make(route.request().headers()['idempotency-key']) }));
    await page.getByTestId(i === 0 ? 'run-demo' : 'retry-run').click();
    await expect(page.getByTestId('run-failed')).toHaveAttribute('data-state', 'interrupted_unknown');
    await expect(page.getByTestId('run-complete')).toHaveCount(0);
  }
  expect(await readStore(page, 'submissionReceipts')).toHaveLength(0);
});

test('double click and a second tab give one attempt; the second tab sees the run in progress and cannot start another', async ({ page, context }) => {
  test.setTimeout(120000);
  await readyReview(page);
  await confirmBoth(page);
  let release;
  const held = new Promise((r) => { release = r; });
  let calls = 0;
  await page.route(RUNS, async (route) => { calls += 1; await held; await route.continue(); });
  await page.getByTestId('run-demo').dblclick();
  await expect(page.getByTestId('cancel-run')).toBeVisible();
  await expect(page.getByTestId('run-demo')).toBeDisabled();
  await page.waitForTimeout(300);
  expect(calls).toBe(1);

  // Abandon is unavailable on the planning list while the run is in progress (same tab, different page of the app)
  await page.goto('/#/planning');
  await expect(page.locator('li.grant[data-id="G-001"] button[data-action="abandon"]')).toBeDisabled();
  await expect(page.getByTestId('card-demo')).toContainText('Demo run in progress');
  await page.goBack();
  await expect(page.getByTestId('cancel-run')).toBeVisible();

  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
  await confirmBoth(other);
  // the other tab sees the live run (its Web Lock is held) and cannot start a second one
  await expect(other.getByTestId('run-elsewhere')).toContainText('in progress in another tab');
  await expect(other.getByTestId('run-demo')).toBeDisabled();
  // and even if a stale screen tried, the transactional attempt lock refuses a second running attempt
  const refused = await other.evaluate(async () => {
    const { openDb } = await import('/js/org/db.js');
    const { createApplicationRepository } = await import('/js/application/repository.js');
    const apps = createApplicationRepository(await openDb());
    const [snap] = await new Promise((res) => { const r = indexedDB.open('charity-funding.organisation'); r.onsuccess = () => { const q = r.result.transaction('submissionSnapshots').objectStore('submissionSnapshots').getAll(); q.onsuccess = () => res(q.result); }; });
    try { await apps.acquireAttempt({ applicationId: snap.applicationId, snapshotId: snap.id, payloadHash: snap.payloadHash }); return 'acquired'; } catch (e) { return e.code; }
  });
  expect(refused).toBe('attempt-active');
  expect(await readStore(page, 'submissionAttempts')).toHaveLength(1);

  release();
  await expect(page.getByTestId('run-complete')).toBeVisible({ timeout: 90000 });
  expect(await readStore(page, 'submissionAttempts')).toHaveLength(1);
  expect(await readStore(page, 'submissionReceipts')).toHaveLength(1);
  await expect(page.locator('li.grant[data-id="G-001"] button[data-action="abandon"]')).toHaveCount(0); // still on the review
  await other.close();
});

test('reloading during a run leaves it "not confirmed" in Tracking, never retried automatically', async ({ page }) => {
  await readyReview(page);
  await confirmBoth(page);
  let calls = 0;
  await page.route(RUNS, () => { calls += 1; /* never answered: the page is reloaded mid-run */ });
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('cancel-run')).toBeVisible();
  await page.goto('/#/tracking');
  await page.reload();
  const attempt = page.getByTestId('attempt');
  await expect(attempt).toHaveCount(1);
  await expect(attempt).toHaveAttribute('data-state', 'interrupted_unknown');
  await expect(attempt).toContainText('Not confirmed');
  await expect(page.getByTestId('receipt-card')).toHaveCount(0);
  await expect(page.getByTestId('no-receipt')).toBeVisible();
  expect(calls).toBe(1);
});

test('stopping a run before it submits is "stopped", with nothing submitted', async ({ page }) => {
  await readyReview(page);
  await confirmBoth(page);
  await page.route(RUNS, () => { /* held until the manager stops it */ });
  await page.getByTestId('run-demo').click();
  await page.getByTestId('cancel-run').click();
  await expect(page.getByTestId('run-failed')).toHaveAttribute('data-state', 'cancelled');
  await expect(page.getByTestId('run-failed')).toContainText('before the demo portal received anything');
  expect((await readStore(page, 'submissionAttempts'))[0].state).toBe('cancelled');
});

test('receipt save failure: the result stays visible, can be downloaded, and Retry save stores it without re-running', async ({ page }) => {
  test.setTimeout(120000);
  await readyReview(page);
  await confirmBoth(page);
  let calls = 0;
  page.on('request', (r) => { if (r.url().endsWith('/api/submission-demo-runs')) calls += 1; });
  await page.evaluate(() => { globalThis.__APP_TEST_HOOKS__ = { abortNext: 'finishAttempt' }; });
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('receipt-not-saved')).toBeVisible({ timeout: 90000 });
  await expect(page.getByTestId('receipt-not-saved')).toContainText('Demo completed; receipt not saved in this browser');
  await expect(page.getByTestId('run-complete')).toBeVisible();
  expect(await readStore(page, 'submissionReceipts')).toHaveLength(0);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-receipt').click()]);
  expect(dl.suggestedFilename()).toMatch(/^DEMO-.*\.json$/);
  await page.getByTestId('retry-save').click();
  await expect(page.getByTestId('receipt-not-saved')).toHaveCount(0);
  expect(await readStore(page, 'submissionReceipts')).toHaveLength(1);
  expect((await readStore(page, 'submissionAttempts'))[0].state).toBe('demo_completed');
  expect(calls).toBe(1);
});

test('busy runner (429) and unavailable runner are honest: no success, no receipt', async ({ page }) => {
  await readyReview(page);
  await confirmBoth(page);
  await page.route(RUNS, (route) => route.fulfill({ status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' }, body: JSON.stringify({ code: 'BUSY', message: 'Another demo run is in progress.', retryable: true, fieldErrors: [] }) }));
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('run-failed')).toHaveAttribute('data-state', 'failed');
  await expect(page.getByTestId('run-failed')).toContainText('busy');
  await expect(page.getByTestId('retry-run')).toBeVisible();
  expect(await readStore(page, 'submissionReceipts')).toHaveLength(0);

  const fresh = await page.context().newPage();
  await fresh.route('**/api/submission-capabilities', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await fresh.goto(page.url());
  await expect(fresh.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
  await fresh.getByLabel('I have reviewed these demo answers and documents').check();
  await fresh.getByLabel('Run the demo transfer using this package').check();
  await expect(fresh.getByTestId('automation-unavailable')).toContainText('Automation unavailable');
  await expect(fresh.getByTestId('run-demo')).toBeDisabled();
  await fresh.close();
});

test('Create revised draft keeps the old receipt; only a changed package can be run again', async ({ page }) => {
  test.setTimeout(150000);
  await readyReview(page);
  await confirmBoth(page);
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('run-complete')).toBeVisible({ timeout: 90000 });
  const [oldReceipt] = await readStore(page, 'submissionReceipts');

  await page.getByTestId('revise-draft').click();
  await expect(page).toHaveURL(/application$/);
  await expect(page.getByTestId('section-title')).toBeVisible();
  // unchanged answers: the same package, already submitted
  await page.getByRole('button', { name: 'Review application' }).click();
  await expect(page.getByTestId('run-complete')).toBeVisible();
  await expect(page.getByTestId('run-demo')).toBeDisabled();

  await page.getByTestId('edit-answers').click();
  await gotoSection(page, 'Funding request');
  await page.locator('[data-field="request.title"]').locator('input').first().fill('Housing stability and support — core services (revised)');
  await expect(page.getByTestId('save-state')).toContainText(/Saved/);
  await page.getByRole('button', { name: 'Review application' }).click();
  await expect(page.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
  await expect(page.getByTestId('run-complete')).toHaveCount(0);
  await confirmBoth(page);
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('run-complete')).toBeVisible({ timeout: 90000 });
  const receipts = await readStore(page, 'submissionReceipts');
  expect(receipts).toHaveLength(2);
  expect(receipts.find((r) => r.id === oldReceipt.id)).toEqual(oldReceipt);
  await page.goto('/#/tracking');
  await expect(page.getByTestId('receipt-card')).toHaveCount(2);
});
