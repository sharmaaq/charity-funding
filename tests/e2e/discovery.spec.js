import { test, expect, settled } from './base.js';

const ROUTES = ['#/discovery/new', '#/discovery/watchlist', '#/discovery/passed', '#/planning', '#/tracking'];

const row = (page, id) => page.locator(`li.grant[data-id="${id}"]`);
const act = (page, id, action) => row(page, id).locator(`button[data-action="${action}"]`);
const tab = (page, name) => page.locator(`a[data-tab="${name}"]`);
const filter = (page) => page.getByTestId('filter');

async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('fresh context shows six grants in New, the banner, and three reachable areas', async ({ page }) => {
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(page.getByText('Demo discovery - 15 November 2026 snapshot')).toBeVisible();
  await expect(tab(page, 'new')).toContainText('6');
  await expect(tab(page, 'watchlist')).toContainText('0');
  await expect(tab(page, 'passed')).toContainText('0');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Planning & submission' }).click();
  await expect(page.getByRole('heading', { name: 'Planning & submission' })).toBeVisible();
  await nav.getByRole('link', { name: 'Tracking' }).click();
  await expect(page.getByRole('heading', { name: 'Tracking' })).toBeVisible();
  await nav.getByRole('link', { name: 'Discovery' }).click();
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(page.locator('li.grant[data-suitability="suitable"]')).toHaveCount(3);
  await expect(page.locator('li.grant[data-suitability="unsuitable"]')).toHaveCount(3);
  // empty views stay reachable
  await tab(page, 'watchlist').click();
  await expect(page.getByTestId('empty')).toBeVisible();
  await tab(page, 'passed').click();
  await expect(page.getByTestId('empty')).toBeVisible();
});

test('no horizontal page scroll on every route', async ({ page }) => {
  for (const r of ROUTES) {
    await page.goto('/' + r);
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
    await expectNoOverflow(page);
  }
  // with content in Planning, Passed and an override present
  await page.goto('/#/discovery/new');
  await act(page, 'G-004', 'markSuitable').click();
  await act(page, 'G-004', 'plan').click();
  await page.goto('/#/discovery/new');
  await act(page, 'G-001', 'pass').click();
  await expectNoOverflow(page);
  await page.goto('/#/discovery/passed');
  await expectNoOverflow(page);
  await page.goto('/#/planning');
  await expect(row(page, 'G-004')).toBeVisible();
  await expectNoOverflow(page);
  // unknown hash falls back to New
  await page.goto('/#/nonsense');
  await expect(page.locator('h1')).toHaveText('Discovery');
  await expectNoOverflow(page);
});

test('unsuitable badge has icon and text and the reason is visible without interaction', async ({ page }) => {
  const g = row(page, 'G-004');
  const badge = g.locator('.badge');
  await expect(badge).toContainText('Unsuitable');
  await expect(badge.locator('svg')).toHaveCount(1);
  await expect(badge.locator('svg')).toBeVisible();
  await expect(g.locator('.reason')).toBeVisible();
  await expect(g.locator('.reason')).toContainText('turnover below');
  await expect(g.locator('.reason')).toContainText('500,000');
  await expect(row(page, 'G-005').locator('.reason')).toContainText('below £2m');
  await expect(row(page, 'G-006').locator('.reason')).toContainText('Scotland');
  // details are closed by default, reason is outside them
  expect(await g.locator('details').evaluate((d) => d.open)).toBe(false);
  await expect(row(page, 'G-001').locator('.badge')).toContainText('Suitable');
  await expect(row(page, 'G-001').locator('.badge svg')).toBeVisible();
});

