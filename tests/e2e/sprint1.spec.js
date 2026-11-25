import { test, expect, settled } from './base.js';
import { YOUR_PLACE_BRIEF as DEFAULT_BRIEF } from '../../server/seed/your-place-brief.js';

const NOW = '2026-11-15T10:00:00Z'; // 10:00 London

const row = (page, id) => page.locator(`li.grant[data-id="${id}"]`);
const act = (page, id, action) => row(page, id).locator(`button[data-action="${action}"]`);
const marker = (page, id, kind) => row(page, id).locator(`[data-marker="${kind}"]`);
const brief = (page) => page.locator('#brief');
const discover = (page) => page.getByRole('button', { name: 'Discover with AI' });
// What the server holds for Your Place, in the shape the old browser state had (after the page's writes have landed).
const stored = async (page) => {
  await settled(page);
  return page.evaluate(async () => {
    const ws = await (await fetch('/api/charities/your-place/workspace')).json();
    const s = { hideUnsuitable: ws.hideUnsuitable, grants: ws.grants };
    if (ws.freshId) s.freshId = ws.freshId;
    if ('brief' in ws) s.brief = ws.brief;
    return s;
  });
};

async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw).toBeLessThanOrEqual(cw);
}

// Fixed clock for every test. Discovery runs against the server's scripted fake AI (AI_FAKE=1, see playwright.config.js).
test.beforeEach(async ({ page }) => {
  await page.addInitScript((now) => {
    window.__DEMO_NOW__ = now;
  }, NOW);
});

// Runs Discover and waits for the result message.
async function runDiscovery(page) {
  await discover(page).click();
  await expect(page.locator('#live')).toContainText('Discovery complete', { timeout: 20000 });
  await expect(discover(page)).toBeEnabled();
}
const freshId = (page) => page.locator('[data-marker="fresh"]').first().locator('xpath=ancestor::li[contains(@class,"grant")]').getAttribute('data-id');

test('fresh page: AI discovery panel with the default brief, one button, no New badges, six grants', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI discovery' })).toBeVisible();
  await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('What funding are you looking for?')).toHaveValue(DEFAULT_BRIEF);
  await expect(page.getByText('Describe your sector, location, organisation size and funding priorities.')).toBeVisible();
  await expect(page.getByText('Results are suggestions: check the funder')).toBeVisible();
  await expect(discover(page)).toHaveCount(1);
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  await expect(page.getByTestId('last-run')).toHaveCount(0);
  await expect(page.locator('a[data-tab="new"]')).toContainText('6');
  expect((await stored(page)).brief).toBe(DEFAULT_BRIEF);
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

test('an emptied brief is rejected with a linked message, starts no run and stays empty after reload', async ({ page }) => {
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/discover')) posts.push(r.url()); });
  await page.goto('/');
  await brief(page).fill('   \n ');
  await discover(page).click();
  const error = page.locator('#brief-error');
  await expect(error).toHaveText('Enter your discovery criteria first.');
  await expect(brief(page)).toHaveAttribute('aria-describedby', /brief-error/);
  await expect(brief(page)).toBeFocused();
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  await expect(page.locator('li.grant')).toHaveCount(6);
  expect(posts).toEqual([]);
  const s = await stored(page);
  expect(s.freshId).toBeUndefined();
  await brief(page).fill('');
  await discover(page).click();
  await expect(error).toBeVisible();
  await page.reload();
  await expect(brief(page)).toHaveValue('');
  await expect(error).toBeHidden();
  await brief(page).fill('x');
  await expect(error).toBeHidden();
});

