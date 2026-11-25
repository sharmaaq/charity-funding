import { test, expect, settled } from './base.js';

const row = (page, id) => page.locator(`li.grant[data-id="${id}"]`);
const nav = (page) => page.getByRole('navigation', { name: 'Main' });
const send = (page) => page.getByTestId('discussion-send');
const box = (page) => page.getByTestId('discussion-input');

async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('Assess with AI streams a markdown assessment, saves it, marks the card Assessed and shows it again later', async ({ page }) => {
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/assess')) posts.push(r.url()); });
  await expect(row(page, 'G-002').locator('[data-marker="assessed"]')).toHaveCount(0);
  await row(page, 'G-002').getByTestId('assess').click();
  const panel = row(page, 'G-002').getByTestId('assess-panel');
  await expect(panel.getByTestId('assess-status')).toBeVisible();
  await expect(panel.getByTestId('assessment-text').locator('h3', { hasText: 'Verdict' })).toBeVisible({ timeout: 15000 });
  await expect(panel.getByTestId('assessment-text').locator('li', { hasText: 'Fake: a clear budget' })).toBeVisible();
  await expect(panel.getByTestId('assessment-text').locator('a[href="https://example.org/fake-source"]')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(panel.getByTestId('assess-meta')).toContainText('with Gemini 3.8 Flash');
  await expect(panel.getByTestId('assess-status')).toHaveCount(0);
  await expect(row(page, 'G-002').locator('[data-marker="assessed"]')).toContainText('Assessed');
  await expect(row(page, 'G-001').locator('[data-marker="assessed"]')).toHaveCount(0);
  expect(posts.length).toBe(1);
  // after a reload the marker is there, and opening the card shows the saved text without running the AI again
  await page.reload();
  await expect(row(page, 'G-002').locator('[data-marker="assessed"]')).toBeVisible();
  await row(page, 'G-002').getByTestId('assess').click();
  await expect(row(page, 'G-002').getByTestId('assessment-text')).toContainText('Apply with changes');
  await expect(row(page, 'G-002').getByTestId('assess-meta')).toBeVisible();
  expect(posts.length).toBe(1);
  // Re-assess runs it again, and Close hides the panel
  await row(page, 'G-002').getByTestId('reassess').click();
  await expect(row(page, 'G-002').getByTestId('assess-status')).toBeVisible();
  await expect(row(page, 'G-002').getByTestId('assess-meta')).toBeVisible({ timeout: 15000 });
  expect(posts.length).toBe(2);
  await row(page, 'G-002').getByRole('button', { name: 'Close' }).click();
  await expect(row(page, 'G-002').getByTestId('assessment-text')).toHaveCount(0);
});

test('a failed assessment says so and offers a retry', async ({ page }) => {
  await page.route('**/api/charities/your-place/opportunities/G-003/assess', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"SERVER_ERROR","message":"Server error."}' }));
  await row(page, 'G-003').getByTestId('assess').click();
  await expect(row(page, 'G-003').getByTestId('assess-error')).toContainText('could not be started');
  await expect(row(page, 'G-003').getByTestId('reassess')).toBeEnabled();
  await expect(row(page, 'G-003').locator('[data-marker="assessed"]')).toHaveCount(0);
});

test('Discuss on a card opens a discussion about that grant; messages stream in and the thread is saved', async ({ page }) => {
  const bodies = [];
  page.on('request', (r) => { if (r.method() === 'POST' && /\/threads(\/[^/]+\/messages)?$/.test(r.url())) bodies.push(r.postDataJSON()); });
  await row(page, 'G-002').getByTestId('discuss').click();
  await expect(page).toHaveURL(/#\/discussions\/new\?grant=G-002$/);
  await expect(page.getByRole('heading', { name: 'Discuss a grant' })).toBeVisible();
  await expect(page.getByTestId('discussion-about')).toContainText('Reaching Communities England');
  await send(page).click();
  await expect(page.getByText('Write a message first.')).toBeVisible();
  await box(page).fill('Should we apply to this fund?');
  await send(page).click();
  await expect(page).toHaveURL(/#\/discussions\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('thread-title')).toHaveText('Reaching Communities England');
  await expect(page.getByTestId('discussion-status')).toContainText('The AI is writing');
  await expect(page.locator('.message[data-role="user"]')).toHaveText(/Should we apply to this fund\?/);
  await expect(page.locator('.message[data-role="assistant"]')).toContainText('Fake answer to', { timeout: 15000 });
  await expect(page.locator('.message[data-role="assistant"] .who')).toContainText('Gemini 3.8 Flash');
  await expect(page.getByTestId('discussion-status')).toBeEmpty();
  // a second message, with another model chosen in the header
  await page.getByTestId('ai-model').selectOption('gemini:gemini-4-carbon');
  await box(page).fill('And the budget?');
  await send(page).click();
  await expect(page.locator('.message[data-role="assistant"]')).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator('.message[data-role="assistant"] .who').nth(1)).toContainText('Gemini 4 Carbon');
  await expect(page.locator('.message[data-role="assistant"]').nth(1)).toContainText('history 2');
  expect(bodies.map((b) => b.model)).toEqual(['gemini:gemini-3.8-flash', 'gemini:gemini-4-carbon']);
  // saved: a reload shows the whole thread
  await page.reload();
  await expect(page.locator('.message')).toHaveCount(4);
  await expectNoOverflow(page);
});

test('the Discussions page lists threads newest first; rename and delete (with confirmation) work', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Discussions' }).click();
  await expect(page.getByRole('heading', { name: 'Discussions' })).toBeVisible();
  await expect(page.getByTestId('empty')).toContainText('No discussions yet.');
  await page.getByTestId('ask-funding').click();
  await expect(page.getByRole('heading', { name: 'Ask about funding' })).toBeVisible();
  await box(page).fill('Where could we look for roof repair money?');
  await send(page).click();
  await expect(page.locator('.message[data-role="assistant"]')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('discussion-status')).toBeEmpty();
  await expect(page.getByTestId('thread-title')).toHaveText('Where could we look for roof repair money?');
  // a second thread, about a grant
  await page.goto('/#/discussions/new?grant=G-001');
  await box(page).fill('First question about the Garfield Weston grant');
  await send(page).click();
  await expect(page.locator('.message[data-role="assistant"]')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('discussion-status')).toBeEmpty();
  await page.getByRole('link', { name: 'Back to Discussions' }).first().click();
  const items = page.locator('li.thread-item');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Regular Grants');
  await expect(items.nth(1)).toContainText('Where could we look for roof repair money?');
  await expect(items.nth(0)).toContainText('2 messages');
  // rename
  await items.nth(0).getByRole('link').click();
  await page.getByTestId('rename').click();
  await page.getByTestId('rename-input').fill('Garfield Weston plan');
  await page.getByTestId('rename-save').click();
  await expect(page.getByTestId('thread-title')).toHaveText('Garfield Weston plan');
  await expect(page.locator('#live')).toContainText('Discussion renamed.');
  // delete: dismissing the confirmation keeps it, accepting removes it
  page.once('dialog', (d) => d.dismiss());
  await page.getByTestId('delete').click();
  await expect(page.getByTestId('thread-title')).toBeVisible();
  page.once('dialog', (d) => { expect(d.message()).toContain('Garfield Weston plan'); d.accept(); });
  await page.getByTestId('delete').click();
  await expect(page).toHaveURL(/#\/discussions$/);
  await expect(page.locator('li.thread-item')).toHaveCount(1);
  await expect(page.locator('#live')).toContainText('Discussion deleted.');
  await expectNoOverflow(page);
});

test('an unknown discussion says so, and discussions are in the main navigation on every view', async ({ page }) => {
  await page.goto('/#/discussions/00000000-0000-0000-0000-000000000000');
  await expect(page.getByTestId('empty')).toContainText('That discussion was not found.');
  await expect(nav(page).getByRole('link', { name: 'Discussions' })).toHaveAttribute('aria-current', 'page');
  await page.goto('/#/discovery/new');
  await expect(nav(page).getByRole('link', { name: 'Discussions' })).not.toHaveAttribute('aria-current', 'page');
  await expect(row(page, 'G-001').getByTestId('assess')).toBeVisible();
  await expect(row(page, 'G-001').getByTestId('discuss')).toBeVisible();
});

test('assess and discuss buttons fit on cards at every width and in Planning', async ({ page }) => {
  await expectNoOverflow(page);
  await row(page, 'G-001').getByTestId('assess').click();
  await expect(row(page, 'G-001').getByTestId('assess-meta')).toBeVisible({ timeout: 15000 });
  await expectNoOverflow(page);
  await row(page, 'G-001').locator('button[data-action="plan"]').click();
  await settled(page);
  await page.goto('/#/planning');
  await expect(row(page, 'G-001').getByTestId('assess')).toBeVisible();
  await expectNoOverflow(page);
});
