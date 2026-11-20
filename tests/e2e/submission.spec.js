// S3-001 Phase C, all three viewports: the worked example through a REAL demo run (server, test portal, Chromium)
// to a DEMO receipt in Tracking. Synthetic data only; nothing leaves this origin.
import { test, expect } from './base.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStore, readyReview, confirmBoth } from './package-helpers.js';

const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'project', 'sprint-3', 'tickets', 'S3-001-automated-submission', 'evidence');
async function shot(page, name, opts = {}) {
  if (!process.env.S3_EVIDENCE) return;
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${test.info().project.name}.png`), ...opts });
}
async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}
async function expectLargeControls(page, scope) {
  const small = await page.locator(`${scope} a.btn, ${scope} button`).evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map((e) => e.textContent));
  expect(small).toEqual([]);
}

test('worked example: real demo run to a DEMO receipt, shown in Tracking and on the planning card', async ({ page, baseURL }) => {
  test.setTimeout(120000);
  const own = new URL(baseURL).origin;
  const outside = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== own) outside.push(u); });
  await readyReview(page);
  await expect(page.getByTestId('run-demo')).toBeDisabled();
  await confirmBoth(page);
  const run = page.getByTestId('run-demo');
  await expect(run).toBeEnabled();
  await expect(page.getByTestId('automation-unavailable')).toContainText('Keep this page open');

  await run.click();
  await expect(page.getByTestId('run-progress')).toBeVisible();
  await expect(page.getByTestId('run-complete')).toBeVisible({ timeout: 90000 });
  const steps = page.getByTestId('run-progress').locator('li');
  await expect(steps).toHaveCount(8);
  for (let i = 0; i < 8; i += 1) await expect(steps.nth(i)).toHaveAttribute('data-status', 'complete');
  await expect(steps.nth(0)).toContainText('Checking package');
  await expect(steps.nth(7)).toContainText('Verifying receipt');

  const complete = page.getByTestId('run-complete');
  await expect(complete).toContainText('Demo submission completed — nothing sent to Garfield Weston');
  const attempts = await readStore(page, 'submissionAttempts');
  expect(attempts).toHaveLength(1);
  expect(attempts[0].state).toBe('demo_completed');
  await expect(page.getByTestId('receipt-reference')).toHaveText(`DEMO-${attempts[0].id}`);
  const receipts = await readStore(page, 'submissionReceipts');
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({ mode: 'demo', target: 'controlled-test-portal', reference: `DEMO-${attempts[0].id}`, attemptId: attempts[0].id });
  const snaps = await readStore(page, 'submissionSnapshots');
  expect(receipts[0].payloadHash).toBe(snaps[0].payloadHash);
  expect(receipts[0].evidenceSummary.portalFiles.map((f) => f.sha256)).toEqual(snaps[0].attachments.map((a) => a.sha256));
  await expect(complete).not.toContainText(/Awarded|awaiting decision/i);
  await expect(page.getByTestId('run-demo')).toBeDisabled();
  await expect(page.getByTestId('check-reviewed')).toBeDisabled();
  await expectNoOverflow(page);
  await expectLargeControls(page, '[data-testid="run-complete"]');
  await page.getByTestId('run-area').scrollIntoViewIfNeeded();
  await shot(page, 'S3-001-C-run-completed');

  // Tracking: demo records only
  await page.getByTestId('view-tracking').click();
  await expect(page).toHaveURL(/#\/tracking$/);
  await expect(page.locator('h1')).toHaveText('Tracking');
  await expect(page.getByTestId('tracking-notice')).toContainText('nothing was sent to Garfield Weston');
  await expect(page.getByTestId('receipt-card')).toHaveCount(1);
  await expect(page.getByTestId('tracking-reference')).toHaveText(`DEMO-${attempts[0].id}`);
  await expect(page.getByTestId('attempt')).toHaveCount(1);
  await expect(page.getByTestId('attempt').first()).toHaveAttribute('data-state', 'demo_completed');
  await expect(page.getByTestId('tracking')).not.toContainText(/Awarded|Awaiting decision/);
  await expectNoOverflow(page);
  await expectLargeControls(page, '[data-testid="tracking"]');
  await shot(page, 'S3-001-C-tracking', { fullPage: true });

  // download the receipt from Tracking
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('tracking-download').click()]);
  expect(dl.suggestedFilename()).toBe(`DEMO-${attempts[0].id}.json`);

  // planning card; G-001 stays in planning (no new grant state); no past bid created
  await page.goto('/#/planning');
  await expect(page.getByTestId('card-demo')).toContainText(`Completed demo (DEMO-${attempts[0].id})`);
  expect(await readStore(page, 'bids')).toHaveLength(3);
  expect(outside).toEqual([]);
});

test('the review of an already-run package shows its receipt instead of offering a second run', async ({ page }) => {
  test.setTimeout(120000);
  await readyReview(page);
  await confirmBoth(page);
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('run-complete')).toBeVisible({ timeout: 90000 });
  await page.reload();
  await expect(page.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
  await expect(page.getByTestId('run-complete')).toBeVisible();
  await expect(page.getByTestId('run-demo')).toBeDisabled();
  expect(await readStore(page, 'submissionAttempts')).toHaveLength(1);
  await expectNoOverflow(page);
});

test('layout: progress with mixed steps and the not-confirmed state fit at every width', async ({ page }) => {
  await readyReview(page);
  await confirmBoth(page);
  await page.route('**/api/submission-demo-runs', (route) => {
    const id = route.request().headers()['idempotency-key'];
    const at = new Date().toISOString();
    const ev = [['check', 'complete'], ['prepare', 'started'], ['prepare', 'complete'], ['open', 'started'], ['open', 'complete'], ['fill', 'started']];
    return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/x-ndjson' }, body: `${ev.map(([step, status], i) => JSON.stringify({ seq: i + 1, attemptId: id, type: 'step', step, status, at })).join('\n')}\n` });
  });
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('run-failed')).toHaveAttribute('data-state', 'interrupted_unknown');
  const steps = page.getByTestId('run-progress').locator('li');
  await expect(steps.nth(2)).toHaveAttribute('data-status', 'complete');
  await expect(steps.nth(3)).toHaveAttribute('data-status', 'current');
  await expect(steps.nth(7)).toHaveAttribute('data-status', 'pending');
  await expect(page.getByTestId('run-demo')).toBeDisabled(); // only the deliberate retry (same attempt) is offered
  await expect(page.getByTestId('retry-run')).toBeEnabled();
  await expectNoOverflow(page);
  await expectLargeControls(page, '[data-testid="run-area"]');
  await page.getByTestId('run-area').scrollIntoViewIfNeeded();
  await shot(page, 'S3-001-C-run-not-confirmed');
});
