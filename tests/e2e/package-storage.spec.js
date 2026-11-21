import { test, expect } from './base.js';
import { createHash } from 'node:crypto';
import { readStore, readyReview, saveFromOtherTab, fillStorage } from './package-helpers.js';

const tick = async (page) => {
  await page.getByLabel('I have reviewed these demo answers and documents').check();
  await page.getByLabel('Save a demo draft on the test portal using this package').check();
};

test('attachment bytes are identical after copying into the snapshot and after a reload (SHA-256)', async ({ page }) => {
  await readyReview(page);
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('Package saved');
  const shownProposal = await page.getByTestId('hash-proposal').innerText();
  const shownAccounts = await page.getByTestId('hash-accounts').innerText();
  await page.reload();
  // Everything below comes from the server's copies, hashed here in Node, independent of the app's code.
  const sha = async (url) => createHash('sha256').update(await (await page.request.get(url)).body()).digest('hex');
  const app = (await (await page.request.get('/api/charities/your-place/applications/by-grant/G-001')).json()).application;
  const snap = (await (await page.request.get(`/api/charities/your-place/snapshots/${app.lastSnapshotId}`)).json()).snapshot;
  const files = await (await page.request.get(`/api/charities/your-place/snapshots/${snap.id}/files`)).json();
  const hashes = [];
  for (const f of files) hashes.push(await sha(`/api/charities/your-place/snapshots/${snap.id}/files/${f.id}`));
  const original = await sha(`/api/charities/your-place/documents/${snap.attachments[1].sourceId}/file`);
  expect(hashes).toEqual(snap.attachments.map((a) => a.sha256));
  expect(hashes).toEqual([shownProposal, shownAccounts]);
  expect(hashes[1]).toBe(original);
});

test('a failed save while freezing keeps the draft, shows an actionable error and never says saved; retry works', async ({ page }) => {
  let refuse = true;
  await page.route('**/applications/*/snapshots', (route) => {
    if (refuse && route.request().method() === 'POST') { refuse = false; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'quota' }) }); }
    return route.continue();
  });
  await readyReview(page);
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('The package was not saved');
  await expect(page.getByTestId('package-status')).toContainText('no room');
  await expect(page.getByTestId('package-status')).not.toContainText('Package saved');
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(0);
  expect(await readStore(page, 'submissionFiles')).toHaveLength(0);
  expect((await readStore(page, 'applications'))[0].lastSnapshotId).toBeNull();
  await expect(page.getByLabel('I have reviewed these demo answers and documents')).not.toBeChecked();
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('Package saved');
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(1);
});

test('stale source: if the accounts document changes after the review was prepared, the commit aborts and nothing is stored', async ({ page }) => {
  await readyReview(page);
  const docs = await (await page.request.get('/api/charities/your-place/documents')).json();
  const d = docs.find((x) => x.filename === 'synthetic-accounts-example.pdf');
  const res = await page.request.put(`/api/charities/your-place/documents/${d.id}`, {
    headers: { Origin: new URL(page.url()).origin },
    data: { title: `${d.title} edited`, category: d.category, description: d.description, period: d.period, tags: d.tags, documentDate: d.documentDate },
  });
  expect(res.ok()).toBe(true);
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('changed while it was being prepared');
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(0);
});

test('stale draft: a revision change from another tab aborts the commit', async ({ page }) => {
  await readyReview(page);
  await saveFromOtherTab(page, 'org.companyNumber', 'FROM-OTHER-TAB');
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('changed in another tab');
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(0);
});

const makePdf = (pages) => `(async () => { const { PDFDocument } = await import('/vendor/pdf-lib.esm.min.js'); const d = await PDFDocument.create(); for (let i = 0; i < ${pages}; i++) d.addPage([595, 842]); return Array.from(await d.save()); })()`;

test('manager-supplied proposal PDF: page count read, confirmation required, "manager checked" shown, never called verified', async ({ page }) => {
  await readyReview(page);
  const bytes = await page.evaluate(makePdf(2));
  await page.getByTestId('replace-proposal-file').setInputFiles({ name: 'my-proposal.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
  await expect(page.getByTestId('replacement-summary')).toContainText('my-proposal.pdf · 2 pages (read from the file)');
  await expect(page.getByTestId('replacement-summary')).toContainText('Not checked yet');
  await expect(page.getByTestId('package-blocked')).toHaveAttribute('data-code', 'replacement-unchecked');
  await expect(page.getByTestId('check-reviewed')).toBeDisabled();
  await page.getByLabel(/I have checked this PDF: it has 2 pages/).check();
  await expect(page.getByTestId('replacement-summary')).toContainText('Manager checked (not format-verified by this app)');
  await expect(page.getByTestId('proposal-summary')).toContainText('your own PDF · 2 pages · Manager checked');
  await expect(page.getByTestId('attachment-list')).toContainText('my-proposal.pdf');
  const shown = await page.getByTestId('hash-proposal').innerText();
  const expected = await page.evaluate(async (b) => {
    const d = await crypto.subtle.digest('SHA-256', new Uint8Array(b));
    return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }, bytes);
  expect(shown).toBe(expected);
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('Package saved');
  const [snap] = await readStore(page, 'submissionSnapshots');
  expect(snap.attachments[0]).toMatchObject({ role: 'proposal', filename: 'my-proposal.pdf', managerChecked: true, pageCount: 2, generated: false });
  await page.getByTestId('replacement-remove').click();
  await expect(page.getByTestId('proposal-summary')).toContainText('generated');
  await expect(page.getByLabel('I have reviewed these demo answers and documents')).not.toBeChecked();
});

test('manager-supplied proposal PDF: a renamed text file, an empty file and an 11-page PDF are refused', async ({ page }) => {
  await readyReview(page);
  await page.getByTestId('replace-proposal-file').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('plain text, not a PDF') });
  await expect(page.getByTestId('replacement-error')).toContainText('does not start like a real PDF');
  await page.getByTestId('replace-proposal-file').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await expect(page.getByTestId('replacement-error')).toContainText('empty');
  const bytes = await page.evaluate(makePdf(11));
  await page.getByTestId('replace-proposal-file').setInputFiles({ name: 'long.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
  await expect(page.getByTestId('replacement-error')).toContainText('11 pages');
  expect((await readStore(page, 'applications'))[0].proposalReplacement).toBeUndefined();
});

test('capacity: copies count against the 100 MB budget; nothing is stored when they do not fit', async ({ page }) => {
  test.setTimeout(180000);
  await readyReview(page);
  await fillStorage(page, 2000);
  await page.reload();
  await expect(page.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('not enough room');
  await expect(page.getByTestId('package-status')).toContainText('MB is free');
  await expect(page.getByTestId('package-status')).toContainText('Your draft is unchanged');
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(0);
  expect(await readStore(page, 'submissionFiles')).toHaveLength(0);
});
