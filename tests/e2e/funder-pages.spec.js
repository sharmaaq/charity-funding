// The review screen's funder application pages: a labelled choice defaulting to the grant's funder, plus the link to the
// chosen page. Links only; the tests never contact a funder (external requests are answered locally).
import { test, expect } from './base.js';
import { readyReview } from './package-helpers.js';

const GWF = 'https://garfieldweston.org/for-grant-applicants/how-to-apply/';
const SECOND = { id: 'test-funder', funder: 'Test Funder Trust', label: 'Apply here', url: 'https://test-funder.example/apply?x=1' };

async function resetWith(request, baseURL, body) {
  const res = await request.post('/api/dev/reset', { headers: { Origin: new URL(baseURL).origin }, data: body });
  if (!res.ok()) throw new Error(`reset failed: ${res.status()} ${await res.text()}`);
}
async function noOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test('with one entry the choice is still shown, labelled, preselected to the grant funder, and opens safely', async ({ page }) => {
  test.setTimeout(120000);
  await readyReview(page);
  const select = page.getByLabel('Funder application page');
  await expect(select).toBeVisible();
  await expect(select.locator('option')).toHaveCount(1);
  await expect(select).toHaveValue('garfield-weston');
  await expect(select.locator('option:checked')).toHaveText('Garfield Weston Foundation - How to apply');
  const link = page.getByTestId('open-funder-page');
  await expect(link).toHaveText("Open the funder's application page");
  await expect(link).toHaveAttribute('href', GWF);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await noOverflow(page);
  const box = await select.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(43.5);
});

test('with two entries the grant funder is the default and choosing the second opens its URL in a new tab', async ({ page, request, baseURL, context }) => {
  test.setTimeout(120000);
  await resetWith(request, baseURL, { funderPages: { 'your-place': [SECOND] } });
  await context.route('https://test-funder.example/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
  await readyReview(page);
  const select = page.getByLabel('Funder application page');
  await expect(select.locator('option')).toHaveCount(2);
  await expect(select).toHaveValue('garfield-weston');
  await expect(page.getByTestId('open-funder-page')).toHaveAttribute('href', GWF);
  await select.selectOption('test-funder');
  const link = page.getByTestId('open-funder-page');
  await expect(link).toHaveAttribute('href', SECOND.url);
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(SECOND.url);
  await noOverflow(page);
});

test('a grant linked to the second entry defaults to it', async ({ page, request, baseURL }) => {
  test.setTimeout(120000);
  await resetWith(request, baseURL, { funderPages: { 'your-place': [SECOND] }, grantFunderPages: { 'your-place': { 'G-001': 'test-funder' } } });
  await readyReview(page);
  await expect(page.getByLabel('Funder application page')).toHaveValue('test-funder');
  await expect(page.getByTestId('open-funder-page')).toHaveAttribute('href', SECOND.url);
});

test('the dev fixture refuses a non-https address', async ({ request, baseURL }) => {
  for (const url of ['javascript:alert(1)', 'http://test-funder.example/']) {
    const res = await request.post('/api/dev/reset', { headers: { Origin: new URL(baseURL).origin }, data: { funderPages: { 'your-place': [{ ...SECOND, url }] } } });
    expect(res.ok()).toBe(false);
  }
});
