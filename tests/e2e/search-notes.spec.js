import { test, expect, settled } from './base.js';

const row = (page, id) => page.locator(`li.grant[data-id="${id}"]`);
const tab = (page, name) => page.locator(`a[data-tab="${name}"]`);
const search = (page) => page.getByTestId('search');
const note = (page, id) => row(page, id).getByTestId('note-input');

async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('search filters on name, funder, summary and reason, with counts, a no-match message and Clear search', async ({ page }) => {
  await expect(search(page)).toBeVisible();
  await expect(page.getByLabel('Search grants')).toBeVisible();
  await search(page).fill('garfield');
  await expect(page.locator('li.grant')).toHaveCount(1);
  await expect(row(page, 'G-001')).toBeVisible();
  await expect(tab(page, 'new')).toContainText('1 of 6');
  await expect(tab(page, 'watchlist')).toContainText('0 of 0');
  await search(page).fill('REACHING communities');
  await expect(page.locator('li.grant')).toHaveCount(1);
  await expect(row(page, 'G-002')).toBeVisible();
  await search(page).fill('turnover below');
  await expect(row(page, 'G-004')).toBeVisible();
  await search(page).fill('zzzz');
  await expect(page.getByTestId('no-match')).toContainText('No grants match "zzzz".');
  await page.getByTestId('clear-search').click();
  await expect(search(page)).toHaveValue('');
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(tab(page, 'new')).toContainText('6');
  await expect(tab(page, 'new')).not.toContainText('of');
});

test('the search text is kept across tabs and Planning, and cleared on reload', async ({ page }) => {
  await row(page, 'G-001').locator('button[data-action="watch"]').click();
  await settled(page);
  await search(page).fill('garfield');
  await expect(page.getByTestId('no-match')).toBeVisible();
  await tab(page, 'watchlist').click();
  await expect(search(page)).toHaveValue('garfield');
  await expect(row(page, 'G-001')).toBeVisible();
  await row(page, 'G-001').locator('button[data-action="plan"]').click();
  await settled(page);
  await page.goto('/#/planning');
  await page.reload();
  await expect(search(page)).toHaveCount(1);
  await expect(search(page)).toHaveValue('');
  await expect(row(page, 'G-001')).toBeVisible();
});

test('search finds a grant by its note, and notes save, mark the card and survive Pass, Restore and reload', async ({ page }) => {
  await row(page, 'G-003').locator('summary').click();
  await note(page, 'G-003').fill('Ask Priya about the learning programme');
  await expect(row(page, 'G-003').getByTestId('note-status')).toHaveText('Saved');
  await settled(page);
  await expect(row(page, 'G-003').locator('[data-marker="notes"]')).toContainText('Has notes');
  await search(page).fill('priya');
  await expect(page.locator('li.grant')).toHaveCount(1);
  await expect(row(page, 'G-003')).toBeVisible();
  await search(page).fill('');
  await row(page, 'G-003').locator('button[data-action="pass"]').click();
  await settled(page);
  await tab(page, 'passed').click();
  await row(page, 'G-003').locator('button[data-action="restore"]').click();
  await settled(page);
  await tab(page, 'new').click();
  await expect(row(page, 'G-003').locator('[data-marker="notes"]')).toBeVisible();
  await page.reload();
  await expect(row(page, 'G-003').locator('[data-marker="notes"]')).toBeVisible();
  await row(page, 'G-003').locator('summary').click();
  await expect(note(page, 'G-003')).toHaveValue('Ask Priya about the learning programme');
  await expect(row(page, 'G-002').locator('[data-marker="notes"]')).toHaveCount(0);
  // emptying the note removes it and the marker
  await note(page, 'G-003').fill('');
  await note(page, 'G-003').blur();
  await settled(page);
  await expect(row(page, 'G-003').locator('[data-marker="notes"]')).toHaveCount(0);
  await page.reload();
  await expect(row(page, 'G-003').locator('[data-marker="notes"]')).toHaveCount(0);
});

test('a failed note save says so and retries', async ({ page }) => {
  let fail = true;
  await page.route('**/api/charities/your-place/notes/G-002', (route) => (fail
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"SERVER_ERROR","message":"x"}' })
    : route.continue()));
  await row(page, 'G-002').locator('summary').click();
  await note(page, 'G-002').fill('Will retry');
  await expect(row(page, 'G-002').getByTestId('note-status')).toHaveText('Not saved, will retry');
  fail = false;
  await expect(row(page, 'G-002').getByTestId('note-status')).toHaveText('Saved', { timeout: 15000 });
});

test('search and notes fit at phone width', async ({ page }) => {
  await search(page).fill('grant');
  await row(page, 'G-001').locator('summary').click();
  await expect(note(page, 'G-001')).toBeVisible();
  await expectNoOverflow(page);
  await page.goto('/#/planning');
  await expectNoOverflow(page);
});
