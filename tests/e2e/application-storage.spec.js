import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
// The organisation database module exactly as shipped with schema 1 (S2-001). Serving it makes the real app create
// a genuine schema-1 database, with real data written through the real repository.
const SCHEMA1_DB = path.join(here, '..', 'fixtures', 'org-db-schema1.js');
const NAMES4 = ['meta', 'bids', 'documents', 'files'];
const NEW5 = ['applications', 'submissionFiles', 'submissionAttempts', 'submissionReceipts', 'submissionSnapshots'];

async function useSchema1(page) {
  await page.route('**/js/org/db.js', (route) => route.fulfill({ path: SCHEMA1_DB, contentType: 'text/javascript; charset=utf-8', headers: { 'cache-control': 'no-store' } }));
}

// Raw read of the database, independent of the app's code. Blobs are reduced to size and SHA-256.
async function dump(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('charity-funding.organisation');
    open.onerror = () => reject(open.error);
    open.onsuccess = async () => {
      const db = open.result;
      const out = { version: db.version, stores: [...db.objectStoreNames].sort(), data: {}, indexes: {} };
      const names = [...db.objectStoreNames];
      const tx = db.transaction(names, 'readonly');
      const got = {};
      await Promise.all(names.map((n) => new Promise((res) => {
        const q = tx.objectStore(n).getAll();
        q.onsuccess = () => { got[n] = q.result; out.indexes[n] = [...tx.objectStore(n).indexNames].sort(); res(); };
      })));
      for (const n of names) {
        if (n === 'files') {
          out.data[n] = [];
          for (const r of got[n]) {
            const buf = await r.blob.arrayBuffer();
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
            out.data[n].push({ id: r.id, size: r.blob.size, type: r.blob.type, hash });
          }
          out.data[n].sort((a, b) => (a.id < b.id ? -1 : 1));
        } else out.data[n] = got[n];
      }
      db.close();
      resolve(out);
    };
  }));
}

async function withOrgRepo(page, fn, arg) {
  return page.evaluate(async ({ src, arg }) => {
    const { openDb } = await import('/js/org/db.js');
    const { createRepository } = await import('/js/org/repository.js');
    const db = await openDb();
    try {
      const repo = createRepository(db, {});
      return await new Function('repo', 'arg', `return (${src})(repo, arg)`)(repo, arg);
    } finally { db.close(); }
  }, { src: fn.toString(), arg });
}

const readApps = (page) => page.evaluate(() => new Promise((resolve) => {
  const r = indexedDB.open('charity-funding.organisation');
  r.onsuccess = () => { const db = r.result; const q = db.transaction('applications').objectStore('applications').getAll(); q.onsuccess = () => { db.close(); resolve(q.result); }; };
}));

async function planG001(page) {
  await page.goto('/');
  await page.locator('li.grant[data-id="G-001"] button[data-action="plan"]').click();
  await expect(page.getByRole('heading', { name: 'Prepare your Garfield Weston application' })).toBeVisible();
}

test('schema 1 to 2: every profile, bid, attachment byte, document and grant decision survives; only stores are added', async ({ page }) => {
  await useSchema1(page);
  await page.goto('/');
  // Real schema-1 data: seed, a profile edit, a bid with an attachment, a stored document, and grant decisions.
  await withOrgRepo(page, async (repo) => {
    await repo.seedOnce();
    const p = await repo.getProfile();
    await repo.updateProfile({ ...p, overview: 'Edited by the manager before the upgrade.', website: 'https://example.org/yor' });
  });
  const att = randomBytes(5000);
  const doc = randomBytes(7000);
  await page.evaluate(async ({ att, doc }) => {
    const { openDb } = await import('/js/org/db.js');
    const { createRepository } = await import('/js/org/repository.js');
    const db = await openDb();
    const repo = createRepository(db, {});
    const bytes = (a) => new Uint8Array(a);
    await repo.saveBid({
      fields: { title: 'Bid made before the upgrade', funder: 'Example Funder', outcome: 'awaiting', summary: 'S', feedback: '', notes: '' },
      newFiles: [{ file: new File([bytes(att)], 'before-upgrade.pdf', { type: 'application/pdf' }), role: 'bid-document' }],
    });
    await repo.uploadDocument(new File([bytes(doc)], 'policy.pdf', { type: 'application/pdf' }), { category: 'governance', title: 'A policy', period: '2026' });
    db.close();
  }, { att: [...att], doc: [...doc] });
  await page.locator('li.grant[data-id="G-002"] button[data-action="watch"]').click();
  await page.locator('li.grant[data-id="G-003"] button[data-action="pass"]').click();
  const grantsBefore = await page.evaluate(() => localStorage.getItem('charity-funding.demo.v1'));

  const before = await dump(page);
  expect(before.version).toBe(1);
  expect(before.stores).toEqual([...NAMES4].sort());
  expect(before.data.bids).toHaveLength(4);
  expect(before.data.files.length).toBe(before.data.documents.length);

  // Load the new code (no route override): opening upgrades the database.
  await page.unroute('**/js/org/db.js');
  await page.goto('/#/organisation/bids');
  await page.reload();
  await expect(page.getByText('Bid made before the upgrade')).toBeVisible();
  const after = await dump(page);
  expect(after.version).toBe(2);
  expect(after.stores).toEqual([...NAMES4, ...NEW5].sort());
  for (const n of NAMES4) expect(after.data[n], `store ${n} is byte-for-byte unchanged`).toEqual(before.data[n]);
  for (const n of NEW5) expect(after.data[n], `new store ${n} starts empty`).toEqual([]);
  expect(after.indexes.documents).toEqual(before.indexes.documents);
  expect(after.indexes.applications).toEqual(['grantId']);
  expect(after.data.meta.filter((m) => m.key === 'seed')).toEqual(before.data.meta.filter((m) => m.key === 'seed')); // not reseeded
  expect(await page.evaluate(() => localStorage.getItem('charity-funding.demo.v1'))).toBe(grantsBefore);
  // the profile edit and the attachment are readable through the new code
  await page.goto('/#/organisation/documents');
  await expect(page.getByText('A policy')).toBeVisible();

  // the application area works on the upgraded database and still leaves the old stores alone
  await planG001(page);
  await page.locator('[data-field="org.postcode"] input').fill('E1 1AA');
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  await expect.poll(async () => (await readApps(page)).length).toBe(1);
  const later = await dump(page);
  for (const n of NAMES4) expect(later.data[n]).toEqual(before.data[n]);
  expect(later.data.applications[0].answers['org.postcode'].value).toBe('E1 1AA');
  // the original organisation profile text is what the application suggests from
  await expect(page.locator('[data-field="org.overview"] textarea')).toHaveValue('Edited by the manager before the upgrade.');
  await expect(page.locator('[data-field="org.website"] input')).toHaveValue('https://example.org/yor');
});

