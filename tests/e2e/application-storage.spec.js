import { test, expect } from './base.js';
import { readStore, saveFromOtherTab } from './package-helpers.js';

const readApps = (page) => readStore(page, 'applications');

async function planG001(page) {
  await page.goto('/');
  await page.locator('li.grant[data-id="G-001"] button[data-action="plan"]').click();
  await expect(page.getByRole('heading', { name: 'Prepare your Garfield Weston application' })).toBeVisible();
}

test('a failed server save shows Not saved, keeps the input, never reports saved, and Retry saves it', async ({ page }) => {
  await planG001(page);
  const addr = page.locator('[data-field="org.address"] textarea');
  // every save is refused until the route is cleared (blur and leave attempts each try again)
  const refuse = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'quota' }) });
  await page.route('**/applications/*/answers', refuse);
  await addr.fill('Typed while the server refuses');
  await expect(page.getByTestId('save-state')).toContainText('Not saved');
  await expect(page.locator('.save-alert')).toContainText('no room left');
  await expect(addr).toHaveValue('Typed while the server refuses');
  expect((await readApps(page))[0].answers['org.address']).toBeUndefined(); // never reported as saved
  // leaving tries one more save; if that also fails it offers to stay, so nothing is silently discarded
  await page.getByRole('link', { name: 'Discovery' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay on this page' }).click();
  await expect(addr).toHaveValue('Typed while the server refuses');
  await page.unroute('**/applications/*/answers', refuse);
  await page.getByTestId('save-state').getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  await expect.poll(async () => (await readApps(page))[0].answers['org.address'].value).toBe('Typed while the server refuses');
  // a single cancelled save behaves the same way
  let once = true;
  await page.route('**/applications/*/answers', (route) => {
    if (once) { once = false; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'aborted' }) }); }
    return route.continue();
  });
  await addr.fill('Second edit');
  await page.getByRole('heading', { name: 'Prepare your Garfield Weston application' }).click(); // blur: the single refusal is used up
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
  const bump = (value) => saveFromOtherTab(page, 'org.companyNumber', value);
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
