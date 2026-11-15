import { test, expect } from '@playwright/test';
import { DEFAULT_BRIEF } from '../../public/js/discovery.js';

const NOW = '2026-11-15T10:00:00Z'; // 10:00 London

const row = (page, id) => page.locator(`li.grant[data-id="${id}"]`);
const act = (page, id, action) => row(page, id).locator(`button[data-action="${action}"]`);
const marker = (page, id, kind) => row(page, id).locator(`[data-marker="${kind}"]`);
const brief = (page) => page.locator('#brief');
const discover = (page) => page.getByRole('button', { name: 'Discover with AI' });
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('charity-funding.demo.v1') || 'null'));

async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw).toBeLessThanOrEqual(cw);
}

// Fixed clock for every test, and a recorder in front of the discovery runner where needed.
test.beforeEach(async ({ page }) => {
  await page.addInitScript((now) => {
    window.__DEMO_NOW__ = now;
  }, NOW);
});

async function useRecordingRunner(page, { delay = 400, fail = false } = {}) {
  await page.addInitScript(({ delay, fail }) => {
    window.__calls = [];
    window.__DEMO_RUN_DISCOVERY__ = ({ brief }) => {
      window.__calls.push(brief);
      return new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error('boom')) : resolve({ briefUsed: brief })), delay));
    };
  }, { delay, fail });
}

test('fresh page: AI discovery panel with the default brief, one button, no New badges, six grants', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI discovery' })).toBeVisible();
  await expect(page.getByText('Demo', { exact: true })).toBeVisible();
  await expect(page.getByLabel('What funding are you looking for?')).toHaveValue(DEFAULT_BRIEF);
  await expect(page.getByText('Describe your sector, location, organisation size and funding priorities.')).toBeVisible();
  await expect(page.getByText('Sample results are fixed in this demo; editing the brief does not change the grant selection.')).toBeVisible();
  await expect(discover(page)).toHaveCount(1);
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  await expect(page.locator('a[data-tab="new"]')).toContainText('6');
  // Nothing was saved just by looking at the page, and the panel shows on all three Discovery views only.
  expect((await stored(page)) === null || (await stored(page)).brief === undefined).toBe(true);
  await page.goto('/#/discovery/watchlist');
  await expect(brief(page)).toBeVisible();
  await page.goto('/#/discovery/passed');
  await expect(brief(page)).toBeVisible();
  await page.goto('/#/planning');
  await expect(brief(page)).toBeHidden();
});

test('markers on the real data at the injected clock: Due soon beside G-003 and G-005 only', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-marker]')).toHaveCount(2);
  await expect(marker(page, 'G-003', 'dueSoon')).toHaveText('Due soon');
  await expect(marker(page, 'G-005', 'dueSoon')).toHaveText('Due soon');
  await expect(page.locator('[data-marker="upcoming"]')).toHaveCount(0);
  await expect(marker(page, 'G-004', 'dueSoon')).toHaveCount(0);
  // The badge sits in the title block with the name, with an icon that is hidden from assistive technology.
  await expect(row(page, 'G-003').locator('.name-row h2')).toHaveText('DPS Social Commitment Programme - Scale');
  await expect(marker(page, 'G-003', 'dueSoon').locator('svg[aria-hidden="true"]')).toHaveCount(1);
  // Existing timing text is untouched.
  await expect(row(page, 'G-003')).toContainText('Original snapshot extension to noon UK time, 17 November 2026');
  // Markers also appear in the other Discovery views.
  await act(page, 'G-003', 'watch').click();
  await page.locator('a[data-tab="watchlist"]').click();
  await expect(marker(page, 'G-003', 'dueSoon')).toBeVisible();
});

test('a later clock moves the markers: after 17 December G-004 is Due soon and G-003 and G-005 are not', async ({ page }) => {
  await page.addInitScript(() => {
    window.__DEMO_NOW__ = '2026-12-10T10:00:00Z';
  });
  await page.goto('/');
  await expect(marker(page, 'G-004', 'dueSoon')).toBeVisible();
  await expect(page.locator('[data-marker]')).toHaveCount(1);
});