test('a second tab holding schema 1 open blocks the upgrade safely: nothing changes, Retry works once it closes', async ({ page, context }) => {
  await useSchema1(page);
  await page.goto('/');
  await withOrgRepo(page, (repo) => repo.seedOnce());
  const holder = await context.newPage();
  await holder.goto('/robots-none-existing').catch(() => {});
  await holder.goto('/');
  await holder.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('charity-funding.organisation', 1); // raw connection, no versionchange handler
    r.onsuccess = () => { window.__held = r.result; resolve(); };
    r.onerror = () => reject(r.error);
  }));
  const before = await dump(holder);
  await page.unroute('**/js/org/db.js');
  await page.goto('/#/organisation/bids');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Organisation information is not available' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('older version');
  await holder.evaluate(() => window.__held.close());
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Past bids', level: 2 })).toBeVisible();
  const after = await dump(page);
  expect(after.version).toBe(2);
  for (const n of NAMES4) expect(after.data[n]).toEqual(before.data[n]);
});

test('storage failure: an aborted or over-quota save shows Not saved, keeps the input, and Retry saves it', async ({ page }) => {
  await planG001(page);
  const addr = page.locator('[data-field="org.address"] textarea');
  // every save fails until the hook is cleared (blur and leave attempts each try again)
  await page.evaluate(() => { window.__APP_TEST_HOOKS__ = { get abortNext() { return 'saveApplication'; }, set abortNext(v) {}, code: 'quota' }; });
  await addr.fill('Typed while storage is full');
  await expect(page.getByTestId('save-state')).toContainText('Not saved');
  await expect(page.locator('.save-alert')).toContainText('no room left');
  await expect(addr).toHaveValue('Typed while storage is full');
  expect((await readApps(page))[0].answers['org.address']).toBeUndefined(); // rolled back, never reported as saved
  // leaving tries one more save; if that also fails it offers to stay, so nothing is silently discarded
  await page.getByRole('link', { name: 'Discovery' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay on this page' }).click();
  await expect(addr).toHaveValue('Typed while storage is full');
  await page.evaluate(() => { window.__APP_TEST_HOOKS__ = {}; });
  await page.getByTestId('save-state').getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  await expect.poll(async () => (await readApps(page))[0].answers['org.address'].value).toBe('Typed while storage is full');
  // a plain aborted transaction behaves the same way
  await page.evaluate(() => { window.__APP_TEST_HOOKS__ = { abortNext: 'saveApplication' }; });
  await addr.fill('Second edit');
  await page.getByRole('heading', { name: 'Prepare your Garfield Weston application' }).click(); // blur: the single abort is used up
  await expect(page.getByTestId('save-state')).toContainText('Not saved');
  await expect(page.locator('.save-alert')).toContainText('cancelled');
  await page.getByTestId('save-state').getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  expect((await readApps(page))[0].answers['org.address'].value).toBe('Second edit');
});

test('revision conflict from another tab keeps the edits and lets the manager choose', async ({ page }) => {
  await planG001(page);
  await page.locator('[data-field="org.postcode"] input').fill('E1 1AA');
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  const bump = (value) => page.evaluate((v) => new Promise((resolve, reject) => {
    const r = indexedDB.open('charity-funding.organisation');
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('applications', 'readwrite');
      const st = tx.objectStore('applications');
      st.getAll().onsuccess = (e) => {
        const a = e.target.result[0];
        a.draftRevision += 1;
        a.answers['org.companyNumber'] = { value: v, origin: 'manager', sourceRefs: [], confirmedAt: a.updatedAt, editedAt: a.updatedAt };
        st.put(a);
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), value);
  await bump('FROM-OTHER-TAB');
  const addr = page.locator('[data-field="org.address"] textarea');
  await addr.fill('Mine, typed after the other tab saved');
  await expect(page.getByTestId('save-state')).toHaveText('Not saved');
  await expect(page.locator('.conflict-box')).toContainText('changed in another tab');
  await expect(addr).toHaveValue('Mine, typed after the other tab saved');
  expect((await readApps(page))[0].answers['org.address']).toBeUndefined(); // the other tab's record was not overwritten
  await page.getByTestId('conflict-keep').click();
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  await expect.poll(async () => (await readApps(page))[0].answers['org.address'].value).toBe('Mine, typed after the other tab saved');
  // second conflict, this time taking the saved version
  await bump('SECOND');
  await addr.fill('Another local edit');
  await expect(page.locator('.conflict-box')).toBeVisible();
  await page.getByTestId('conflict-reload').click();
  await expect(page.locator('.conflict-box')).toBeHidden();
  await expect(addr).toHaveValue('Mine, typed after the other tab saved');
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
});
