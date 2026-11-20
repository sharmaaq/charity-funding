// Storage-heavy tests: real server storage, real bytes. Run in the desktop project only (see playwright.config.js).
import { test, expect, settled } from './base.js';
import { readStore, orgApi, fillStorage } from './package-helpers.js';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const NOW = '2026-11-15T10:00:00Z';
const MIB = 1024 * 1024;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((now) => { window.__DEMO_NOW__ = now; }, NOW);
});

// download.path() can hit a Windows file lock; saving a copy is reliable.
async function readDownload(download) {
  const p = path.join(os.tmpdir(), 'org-dl-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  const fail = await download.failure(); if (fail) throw new Error('download failed: ' + fail);
  // Windows can briefly lock a freshly written file (scanner); retry the copy.
  for (let i = 0; ; i++) {
    try { await download.saveAs(p); break; } catch (e) { if (i >= 25 || !/EPERM|EBUSY/.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 200)); }
  }
  const buf = fs.readFileSync(p);
  fs.rmSync(p, { force: true });
  return buf;
}
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const docRows = (page) => page.locator('li.doc-row');
const docRow = (page, text) => docRows(page).filter({ hasText: text });
const bidRows = (page) => page.locator('li.bid-row');

const SAMPLES = {
  pdf: { name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), randomBytes(3000), Buffer.from('\n%%EOF')]) },
  docx: { name: 'letter.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), randomBytes(2500)]) },
  xlsx: { name: 'budget.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), randomBytes(2600)]) },
  csv: { name: 'figures.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\r\n1,£2\r\n"x, y",z\r\n', 'utf8') },
  txt: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('line one\r\nline é two\n\ttabbed\n', 'utf8') },
  png: { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(1800)]) },
  jpg: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(1900)]) },
};

async function openDocs(page) {
  await page.goto('/#/organisation/documents');
  await expect(page.locator('h1')).toHaveText('Organisation information');
  await expect(page.getByRole('heading', { name: 'Documents', level: 2 })).toBeVisible();
}

async function upload(page, files) {
  await page.getByRole('button', { name: /Upload documents/ }).click();
  await page.getByTestId('doc-file-input').setInputFiles(files);
}

// What the server holds, read through the dev-only state endpoint and the document download route (independent of the
// app's code). `files` has one entry for every document whose bytes can be downloaded.
async function dump(page) {
  const [bids, documents, meta] = await Promise.all([readStore(page, 'bids'), readStore(page, 'documents'), readStore(page, 'meta')]);
  const files = [];
  for (const d of documents) {
    const res = await page.request.get(`/api/charities/your-place/documents/${d.id}/file`);
    if (res.ok()) files.push({ id: d.id, size: (await res.body()).length });
  }
  return { bids, documents, files, meta };
}

