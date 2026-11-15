import { test, expect } from '@playwright/test';

const ROUTES = [
  ['#/discovery/new', 'Discovery'],
  ['#/discovery/watchlist', 'Discovery'],
  ['#/discovery/passed', 'Discovery'],
  ['#/planning', 'Planning & submission'],
  ['#/tracking', 'Tracking'],
];

test('fonts load: Lilita One 400, Urbanist 600 and 800', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(['400 16px "Lilita One"', '600 16px Urbanist', '800 16px Urbanist'].map((f) => document.fonts.load(f)));
    return {
      lilita: document.fonts.check('400 16px "Lilita One"'),
      u600: document.fonts.check('600 16px Urbanist'),
      u800: document.fonts.check('800 16px Urbanist'),
      loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`),
    };
  });
  expect(res.lilita).toBe(true);
  expect(res.u600).toBe(true);
  expect(res.u800).toBe(true);
  expect(res.loaded.join(',')).toContain('Lilita One');
  expect(res.loaded.join(',')).toContain('Urbanist 600');
});

test('computed families, band and strip colours', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Discovery');
  const s = await page.evaluate(() => ({
    h1: getComputedStyle(document.querySelector('h1')).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
    band: getComputedStyle(document.querySelector('.band')).backgroundColor,
    strip: getComputedStyle(document.querySelector('.strip')).backgroundColor,
    transform: getComputedStyle(document.querySelector('h1')).textTransform,
  }));
  expect(s.h1).toMatch(/^"?Lilita One/);
  expect(s.body).toMatch(/^"?Urbanist/);
  expect(s.band).toBe('rgb(68, 44, 134)');
  expect(s.strip).toBe('rgb(215, 219, 45)');
  expect(s.transform).toBe('uppercase');
});

test('each route shows exactly one h1 with the area name', async ({ page }) => {
  for (const [hash, name] of ROUTES) {
    await page.goto('/' + hash);
    await page.reload();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(name);
  }
});

test('every request is same-origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const foreign = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['data:', 'blob:', 'about:'].includes(u.protocol) && u.origin !== origin) foreign.push(r.url());
  });
  for (const [hash] of ROUTES) {
    await page.goto('/' + hash);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
  }
  expect(foreign).toEqual([]);
});

test('the motif is aria-hidden and does not intercept clicks', async ({ page }) => {
  await page.goto('/');
  const motif = page.locator('.motif');
  await expect(motif).toHaveAttribute('aria-hidden', 'true');
  expect(await motif.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  // nothing in the accessibility tree
  await expect(page.getByRole('img')).toHaveCount(0);
  // the motif never overlaps the title text
  const overlap = await page.evaluate(() => {
    const r = document.createRange();
    r.selectNodeContents(document.querySelector('h1'));
    const t = r.getBoundingClientRect();
    const m = document.querySelector('.motif').getBoundingClientRect();
    return !(t.right <= m.left || t.left >= m.right || t.bottom <= m.top || t.top >= m.bottom);
  });
  expect(overlap).toBe(false);
  // the navigation stays clickable
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tracking' }).click();
  await expect(page).toHaveURL(/#\/tracking$/);
  // and the motif sits in the title band, below the header
  const hit = await page.evaluate(() => {
    const m = document.querySelector('.motif').getBoundingClientRect();
    const el = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
    return el && el.closest('.motif') ? 'motif' : el.tagName;
  });
  expect(hit).not.toBe('motif');
});

test('the planning title also fits the band without overlapping the motif', async ({ page }) => {
  await page.goto('/#/planning');
  await page.reload();
  const overlap = await page.evaluate(() => {
    const r = document.createRange();
    r.selectNodeContents(document.querySelector('h1'));
    const t = r.getBoundingClientRect();
    const m = document.querySelector('.motif').getBoundingClientRect();
    return !(t.right <= m.left || t.left >= m.right || t.bottom <= m.top || t.top >= m.bottom);
  });
  expect(overlap).toBe(false);
});