test('?preview=timing shows the notice and synthetic markers without changing timing text', async ({ page }) => {
  await page.goto('/?preview=timing');
  await expect(page.getByTestId('preview-notice')).toContainText('Timing preview: the opening and closing dates used for markers on this page are synthetic examples, not funder dates.');
  await expect(marker(page, 'G-001', 'upcoming')).toHaveText('Upcoming');
  await expect(marker(page, 'G-001', 'dueSoon')).toHaveCount(0);
  await expect(marker(page, 'G-002', 'upcoming')).toBeVisible();
  await expect(marker(page, 'G-002', 'dueSoon')).toBeVisible();
  await expect(marker(page, 'G-003', 'dueSoon')).toBeVisible();
  await expect(marker(page, 'G-003', 'upcoming')).toHaveCount(0);
  await expect(row(page, 'G-001')).toContainText('Rolling (original snapshot)');
  await expect(row(page, 'G-003')).toContainText('Original snapshot extension to noon UK time, 17 November 2026');
  // Nothing synthetic is saved.
  expect(JSON.stringify(await stored(page) || {})).not.toMatch(/opensOn|closesOn/);
  // The link goes back to the normal view, with no preview notice.
  await page.getByRole('link', { name: 'Back to the normal view' }).click();
  await expect(page.getByTestId('preview-notice')).toHaveCount(0);
  await expect(page.locator('[data-marker="upcoming"]')).toHaveCount(0);
  expect(page.url()).not.toContain('preview');
  await expectNoOverflow(page);
});

test('the notice is absent on the normal page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('preview-notice')).toHaveCount(0);
});

test('an edited brief with a line break survives navigation and reload', async ({ page }) => {
  await page.goto('/');
  const text = 'Housing grants in London\nIncome about 7m <b>not bold</b>';
  await brief(page).fill(text);
  await page.waitForTimeout(700); // past the autosave debounce
  expect((await stored(page)).brief).toBe(text);
  await page.goto('/#/tracking');
  await page.goto('/#/discovery/new');
  await expect(brief(page)).toHaveValue(text);
  await page.reload();
  await expect(brief(page)).toHaveValue(text);
  // The text is inserted as text, never as markup.
  await expect(page.locator('#ai-panel b')).toHaveCount(0);
});

test('reload straight after typing keeps the text (flushed when the page is hidden)', async ({ page }) => {
  await page.goto('/');
  await brief(page).fill('typed just before leaving');
  await page.reload();
  await expect(brief(page)).toHaveValue('typed just before leaving');
});

test('typing keeps focus and caret when a grant action re-renders the list', async ({ page }) => {
  await page.goto('/');
  await brief(page).fill('');
  await brief(page).focus();
  await page.keyboard.type('abcdef');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft'); // caret between "abcd" and "ef"
  // A programmatic click re-renders the grant list without moving focus by itself.
  await page.evaluate(() => document.querySelector('li.grant[data-id="G-001"] button[data-action="pass"]').click());
  await expect(row(page, 'G-001')).toHaveCount(0);
  const state = await page.evaluate(() => ({
    id: document.activeElement.id,
    start: document.activeElement.selectionStart,
    end: document.activeElement.selectionEnd,
  }));
  expect(state).toEqual({ id: 'brief', start: 4, end: 4 });
  await page.keyboard.type('X');
  await expect(brief(page)).toHaveValue('abcdXef');
});

test('an emptied brief is rejected with a linked message, changes nothing and stays empty after reload', async ({ page }) => {
  await useRecordingRunner(page);
  await page.goto('/');
  await brief(page).fill('   \n ');
  await discover(page).click();
  const error = page.locator('#brief-error');
  await expect(error).toHaveText('Enter your discovery criteria first.');
  await expect(brief(page)).toHaveAttribute('aria-describedby', /brief-error/);
  await expect(brief(page)).toBeFocused();
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  await expect(page.locator('li.grant')).toHaveCount(6);
  expect(await page.evaluate(() => window.__calls.length)).toBe(0);
  const s = await stored(page);
  expect(s.freshId).toBeUndefined();
  expect(Object.values(s.grants).every((g) => g.workflow === 'new' && g.override === false)).toBe(true);
  // A truly empty brief stays empty after reload (the default is not re-applied).
  await brief(page).fill('');
  await discover(page).click();
  await expect(error).toBeVisible();
  await page.reload();
  await expect(brief(page)).toHaveValue('');
  await expect(error).toBeHidden();
  // Typing clears the message.
  await brief(page).fill('x');
  await expect(error).toBeHidden();
});

