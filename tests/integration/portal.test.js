// The test portal on its own, over plain HTTP: session, CSRF, its own validation and one receipt per attempt.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startDemoPortal, PORTAL_PAGES } from '../../server/demo-portal.js';

const HASH = 'a'.repeat(64);

async function session(opts = {}) {
  const attemptId = crypto.randomUUID();
  const portal = await startDemoPortal({ attemptId, payloadHash: HASH, ...opts });
  const start = await fetch(portal.startUrl);
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const csrf = portal.state.csrf;
  const base = portal.startUrl.replace(/\/start$/, '');
  const postForm = (page, data, withCsrf = true) => fetch(`${base}/${page}`, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...(withCsrf ? { _csrf: csrf } : {}), ...data }) });
  return { portal, attemptId, cookie, csrf, base, postForm };
}

const VALID = {
  organisation: { 'org.name': 'Your Place', 'org.type': 'synthetic-registered-charity', syntheticApplicant: 'on', 'org.address': 'Demo office, London', 'org.postcode': 'E16 1AA', 'contact.firstName': 'Alex', 'contact.lastName': 'Morgan', 'contact.role': 'Fundraising Manager', 'contact.employment': 'staff', 'contact.email': 'alex.morgan@example.org', 'contact.phone': '00000000000' },
  request: { 'request.type': 'core', 'request.title': 'Core', 'request.amountMode': 'specified', 'request.amountPence': '50000.00', 'request.start': '2027-06-01', 'request.end': '2028-05-31', 'org.geography': 'London', 'work.annualPeople': '250', 'request.people': '250', 'finance.historicalIncomePence': '7000000.00', 'finance.reportingEnd': '2026-03-31' },
  compliance: { 'eligibility.previousApplication': 'no', 'compliance.ukTaxResident': 'yes', 'compliance.safeguarding': 'yes', 'compliance.demographics': 'Not collected in example.' },
};

async function upload(s, files) {
  const fd = new FormData();
  fd.append('_csrf', s.csrf);
  for (const [role, bytes] of Object.entries(files)) fd.append(role, new Blob([bytes]), `${role}.pdf`);
  return fetch(`${s.base}/documents`, { method: 'POST', redirect: 'manual', headers: { Cookie: s.cookie }, body: fd });
}
const PDF = new TextEncoder().encode('%PDF-1.7\nsynthetic');

test('pages carry the DEMO identity, version and token; it says it is not a funder service', async () => {
  const s = await session();
  const html = await (await fetch(`${s.base}/organisation`, { headers: { Cookie: s.cookie } })).text();
  assert.match(html, /data-portal-version="gwf-demo-v1"/);
  assert.match(html, /DEMO test portal/);
  assert.match(html, /not a Garfield Weston Foundation or Blackbaud service/);
  for (const f of PORTAL_PAGES[0].fields) assert.match(html, new RegExp(`data-field="${f.key.replace('.', '\\.')}"`));
  await s.portal.close();
});

test('session and CSRF: no cookie or a wrong token is refused; the wrong path token is 404', async () => {
  const s = await session();
  assert.equal((await fetch(`${s.base}/organisation`)).status, 403);
  assert.equal((await s.postForm('organisation', VALID.organisation, false)).status, 403);
  assert.equal((await fetch(s.portal.startUrl.replace(/portal\/[0-9a-f]+/, `portal/${'0'.repeat(48)}`))).status, 404);
  assert.equal(s.portal.state.pages.organisation, undefined);
  await s.portal.close();
});

test('independent validation: the portal applies its own rules', async () => {
  const s = await session();
  const bad = [
    ['organisation', { ...VALID.organisation, 'contact.email': 'not-an-email' }, 'contact.email'],
    ['organisation', { ...VALID.organisation, 'org.type': 'registered-charity', syntheticApplicant: '' }, 'org.charityNumber'],
    ['organisation', { ...VALID.organisation, syntheticApplicant: '' }, 'syntheticApplicant'],
    ['request', { ...VALID.request, 'request.amountPence': '100000.00' }, 'request.amountPence'],
    ['request', { ...VALID.request, 'request.amountPence': '5000000' + '0' }, 'request.amountPence'],
    ['request', { ...VALID.request, 'request.end': '2027-05-01' }, 'request.end'],
    ['compliance', { ...VALID.compliance, 'compliance.safeguarding': 'no' }, 'compliance.safeguardingExplanation'],
    ['compliance', { ...VALID.compliance, 'compliance.ukTaxResident': 'unknown' }, 'compliance.ukTaxResident'],
  ];
  for (const [page, data, field] of bad) {
    const res = await s.postForm(page, data);
    assert.equal(res.status, 422, `${page} ${field}`);
    assert.match(await res.text(), new RegExp(`data-error-for="${field.replace('.', '\\.')}"`));
  }
  await s.portal.close();
});