test('byte integrity: PDF, DOCX, XLSX, CSV, TXT, PNG and JPEG survive reload and download unchanged (SHA-256)', async ({ page }) => {
  await openDocs(page);
  const files = Object.values(SAMPLES);
  await upload(page, files);
  await page.getByRole('button', { name: 'Upload 7 documents' }).click();
  await expect(page.getByTestId('upload-results')).toContainText('Upload results: 7 of 7 uploaded');
  await page.reload();
  await expect(docRows(page)).toHaveCount(11);
  for (const f of files) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      docRow(page, f.name).getByRole('button', { name: `Download ${f.name}` }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(f.name);
    const got = await readDownload(download);
    expect(got.length, f.name).toBe(f.buffer.length);
    expect(sha(got), f.name).toBe(sha(f.buffer));
  }
  // the stored size shown matches, and a seed file downloads too
  await expect(docRow(page, 'report.pdf')).toContainText('PDF');
  const [seedDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download service-overview.txt' }).click()]);
  expect((await readDownload(seedDl)).toString('utf8')).toContain('Synthetic demo example');
});

test('limits: exactly 10 MiB accepted, one byte over rejected, zero-byte and unsupported rejected, mixed batch keeps the good files', async ({ page }) => {
  await openDocs(page);
  const exact = { name: 'exact.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * MIB, 7) };
  await upload(page, [exact]);
  await page.getByRole('button', { name: 'Upload 1 document' }).click();
  await expect(page.getByTestId('upload-results')).toContainText('Upload results: 1 of 1 uploaded');
  await expect(docRow(page, 'exact.pdf')).toContainText('10 MB');
  const stored = await dump(page);
  expect(stored.files.find((f) => f.size === 10 * MIB)).toBeTruthy();

  await page.getByRole('button', { name: 'Dismiss results' }).click();
  await upload(page, [
    { name: 'over.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * MIB + 1, 1) },
    { name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) },
    { name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') },
    { name: 'liar.pdf', mimeType: 'image/png', buffer: Buffer.from('x') },
    { name: 'good.txt', mimeType: 'text/plain', buffer: Buffer.from('good') },
  ]);
  const sel = page.locator('.selected-files li');
  await expect(sel).toHaveCount(5);
  await expect(sel.filter({ hasText: 'over.pdf' })).toContainText('over the 10 MB limit');
  await expect(sel.filter({ hasText: 'empty.txt' })).toContainText('empty (0 bytes)');
  await expect(sel.filter({ hasText: 'virus.exe' })).toContainText('not an allowed file type');
  await expect(sel.filter({ hasText: 'liar.pdf' })).toContainText('reports it as image/png');
  await expect(sel.filter({ hasText: 'good.txt' })).toContainText('Ready to upload');
  await page.getByRole('button', { name: 'Upload 1 document' }).click();
  const results = page.getByTestId('upload-results');
  await expect(results).toContainText('Upload results: 1 of 5 uploaded');
  await expect(results.locator('li[data-ok="false"]')).toHaveCount(4);
  await expect(results.locator('li[data-ok="true"]')).toContainText('good.txt');
  await expect(docRow(page, 'good.txt')).toHaveCount(1);
  await expect(docRow(page, 'over.pdf')).toHaveCount(0);
  const after = await dump(page);
  expect(after.documents.length).toBe(after.files.length);
});

test('aggregate cap is enforced at commit and leaves earlier files stored', async ({ page }) => {
  await page.goto('/');
  await fillStorage(page, 10000);
  await openDocs(page);
  const mk = (n) => ({ name: n, mimeType: 'text/plain', buffer: Buffer.alloc(4000, 65) });
  await upload(page, [mk('a.txt'), mk('b.txt'), mk('c.txt')]);
  await page.getByRole('button', { name: 'Upload 3 documents' }).click();
  const results = page.getByTestId('upload-results');
  await expect(results).toContainText('Upload results: 2 of 3 uploaded');
  await expect(results.locator('li[data-ok="false"]')).toContainText('c.txt');
  await expect(results.locator('li[data-ok="false"]')).toContainText('not enough room');
  await expect(docRow(page, 'a.txt')).toHaveCount(1);
  await expect(docRow(page, 'b.txt')).toHaveCount(1);
  await expect(docRow(page, 'c.txt')).toHaveCount(0);
  const d = await dump(page);
  expect(d.documents.length).toBe(d.files.length);
});

async function openBidEdit(page, title) {
  await page.goto('/#/organisation/bids');
  await bidRows(page).filter({ hasText: title }).getByRole('link', { name: /View/ }).click();
  await page.getByRole('link', { name: 'Edit bid' }).click();
  await expect(page.getByRole('heading', { name: 'Edit past bid' })).toBeVisible();
}

test('staged bid files: Cancel leaves no documents or blobs', async ({ page }) => {
  await page.goto('/#/organisation/bids');
  await expect(bidRows(page)).toHaveCount(3);
  const before = await dump(page);
  await page.getByRole('link', { name: '+ Add past bid' }).click();
  await page.getByLabel('Bid title').fill('Never saved');
  await page.locator('input[name="funder"]').fill('Nobody');
  await page.getByTestId('bid-file-input').setInputFiles([SAMPLES.pdf, SAMPLES.txt]);
  await expect(page.locator('li.attach-row[data-kind="staged"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(bidRows(page)).toHaveCount(3);
  const after = await dump(page);
  expect(after.documents.map((x) => x.id).sort()).toEqual(before.documents.map((x) => x.id).sort());
  expect(after.files.map((x) => x.id).sort()).toEqual(before.files.map((x) => x.id).sort());
  expect(after.bids.length).toBe(3);
});

test('a bid save the server refuses changes nothing; the retry then commits everything together', async ({ page }) => {
  await openBidEdit(page, 'Skills for independent living');
  const before = await dump(page);
  const bidBefore = before.bids.find((b) => b.title === 'Skills for independent living');
  const attBefore = before.documents.filter((d) => d.ownerId === bidBefore.id);
  expect(attBefore.length).toBe(2);

  // change the record, edit one attachment, remove the other, stage two new files
  await page.getByLabel('Bid title').fill('Skills (edited)');
  await page.locator('input[name="funder"]').fill('Oakfield (edited)');
  await page.getByRole('group', { name: 'oakfield-skills-bid-example.txt' }).getByLabel('Title').fill('Edited attachment title');
  await page.getByRole('button', { name: 'Remove oakfield-feedback-example.txt' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove file' }).click();
  await page.getByRole('button', { name: '+ Attach supporting document' }).click();
  await page.getByTestId('bid-file-input').setInputFiles([SAMPLES.pdf, SAMPLES.png]);

  // the first save is refused at the network boundary
  let refuse = true;
  await page.route('**/bids/*', (route) => {
    if (refuse && route.request().method() === 'PUT') { refuse = false; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'aborted' }) }); }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.form-error')).toContainText('The bid was not saved');
  await expect(page).toHaveURL(/\/edit$/);
  await expect(live(page)).not.toContainText('saved');
  await expect(page.getByLabel('Bid title')).toHaveValue('Skills (edited)'); // inputs kept for retry
  await expect(page.locator('li.attach-row[data-kind="staged"]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();

  const mid = await dump(page);
  expect(mid.bids.find((b) => b.id === bidBefore.id)).toEqual(bidBefore); // record untouched
  expect(mid.documents.map((d) => d.id).sort()).toEqual(before.documents.map((d) => d.id).sort()); // no new docs, none removed
  expect(mid.documents.filter((d) => d.ownerId === bidBefore.id)).toEqual(attBefore); // metadata edits not applied
  expect(mid.files.map((f) => f.id).sort()).toEqual(before.files.map((f) => f.id).sort()); // no new files, none removed

  // retry: everything lands in one commit
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Skills (edited)', level: 2 })).toBeVisible();
  await expect(live(page)).toContainText('Past bid saved.');
  const end = await dump(page);
  const attEnd = end.documents.filter((d) => d.ownerId === bidBefore.id);
  expect(attEnd.length).toBe(3);
  expect(attEnd.find((d) => d.filename === 'oakfield-skills-bid-example.txt').title).toBe('Edited attachment title');
  expect(attEnd.find((d) => d.filename === 'oakfield-feedback-example.txt')).toBeUndefined();
  expect(end.documents.length).toBe(end.files.length);
  expect(end.files.length).toBe(before.files.length + 1); // +2 new, -1 removed
  expect(end.bids.find((b) => b.id === bidBefore.id).createdAt).toBe(bidBefore.createdAt); // id and creation stable
});

test('a bid save that does not fit in the file store is refused by the server as one transaction: nothing changes', async ({ page }) => {
  await openBidEdit(page, 'Skills for independent living');
  await fillStorage(page, 500);
  const before = await dump(page);
  await page.getByLabel('Bid title').fill('Never stored');
  await page.getByRole('button', { name: 'Remove oakfield-feedback-example.txt' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove file' }).click();
  await page.getByRole('button', { name: '+ Attach supporting document' }).click();
  await page.getByTestId('bid-file-input').setInputFiles([SAMPLES.pdf]);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.form-error')).toContainText('The bid was not saved');
  await expect(page.locator('.form-error')).toContainText('not enough room');
  const after = await dump(page);
  expect(after.bids).toEqual(before.bids);
  expect(after.documents).toEqual(before.documents);
  expect(after.files).toEqual(before.files);
});

test('a quota failure on an organisation upload is reported honestly and stores nothing', async ({ page }) => {
  await openDocs(page);
  const before = await dump(page);
  await page.route('**/api/charities/*/documents', (route) => (route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'quota' }) })
    : route.continue()));
  await upload(page, [SAMPLES.txt]);
  await page.getByRole('button', { name: 'Upload 1 document' }).click();
  await expect(page.getByTestId('upload-results')).toContainText('Upload results: 0 of 1 uploaded');
  await expect(page.getByTestId('upload-results')).toContainText('no room left');
  await expect(live(page)).toContainText('0 of 1 file uploaded.');
  const after = await dump(page);
  expect(after.documents.length).toBe(before.documents.length);
  expect(after.files.length).toBe(before.files.length);
});

const live = (page) => page.locator('#live');

test('deleting a bid removes only its own documents and blobs; organisation documents and grant state are untouched', async ({ page }) => {
  await page.goto('/');
  await page.locator('li.grant[data-id="G-001"] button[data-action="pass"]').click();
  await settled(page);
  const grantBefore = await readStore(page, 'decisions');
  expect(JSON.stringify(grantBefore)).toContain('passed');
  await page.goto('/#/organisation/bids');
  const before = await dump(page);
  const bid = before.bids.find((b) => b.title === 'Skills for independent living');
  const own = before.documents.filter((d) => d.ownerId === bid.id).map((d) => d.id);
  expect(own.length).toBe(2);
  await bidRows(page).filter({ hasText: 'Skills for independent living' }).getByRole('link', { name: /View/ }).click();
  await page.getByRole('button', { name: 'Delete bid' }).click();
  await expect(page.getByRole('dialog')).toContainText('2 attached files');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete bid' }).click();
  await expect(bidRows(page)).toHaveCount(2);
  const after = await dump(page);
  expect(after.bids.map((b) => b.id)).not.toContain(bid.id);
  const expectedDocs = before.documents.filter((d) => !own.includes(d.id)).map((d) => d.id).sort();
  expect(after.documents.map((d) => d.id).sort()).toEqual(expectedDocs);
  expect(after.files.map((f) => f.id).sort()).toEqual(expectedDocs);
  expect(after.documents.filter((d) => d.ownerType === 'organisation').length).toBe(4);
  expect(await readStore(page, 'decisions')).toEqual(grantBefore);
});

test('deleted sample content stays deleted after reload: nothing reseeds it', async ({ page }) => {
  await page.goto('/#/organisation/documents');
  await expect(docRows(page)).toHaveCount(4);
  const org = orgApi(page);
  for (const b of await (await page.request.get('/api/charities/your-place/bids')).json()) {
    const res = await page.request.delete(`/api/charities/your-place/bids/${b.id}`, { headers: { Origin: new URL(page.url()).origin } });
    expect(res.ok()).toBe(true);
  }
  for (const d of await org.listDocuments()) await org.deleteDocument(d.id);
  await page.reload();
  await expect(page.getByText('No documents yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Past bids/ })).toContainText('0');
  await page.getByRole('link', { name: /^Past bids/ }).click();
  await expect(page.getByText('No past bids yet.')).toBeVisible();
  const d = await dump(page);
  expect(d.bids.length + d.documents.length + d.files.length).toBe(0);
  await page.reload();
  await expect(page.getByText('No past bids yet.')).toBeVisible();
});

test('a second browser context for the same user sees the same saved data (it is held on the server)', async ({ page, browser }) => {
  await page.goto('/#/organisation');
  await page.getByRole('button', { name: 'Edit organisation information' }).click();
  await page.getByLabel('What the charity does').fill('First context overview');
  await page.getByRole('button', { name: 'Save information' }).click();
  await expect(page.getByTestId('overview-text')).toHaveText('First context overview');
  for (const b of await (await page.request.get('/api/charities/your-place/bids')).json()) {
    await page.request.delete(`/api/charities/your-place/bids/${b.id}`, { headers: { Origin: new URL(page.url()).origin } });
  }

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.addInitScript((now) => { window.__DEMO_NOW__ = now; }, NOW);
  await p2.goto('/#/organisation');
  await expect(p2.getByTestId('overview-text')).toHaveText('First context overview');
  await expect(p2.getByRole('link', { name: /^Past bids/ })).toContainText('0');
  await ctx2.close();
});

test('catalogue: profile, all bids with outcome, summary, feedback and notes, every live document with bytes by ID; deleted sources are absent', async ({ page }) => {
  await openDocs(page);
  await upload(page, [SAMPLES.pdf]);
  await page.getByRole('button', { name: 'Upload 1 document' }).click();
  await expect(docRow(page, 'report.pdf')).toHaveCount(1);
  const c = await (await page.request.get('/api/charities/your-place/catalogue')).json();
  const blobs = {};
  for (const d of c.documents) { const r = await page.request.get(`/api/charities/your-place/documents/${d.id}/file`); blobs[d.id] = r.ok() ? (await r.body()).length : null; }
  expect(c.profile.name).toBe('Your Place');
  expect(c.profile.overview).toContain('demo charity');
  expect(c.bids.length).toBe(3);
  const unsuccessful = c.bids.find((b) => b.outcome === 'unsuccessful');
  expect(unsuccessful.outcomeLabel).toBe('Unsuccessful');
  expect(unsuccessful.summary.length).toBeGreaterThan(10);
  expect(unsuccessful.feedback).toContain('clearer evidence');
  expect(unsuccessful.notes).toContain('twelve-month');
  expect(unsuccessful.attachmentIds.length).toBe(2);
  expect(c.documents.length).toBe(9);
  for (const d of c.documents) {
    expect(['bid', 'organisation']).toContain(d.ownerType);
    expect(d.ownerId).toBeTruthy();
    expect(d.role || d.category).toBeTruthy();
    expect(d.filename).toBeTruthy();
    expect(d.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(d.updatedAt).toBeTruthy();
    expect(d.status).toBe('Stored');
    expect(blobs[d.id]).toBe(d.size);
  }
  expect(c.documents.filter((d) => d.role === 'feedback').length).toBe(1);
  expect(c.documents.find((d) => d.category === 'companies-house').period).toBe('Year ended 31 March 2026');
  const removed = c.documents.find((d) => d.filename === 'report.pdf');
  await docRow(page, 'report.pdf').getByRole('button', { name: /^Delete/ }).click();
  await page.getByRole('button', { name: 'Delete document' }).click();
  await expect(docRow(page, 'report.pdf')).toHaveCount(0);
  const gone = await (await page.request.get('/api/charities/your-place/catalogue')).json();
  expect(gone.documents.map((d) => d.id)).not.toContain(removed.id);
  expect((await page.request.get(`/api/charities/your-place/documents/${removed.id}/file`)).status()).toBe(404);
});

test('uploaded content only goes to our own origin, and only to the charity API paths', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const seen = [];
  page.on('request', (r) => seen.push({ method: r.method(), url: r.url() }));
  await openDocs(page);
  await upload(page, [SAMPLES.pdf, SAMPLES.csv]);
  await page.getByRole('button', { name: 'Upload 2 documents' }).click();
  await expect(page.getByTestId('upload-results')).toContainText('2 of 2 uploaded');
  await page.getByLabel('Search document details').fill('report');
  const [dl] = await Promise.all([page.waitForEvent('download'), docRow(page, 'report.pdf').getByRole('button', { name: /Download/ }).click()]);
  await readDownload(dl);
  await page.goto('/#/organisation/bids/new');
  await page.getByLabel('Bid title').fill('Net check');
  await page.locator('input[name="funder"]').fill('F');
  await page.getByTestId('bid-file-input').setInputFiles([SAMPLES.docx]);
  await page.getByRole('button', { name: 'Save past bid' }).click();
  await expect(page.getByRole('heading', { name: 'Net check', level: 2 })).toBeVisible();
  expect(seen.length).toBeGreaterThan(3);
  for (const r of seen) {
    if (/^(data|blob):/.test(r.url)) continue;
    expect(new URL(r.url).origin, r.url).toBe(origin);
    if (r.method !== 'GET') expect(new URL(r.url).pathname, r.url).toMatch(/^\/api\/charities\/your-place\/(documents|bids)(\/|$)|^\/api\/charities\/your-place\/(decisions|discovery-settings)/);
  }
  // and the saved bytes are on the server
  expect((await readStore(page, 'documents')).some((d) => d.filename === 'report.pdf')).toBe(true);
});
