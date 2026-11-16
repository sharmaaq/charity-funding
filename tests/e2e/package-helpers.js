import { expect } from '@playwright/test';

export async function readStore(page, store) {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    const r = indexedDB.open('charity-funding.organisation');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const q = db.transaction(name).objectStore(name).getAll();
      q.onsuccess = () => { db.close(); resolve(q.result.map((x) => { const { blob, ...rest } = x; return { ...rest, hasBlob: !!blob }; })); };
    };
  }), store);
}

export async function planAndLoadExample(page) {
  await page.goto('/');
  await page.locator('li.grant[data-id="G-001"] button[data-action="plan"]').click();
  await expect(page.getByRole('heading', { name: 'Prepare your Garfield Weston application' })).toBeVisible();
  await page.getByRole('button', { name: 'Load worked demo example' }).click();
  await expect(page.locator('#live')).toContainText('Worked demo example loaded');
}

export async function gotoSection(page, label) {
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