test('Discover: busy state with progress lines, then new graded cards, a fresh marker and a note of what was searched', async ({ page }) => {
  await page.goto('/');
  await page.locator('a[data-tab="watchlist"]').click();
  await discover(page).click();
  await expect(discover(page)).toBeDisabled();
  await expect(brief(page)).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#ai-status')).toHaveText('Discovering grants...');
  await expect(page.locator('#ai-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('#ai-progress li').filter({ hasText: 'Searching: fake grants for charities' })).toBeVisible();
  await expect(page.locator('#live')).toContainText('Discovery complete: 2 new, 1 updated.', { timeout: 20000 });
  await expect(page.locator('a[data-tab="watchlist"]')).toHaveAttribute('aria-current', 'page'); // the run does not move you
  await expect(page.locator('a[data-tab="new"] .count')).toHaveText('8');
  await page.locator('#live').getByRole('link', { name: 'Go to New' }).click();
  await expect(page.locator('li.grant')).toHaveCount(8);
  await expect(discover(page)).toBeEnabled();
  await expect(brief(page)).toHaveJSProperty('readOnly', false);
  await expect(page.locator('#ai-status')).toBeEmpty();
  // exactly one fresh marker, on the best suitable new card, which says it was found by AI and shows its score
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(1);
  const id = await freshId(page);
  await expect(row(page, id).locator('h2')).toHaveText('Example Neighbourhood Fund');
  await expect(row(page, id).getByTestId('fit-score')).toHaveText('Fit score 84 out of 100');
  await expect(row(page, id).getByTestId('found-by')).toContainText('Found by AI on');
  await expect(row(page, id)).toHaveAttribute('data-suitability', 'suitable');
  // the blocked grant is unsuitable and lists its barrier in the details
  const blocked = page.locator('li.grant', { hasText: 'Example Capital Grant' });
  await expect(blocked).toHaveAttribute('data-suitability', 'unsuitable');
  await blocked.locator('summary').click();
  await expect(blocked.getByTestId('barriers')).toContainText('Minimum income of £5m');
  await expect(blocked.locator('details a').first()).toHaveAttribute('href', 'https://example.org/capital-grant');
  // the card that was already here gains a score but keeps its wording
  await expect(row(page, 'G-002').getByTestId('fit-score')).toHaveText('Fit score 71 out of 100');
  await expect(row(page, 'G-002').locator('.reason')).toContainText('community support in England');
  // what the AI searched
  await page.getByTestId('last-run').locator('summary').click();
  await expect(page.getByTestId('last-run-summary')).toContainText('2 new, 1 updated, 1 ignored');
  await expect(page.getByTestId('last-run-queries')).toContainText('fake neighbourhood funding');
  await expect(page.getByTestId('last-run-sources')).toContainText('Fake source');
  await expect(page.getByTestId('last-run-notes')).toContainText('Fake run');
  // the insecure-link item was dropped
  await expect(page.locator('li.grant', { hasText: 'Insecure link grant' })).toHaveCount(0);
  const s = await stored(page);
  expect(s.freshId).toBe(id);
  expect(Object.values(s.grants).every((g) => g.workflow === 'new' && g.override === false)).toBe(true);
});

test('the panel can be left while a run is going, and the result is there when it is done', async ({ page }) => {
  await page.goto('/');
  await discover(page).click();
  await expect(discover(page)).toBeDisabled();
  await page.goto('/#/tracking');
  await expect(page.getByRole('heading', { name: 'Tracking' })).toBeVisible();
  await expect(page.locator('#live')).toContainText('Discovery complete', { timeout: 20000 });
  await page.goto('/#/discovery/new');
  await expect(page.locator('li.grant')).toHaveCount(8);
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(1);
});

test('a reload during a run picks the run up again', async ({ page }) => {
  await page.goto('/');
  await discover(page).click();
  await expect(page.locator('#ai-progress li').first()).toBeVisible();
  await page.reload();
  await expect(discover(page)).toBeDisabled();
  await expect(page.locator('#live')).toContainText('Discovery complete', { timeout: 20000 });
  await expect(page.locator('li.grant')).toHaveCount(8);
  await expect(discover(page)).toBeEnabled();
});

test('only one run at a time: a second request is told so, and the button cannot start two', async ({ page, baseURL }) => {
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/discover')) posts.push(r.url()); });
  await page.goto('/');
  await discover(page).dblclick();
  await expect(discover(page)).toBeDisabled();
  const again = await page.request.post('/api/charities/your-place/discover', { headers: { Origin: new URL(baseURL).origin }, data: {} });
  expect(again.status()).toBe(409);
  expect((await again.json()).message).toBe('A discovery run is already in progress.');
  await expect(page.locator('#live')).toContainText('Discovery complete', { timeout: 20000 });
  expect(posts.length).toBe(1);
});

test('a second run adds nothing twice; the fresh marker and a decision on an AI card survive a reload', async ({ page }) => {
  await page.goto('/');
  await runDiscovery(page);
  const id = await freshId(page);
  await page.reload();
  await expect(marker(page, id, 'fresh')).toBeVisible();
  await expect(discover(page)).toBeEnabled();
  await act(page, id, 'watch').click();
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  expect((await stored(page)).freshId).toBeUndefined();
  await runDiscovery(page);
  await expect(page.locator('#live')).toContainText('Discovery complete: 0 new, 3 updated.');
  await expect(page.locator('li.grant')).toHaveCount(7); // eight cards, one of them now on the Watchlist
  await page.locator('a[data-tab="watchlist"]').click();
  await expect(row(page, id)).toBeVisible();
  expect((await stored(page)).grants[id].workflow).toBe('watchlist');
});

test('the Hide unsuitable preference and a manager override survive a discovery run', async ({ page }) => {
  await page.goto('/');
  await act(page, 'G-004', 'markSuitable').click();
  await page.getByRole('button', { name: 'Hide unsuitable', exact: true }).click();
  await expect(page.getByTestId('hidden-note')).toContainText('2 unsuitable hidden');
  await runDiscovery(page);
  await expect(page.getByRole('button', { name: 'Hide unsuitable', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'G-004')).toHaveAttribute('data-suitability', 'override');
  await expect(page.getByTestId('hidden-note')).toContainText('3 unsuitable hidden'); // the blocked AI grant joins the hidden ones
  const s = await stored(page);
  expect(s.hideUnsuitable).toBe(true);
  expect(s.grants['G-004'].override).toBe(true);
});

test('notes and search survive a run: a note on a grant is kept and still searchable', async ({ page }) => {
  await page.goto('/');
  await row(page, 'G-002').locator('summary').click();
  await row(page, 'G-002').getByTestId('note-input').fill('Ask Priya before the run');
  await settled(page);
  await expect(row(page, 'G-002').getByTestId('note-status')).toHaveText('Saved');
  await runDiscovery(page);
  await page.getByTestId('search').fill('priya');
  await expect(page.locator('li.grant')).toHaveCount(1);
  await expect(row(page, 'G-002').locator('[data-marker="notes"]')).toBeVisible();
});

test('a failed start shows a retry message and returns to idle with the brief and grants unchanged', async ({ page }) => {
  await page.route('**/api/charities/your-place/discover', (route) => (route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"SERVER_ERROR","message":"Server error."}' })
    : route.continue()));
  await page.goto('/');
  await act(page, 'G-001', 'watch').click();
  await brief(page).fill('My criteria');
  await discover(page).click();
  await expect(page.locator('#live')).toContainText('Discovery could not be started.');
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

test('the model menu lists the built-in models, sends the choice and remembers it per browser', async ({ page }) => {
  const bodies = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/discover')) bodies.push(r.postDataJSON()); });
  await page.goto('/');
  const menu = page.getByTestId('ai-model');
  await expect(page.getByLabel('AI model')).toBeVisible();
  await expect(menu.locator('option')).toHaveCount(6);
  await expect(menu.locator('option:not([disabled])')).toHaveCount(2); // Claude and ChatGPT need a key from Settings
  await expect(menu).toHaveValue('gemini:gemini-3.8-flash');
  await menu.selectOption('gemini:gemini-4-carbon');
  await page.reload();
  await expect(page.getByTestId('ai-model')).toHaveValue('gemini:gemini-4-carbon');
  await runDiscovery(page);
  expect(bodies).toEqual([{ model: 'gemini:gemini-4-carbon' }]);
  await expectNoOverflow(page);
});

test('nothing runs on load, and no request leaves the origin during a run', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const foreign = [];
  const posts = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u);
    if (r.method() === 'POST' && u.endsWith('/discover')) posts.push(u);
  });
  await page.goto('/');
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-marker="fresh"]')).toHaveCount(0);
  await expect(page.locator('#ai-status')).toBeEmpty();
  await brief(page).fill('Some text');
  await page.waitForTimeout(700);
  expect(posts).toEqual([]); // editing never starts a run
  await runDiscovery(page);
  expect(foreign).toEqual([]);
});

test('layout: no overflow with the panel, the progress list and AI cards; the button is large and keyboard operable', async ({ page }) => {
  await page.goto('/?preview=timing');
  await runDiscovery(page);
  await expectNoOverflow(page);
  await page.getByTestId('last-run').locator('summary').click();
  await expectNoOverflow(page);
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
  await expect(page.locator('#live')).toContainText('Discovery complete', { timeout: 20000 });
  await expectNoOverflow(page);
});

test('a long brief wraps inside the panel without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await brief(page).fill('x'.repeat(600) + '\n' + 'word '.repeat(300));
  await expectNoOverflow(page);
  await expect(brief(page)).toBeVisible();
});