test('Discover: busy state, announcements, then exactly one New badge on G-001', async ({ page }) => {
  await page.goto('/');
  await page.locator('a[data-tab="watchlist"]').click();
  await discover(page).click();
  await expect(discover(page)).toBeDisabled();
  await expect(brief(page)).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#ai-status')).toHaveText('Discovering grants...');
  await expect(page.locator('#ai-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('#live')).toContainText('Demo discovery complete - 1 grant marked as new.', { timeout: 5000 });
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(1);
  await expect(marker(page, 'G-001', 'fresh')).toHaveText('New');
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(page.locator('a[data-tab="new"]')).toHaveAttribute('aria-current', 'page');
  await expect(discover(page)).toBeEnabled();
  await expect(brief(page)).toHaveJSProperty('readOnly', false);
  await expect(page.locator('#ai-status')).toBeEmpty();
  // The grants themselves are unchanged apart from the freshness marker.
  const s = await stored(page);
  expect(s.freshId).toBe('G-001');
  expect(Object.values(s.grants).every((g) => g.workflow === 'new' && g.override === false)).toBe(true);
});

test('Discover straight after editing uses and saves the latest text', async ({ page }) => {
  await useRecordingRunner(page);
  await page.goto('/');
  await brief(page).fill('Fresh edit before the debounce');
  await discover(page).click();
  expect(await page.evaluate(() => window.__calls)).toEqual(['Fresh edit before the debounce']);
  expect((await stored(page)).brief).toBe('Fresh edit before the debounce');
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(1);
});

test('double click starts one run; repeating after completion still leaves one New badge', async ({ page }) => {
  await useRecordingRunner(page);
  await page.goto('/');
  await discover(page).dblclick();
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.__calls.length)).toBe(1);
  await discover(page).click();
  await expect(page.locator('#ai-status')).toBeEmpty();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__calls.length)).toBe(2);
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(1);
  await expect(page.locator('li.grant')).toHaveCount(6);
});

test('the badge survives a reload and clears when the manager acts on that grant', async ({ page }) => {
  await useRecordingRunner(page, { delay: 50 });
  await page.goto('/');
  await discover(page).click();
  await expect(marker(page, 'G-001', 'fresh')).toBeVisible();
  await page.reload();
  await expect(marker(page, 'G-001', 'fresh')).toBeVisible();
  // Busy state never survives a reload and nothing runs on load.
  await expect(discover(page)).toBeEnabled();
  expect(await page.evaluate(() => window.__calls.length)).toBe(0);
  await act(page, 'G-001', 'watch').click();
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  expect((await stored(page)).freshId).toBeUndefined();
  await page.locator('a[data-tab="watchlist"]').click();
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
});

test('a run moves the badge to the next suitable grant once G-001 has been watched', async ({ page }) => {
  await useRecordingRunner(page, { delay: 50 });
  await page.goto('/');
  await act(page, 'G-001', 'watch').click();
  await discover(page).click();
  await expect(marker(page, 'G-002', 'fresh')).toBeVisible();
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(1);
});

