import { test, expect } from './base.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'project', 'sprint-3', 'tickets', 'S3-001-automated-submission', 'evidence');
import { readStore, writeAnswers, orgApi, planAndLoadExample, confirmDeclarations, openReview, readyReview, gotoSection } from './package-helpers.js';

async function shot(page, name, opts = {}) {
  if (!process.env.S3_EVIDENCE) return;
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${test.info().project.name}.png`), ...opts });
}

async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test('worked example: package, hash, confirmations, disabled run control, frozen snapshot, no external requests', async ({ page, baseURL }) => {
  const outside = [];
  const own = new URL(baseURL).origin; // the app's own origin, local or deployed
  page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== own && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.push(r.url()); });
  await readyReview(page);

  await expect(page.getByTestId('review-ready')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('missing-info')).toContainText('Missing information (0)');
  const panel = page.getByTestId('review-next');
  await expect(page.getByTestId('proposal-summary')).toContainText('generated from your confirmed answers');
  await expect(page.getByTestId('proposal-summary')).toContainText('A4');
  const rows = page.getByTestId('attachment-list').locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Proposal');
  await expect(rows.nth(0)).toContainText('application/pdf');
  await expect(rows.nth(1)).toContainText('Accounts');
  await expect(rows.nth(1)).toContainText('synthetic-accounts-example.pdf');
  await expect(page.getByTestId('hash-proposal')).toHaveText(/^[0-9a-f]{64}$/);
  await expect(page.getByTestId('hash-accounts')).toHaveText(/^[0-9a-f]{64}$/);

  // explanation, unchecked confirmations, disabled primary control with the unavailable wording
  await expect(page.getByTestId('package-explanation')).toContainText('processed temporarily by our server');
  await expect(page.getByTestId('package-explanation')).toContainText('Nothing is sent to the real funder');
  await expect(page.getByTestId('package-explanation')).toContainText('originals stay in server storage for this charity');
  await expect(page.getByLabel('I have reviewed these demo answers and documents')).not.toBeChecked();
  await expect(page.getByLabel('Save a demo draft on the test portal using this package')).not.toBeChecked();
  await expect(page.getByTestId('run-demo')).toBeDisabled();
  await expect(page.getByTestId('run-demo')).toHaveText('Save demo draft');
  // Phase C: the runner is available, so the note explains the run instead of saying automation is unavailable
  await expect(page.getByTestId('automation-unavailable')).toContainText('takes up to 90 seconds');
  await expect(page.getByTestId('automation-unavailable')).toContainText('Keep this page open');
  await expect(panel).not.toContainText(/\bSubmit\b/);
  await expect(panel.locator('summary', { hasText: 'Live submission' })).toBeVisible();
  // The funder application page choice names the funder by design; the rest of the panel must not.
  const panelText = await panel.evaluate((el) => { const c = el.cloneNode(true); c.querySelector('[data-testid=funder-choice]')?.remove(); return c.textContent; });
  expect(panelText).not.toMatch(/Garfield|Weston|Blackbaud/);

  // nothing is saved before both boxes are ticked
  await page.getByLabel('I have reviewed these demo answers and documents').check();
  await expect(page.getByTestId('package-status')).toContainText('Nothing is saved');
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(0);
  await page.getByLabel('Save a demo draft on the test portal using this package').check();
  await expect(page.getByTestId('package-status')).toContainText('Package saved as snapshot');
  const snaps = await readStore(page, 'submissionSnapshots');
  expect(snaps).toHaveLength(1);
  const hash = await page.getByTestId('package-hash').innerText();
  expect(snaps[0].payloadHash).toBe(hash);
  expect(snaps[0].mode).toBe('demo');
  expect(snaps[0].adapter).toBe('garfield-weston-regular-core-demo.v1');
  expect(snaps[0].attachments.map((a) => a.role)).toEqual(['proposal', 'accounts']);
  expect(snaps[0].attachments[1].synthetic).toBe(true);
  expect(JSON.stringify(snaps[0].answers)).not.toContain('companyNumber');
  expect((await readStore(page, 'submissionFiles'))).toHaveLength(2);
  await expect(page.getByTestId('run-demo')).toBeEnabled(); // Phase C: a frozen, confirmed package can be run

  // download the proposal: a real PDF
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-proposal').click()]);
  const saved = path.join(os.tmpdir(), `proposal-${Date.now()}-${test.info().project.name}.pdf`);
  for (let i = 0; ; i += 1) { try { await dl.saveAs(saved); break; } catch (e) { if (i >= 25 || !/EPERM|EBUSY/.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 200)); } }
  const buf = fs.readFileSync(saved);
  fs.unlinkSync(saved);
  expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(dl.suggestedFilename()).toBe('your-place-proposal.pdf');

  // source notes
  await page.getByTestId('source-notes').locator('summary').click();
  await expect(page.getByTestId('source-notes')).toContainText('Source: synthetic demo example');
  await expectNoOverflow(page);
  await shot(page, 'S3-001-B-review-package', { fullPage: true });
  await page.getByTestId('review-next').scrollIntoViewIfNeeded();
  await shot(page, 'S3-001-B-package-panel');
  const small = await page.locator('.app-review a.btn, .app-review button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).length);
  expect(small).toBe(0);
  expect(outside).toEqual([]);
});

test('the same answers give the same proposal bytes and package hash on a second review', async ({ page }) => {
  await readyReview(page);
  const h1 = await page.getByTestId('package-hash').innerText();
  const p1 = await page.getByTestId('hash-proposal').innerText();
  await page.reload();
  await expect(page.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
  expect(await page.getByTestId('package-hash').innerText()).toBe(h1);
  expect(await page.getByTestId('hash-proposal').innerText()).toBe(p1);
});

test('editing an answer clears both confirmations, changes the hash, and leaves the frozen snapshot untouched', async ({ page }) => {
  await readyReview(page);
  const h1 = await page.getByTestId('package-hash').innerText();
  await page.getByLabel('I have reviewed these demo answers and documents').check();
  await page.getByLabel('Save a demo draft on the test portal using this package').check();
  await expect(page.getByTestId('package-status')).toContainText('Package saved');
  const before = (await readStore(page, 'submissionSnapshots'))[0];

  await page.getByTestId('edit-answers').click();
  const title = page.locator('[data-field="request.title"]').locator('input').first();
  await expect(page.getByTestId('section-title')).toBeVisible();
  await gotoSection(page, 'Funding request');
  await title.fill('Housing stability and support — core services (revised)');
  await expect(page.getByTestId('save-state')).toContainText(/Saved/);
  await page.getByRole('button', { name: 'Review application' }).click();
  await expect(page.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
  expect(await page.getByTestId('package-hash').innerText()).not.toBe(h1);
  await expect(page.getByLabel('I have reviewed these demo answers and documents')).not.toBeChecked();
  await expect(page.getByLabel('Save a demo draft on the test portal using this package')).not.toBeChecked();
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(1);

  await page.getByLabel('I have reviewed these demo answers and documents').check();
  await page.getByLabel('Save a demo draft on the test portal using this package').check();
  await expect(page.getByTestId('package-status')).toContainText('Package saved');
  const snaps = await readStore(page, 'submissionSnapshots');
  expect(snaps).toHaveLength(2);
  const old = snaps.find((s) => s.id === before.id);
  expect(old).toEqual(before); // byte-for-byte the same record: a new revision made a new snapshot
  const apps = await readStore(page, 'applications');
  expect(apps[0].lastSnapshotId).not.toBe(before.id);
  expect(snaps.find((s) => s.id !== before.id).revision).toBeGreaterThan(before.revision);
});

test('incomplete draft: no package, both boxes disabled', async ({ page }) => {
  await page.goto('/');
  await page.locator('li.grant[data-id="G-001"] button[data-action="plan"]').click();
  await expect(page.getByRole('heading', { name: 'Prepare your Garfield Weston application' })).toBeVisible();
  await page.getByRole('button', { name: 'Review application' }).click();
  await expect(page.getByTestId('package-blocked')).toBeVisible();
  await expect(page.getByTestId('attachment-list')).toHaveCount(0);
  await expect(page.getByTestId('check-reviewed')).toBeDisabled();
});

test('unsupported character blocks the proposal, naming the field and the character', async ({ page }) => {
  await readyReview(page);
  await writeAnswers(page, (a) => { a.answers['work.need'].value += ' Ł'; });
  await page.reload();
  const blocked = page.getByTestId('package-blocked');
  await expect(blocked).toContainText('What need are you responding to?');
  await expect(blocked).toContainText('"Ł" (U+0141)');
  await expect(page.getByTestId('attachment-list')).toHaveCount(0);
  await expect(page.getByTestId('check-reviewed')).toBeDisabled();
});

test('a proposal over ten pages blocks and names the sections that are too long', async ({ page }) => {
  await readyReview(page);
  await writeAnswers(page, (a) => {
    a.answers['finance.expenseRows'].value.push(...Array.from({ length: 450 }, (_, i) => ({ label: `Cost line ${i + 1}`, amountPence: 0, note: '' })));
  });
  await page.reload();
  const blocked = page.getByTestId('package-blocked');
  await expect(blocked).toHaveAttribute('data-code', 'too-long');
  await expect(blocked).toContainText('limit is 10');
  await expect(blocked).toContainText('Income and expenditure');
  await expect(page.getByTestId('check-transfer')).toBeDisabled();
  await shot(page, 'S3-001-B-overflow-blocked');
});

test('a text file is never accepted as accounts, including one renamed to .pdf', async ({ page }) => {
  await readyReview(page);
  const org = orgApi(page);
  const txt = (await org.listDocuments()).find((d) => d.filename === 'accounts-example.txt');
  const fake = await org.uploadDocument('renamed.pdf', 'application/pdf', new TextEncoder().encode('just text, not a pdf'), { title: 'Renamed text', category: 'financial' });
  const ids = { txt: txt.id, fake: fake.id };
  for (const [id, expected] of [[ids.txt, /only PDF or DOCX/], [ids.fake, /does not start like a real PDF/]]) {
    await writeAnswers(page, (a, v) => { a.answers['evidence.accountsId'].value = v; }, id);
    await page.reload();
    await expect(page.getByTestId('package-blocked')).toContainText(expected);
    await expect(page.getByTestId('attachment-list')).toHaveCount(0);
  }
});

test('layout: the review with the package has no horizontal overflow', async ({ page }) => {
  await readyReview(page);
  await page.getByLabel('I have reviewed these demo answers and documents').check();
  await page.getByLabel('Save a demo draft on the test portal using this package').check();
  await expect(page.getByTestId('package-status')).toContainText('Package saved');
  await expectNoOverflow(page);
  await page.getByTestId('review-next').scrollIntoViewIfNeeded();
  await shot(page, 'S3-001-B-package-confirmed');
});
