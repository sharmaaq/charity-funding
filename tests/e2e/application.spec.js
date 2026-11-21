import { test, expect } from './base.js';
import { readStore, orgApi } from './package-helpers.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'project', 'sprint-3', 'tickets', 'S3-001-automated-submission', 'evidence');
const APP = '#/planning/G-001/application';

const ctl = (page, id) => page.locator(`[data-field="${id}"]`).locator('input:not([type=hidden]), select, textarea').first();
const field = (page, id) => page.locator(`[data-field="${id}"]`).first();
const statusOf = (page, id) => field(page, id).locator('.field-status').first();

// Screenshots are only written when S3_EVIDENCE=1 (used once to produce the ticket's evidence files).
async function shot(page, name, opts = {}) {
  if (!process.env.S3_EVIDENCE) return;
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${test.info().project.name}.png`), ...opts });
}

async function planG001(page) {
  await page.goto('/');
  await page.locator('li.grant[data-id="G-001"] button[data-action="plan"]').click();
  await expect(page).toHaveURL(/#\/planning\/G-001\/application$/);
  await expect(page.getByRole('heading', { name: 'Prepare your Garfield Weston application' })).toBeVisible();
}

async function gotoSection(page, label) {
  await expect(page.getByTestId('section-title')).toBeVisible(); // the page has rendered, so the select-or-nav choice below is reliable
  const select = page.getByTestId('section-select');
  if (await select.isVisible()) await select.selectOption({ label });
  else await page.locator('.app-nav .nav-item', { hasText: label }).first().click();
  await expect(page.getByTestId('section-title')).toHaveText(label);
}

const readApps = (page) => readStore(page, 'applications');

const org = (page) => orgApi(page);

async function expectNoOverflow(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

async function loadExample(page) {
  await page.getByRole('button', { name: 'Load worked demo example' }).click();
  await expect(page.locator('#live')).toContainText('Worked demo example loaded');
}

test('Plan application on G-001 opens the workspace with six sections and the explanatory copy', async ({ page }) => {
  await planG001(page);
  await expect(page.locator('h1')).toHaveText('Planning & submission');
  await expect(page.locator('.app-workspace .demo-tag')).toHaveText('Demo');
  await expect(page.getByText('Answer once here. We will prepare the documents and demonstrate transferring them into an application portal. This demo does not send an application to the funder.')).toBeVisible();
  const options = await page.getByTestId('section-select').locator('option').allTextContents();
  expect(options).toEqual(['Organisation', 'Funding request', 'Work and evidence', 'Finances', 'Documents', 'Review and submit']);
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review application' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to planning' })).toBeVisible();
  await expect(page.getByTestId('status-strip')).toContainText('Missing');
  await expect(page.getByTestId('status-strip')).toContainText('Needs review');
  await expect(page.getByTestId('status-strip')).toContainText('Confirmed');
  await expect(page.getByText('Submit to Garfield Weston')).toHaveCount(0);
  await expectNoOverflow(page);
  // the grant moved to Planning; Tracking has no demo records yet (S3-001 Phase C replaced its placeholder)
  await page.goto('/#/tracking');
  await expect(page.getByTestId('tracking-empty')).toContainText('No demo drafts yet');
  await expect(page.locator('main button')).toHaveCount(0);
});

test('one draft per grant: edits autosave, survive reload, and the planning card resumes it', async ({ page }) => {
  await planG001(page);
  await ctl(page, 'org.postcode').fill('E16 1AA');
  await expect(statusOf(page, 'org.postcode')).toContainText('Confirmed');
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  await expect.poll(async () => (await readApps(page))[0].answers['org.postcode'] && (await readApps(page))[0].answers['org.postcode'].value).toBe('E16 1AA');
  await page.reload();
  await expect(ctl(page, 'org.postcode')).toHaveValue('E16 1AA');
  await page.getByRole('link', { name: 'Back to planning' }).click();
  const card = page.locator('li.grant[data-id="G-001"]');
  await expect(card.getByTestId('card-stage')).toContainText('Stage: Incomplete');
  await expect(card.getByTestId('card-saved')).toContainText('Last saved');
  await expect(card.getByTestId('card-missing')).toContainText('missing');
  await expect(card.locator('button[data-action="abandon"]')).toBeVisible();
  await card.getByTestId('open-application').click();
  await expect(ctl(page, 'org.postcode')).toHaveValue('E16 1AA');
  const apps = await readApps(page);
  expect(apps).toHaveLength(1);
  expect(apps[0].grantId).toBe('G-001');
  expect(apps[0].draftRevision).toBeGreaterThan(1);
  // Abandon keeps the draft; planning again resumes it
  await page.getByRole('link', { name: 'Back to planning' }).click();
  await card.locator('button[data-action="abandon"]').click();
  await page.goto('/#/discovery/passed');
  await page.locator('li.grant[data-id="G-001"] button[data-action="restore"]').click();
  await page.goto('/#/discovery/new');
  await page.locator('li.grant[data-id="G-001"] button[data-action="plan"]').click();
  await expect(ctl(page, 'org.postcode')).toHaveValue('E16 1AA');
  expect(await readApps(page)).toHaveLength(1);
});

test('other planned grants keep their card, Abandon and an honest unavailable message', async ({ page }) => {
  await page.goto('/');
  await page.locator('li.grant[data-id="G-002"] button[data-action="plan"]').click();
  await expect(page).toHaveURL(/#\/planning$/);
  const card = page.locator('li.grant[data-id="G-002"]');
  await expect(card.getByTestId('app-unavailable')).toHaveText('Application preparation not yet available for this funder');
  await expect(card.locator('button[data-action="abandon"]')).toBeVisible();
  await expect(card.getByTestId('open-application')).toHaveCount(0);
  await page.goto('/#/planning/G-002/application');
  await expect(page.getByTestId('not-available')).toHaveText('Application preparation not yet available for this funder');
});

test('a deep link for G-001 outside Planning points to where it is and changes nothing', async ({ page }) => {
  await page.goto('/');
  await page.goto('/#/planning/G-001/application');
  await expect(page.getByTestId('not-in-planning')).toContainText('currently in New');
  await page.getByRole('link', { name: 'Go to New' }).click();
  await expect(page).toHaveURL(/#\/discovery\/new$/);
  await expect(page.locator('li.grant')).toHaveCount(6);
  await expect(page.locator('li.grant[data-id="G-001"] button[data-action="plan"]')).toBeVisible();
});

test('prefill shows source chips, and the drawer shows origin, keeps focus and closes with Escape', async ({ page }) => {
  await planG001(page);
  const chip = field(page, 'org.overview').locator('.source-chip');
  await expect(chip).toHaveText('Source: organisation profile');
  await expect(statusOf(page, 'org.overview')).toContainText('Needs review');
  await expect(ctl(page, 'org.overview')).toHaveValue(/Your Place is a demo charity/);
  await chip.click();
  const drawer = page.getByTestId('source-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAccessibleName('Source for: What does the organisation do?');
  await expect(drawer).toContainText('Organisation profile');
  await expect(drawer).toContainText('has not been checked');
  await shot(page, 'S3-001-A-source-drawer');
  await expectNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(chip).toBeFocused();
  // suggested paragraphs carry origin suggested-draft and stay flagged
  await gotoSection(page, 'Funding request');
  await expect(field(page, 'request.reason').locator('.source-chip')).toHaveText('Source: suggested draft');
  await expect(statusOf(page, 'request.reason')).toContainText('Needs review');
  await expect(ctl(page, 'request.reason')).toHaveValue(/We propose requesting a contribution/);
  await field(page, 'request.reason').getByRole('button', { name: /Confirm answer/ }).click();
  await expect(statusOf(page, 'request.reason')).toContainText('Confirmed');
  await expect(field(page, 'request.reason').locator('.source-chip')).toHaveText('Source: suggested draft');
  // nothing was invented for facts the app does not know
  await expect(ctl(page, 'eligibility.previousApplication')).toHaveValue('');
  await expect(statusOf(page, 'eligibility.previousApplication')).toContainText('Missing');
  await expect(ctl(page, 'request.people')).toHaveValue('');
  await gotoSection(page, 'Organisation');
  await expect(ctl(page, 'compliance.safeguarding')).toHaveValue('');
  await expect(ctl(page, 'org.type')).toHaveValue('');
});

test('manager edits win over suggestions; profile changes flag stale sources and Refresh asks per change', async ({ page }) => {
  await planG001(page);
  await ctl(page, 'org.overview').fill('Our own wording about the work. '.repeat(5));
  await expect(statusOf(page, 'org.overview')).toContainText('Confirmed');
  await expect(field(page, 'org.overview').locator('.source-chip')).toHaveText('Entered by you');
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  await expect.poll(async () => (await readApps(page))[0].answers['org.overview'].origin).toBe('manager');
  // change the organisation profile elsewhere
  const p = await org(page).getProfile();
  await org(page).updateProfile({ ...p, overview: 'A completely new profile overview that is long enough to be useful here. '.repeat(2), geography: 'East London' });
  await page.reload();
  // the edited answer is untouched on render
  await expect(ctl(page, 'org.overview')).toHaveValue(/Our own wording/);
  // the unedited profile answer is flagged, its text is retained
  await expect(ctl(page, 'org.geography')).toHaveValue('London');
  await expect(field(page, 'org.geography').locator('.source-chip')).toHaveClass(/stale/);
  await expect(field(page, 'org.geography')).toContainText('The source for this answer changed');
  await expect(statusOf(page, 'org.geography')).toContainText('Needs review');
  await page.getByRole('button', { name: 'Refresh suggestions' }).click();
  const dlg = page.getByRole('dialog', { name: 'Refresh suggestions' });
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('[data-change="org.overview"]')).toContainText('You edited this answer');
  await expect(dlg.locator('[data-change="org.geography"]')).toContainText('East London');
  for (const box of await dlg.locator('input[type=checkbox]').all()) await expect(box).not.toBeChecked();
  await dlg.getByLabel('Use the suggestion for: Where do you work?').check();
  await dlg.getByRole('button', { name: 'Apply selected changes' }).click();
  await expect(ctl(page, 'org.geography')).toHaveValue('East London');
  await expect(ctl(page, 'org.overview')).toHaveValue(/Our own wording/);
  await expect(field(page, 'org.geography').locator('.source-chip')).not.toHaveClass(/stale/);
  // closing the dialog without ticking anything changes nothing
  await page.getByRole('button', { name: 'Refresh suggestions' }).click();
  await page.getByRole('dialog', { name: 'Refresh suggestions' }).getByRole('button', { name: /Close/ }).click();
  await expect(ctl(page, 'org.overview')).toHaveValue(/Our own wording/);
});

test('worked demo example: synthetic values, finance totals, confirm before overwriting edits', async ({ page }) => {
  await planG001(page);
  await ctl(page, 'org.address').fill('My own address');
  await page.getByRole('button', { name: 'Load worked demo example' }).click(); // address was edited, so a confirmation is required first
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my answers' }).click();
  await expect(ctl(page, 'org.address')).toHaveValue('My own address');
  await page.getByRole('button', { name: 'Load worked demo example' }).click();
  await page.getByRole('button', { name: 'Replace my answers' }).click();
  await expect(page.locator('#live')).toContainText('Worked demo example loaded');
  await expect(ctl(page, 'org.address')).toHaveValue('Demo office, London');
  await expect(ctl(page, 'org.postcode')).toHaveValue('E16 1AA');
  await expect(ctl(page, 'contact.email')).toHaveValue('alex.morgan@example.org');
  await expect(field(page, 'org.postcode').locator('.source-chip')).toHaveText('Source: synthetic demo example');
  await expect(field(page, 'org.charityNumber')).toHaveCount(0);
  await gotoSection(page, 'Funding request');
  await expect(ctl(page, 'request.amountPence')).toHaveValue('50,000');
  await expect(ctl(page, 'request.start')).toHaveValue('2027-06-01');
  await gotoSection(page, 'Finances');
  await expect(page.getByTestId('finance-summary')).toContainText('£6,900,000');
  await expect(page.getByTestId('finance-summary').locator('[data-fin="gap"]')).toHaveText('£400,000');
  await expect(page.getByTestId('finance-summary').locator('[data-fin="surplus"]')).toHaveText('£100,000 surplus');
  await expect(page.getByTestId('finance-summary').locator('[data-fin="within"]')).toHaveText('Yes');
  await expect(page.getByTestId('finance.incomeRows-total')).toContainText('Total target £7,000,000 · Total secured £6,500,000');
  await page.getByTestId('finance-summary').scrollIntoViewIfNeeded();
  await shot(page, 'S3-001-A-finance');
  await expectNoOverflow(page);
  // data is saved as origin synthetic-demo, in pence
  await expect.poll(async () => (await readApps(page))[0].answers['finance.expenseRows'] && (await readApps(page))[0].answers['finance.expenseRows'].origin).toBe('synthetic-demo');
  const apps = await readApps(page);
  expect(apps[0].answers['request.amountPence'].value).toBe(5000000);
  expect(apps[0].answers['finance.incomeRows'].value[0].targetPence).toBe(580000000);
  // organisation profile untouched
  await page.goto('/#/organisation');
  await expect(page.locator('main')).not.toContainText('Demo office, London');
  // review: the worked example now selects the synthetic accounts PDF, so nothing is missing; the four demo-review answers wait for the manager
  await page.goto('/' + APP);
  await page.getByRole('button', { name: 'Review application' }).click();
  await expect(page).toHaveURL(/application\/review$/);
  await expect(page.getByTestId('missing-info')).toContainText('Missing information (0)');
  await expect(page.getByTestId('missing-info')).not.toContainText('Accounts document');
  await expect(page.getByTestId('needs-review')).toContainText('Other answers that need review (4)');
});

test('incomplete draft: saved, review lists missing items as links back to the fields, and nothing runs', async ({ page }) => {
  await planG001(page);
  await page.getByRole('button', { name: 'Review application' }).click();
  await expect(page).toHaveURL(/application\/review$/);
  await expect(page.getByRole('heading', { name: 'Review your application' })).toBeFocused();
  await expect(page.getByTestId('review-ready')).toHaveAttribute('data-ready', 'false');
  const missing = page.getByTestId('missing-info');
  await expect(missing).toContainText('Legal status: needs an answer.');
  await expect(page.getByTestId('suggested-drafts')).toContainText('Why are you asking');
  await expect(page.getByTestId('policy-answers')).toContainText('Policy and declaration answers');
  await expect(page.getByTestId('review-finance')).toContainText('No rows yet');
  // Phase B replaced the placeholder: no package is prepared for an incomplete draft, both boxes are disabled and the run control is disabled
  await expect(page.getByTestId('package-blocked')).toContainText('present and confirmed');
  await expect(page.getByTestId('check-reviewed')).toBeDisabled();
  await expect(page.getByTestId('check-transfer')).toBeDisabled();
  await expect(page.getByTestId('run-demo')).toBeDisabled();
  await expect(page.getByTestId('download-proposal')).toHaveCount(0);
  await expect(page.getByText('Submit to Garfield Weston')).toHaveCount(0);
  await shot(page, 'S3-001-A-review-missing');
  await expectNoOverflow(page);
  await missing.getByRole('link', { name: /Legal status/ }).click();
  await expect(page.getByTestId('section-title')).toHaveText('Organisation');
  await expect(ctl(page, 'org.type')).toBeFocused();
  // a field in another section
  await page.getByRole('button', { name: 'Review application' }).click();
  await page.getByTestId('missing-info').getByRole('link', { name: /Period the accounts cover/ }).click();
  await expect(page.getByTestId('section-title')).toHaveText('Documents');
  await expect(ctl(page, 'evidence.accountsPeriod')).toBeFocused();
});

test('validation: strict money, limits, conditional fields and counts of visible fields only', async ({ page }) => {
  await planG001(page);
  const before = await page.getByTestId('status-strip').locator('[data-status="missing"]').getAttribute('data-count');
  await gotoSection(page, 'Funding request');
  await ctl(page, 'request.amountPence').fill('1e5');
  await expect(field(page, 'request.amountPence').locator('.field-error')).toContainText('Enter an amount in pounds');
  await ctl(page, 'request.amountPence').fill('100,000');
  await expect(field(page, 'request.amountPence').locator('.field-error')).toContainText('Major Grants');
  await ctl(page, 'request.amountPence').fill('99,999.99');
  await expect(field(page, 'request.amountPence').locator('.field-error')).toBeHidden();
  await ctl(page, 'request.amountMode').selectOption('discretion');
  await expect(field(page, 'request.amountPence')).toHaveCount(0);
  // a hidden conditional field is not counted as missing
  await ctl(page, 'eligibility.previousApplication').selectOption('yes');
  await expect(field(page, 'eligibility.previousOutcome')).toHaveCount(1);
  await expect(field(page, 'eligibility.previousOutcomeDate')).toHaveCount(0);
  await ctl(page, 'eligibility.previousOutcome').selectOption('decided');
  await expect(field(page, 'eligibility.previousOutcomeDate')).toHaveCount(1);
  await ctl(page, 'eligibility.previousApplication').selectOption('no');
  await expect(field(page, 'eligibility.previousOutcome')).toHaveCount(0);
  const after = await page.getByTestId('status-strip').locator('[data-status="missing"]').getAttribute('data-count');
  expect(Number(after)).toBe(Number(before) - 1);
  await gotoSection(page, 'Work and evidence');
  await ctl(page, 'work.annualPeople').fill('2.5');
  await expect(field(page, 'work.annualPeople').locator('.field-error')).toContainText('whole number');
  await ctl(page, 'work.annualPeople').fill('250');
  await expect(field(page, 'work.annualPeople').locator('.field-error')).toBeHidden();
  await ctl(page, 'work.partnerships').fill('word '.repeat(301));
  await expect(field(page, 'work.partnerships').locator('.field-error')).toContainText('no more than 300 words');
  await field(page, 'work.partnerships').getByRole('button', { name: 'None recorded' }).click();
  await expect(ctl(page, 'work.partnerships')).toHaveValue('None recorded.');
  await expect(statusOf(page, 'work.partnerships')).toContainText('Confirmed');
  // user text is rendered as text, with line breaks
  await ctl(page, 'work.caseStudy').fill('<img src=x onerror=window.__pwn=1>\nsecond line');
  await page.getByRole('button', { name: 'Review application' }).click();
  await expect(page.getByTestId('application-review').locator('img')).toHaveCount(0);
  await expect(page.getByTestId('application-review')).toContainText('<img src=x onerror=window.__pwn=1>');
  expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
});

test('finance rows: strict amounts, secured over target, request over the gap', async ({ page }) => {
  await planG001(page);
  await gotoSection(page, 'Finances');
  await page.getByRole('button', { name: 'Add income row' }).click();
  await page.getByLabel('Income source 1').fill('Trusts');
  await page.getByLabel('Target for row 1 (GBP)').fill('1,000');
  await page.getByLabel('Secured for row 1 (GBP)').fill('1,500');
  await page.getByLabel('Note for row 1').click();
  await expect(field(page, 'finance.incomeRows').locator('.row-error')).toContainText('cannot be more than the target');
  await page.getByLabel('Secured for row 1 (GBP)').fill('1e3');
  await page.getByLabel('Note for row 1').click();
  await expect(field(page, 'finance.incomeRows').locator('.row-error')).toContainText('not a valid amount');
  await page.getByLabel('Secured for row 1 (GBP)').fill('400.50');
  await page.getByRole('button', { name: 'Add expenditure row' }).click();
  await page.getByLabel('Expenditure 1').fill('Staff');
  await page.getByLabel('Amount for row 1 (GBP)').fill('1,200');
  await expect(page.getByTestId('finance-summary').locator('[data-fin="gap"]')).toHaveText('£799.50');
  await expect(page.getByTestId('finance-summary').locator('[data-fin="surplus"]')).toHaveText('£200 shortfall');
  await gotoSection(page, 'Funding request');
  await ctl(page, 'request.amountMode').selectOption('specified');
  await ctl(page, 'request.amountPence').fill('5,000');
  await expect(field(page, 'request.amountPence').locator('.field-error')).toContainText('more than the current unsecured gap of £799.50');
  await gotoSection(page, 'Finances');
  await page.getByRole('button', { name: 'Remove income row 1' }).click();
  await expect(page.getByLabel('Income source 1')).toHaveCount(0);
});

test('stored documents: only PDF or DOCX can be chosen as accounts, nothing is chosen for you, excerpts are attributed', async ({ page }) => {
  await planG001(page);
  await gotoSection(page, 'Documents');
  await expect(ctl(page, 'evidence.accountsId')).toHaveValue('');
  await expect(ctl(page, 'evidence.accountsId').locator('option:disabled').first()).toContainText('not a PDF or DOCX');
  await expect(field(page, 'evidence.accountsId')).toContainText('No PDF or DOCX document is stored yet');
  await org(page).uploadDocument('accounts-test.pdf', 'application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 10, 1, 2, 3, 4, 5, 6, 7]), { category: 'financial', title: 'Test accounts', period: 'Year ended 31 March 2026' });
  await page.reload();
  await gotoSection(page, 'Documents');
  await expect(ctl(page, 'evidence.accountsId')).toHaveValue(''); // suggested, never silently selected
  await expect(field(page, 'evidence.accountsId')).toContainText('Suggested: Test accounts');
  await ctl(page, 'evidence.accountsId').selectOption({ label: 'Test accounts (accounts-test.pdf)' });
  await expect(statusOf(page, 'evidence.accountsId')).toContainText('Confirmed');
  await expect(page.getByTestId('save-state')).toHaveText(/Saved at/);
  await field(page, 'evidence.accountsId').locator('.source-chip').click();
  await expect(page.getByTestId('source-drawer')).toContainText('Stored document: Test accounts');
  await expect(page.getByTestId('source-drawer')).toContainText('Period: Year ended 31 March 2026');
  // delete the document: the answer is kept, flagged as source removed
  { const [d] = (await org(page).listDocuments()).filter((x) => x.filename === 'accounts-test.pdf'); await org(page).deleteDocument(d.id); }
  await page.reload();
  await gotoSection(page, 'Documents');
  await expect(field(page, 'evidence.accountsId').locator('.source-chip')).toHaveClass(/stale/);
  await expect(field(page, 'evidence.accountsId')).toContainText('source for this answer was removed');
  await expect(statusOf(page, 'evidence.accountsId')).toContainText('Needs review');
  // use information from a document: manager supplied excerpt with locator
  await page.getByRole('button', { name: 'Use information from a document' }).click();
  const dlg = page.getByRole('dialog', { name: 'Use information from a document' });
  await dlg.getByLabel('Source document').selectOption({ index: 1 });
  await dlg.getByLabel('Use it for this answer').selectOption('work.need');
  await dlg.getByLabel('Excerpt from the document').fill('Line one from the page.\nLine two of the need.');
  await dlg.getByRole('button', { name: 'Use this text' }).click();
  await expect(dlg.getByRole('alert')).toContainText('where in the document');
  await dlg.getByLabel('Page or section').fill('page 2');
  await dlg.getByRole('button', { name: 'Use this text' }).click();
  await expect(page.getByTestId('section-title')).toHaveText('Work and evidence');
  await expect(ctl(page, 'work.need')).toHaveValue('Line one from the page.\nLine two of the need.');
  await expect(field(page, 'work.need').locator('.source-chip')).toHaveText('Source: your excerpt from a document');
  await field(page, 'work.need').locator('.source-chip').click();
  await expect(page.getByTestId('source-drawer')).toContainText('Page or section: page 2');
  await expect(page.getByTestId('source-drawer')).toContainText('Manager supplied from a document');
  await expect(page.getByTestId('source-drawer')).toContainText('Line two of the need.');
});

test('keyboard flow, targets of at least 44px and no horizontal overflow on every section and the review', async ({ page }) => {
  await planG001(page);
  await loadExample(page);
  await expect(page.getByRole('heading', { name: 'Prepare your Garfield Weston application' })).toBeVisible();
  for (const s of ['Organisation', 'Funding request', 'Work and evidence', 'Finances', 'Documents']) {
    await gotoSection(page, s);
    await expectNoOverflow(page);
    const small = await page.locator('.app-workspace button, .app-workspace select, .app-workspace input:not([type=hidden]), .app-workspace a.btn').evaluateAll((els) =>
      els.filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5 && !e.readOnly)
        .map((e) => `${e.tagName} ${(e.textContent || e.name || e.id).trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().height)}`));
    expect(small).toEqual([]);
  }
  await gotoSection(page, 'Organisation');
  await shot(page, 'S3-001-A-prefilled-form', { fullPage: false });
  // keyboard: Tab reaches a source chip, Enter opens the drawer, Escape returns focus
  const chip = field(page, 'org.name').locator('.source-chip');
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('source-drawer')).toBeVisible();
  await expectNoOverflow(page);
  await shot(page, 'S3-001-A-drawer-open');
  await page.keyboard.press('Escape');
  await expect(chip).toBeFocused();
  await page.getByRole('button', { name: 'Review application' }).click();
  await expectNoOverflow(page);
  await shot(page, 'S3-001-A-review-example', { fullPage: true });
  const smallReview = await page.locator('.app-review a.btn, .app-review button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 43.5).length);
  expect(smallReview).toBe(0);
  await expect(page.getByTestId('review-finance')).toContainText('£400,000');
  await expect(page.getByTestId('review-documents')).toContainText('Synthetic accounts example');
});

test('leaving mid-edit saves first and the draft is there on return', async ({ page }) => {
  await planG001(page);
  await ctl(page, 'org.postcode').fill('E1 6AN');
  await page.goto('/#/discovery/new');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/' + APP);
  await expect(ctl(page, 'org.postcode')).toHaveValue('E1 6AN');
});
