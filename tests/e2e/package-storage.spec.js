import { test, expect } from '@playwright/test';
import { readStore, readyReview } from './package-helpers.js';

const tick = async (page) => {
  await page.getByLabel('I have reviewed these demo answers and documents').check();
  await page.getByLabel('Run the demo transfer using this package').check();
};

test('schema stays at version 2 and Phase A stores and indexes are unchanged', async ({ page }) => {
  await readyReview(page);
  const info = await page.evaluate(() => new Promise((resolve) => {
    const r = indexedDB.open('charity-funding.organisation');
    r.onsuccess = () => {
      const db = r.result;
      const out = { version: db.version, stores: [...db.objectStoreNames].sort(), idx: {} };
      for (const n of ['applications', 'submissionSnapshots', 'submissionFiles', 'submissionAttempts', 'submissionReceipts']) out.idx[n] = [...db.transaction(n).objectStore(n).indexNames].sort();
      db.close(); resolve(out);
    };
  }));
  expect(info.version).toBe(2);
  expect(info.stores).toEqual(['applications', 'bids', 'documents', 'files', 'meta', 'submissionAttempts', 'submissionFiles', 'submissionReceipts', 'submissionSnapshots']);
  expect(info.idx.applications).toEqual(['grantId']);
  expect(info.idx.submissionSnapshots).toEqual(['applicationId']);
  expect(info.idx.submissionFiles).toEqual(['snapshotId']);
});

test('attachment bytes are identical after copying into the snapshot and after a reload (SHA-256)', async ({ page }) => {
  await readyReview(page);
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('Package saved');
  const shownProposal = await page.getByTestId('hash-proposal').innerText();
  const shownAccounts = await page.getByTestId('hash-accounts').innerText();
  await page.reload();
  const res = await page.evaluate(async () => {
    const { openDb } = await import('/js/org/db.js');
    const { createRepository } = await import('/js/org/repository.js');
    const { createApplicationRepository } = await import('/js/application/repository.js');
    const { verifySnapshot, sha256Hex } = await import('/js/application/package.js');
    const db = await openDb();
    const org = createRepository(db, {});
    const apps = createApplicationRepository(db, {});
    const app = await apps.getByGrant('G-001');
    const snap = await apps.getSnapshot(app.lastSnapshotId);
    const files = await apps.getSnapshotFiles(snap.id);
    const hashes = [];
    for (const f of files) hashes.push(await sha256Hex(new Uint8Array(await f.blob.arrayBuffer())));
    const original = await sha256Hex(new Uint8Array(await (await org.getBlob(snap.attachments[1].sourceId)).arrayBuffer()));
    const verify = await verifySnapshot(apps, snap.id);
    db.close();
    return { hashes, original, recorded: snap.attachments.map((a) => a.sha256), verify: verify.ok };
  });
  expect(res.hashes).toEqual(res.recorded);
  expect(res.hashes).toEqual([shownProposal, shownAccounts]);
  expect(res.hashes[1]).toBe(res.original);
  expect(res.verify).toBe(true);
});

test('a quota failure while freezing keeps the draft, shows an actionable error and never says saved; retry works', async ({ page }) => {
  await page.addInitScript(() => { globalThis.__APP_TEST_HOOKS__ = { abortNext: 'freezeSnapshot', code: 'quota' }; });
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
  await page.evaluate(async () => {
    const { openDb } = await import('/js/org/db.js');
    const { createRepository } = await import('/js/org/repository.js');
    const db = await openDb();
    const repo = createRepository(db, {});
    const d = (await repo.listDocuments()).find((x) => x.filename === 'synthetic-accounts-example.pdf');
    await repo.updateDocument(d.id, { title: `${d.title} edited`, category: d.category, description: d.description, period: d.period, tags: d.tags, documentDate: d.documentDate });
    db.close();
  });
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('changed while it was being prepared');
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(0);
});

test('stale draft: a revision change from another tab aborts the commit', async ({ page }) => {
  await readyReview(page);
  await page.evaluate(() => new Promise((resolve) => {
    const r = indexedDB.open('charity-funding.organisation');
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('applications', 'readwrite');
      const st = tx.objectStore('applications');
      st.getAll().onsuccess = (e) => { const a = e.target.result[0]; a.draftRevision += 1; st.put(a); };
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }));
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
  test.setTimeout(120000);
  await readyReview(page);
  const left = await page.evaluate(async () => {
    const { openDb } = await import('/js/org/db.js');
    const { createRepository } = await import('/js/org/repository.js');
    const db = await openDb();
    const repo = createRepository(db, {});
    const MIB = 1024 * 1024;
    let u = await repo.usage();
    const text = (n) => new File([new Uint8Array(n).fill(65)], `filler-${n}-${Math.random().toString(36).slice(2)}.txt`, { type: 'text/plain' });
    while (repo.limits.maxTotalBytes - u.totalBytes > 10 * MIB + 5000) { await repo.uploadDocument(text(10 * MIB), { title: 'filler' }); u = await repo.usage(); }
    await repo.uploadDocument(text(repo.limits.maxTotalBytes - u.totalBytes - 2000), { title: 'filler last' });
    u = await repo.usage();
    db.close();
    return repo.limits.maxTotalBytes - u.totalBytes;
  });
  expect(left).toBe(2000);
  await page.reload();
  await expect(page.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
  await tick(page);
  await expect(page.getByTestId('package-status')).toContainText('not enough room');
  await expect(page.getByTestId('package-status')).toContainText('MB is free');
  await expect(page.getByTestId('package-status')).toContainText('Your draft is unchanged');
  expect(await readStore(page, 'submissionSnapshots')).toHaveLength(0);
  expect(await readStore(page, 'submissionFiles')).toHaveLength(0);
});
