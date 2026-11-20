import { expect } from '@playwright/test';

// What the server holds for a charity, read through the dev-only endpoint (it exists only with the dev identity,
// never on Cloud Run). Collections use the old IndexedDB store names, for example submissionSnapshots.
export async function readStore(page, store, cid = 'your-place') {
  const res = await page.request.get(`/api/dev/state/${cid}/${store}`);
  if (!res.ok()) throw new Error(`state read failed: ${res.status()}`);
  return (await res.json()).records;
}

export async function planAndLoadExample(page) {
  await page.goto('/');
  await page.locator('li.grant[data-id="G-001"] button[data-action="plan"]').click();
  await expect(page.getByRole('heading', { name: 'Prepare your Garfield Weston application' })).toBeVisible();
  await page.getByRole('button', { name: 'Load worked demo example' }).click();
  await expect(page.locator('#live')).toContainText('Worked demo example loaded');
}

export async function gotoSection(page, label) {
  await expect(page.getByTestId('section-title')).toBeVisible(); // the page has rendered, so the select-or-nav choice below is reliable
  const select = page.getByTestId('section-select');
  if (await select.isVisible()) await select.selectOption({ label });
  else await page.locator('.app-nav .nav-item', { hasText: label }).first().click();
  await expect(page.getByTestId('section-title')).toHaveText(label);
}

// The four declaration answers stay "Needs review" until the manager confirms them (Phase A decision).
export async function confirmDeclarations(page) {
  await gotoSection(page, 'Organisation');
  for (const id of ['compliance.ukTaxResident', 'compliance.safeguarding', 'compliance.demographics']) {
    await page.locator(`[data-field="${id}"]`).first().getByRole('button', { name: /Confirm answer/ }).click();
  }
  await gotoSection(page, 'Funding request');
  await page.locator('[data-field="eligibility.previousApplication"]').first().getByRole('button', { name: /Confirm answer/ }).click();
}

export async function openReview(page) {
  await page.getByRole('button', { name: 'Review application' }).click();
  await expect(page).toHaveURL(/application\/review$/);
}

export async function readyReview(page) {
  await planAndLoadExample(page);
  await confirmDeclarations(page);
  await openReview(page);
  await expect(page.getByTestId('package-hash')).toHaveText(/^[0-9a-f]{64}$/);
}


// Ticks both demo confirmations and waits until the snapshot is stored (new, or the identical one already stored).
export async function confirmBoth(page) {
  await page.getByLabel('I have reviewed these demo answers and documents').check();
  await page.getByLabel('Run the demo transfer using this package').check();
  await expect(page.getByTestId('package-status')).toContainText(/(Package saved|already saved) as snapshot/);
}

// Changes the stored G-001 draft from "another tab": a direct API save with the current revision, which bumps it.
export async function saveFromOtherTab(page, answerId, value, cid = 'your-place') {
  const origin = new URL(page.url()).origin;
  const got = await page.request.get(`/api/charities/${cid}/applications/by-grant/G-001`);
  const a = (await got.json()).application;
  const answers = { ...a.answers, [answerId]: { value, origin: 'manager', sourceRefs: [], confirmedAt: a.updatedAt, editedAt: a.updatedAt } };
  const res = await page.request.put(`/api/charities/${cid}/applications/${a.id}/answers`, { headers: { Origin: origin }, data: { expectedRevision: a.draftRevision, answers } });
  if (!res.ok()) throw new Error(`other-tab save failed: ${res.status()}`);
}

// Direct, signed-in API calls for test set-up and for changes "made elsewhere" (the same session cookies as the page).
export function orgApi(page, cid = 'your-place') {
  const base = `/api/charities/${cid}`;
  const headers = () => ({ Origin: new URL(page.url()).origin });
  const ok = async (res) => { if (!res.ok()) throw new Error(`${res.url()} -> ${res.status()} ${await res.text()}`); return res; };
  return {
    getProfile: async () => (await ok(await page.request.get(`${base}/profile`))).json(),
    updateProfile: async (profile) => (await ok(await page.request.put(`${base}/profile`, { headers: headers(), data: profile }))).json(),
    listDocuments: async () => (await ok(await page.request.get(`${base}/documents`))).json(),
    uploadDocument: async (name, mimeType, buffer, details = {}) => (await ok(await page.request.post(`${base}/documents`, { headers: headers(), multipart: { details: JSON.stringify(details), file: { name, mimeType, buffer: Buffer.from(buffer) } } }))).json(),
    deleteDocument: async (id) => { await ok(await page.request.delete(`${base}/documents/${id}`, { headers: headers() })); },
  };
}

// Edits the stored G-001 draft in place (mutate runs in Node) through a direct API save that bumps the revision.
export async function writeAnswers(page, mutate, arg, cid = 'your-place') {
  const a = (await (await page.request.get(`/api/charities/${cid}/applications/by-grant/G-001`)).json()).application;
  mutate(a, arg);
  const res = await page.request.put(`/api/charities/${cid}/applications/${a.id}/answers`, { headers: { Origin: new URL(page.url()).origin }, data: { expectedRevision: a.draftRevision, answers: a.answers } });
  if (!res.ok()) throw new Error(`writeAnswers failed: ${res.status()} ${await res.text()}`);
}

// Uploads filler documents through the API until exactly `leaveBytes` remain of the charity's file-store budget.
export async function fillStorage(page, leaveBytes, cid = 'your-place') {
  const MIB = 1024 * 1024;
  const org = orgApi(page, cid);
  const usage = async () => (await page.request.get(`/api/charities/${cid}/usage`)).json();
  let n = 0;
  const filler = (size) => org.uploadDocument(`filler-${Date.now()}-${n++}.txt`, 'text/plain', Buffer.alloc(size, 65 + (n % 20)), { title: 'filler' });
  let u = await usage();
  while (u.maxTotalBytes - u.totalBytes - leaveBytes > 10 * MIB) { await filler(10 * MIB); u = await usage(); }
  await filler(u.maxTotalBytes - u.totalBytes - leaveBytes);
  u = await usage();
  if (u.maxTotalBytes - u.totalBytes !== leaveBytes) throw new Error(`fillStorage left ${u.maxTotalBytes - u.totalBytes}, wanted ${leaveBytes}`);
}