test('uploads are hashed as received, a text file is refused, and the portal final submit still gives exactly one receipt per attempt', async () => {
  const s = await session();
  for (const p of ['organisation', 'request', 'compliance']) assert.equal((await s.postForm(p, VALID[p])).status, 303);
  assert.equal((await upload(s, { proposal: PDF, accounts: new TextEncoder().encode('plain text') })).status, 422);
  assert.equal((await upload(s, { proposal: PDF, accounts: PDF })).status, 303);
  assert.equal(s.portal.state.files.proposal.sha256, crypto.createHash('sha256').update(PDF).digest('hex'));
  assert.equal((await s.postForm('submit', { reviewedPayloadHash: 'b'.repeat(64), demoTransfer: 'on' })).status, 422, 'review hash mismatch');
  assert.equal((await s.postForm('submit', { reviewedPayloadHash: HASH })).status, 422, 'confirmation required');
  assert.equal(s.portal.state.receipt, null);
  const ok = await s.postForm('submit', { reviewedPayloadHash: HASH, demoTransfer: 'on' });
  assert.equal(ok.status, 303);
  const first = s.portal.state.receipt;
  assert.equal(first.reference, `DEMO-${s.attemptId}`);
  assert.equal((await s.postForm('submit', { reviewedPayloadHash: HASH, demoTransfer: 'on' })).status, 303);
  assert.equal(s.portal.state.receipt, first, 'a repeated submit returns the same receipt, not a second one');
  const receipt = await (await fetch(`${s.base}/receipt`, { headers: { Cookie: s.cookie } })).text();
  assert.match(receipt, new RegExp(`data-receipt="payload-hash">${HASH}`));
  assert.match(receipt, /Nothing was sent to Garfield Weston/);
  await s.portal.close();
});

test('save draft stores one draft, reads it back, never counts as a submission, and requires the right hash', async () => {
  const s = await session();
  for (const p of ['organisation', 'request', 'compliance']) assert.equal((await s.postForm(p, VALID[p])).status, 303);
  assert.equal((await s.postForm('draft', { draftPayloadHash: HASH })).status, 422, 'documents are required first');
  assert.equal((await upload(s, { proposal: PDF, accounts: PDF })).status, 303);
  assert.equal((await s.postForm('draft', { draftPayloadHash: 'b'.repeat(64) })).status, 422, 'hash mismatch');
  assert.equal((await fetch(`${s.base}/draft`, { headers: { Cookie: s.cookie } })).status, 404, 'no draft yet');
  assert.equal((await s.postForm('draft', { draftPayloadHash: HASH })).status, 303);
  const first = s.portal.state.draft;
  assert.equal(first.reference, `DEMO-${s.attemptId}`);
  assert.equal((await s.postForm('draft', { draftPayloadHash: HASH })).status, 303);
  assert.equal(s.portal.state.draft, first, 'a repeated save returns the same draft');
  assert.equal(s.portal.state.submits, 0);
  assert.equal(s.portal.state.receipt, null);
  const page = await (await fetch(`${s.base}/draft`, { headers: { Cookie: s.cookie } })).text();
  assert.match(page, new RegExp(`data-draft="payload-hash">${HASH}`));
  assert.match(page, /data-draft="state">draft-saved-demo/);
  assert.match(page, /has not been submitted, and nothing was sent to Garfield Weston/);
  const review = await (await fetch(`${s.base}/review`, { headers: { Cookie: s.cookie } })).text();
  assert.match(review, /data-action="save-draft"/);
  assert.match(review, /data-action="submit-demo"/, 'the final submit control stays present on the portal');
  await s.portal.close();
});

test('the listener is loopback only and closes', async () => {
  const s = await session();
  assert.match(s.portal.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  await s.portal.close();
  await assert.rejects(fetch(s.portal.startUrl));
});
