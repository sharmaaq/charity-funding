import { test, expect } from './base.js';

const CLAUDE = 'sk-ant-FAKEKEY-abcdef0000001234';
const nav = (page) => page.getByRole('navigation', { name: 'Main' });
const option = (page, value) => page.getByTestId('ai-model').locator(`option[value="${value}"]`);

async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('Settings is in the main navigation and shows three AI connections, none connected', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(nav(page).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('li.connection')).toHaveCount(3);
  for (const p of ['anthropic', 'openai', 'gemini']) await expect(page.getByTestId(`status-${p}`)).toHaveText('Not connected');
  await expect(page.getByText('billed to your account with that provider')).toBeVisible();
  await expectNoOverflow(page);
});

test('Claude and ChatGPT models are listed in the header menu but disabled until their key is connected', async ({ page }) => {
  await expect(option(page, 'claude:claude-opus-5-5')).toBeDisabled();
  await expect(option(page, 'claude:claude-opus-5-5')).toContainText('connect a key in Settings');
  await expect(option(page, 'openai:gpt-6.2-sol')).toBeDisabled();
  await expect(option(page, 'gemini:gemini-4-carbon')).toBeEnabled();
});

test('connect a key: it is checked, only its last four characters come back, the menu enables the models and Discover uses them', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByTestId('key-anthropic').fill(CLAUDE);
  await page.getByTestId('connect-anthropic').click();
  await expect(page.getByTestId('status-anthropic')).toHaveText('Connected, key ending 1234');
  await expect(page.getByTestId('key-anthropic')).toHaveCount(0);
  await expect(page.locator('#live')).toContainText('connected');
  expect(await page.content()).not.toContain(CLAUDE);
  await expect(option(page, 'claude:claude-sonnet-5-5')).toBeEnabled();
  await expect(option(page, 'openai:gpt-6.2-sol')).toBeDisabled();
  // it stays connected after a reload, and the secret is not in any browser storage
  await page.reload();
  await expect(page.getByTestId('status-anthropic')).toHaveText('Connected, key ending 1234');
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain('FAKEKEY');
  // choose the Claude model and run Discover with it
  const bodies = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/discover')) bodies.push(r.postDataJSON()); });
  await page.getByTestId('ai-model').selectOption('claude:claude-sonnet-5-5');
  await page.goto('/#/discovery/new');
  await page.getByRole('button', { name: 'Discover with AI' }).click();
  await expect(page.locator('#live')).toContainText('Discovery complete', { timeout: 20000 });
  expect(bodies).toEqual([{ model: 'claude:claude-sonnet-5-5' }]);
});

test('a rejected key is refused with the provider message and nothing is connected', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByTestId('key-openai').fill('bad-key-0000000000000000');
  await page.getByTestId('connect-openai').click();
  await expect(page.getByTestId('error-openai')).toContainText('rejected');
  await expect(page.getByTestId('status-openai')).toHaveText('Not connected');
  await expect(option(page, 'openai:gpt-6.2-sol')).toBeDisabled();
  await page.getByTestId('key-openai').fill('');
  await page.getByTestId('connect-openai').click();
  await expect(page.getByTestId('error-openai')).toHaveText('Paste a key first.');
});

test('removing a key asks first, disables its models again and falls back from a chosen one', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByTestId('key-anthropic').fill(CLAUDE);
  await page.getByTestId('connect-anthropic').click();
  await expect(page.getByTestId('status-anthropic')).toContainText('1234');
  await page.getByTestId('ai-model').selectOption('claude:claude-opus-5-5');
  page.once('dialog', (d) => d.dismiss());
  await page.getByTestId('remove-anthropic').click();
  await expect(page.getByTestId('status-anthropic')).toContainText('1234');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('remove-anthropic').click();
  await expect(page.getByTestId('status-anthropic')).toHaveText('Not connected');
  await expect(option(page, 'claude:claude-opus-5-5')).toBeDisabled();
  await expect(page.getByTestId('ai-model')).toHaveValue('gemini:gemini-3.8-flash');
  await expect(page.locator('#live')).toContainText('key removed');
});

test('the keys belong to the charity: a second member sees them', async ({ page, context, baseURL }) => {
  await page.goto('/#/settings');
  await page.getByTestId('key-anthropic').fill(CLAUDE);
  await page.getByTestId('connect-anthropic').click();
  await expect(page.getByTestId('status-anthropic')).toContainText('1234');
  const other = await context.newPage();
  await context.addCookies([{ name: 'dev_user_email', value: encodeURIComponent('both@test.example'), domain: new URL(baseURL).hostname, path: '/' }]);
  await other.goto('/#/settings');
  await expect(other.getByTestId('status-anthropic')).toContainText('Connected, key ending 1234');
  await other.close();
});