test('Pass G-001, see it in Passed, restore it, see it in New', async ({ page }) => {
  await act(page, 'G-001', 'pass').click();
  await expect(row(page, 'G-001')).toHaveCount(0);
  await expect(page.locator('li.grant')).toHaveCount(5);
  await expect(page.locator('#live')).toContainText('Regular Grants moved to Passed');
  await expect(tab(page, 'passed')).toContainText('1');
  await expect(tab(page, 'new')).toContainText('5');
  await tab(page, 'passed').click();
  await expect(row(page, 'G-001')).toBeVisible();
  await expect(page.getByTestId('filter')).toHaveCount(0);
  await act(page, 'G-001', 'restore').click();
  await expect(page.getByTestId('empty')).toBeVisible();
  await tab(page, 'new').click();
  await expect(row(page, 'G-001')).toBeVisible();
  await expect(page.locator('li.grant')).toHaveCount(6);
});

test('Hide unsuitable shows three and "3 unsuitable hidden"; reload keeps it; Show all restores six', async ({ page }) => {
  await filter(page).getByRole('button', { name: 'Hide unsuitable' }).click();
  await expect(page.locator('li.grant')).toHaveCount(3);
  await expect(page.getByTestId('hidden-note')).toContainText('3 unsuitable hidden');
  await expect(tab(page, 'new')).toContainText('6');
  await page.reload();
  await expect(page.locator('li.grant')).toHaveCount(3);
  await expect(filter(page).getByRole('button', { name: 'Hide unsuitable' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('hidden-note')).toContainText('3 unsuitable hidden');
  // Passed is never filtered and passing keeps counts as totals
  await act(page, 'G-001', 'pass').click();
  await tab(page, 'passed').click();
  await expect(page.locator('li.grant')).toHaveCount(1);
  await act(page, 'G-001', 'restore').click();
  await tab(page, 'new').click();
  await page.getByTestId('hidden-show-all').click();
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(page.getByTestId('hidden-note')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('li.grant')).toHaveCount(6);
});

test('filter that hides everything still reports the hidden count', async ({ page }) => {
  for (const id of ['G-001', 'G-002', 'G-003']) await act(page, id, 'pass').click();
  await filter(page).getByRole('button', { name: 'Hide unsuitable' }).click();
  await expect(page.locator('li.grant')).toHaveCount(0);
  await expect(page.getByTestId('hidden-note')).toContainText('3 unsuitable hidden');
  await expect(tab(page, 'new')).toContainText('3');
  await page.getByTestId('hidden-show-all').click();
  await expect(page.locator('li.grant')).toHaveCount(3);
});

test('Mark G-004 suitable, Watch, Plan application; Planning shows override; reload keeps it; Abandon sends to Passed', async ({ page }) => {
  const g = row(page, 'G-004');
  await expect(g.locator('button[data-action]')).toHaveCount(2);
  await expect(act(page, 'G-004', 'markSuitable')).toBeVisible();
  await expect(act(page, 'G-004', 'pass')).toBeVisible();
  await expect(act(page, 'G-004', 'watch')).toHaveCount(0);
  await expect(act(page, 'G-004', 'plan')).toHaveCount(0);

  await act(page, 'G-004', 'markSuitable').click();
  await expect(g.locator('.badge')).toContainText('Suitable - manager override');
  await expect(g.locator('.reason')).toContainText('500,000');
  await g.locator('summary').click();
  await expect(g.locator('.original-reason')).toContainText('500,000');
  await expect(act(page, 'G-004', 'watch')).toBeVisible();
  await expect(act(page, 'G-004', 'plan')).toBeVisible();
  await expect(act(page, 'G-004', 'markSuitable')).toHaveCount(0);

  // stays visible under Hide unsuitable
  await filter(page).getByRole('button', { name: 'Hide unsuitable' }).click();
  await expect(page.locator('li.grant')).toHaveCount(4);
  await expect(page.getByTestId('hidden-note')).toContainText('2 unsuitable hidden');
  await expect(row(page, 'G-004')).toBeVisible();

  await act(page, 'G-004', 'watch').click();
  await tab(page, 'watchlist').click();
  await expect(row(page, 'G-004')).toBeVisible();
  await expect(act(page, 'G-004', 'watch')).toHaveCount(0);
  await act(page, 'G-004', 'plan').click();
  await expect(page).toHaveURL(/#\/planning$/);
  await expect(page.getByRole('heading', { name: 'Planning & submission' })).toBeVisible();
  await expect(page.getByText('Placeholder - future iteration').first()).toBeVisible();
  await expect(row(page, 'G-004')).toHaveCount(1);
  await expect(row(page, 'G-004').locator('.badge')).toContainText('Suitable - manager override');

  await page.reload();
  await expect(row(page, 'G-004')).toHaveCount(1);
  await expect(row(page, 'G-004').locator('.badge')).toContainText('Suitable - manager override');

  // Abandon is the only working control on the page
  await expect(page.locator('main button')).toHaveCount(1);
  await act(page, 'G-004', 'abandon').click();
  await expect(row(page, 'G-004')).toHaveCount(0);
  await expect(page.locator('#live')).toContainText('moved to Passed');
  await expect(page.getByTestId('empty')).toBeVisible();
  await page.locator('#live a').click();
  await expect(page).toHaveURL(/#\/discovery\/passed$/);
  await expect(row(page, 'G-004')).toBeVisible();
  // restore keeps the override
  await act(page, 'G-004', 'restore').click();
  await tab(page, 'new').click();
  await expect(row(page, 'G-004').locator('.badge')).toContainText('Suitable - manager override');
});

test('Plan application on a suitable grant opens Planning with one entry', async ({ page }) => {
  await act(page, 'G-002', 'plan').click();
  await expect(page).toHaveURL(/#\/planning$/);
  await expect(page.locator('li.grant')).toHaveCount(1);
  await expect(row(page, 'G-002')).toBeVisible();
  await expect(page.locator('#live')).toContainText('Reaching Communities England moved to Planning & submission');
  await page.goto('/#/discovery/new');
  await expect(row(page, 'G-002')).toHaveCount(0);
  await expect(page.locator('li.grant')).toHaveCount(5);
});

// S3-001 replaced the Tracking placeholder with demo receipts; with none recorded it shows the demo notice and an empty state.
test('Tracking shows the demo-records notice, an empty state and no buttons inside main', async ({ page }) => {
  await page.goto('/#/tracking');
  await expect(page.getByTestId('tracking-notice')).toContainText('Demo records only');
  await expect(page.getByTestId('tracking-empty')).toContainText('No demo drafts yet');
  await expect(page.locator('main button')).toHaveCount(0);
  await expect(page.locator('main li.grant')).toHaveCount(0);
});

test('state is saved on the server: a second browser context for the same user sees the same decisions', async ({ page, browser }) => {
  await act(page, 'G-001', 'pass').click();
  await filter(page).getByRole('button', { name: 'Hide unsuitable' }).click();
  await expect(page.locator('li.grant')).toHaveCount(2);
  await settled(page);
  const ctx = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const p2 = await ctx.newPage();
    await p2.goto('/');
    await expect(p2.locator('li.grant')).toHaveCount(2);
    await expect(p2.getByTestId('hidden-note')).toContainText('3 unsuitable hidden');
    await p2.goto('/#/discovery/passed');
    await expect(p2.locator('li.grant[data-id="G-001"]')).toHaveCount(1);
  } finally {
    await ctx.close();
  }
});

test('old browser-only data is deleted on first load and never used', async ({ page }) => {
  await page.evaluate(async () => {
    localStorage.setItem('charity-funding.demo.v1', JSON.stringify({ version: 1, hideUnsuitable: true, grants: { 'G-001': { workflow: 'passed', override: false } } }));
    await new Promise((resolve, reject) => { const r = indexedDB.open('charity-funding.organisation', 1); r.onupgradeneeded = () => r.result.createObjectStore('meta'); r.onsuccess = () => { r.result.close(); resolve(); }; r.onerror = () => reject(r.error); });
  });
  await page.reload();
  await expect(page.locator('li.grant')).toHaveCount(6); // the old "passed" decision was not read
  await expect.poll(() => page.evaluate(() => localStorage.getItem('charity-funding.demo.v1'))).toBeNull();
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === 'charity-funding.organisation'))).toBe(false);
});

test('a failed save shows the notice, and the next successful save clears it', async ({ page }) => {
  await page.route('**/api/charities/*/decisions/*', (route) => route.abort());
  await act(page, 'G-001', 'watch').click();
  await expect(page.locator('#storage-notice')).toBeVisible();
  await expect(page.locator('#storage-notice')).toContainText('could not be saved to the server');
  await page.unroute('**/api/charities/*/decisions/*');
  await act(page, 'G-002', 'watch').click();
  await expect(page.locator('#storage-notice')).toBeHidden();
  await expectNoOverflow(page);
});

test('works when localStorage throws: no notice, because the server holds the data', async ({ browser, page }) => {
  const ctx = await browser.newContext({ viewport: page.viewportSize() });
  try {
    await ctx.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('denied');
        },
      });
    });
    const p = await ctx.newPage();
    await p.goto('/');
    await expect(p.locator('#storage-notice')).toBeHidden();
    await expect(p.locator('li.grant')).toHaveCount(6);
    await act(p, 'G-001', 'pass').click();
    await expect(p.locator('li.grant')).toHaveCount(5);
    await expectNoOverflow(p);
  } finally {
    await ctx.close();
  }
});

