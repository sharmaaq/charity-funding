// Usage: node tests/evidence/capture.mjs <baseUrl> <before|after> [outDir]
// Saves <label>-<width>-<scene>.png into the ticket's evidence folder (or outDir).
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const [baseUrl, label, outArg] = process.argv.slice(2);
if (!baseUrl || !['before', 'after'].includes(label)) {
  console.error('Usage: node tests/evidence/capture.mjs <baseUrl> <before|after> [outDir]');
  process.exit(1);
}
const outDir = outArg || path.resolve('project/sprint-0/tickets/S0-003-visual-theme/evidence');
await fs.mkdir(outDir, { recursive: true });

const widths = label === 'before' ? [1280] : [1280, 390, 360];
const heights = { 1280: 800, 390: 844, 360: 740 };
const scenes = label === 'before'
  ? ['discovery-new', 'planning', 'tracking']
  : ['discovery-new', 'unsuitable', 'override', 'details-open', 'planning', 'tracking'];

const browser = await chromium.launch();
try {
  for (const width of widths) {
    for (const scene of scenes) {
      // A fresh context per scene keeps saved state from leaking between scenes.
      const ctx = await browser.newContext({ viewport: { width, height: heights[width] } });
      const page = await ctx.newPage();
      await page.goto(baseUrl + '/#/discovery/new');
      await page.evaluate(() => document.fonts.ready);
      const row = (id) => page.locator(`li.grant[data-id="${id}"]`);
      const file = path.join(outDir, `${label}-${width}-${scene}.png`);
      let fullPage = false;
      if (scene === 'discovery-new') {
        fullPage = true;
      } else if (scene === 'unsuitable') {
        await row('G-004').scrollIntoViewIfNeeded();
        await row('G-004').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      } else if (scene === 'override') {
        await row('G-004').locator('button[data-action="markSuitable"]').click();
        await row('G-004').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      } else if (scene === 'details-open') {
        await row('G-004').locator('summary').click();
        await row('G-004').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      } else if (scene === 'planning') {
        if (label === 'after') {
          await row('G-002').locator('button[data-action="plan"]').click();
        } else {
          await page.goto(baseUrl + '/#/planning');
        }
        fullPage = true;
      } else if (scene === 'tracking') {
        await page.goto(baseUrl + '/#/tracking');
        fullPage = true;
      }
      await page.waitForTimeout(250);
      await page.screenshot({ path: file, fullPage });
      console.log('saved', file);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
