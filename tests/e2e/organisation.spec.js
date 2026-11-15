import { test, expect } from '@playwright/test';

const NOW = '2026-11-15T10:00:00Z';
const SYNTH = 'Synthetic demo example — not a real submission or filing';
const NOTICE = 'Files are stored in this browser only. Keep your originals. AI processing is not connected in this demo.';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((now) => { window.__DEMO_NOW__ = now; }, NOW);
});

const bidRows = (page) => page.locator('li.bid-row');
const docRows = (page) => page.locator('li.doc-row');
const bidRow = (page, title) => bidRows(page).filter({ hasText: title });
const docRow = (page, text) => docRows(page).filter({ hasText: text });
const live = (page) => page.locator('#live');
const txt = (name, text = 'hello ' + name) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });

async function noOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

async function openOrg(page, hash = '#/organisation') {
  await page.goto('/' + hash);
  await expect(page.locator('h1')).toHaveText('Organisation information');
  await expect(page.getByTestId('org-storage-notice')).toBeVisible();
}

async function addBid(page, { title, funder, outcome, submission, requested, awarded, files }) {
  await page.getByRole('link', { name: '+ Add past bid' }).click();
  await page.getByLabel('Bid title').fill(title);
  await page.locator('input[name="funder"]').fill(funder);
  if (outcome) await page.getByLabel('Outcome').selectOption(outcome);
  if (submission) await page.getByLabel('Submission date').fill(submission);
  if (requested) await page.getByLabel('Requested amount').fill(requested);
  if (awarded) await page.locator('input[name="awardedAmount"]').fill(awarded);
  if (files) await page.getByTestId('bid-file-input').setInputFiles(files);
  await page.getByRole('button', { name: /Save past bid/ }).click();
}

test('the wordmark is a link to Organisation information; Discovery stays the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/discovery\/new$/);
  await expect(page.locator('h1')).toHaveText('Discovery');
  const brand = page.getByRole('link', { name: 'YOR Plc organisation information' });
  await expect(brand).toHaveCount(1);
  await expect(brand).not.toHaveAttribute('aria-current', 'page');
  await brand.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/organisation$/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('Organisation information');
  await expect(brand).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('org-storage-notice')).toHaveText(NOTICE);
  await noOverflow(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tracking' }).click();
  await expect(page.locator('h1')).toHaveText('Tracking');
  await expect(brand).not.toHaveAttribute('aria-current', 'page');
});

