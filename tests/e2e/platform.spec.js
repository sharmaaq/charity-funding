// S4-001 Phase 1: sign-in identity, charity switching, last-charity memory, the "not set up" page and old browser data.
// The dev identity (dev_user_email cookie) stands in for the Google account; see tests/e2e/base.js.
import { test, expect, asUser, EMAILS } from './base.js';

const LAST = 'charity-funding.lastCharity';
const wordmark = (page) => page.locator('#wm-a, #wm-b').allInnerTexts().then((t) => t.join('').replace(/\s+/g, ''));

test('a member of both charities switches between Your Place and Our Time and sees separate data and branding', async ({ page, context, baseURL }) => {
  await asUser(context, baseURL, 'both');
  await page.goto('/');
  await expect(page.getByTestId('signed-in-as')).toContainText(EMAILS.both);
  await expect(page.getByTestId('sign-out')).toBeVisible();
  const select = page.getByTestId('charity-switch');
  await expect(select.locator('option')).toHaveText(['Our Time', 'Your Place']);
  // nothing remembered yet: the first charity alphabetically
  await expect(select).toHaveValue('our-time');
  await expect(page).toHaveTitle(/Our Time/);
  expect(await wordmark(page)).toContain('OurTime');
  expect(await wordmark(page)).not.toContain('YourPlace');
  await expect(page.locator('li.grant')).toHaveCount(0); // Your Place's grants are not here
  await page.goto('/#/organisation');
  await expect(page.locator('main')).not.toContainText('Your Place');
  expect((await (await page.request.get('/api/dev/state/our-time/decisions')).json()).records).toEqual([]);

  await select.selectOption('your-place');
  await expect(page.getByTestId('charity-switch')).toHaveValue('your-place');
  await expect(page).toHaveTitle(/Your Place/);
  expect(await wordmark(page)).toContain('YourPlace');
  await page.goto('/#/discovery/new');
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(page.locator('li.grant[data-id="G-001"]')).toBeVisible();
  // a decision made in Your Place stays in Your Place
  await page.locator('li.grant[data-id="G-002"] button[data-action="watch"]').click();
  await expect.poll(async () => JSON.stringify((await (await page.request.get('/api/dev/state/your-place/decisions')).json()).records)).toContain('G-002');

  await page.getByTestId('charity-switch').selectOption('our-time');
  await expect(page).toHaveTitle(/Our Time/);
  await page.goto('/#/discovery/watchlist');
  await expect(page.locator('li.grant')).toHaveCount(0);
  expect((await (await page.request.get('/api/dev/state/our-time/decisions')).json()).records).toEqual([]);
  await page.getByTestId('charity-switch').selectOption('your-place');
  await expect(page).toHaveTitle(/Your Place/);
  await page.goto('/#/discovery/watchlist');
  await expect(page.locator('li.grant[data-id="G-002"]')).toBeVisible();
});

test('the last charity used is remembered across a reload and a new tab', async ({ page, context, baseURL }) => {
  await asUser(context, baseURL, 'both');
  await page.goto('/');
  await page.getByTestId('charity-switch').selectOption('our-time');
  await expect(page).toHaveTitle(/Our Time/);
  expect(await page.evaluate((k) => localStorage.getItem(k), LAST)).toBe('our-time');
  await page.reload();
  await expect(page).toHaveTitle(/Our Time/);
  await expect(page.getByTestId('charity-switch')).toHaveValue('our-time');
  const tab2 = await context.newPage();
  await tab2.goto('/');
  await expect(tab2).toHaveTitle(/Our Time/);
  // a remembered charity the user no longer belongs to is ignored: first alphabetically
  await page.evaluate((k) => localStorage.setItem(k, 'no-such-charity'), LAST);
  await page.reload();
  await expect(page).toHaveTitle(/Our Time/);
  // a user of one charity never gets another's from memory
  await asUser(context, baseURL, 'a');
  await page.evaluate((k) => localStorage.setItem(k, 'our-time'), LAST);
  await page.reload();
  await expect(page).toHaveTitle(/Your Place/);
  await expect(page.getByTestId('charity-switch')).toHaveCount(0);
  await tab2.close();
});

test('a signed-in account that belongs to no charity sees the "not set up" message and no data', async ({ page, context, baseURL }) => {
  await asUser(context, baseURL, 'nobody');
  const dataCalls = [];
  page.on('request', (r) => { if (/\/api\/charities\//.test(r.url())) dataCalls.push(r.url()); });
  await page.goto('/');
  await expect(page.getByTestId('not-set-up')).toContainText(`Your Google account (${EMAILS.nobody}) is not set up for any charity. Ask your administrator to add you.`);
  await expect(page.locator('li.grant')).toHaveCount(0);
  expect(dataCalls).toEqual([]);
  // and direct API calls get nothing either
  for (const cid of ['your-place', 'our-time']) expect((await page.request.get(`/api/charities/${cid}/workspace`)).status()).toBe(404);
  const me = await (await page.request.get('/api/me')).json();
  expect(me.charities).toEqual([]);
});

test('a member of one charity cannot open the other by URL', async ({ page }) => {
  await page.goto('/');
  expect((await page.request.get('/api/charities/our-time/workspace')).status()).toBe(404);
  expect((await page.request.get('/api/charities/our-time/profile')).status()).toBe(404);
  expect((await page.request.get('/api/charities/your-place/workspace')).status()).toBe(200);
});

test('old browser data (localStorage key and IndexedDB database) is deleted on load and never used', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.setItem('charity-funding.demo.v1', JSON.stringify({ version: 1, hideUnsuitable: true, grants: { 'G-001': { workflow: 'passed', override: false } } }));
    await new Promise((resolve, reject) => { const r = indexedDB.open('charity-funding.organisation', 1); r.onupgradeneeded = () => r.result.createObjectStore('meta'); r.onsuccess = () => { r.result.close(); resolve(); }; r.onerror = () => reject(r.error); });
  });
  expect(await page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === 'charity-funding.organisation'))).toBe(true);
  await page.reload();
  await expect(page.locator('li.grant')).toHaveCount(6); // the old "passed" decision was not read
  await expect.poll(() => page.evaluate(() => localStorage.getItem('charity-funding.demo.v1'))).toBeNull();
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === 'charity-funding.organisation'))).toBe(false);
});