test('no storage notice when storage works', async ({ page }) => {
  await expect(page.locator('#storage-notice')).toBeHidden();
});

test('repeated clicks on a stale button cannot duplicate or corrupt a grant', async ({ page }) => {
  // Two synchronous clicks on the same button element: the second runs after the first re-rendered state.
  await act(page, 'G-001', 'watch').evaluate((el) => {
    el.click();
    el.click();
  });
  await expect(tab(page, 'watchlist')).toContainText('1');
  await expect(tab(page, 'new')).toContainText('5');
  await act(page, 'G-004', 'markSuitable').evaluate((el) => {
    el.click();
    el.click();
  });
  await act(page, 'G-004', 'plan').evaluate((el) => {
    el.click();
    el.click();
  });
  await expect(page).toHaveURL(/#\/planning$/);
  await expect(page.locator('li.grant')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('li.grant')).toHaveCount(1);
  await page.goto('/#/discovery/new');
  await expect(page.locator('li.grant')).toHaveCount(4);
  await expect(tab(page, 'watchlist')).toContainText('1');
});

test('every action button is keyboard operable and buttons are at least 44px tall', async ({ page }) => {
  // Keyboard: Tab to the G-001 Watch button and press Enter
  const target = act(page, 'G-001', 'watch');
  let reached = false;
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) {
      reached = true;
      break;
    }
  }
  expect(reached).toBe(true);
  // focus is visibly styled
  const outline = await target.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'watchlist')).toContainText('1');

  // Space on Pass of G-002
  const pass = act(page, 'G-002', 'pass');
  await pass.focus();
  await page.keyboard.press('Space');
  await expect(tab(page, 'passed')).toContainText('1');

  // Mark suitable and Plan via keyboard
  await act(page, 'G-004', 'markSuitable').focus();
  await page.keyboard.press('Enter');
  await act(page, 'G-004', 'plan').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/planning$/);
  await act(page, 'G-004', 'abandon').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#live')).toContainText('moved to Passed');
  await page.goto('/#/discovery/passed');
  await act(page, 'G-004', 'restore').focus();
  await page.keyboard.press('Enter');
  await expect(tab(page, 'passed')).toContainText('1');

  // Heights on every route with content present
  for (const r of ['#/discovery/new', '#/discovery/watchlist', '#/discovery/passed', '#/planning', '#/tracking']) {
    await page.goto('/' + r);
    const heights = await page.locator('button, summary, nav a, .tabs a').evaluateAll((els) =>
      els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ t: e.textContent.trim().slice(0, 20), h: e.getBoundingClientRect().height })));
    for (const x of heights) expect(x.h, `${r} ${x.t}`).toBeGreaterThanOrEqual(44);
  }
});