test('deep links, reload and Back/Forward work for every organisation route', async ({ page }) => {
  await openOrg(page, '#/organisation/documents');
  await expect(page.getByRole('heading', { name: 'Documents', level: 2 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Documents', level: 2 })).toBeVisible();
  await page.getByRole('link', { name: /^Past bids/ }).click();
  await expect(page).toHaveURL(/#\/organisation\/bids$/);
  await bidRow(page, 'Move-on support programme').getByRole('link', { name: /View/ }).click();
  await expect(page).toHaveURL(/#\/organisation\/bids\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Move-on support programme', level: 2 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Move-on support programme', level: 2 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Past bids', level: 2 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Documents', level: 2 })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Past bids', level: 2 })).toBeVisible();
  await page.goto('/#/organisation/bids/new');
  await expect(page.getByRole('heading', { name: 'Add past bid' })).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
});

test('an unknown bid shows Bid not found with a way back; an unknown organisation path returns to the overview', async ({ page }) => {
  await openOrg(page, '#/organisation/bids/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Bid not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to past bids' }).click();
  await expect(page).toHaveURL(/#\/organisation\/bids$/);
  await expect(bidRows(page)).toHaveCount(3);
  await page.goto('/#/organisation/nonsense');
  await expect(page).toHaveURL(/#\/organisation$/);
  await expect(page.locator('h1')).toHaveText('Organisation information');
  await openOrg(page, '#/organisation/bids/does-not-exist/edit');
  await expect(page.getByRole('heading', { name: 'Bid not found' })).toBeVisible();
});

test('seed: three bids and four documents, all marked synthetic, counts on the tabs', async ({ page }) => {
  await openOrg(page);
  await expect(page.getByRole('link', { name: /^Past bids/ })).toContainText('3');
  await expect(page.getByRole('link', { name: /^Documents/ })).toContainText('4');
  await expect(bidRows(page)).toHaveCount(3);
  await expect(bidRows(page).locator('.synthetic')).toHaveText([SYNTH, SYNTH, SYNTH]);
  await expect(bidRow(page, 'A fresh start').locator('[data-outcome="successful"]')).toBeVisible();
  await expect(bidRow(page, 'Skills for independent living').locator('[data-outcome="unsuccessful"]')).toBeVisible();
  await expect(bidRow(page, 'Move-on support').locator('[data-outcome="awaiting"]')).toBeVisible();
  // sorted by submission date, newest first
  await expect(bidRows(page).locator('h3')).toHaveText(['Move-on support programme', 'Skills for independent living', 'A fresh start: tenancy support']);
  await expect(page.getByTestId('bid-count')).toHaveText('3 of 3 past bids');
  await page.getByRole('link', { name: /^Documents/ }).click();
  await expect(docRows(page)).toHaveCount(4);
  await expect(docRows(page).locator('.synthetic')).toHaveText([SYNTH, SYNTH, SYNTH, SYNTH]);
  await expect(page.getByTestId('doc-count')).toHaveText('4 of 4 documents');
  await expect(page.locator('main')).not.toContainText('null');
  await expect(page.getByText('Charity Commission submission').first()).toBeVisible();
  await expect(page.getByText('Companies House filing').first()).toBeVisible();
  // the seed bid detail: feedback on the unsuccessful bid and its three file groups
  await page.goto('/#/organisation/bids');
  await bidRow(page, 'Skills for independent living').getByRole('link', { name: /View/ }).click();
  await expect(page.getByText('We would have liked clearer evidence')).toBeVisible();
  await expect(page.locator('[data-role="feedback"] li.file')).toHaveCount(1);
  await expect(page.locator('[data-role="bid-document"] li.file')).toHaveCount(1);
  await expect(page.getByText('Bid document missing')).toHaveCount(0);
  await expect(page.getByText('Historical record, not submitted through this application.')).toBeVisible();
});

test('profile edit persists across reload; Cancel and validation errors change nothing; Discovery assessments unchanged', async ({ page }) => {
  await openOrg(page);
  const before = await page.getByTestId('overview-text').textContent();
  await page.getByRole('button', { name: 'Edit organisation information' }).click();
  await page.getByLabel('What the charity does').fill('Changed text then cancelled');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByTestId('overview-text')).toHaveText(before);
  await expect(page.getByRole('button', { name: 'Edit organisation information' })).toBeFocused();

  await page.getByRole('button', { name: 'Edit organisation information' }).click();
  await page.getByLabel('What the charity does').fill('');
  await page.getByLabel('Website').fill('ftp://nope');
  await page.getByLabel('Charity number').fill('00123');
  await page.getByRole('button', { name: 'Save information' }).click();
  const overview = page.getByLabel('What the charity does');
  await expect(overview).toHaveAttribute('aria-invalid', 'true');
  const errId = (await overview.getAttribute('aria-describedby')).split(' ').pop();
  await expect(page.locator('#' + errId)).toHaveText('Describe what the charity does.');
  await expect(page.getByLabel('Website')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Charity number')).toHaveValue('00123'); // typed values preserved
  await page.reload();
  await expect(page.getByTestId('overview-text')).toHaveText(before); // nothing persisted

  await page.getByRole('button', { name: 'Edit organisation information' }).click();
  await page.getByLabel('What the charity does').fill('A new overview.');
  await page.getByLabel('Charity number').fill('00123');
  await page.getByLabel('Website').fill('https://example.org');
  await page.getByRole('button', { name: 'Save information' }).click();
  await expect(live(page)).toContainText('Organisation information saved.');
  await expect(page.getByTestId('overview-text')).toHaveText('A new overview.');
  await page.reload();
  await expect(page.getByTestId('overview-text')).toHaveText('A new overview.');
  await expect(page.getByText('00123', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'https://example.org' })).toBeVisible();

  // canned suitability text in Discovery is untouched
  await page.goto('/#/discovery/new');
  await expect(page.locator('li.grant[data-id="G-004"] .reason')).toContainText('£7.1m');
});

test('bid lifecycle: create, search, filter, edit, outcome change confirmation, delete', async ({ page }) => {
  await openOrg(page);
  await addBid(page, { title: 'Garden project', funder: 'Elm Trust', outcome: 'successful', submission: '2026-03-01', requested: '12000', awarded: '10000.50' });
  await expect(page.getByRole('heading', { name: 'Garden project', level: 2 })).toBeVisible();
  await expect(live(page)).toContainText('Past bid added.');
  await expect(page.getByText('Bid document missing').first()).toBeVisible();
  await expect(page.getByText('£10,000.50')).toBeVisible();
  const url = page.url();
  await page.getByRole('link', { name: 'Back to past bids' }).click();
  await expect(bidRows(page)).toHaveCount(4);
  await expect(bidRow(page, 'Garden project').getByTestId('bid-missing')).toBeVisible();
  await expect(bidRow(page, 'Garden project').locator('.synthetic')).toHaveCount(0);

  await page.getByLabel('Search past bids').fill('elm');
  await expect(bidRows(page)).toHaveCount(1);
  await expect(page.getByTestId('bid-count')).toHaveText('1 of 4 past bids');
  await page.getByLabel('Search past bids').fill('zzz');
  await expect(page.getByText('No past bids match.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filter' }).click();
  await expect(bidRows(page)).toHaveCount(4);
  await page.getByLabel('Filter by outcome').selectOption('unsuccessful');
  await expect(bidRows(page)).toHaveCount(1);
  await page.getByLabel('Filter by outcome').selectOption('all');

  // edit keeps the id and asks before clearing the awarded amount
  await page.goto(url + '/edit');
  await expect(page.getByLabel('Bid title')).toHaveValue('Garden project');
  const outcome = page.getByLabel('Outcome');
  await outcome.selectOption('unsuccessful');
  await expect(page.getByRole('dialog')).toContainText('Clear the awarded amount?');
  await page.getByRole('button', { name: 'Keep Successful' }).click();
  await expect(outcome).toHaveValue('successful');
  await expect(page.locator('input[name="awardedAmount"]')).toHaveValue('10000.5');
  await outcome.selectOption('withdrawn');
  await page.getByRole('button', { name: 'Clear amount' }).click();
  await expect(page.locator('input[name="awardedAmount"]')).toHaveValue('');
  await expect(page.locator('input[name="awardedAmount"]')).toBeDisabled();
  await page.getByLabel('Bid title').fill('Garden project 2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('heading', { name: 'Garden project 2', level: 2 })).toBeVisible();

  // validation: future date and decision before submission
  await page.goto(url + '/edit');
  await page.getByLabel('Submission date').fill('2026-11-16');
  await page.getByLabel('Decision date').fill('2026-01-01');
  await page.getByLabel('Requested amount').fill('1.234');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.form-error')).toContainText('Nothing has been saved');
  await expect(page.getByLabel('Submission date')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Requested amount')).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(url);

  // delete asks first, naming the bid
  await page.getByRole('button', { name: 'Delete bid' }).click();
  await expect(page.getByRole('dialog')).toContainText('Garden project 2');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Garden project 2', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Delete bid' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete bid' }).click();
  await expect(page).toHaveURL(/#\/organisation\/bids$/);
  await expect(live(page)).toContainText('deleted');
  await expect(bidRows(page)).toHaveCount(3);
});

test('bid with a bid document loses the missing flag; roles are kept', async ({ page }) => {
  await openOrg(page);
  await addBid(page, { title: 'Files bid', funder: 'F', files: [txt('main.txt')] });
  await expect(page.getByText('Bid document missing')).toHaveCount(0);
  await expect(page.locator('[data-role="bid-document"] li.file')).toContainText('main.txt');
  await page.getByRole('link', { name: 'Edit bid' }).click();
  await page.getByRole('button', { name: '+ Attach feedback' }).click();
  await page.getByTestId('bid-file-input').setInputFiles(txt('fb.txt'));
  await expect(page.getByRole('group', { name: 'fb.txt' }).getByLabel('Role')).toHaveValue('feedback');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('[data-role="feedback"] li.file')).toContainText('fb.txt');
  await expect(page.locator('[data-role="bid-document"] li.file')).toContainText('main.txt');
});

test('documents: batch upload with default metadata, edit details, search, same name twice, delete', async ({ page }) => {
  await openOrg(page, '#/organisation/documents');
  await page.getByRole('button', { name: /Upload documents/ }).click();
  await expect(page.getByText('Allowed: PDF, DOCX, XLSX, CSV, TXT, PNG and JPEG. Up to 10 MB each.')).toBeVisible();
  await page.getByTestId('doc-file-input').setInputFiles([txt('one.txt'), txt('two.txt'), txt('one.txt')]);
  await expect(page.getByRole('button', { name: 'Upload 3 documents' })).toBeEnabled();
  await page.getByRole('button', { name: 'Upload 3 documents' }).click();
  await expect(page.getByTestId('upload-results')).toContainText('Upload results: 3 of 3 uploaded');
  await expect(live(page)).toContainText('3 of 3 files uploaded.');
  await expect(docRows(page)).toHaveCount(7);
  await expect(page.getByRole('link', { name: /^Documents/ })).toContainText('7');
  await expect(docRow(page, 'one.txt')).toHaveCount(2); // never deduplicated
  await expect(docRow(page, 'two.txt').locator('h3')).toHaveText('two.txt'); // title defaults to the filename
  await expect(docRow(page, 'two.txt').locator('.synthetic')).toHaveCount(0);

  await docRow(page, 'two.txt').getByRole('button', { name: /Edit details/ }).click();
  await page.getByLabel('Title').fill('Trustees report 2026');
  await page.getByLabel('Category').selectOption('governance');
  await page.getByLabel('Reporting period').fill('Year ended 31 March 2026');
  await page.getByLabel('Tags').fill('trustees, report');
  await page.getByLabel('Description').fill('Annual trustees report');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(docRow(page, 'Trustees report 2026')).toContainText('Governance/policy');
  await expect(docRow(page, 'Trustees report 2026')).toContainText('Year ended 31 March 2026');
  await expect(docRow(page, 'Trustees report 2026').getByRole('button', { name: /Edit details/ })).toBeFocused();
  await page.reload();
  await expect(docRow(page, 'Trustees report 2026')).toHaveCount(1);

  await page.getByLabel('Search document details').fill('trustees');
  await expect(docRows(page)).toHaveCount(1);
  await page.getByLabel('Search document details').fill('annual trustees');
  await expect(docRows(page)).toHaveCount(1);
  await page.getByLabel('Search document details').fill('hello'); // content is not searched
  await expect(page.getByText('No documents match.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();

  const target = docRows(page).filter({ hasText: 'one.txt' }).first();
  await target.getByRole('button', { name: /^Delete/ }).click();
  await expect(page.getByRole('dialog')).toContainText('one.txt');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(docRows(page)).toHaveCount(7);
  await target.getByRole('button', { name: /^Delete/ }).click();
  await page.getByRole('button', { name: 'Delete document' }).click();
  await expect(docRows(page)).toHaveCount(6);
  await expect(docRow(page, 'one.txt')).toHaveCount(1);
});

test('a file name containing HTML renders as text', async ({ page }) => {
  const name = '<img src=x onerror=window.__pwned=1>.txt';
  await openOrg(page, '#/organisation/documents');
  await page.getByRole('button', { name: /Upload documents/ }).click();
  await page.getByTestId('doc-file-input').setInputFiles(txt(name));
  await page.getByRole('button', { name: 'Upload 1 document' }).click();
  await expect(docRows(page)).toHaveCount(5);
  await expect(docRow(page, name).locator('h3')).toHaveText(name);
  await expect(page.locator('main img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  // and as a bid attachment name and in the delete confirmation
  await page.goto('/#/organisation/bids/new');
  await page.getByLabel('Bid title').fill('<b>bold</b> bid');
  await page.locator('input[name="funder"]').fill('F');
  await page.getByTestId('bid-file-input').setInputFiles(txt(name));
  await page.getByRole('button', { name: 'Save past bid' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '<b>bold</b> bid' })).toBeVisible();
  await expect(page.locator('main b')).toHaveCount(0);
  await expect(page.locator('li.file')).toContainText(name);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('dirty-form guard: staying keeps input, leaving discards', async ({ page }) => {
  await openOrg(page, '#/organisation/bids/new');
  await page.getByLabel('Bid title').fill('Unsaved bid');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tracking' }).click();
  await expect(page.getByRole('dialog')).toContainText('Leave without saving?');
  await page.getByRole('button', { name: 'Stay on this page' }).click();
  await expect(page).toHaveURL(/#\/organisation\/bids\/new$/);
  await expect(page.getByLabel('Bid title')).toHaveValue('Unsaved bid');
  await expect(page.locator('h1')).toHaveText('Organisation information');
  await page.getByRole('link', { name: 'YOR Plc organisation information' }).click();
  await page.getByRole('button', { name: 'Leave and discard' }).click();
  await expect(page).toHaveURL(/#\/organisation$/);
  await expect(bidRows(page)).toHaveCount(3);
  await page.goto('/#/organisation/bids/new');
  await expect(page.getByLabel('Bid title')).toHaveValue('');
  // a pristine form does not prompt
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tracking' }).click();
  await expect(page.locator('h1')).toHaveText('Tracking');
});

test('keyboard: dialog opens with focus on the safe choice, Escape closes it, focus returns to the trigger', async ({ page }) => {
  await openOrg(page, '#/organisation/documents');
  const del = docRows(page).first().getByRole('button', { name: /^Delete/ });
  await del.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(del).toBeFocused();
  await expect(docRows(page)).toHaveCount(4);
  // cancel button also returns focus
  await del.click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(del).toBeFocused();
});

test('forms: every field has a label and errors are linked with aria-describedby', async ({ page }) => {
  await openOrg(page, '#/organisation/bids/new');
  await page.getByRole('button', { name: 'Save past bid' }).click();
  for (const name of ['Bid title', 'Funder']) {
    const c = page.locator(name === 'Bid title' ? 'input[name="title"]' : 'input[name="funder"]');
    await expect(c).toHaveAttribute('aria-invalid', 'true');
    const ids = (await c.getAttribute('aria-describedby')).split(' ');
    const err = page.locator('#' + ids[ids.length - 1]);
    await expect(err).toBeVisible();
    await expect(err).toContainText(/Enter the/);
  }
  await expect(page.getByLabel('Bid title')).toBeFocused();
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('main input:not([type=file]), main select, main textarea')]
    .filter((el) => !el.labels || el.labels.length === 0 && !el.getAttribute('aria-label')).length);
  expect(unlabeled).toBe(0);
});

test('no horizontal overflow and controls are at least 44px on every organisation view', async ({ page }) => {
  const views = ['#/organisation', '#/organisation/documents', '#/organisation/bids/new'];
  for (const v of views) {
    await openOrg(page, v);
    await noOverflow(page);
    const small = await page.evaluate(() => [...document.querySelectorAll('main button, main a, main input:not([type=file]), main select, main textarea')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || el.id || el.tagName).trim().slice(0, 30), h: el.getBoundingClientRect().height }))
      .filter((x) => x.h < 43.5));
    expect(small, v).toEqual([]);
  }
  await openOrg(page, '#/organisation/bids');
  await bidRows(page).first().getByRole('link', { name: /View/ }).click();
  await expect(page.getByRole('button', { name: 'Delete bid' })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('link', { name: 'Edit bid' }).click();
  await noOverflow(page);
  await openOrg(page, '#/organisation/documents');
  await page.getByRole('button', { name: /Upload documents/ }).click();
  await page.getByTestId('doc-file-input').setInputFiles([txt('a-very-long-file-name-that-keeps-going-and-going-and-going-and-going-forever.txt'), { name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') }]);
  await noOverflow(page);
  await page.getByRole('button', { name: /Upload 1 document/ }).click();
  await expect(page.getByTestId('upload-results')).toContainText('bad.exe');
  await noOverflow(page);
});

test('Discovery, Planning and Tracking still work beside the organisation area', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('li.grant')).toHaveCount(6);
  await page.locator('li.grant[data-id="G-001"] button[data-action="pass"]').click();
  await openOrg(page);
  await page.goto('/#/discovery/passed');
  await expect(page.locator('li.grant[data-id="G-001"]')).toBeVisible();
  await expect(page.locator('#ai-panel')).toBeVisible();
  await page.goto('/#/organisation');
  await expect(page.locator('#ai-panel')).toBeHidden();
});