test('the Hide unsuitable preference and a manager override survive a discovery run', async ({ page }) => {
  await useRecordingRunner(page, { delay: 50 });
  await page.goto('/');
  await act(page, 'G-004', 'markSuitable').click();
  await page.getByRole('button', { name: 'Hide unsuitable', exact: true }).click();
  await expect(page.getByTestId('hidden-note')).toContainText('2 unsuitable hidden');
  await discover(page).click();
  await expect(marker(page, 'G-001', 'fresh')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide unsuitable', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'G-004')).toHaveAttribute('data-suitability', 'override');
  await expect(page.getByTestId('hidden-note')).toContainText('2 unsuitable hidden');
  const s = await stored(page);
  expect(s.hideUnsuitable).toBe(true);
  expect(s.grants['G-004'].override).toBe(true);
});

test('with no suitable grant left in New the demo says so and marks nothing', async ({ page }) => {
  await useRecordingRunner(page, { delay: 50 });
  await page.goto('/');
  for (const id of ['G-001', 'G-002', 'G-003']) await act(page, id, 'pass').click();
  await discover(page).click();
  await expect(page.locator('#live')).toContainText('No demo grant available to rediscover. Restore a suitable grant to New to repeat the demo.');
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  await expect(discover(page)).toBeEnabled();
  expect((await stored(page)).freshId).toBeUndefined();
  expect(await page.evaluate(() => window.__calls.length)).toBe(1);
});

test('a failed run shows a retry message and returns to idle with the brief and grants unchanged', async ({ page }) => {
  await useRecordingRunner(page, { delay: 50, fail: true });
  await page.goto('/');
  await act(page, 'G-001', 'watch').click();
  await brief(page).fill('My criteria');
  await discover(page).click();
  await expect(page.locator('#live')).toContainText('Discovery could not be completed. Please try again.');
  await expect(discover(page)).toBeEnabled();
  await expect(brief(page)).toHaveJSProperty('readOnly', false);
  await expect(brief(page)).toHaveValue('My criteria');
  await expect(page.locator('#ai-status')).toBeEmpty();
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  const s = await stored(page);
  expect(s.brief).toBe('My criteria');
  expect(s.grants['G-001'].workflow).toBe('watchlist');
  expect(s.freshId).toBeUndefined();
});

test('no request leaves the origin and nothing runs on load', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const foreign = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u);
  });
  await page.goto('/');
  await page.waitForTimeout(1500); // longer than the simulated run
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  await expect(page.locator('#ai-status')).toBeEmpty();
  await brief(page).fill('Some text');
  await page.waitForTimeout(700);
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0); // editing never starts a run
  await discover(page).click();
  await expect(marker(page, 'G-001', 'fresh')).toBeVisible({ timeout: 5000 });
  expect(foreign).toEqual([]);
});

test('layout: no overflow with the panel and three badges on one grant; the button is large and keyboard operable', async ({ page }) => {
  await page.goto('/?preview=timing');
  await act(page, 'G-001', 'pass').click();
  await discover(page).click();
  await expect(marker(page, 'G-002', 'fresh')).toBeVisible({ timeout: 5000 });
  await expect(marker(page, 'G-002', 'upcoming')).toBeVisible();
  await expect(marker(page, 'G-002', 'dueSoon')).toBeVisible();
  await expectNoOverflow(page);
  // Every badge sits inside its grant row and the viewport.
  const boxes = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll('.marker')].map((m) => {
      const r = m.getBoundingClientRect();
      const g = m.closest('li.grant').getBoundingClientRect();
      return { l: r.left, r: r.right, gl: g.left, gr: g.right, vw };
    });
  });
  for (const b of boxes) {
    expect(b.l).toBeGreaterThanOrEqual(b.gl);
    expect(b.r).toBeLessThanOrEqual(b.gr + 0.5);
    expect(b.r).toBeLessThanOrEqual(b.vw);
  }
  const btn = await discover(page).boundingBox();
  expect(btn.height).toBeGreaterThanOrEqual(44);
});

test('keyboard: Tab from the textarea reaches the button and Enter starts a run', async ({ page }) => {
  await page.goto('/');
  await brief(page).focus();
  await page.keyboard.press('Tab');
  await expect(discover(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(marker(page, 'G-001', 'fresh')).toBeVisible({ timeout: 5000 });
  await expectNoOverflow(page);
});

test('a long brief wraps inside the panel without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await brief(page).fill('x'.repeat(600) + '\n' + 'word '.repeat(300));
  await expectNoOverflow(page);
  await expect(brief(page)).toBeVisible();
});
