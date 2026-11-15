import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, MIB, validateProfile, validateBid, validateFile, validateDocumentMeta, defaultTitle, parseTags,
  sortBids, sortDocuments, matchesBid, matchesDocument, parseAmount, FILE_TYPES,
} from '../../public/js/org/validation.js';
import { parseOrgHash } from '../../public/js/org/routes.js';
import { materialiseSeed } from '../../public/js/org/repository.js';

const TODAY = '2026-11-15';

test('profile: overview required, length limits, website http(s) only, identifiers keep leading zeros', () => {
  assert.equal(validateProfile({ overview: '' }).ok, false);
  assert.equal(validateProfile({ overview: '   ' }).errors.overview.length > 0, true);
  assert.equal(validateProfile({ overview: 'x'.repeat(2000) }).ok, true);
  assert.ok(validateProfile({ overview: 'x'.repeat(2001) }).errors.overview);
  for (const k of ['beneficiaries', 'geography', 'activities']) {
    assert.equal(validateProfile({ overview: 'a', [k]: 'y'.repeat(1000) }).ok, true);
    assert.ok(validateProfile({ overview: 'a', [k]: 'y'.repeat(1001) }).errors[k]);
  }
  assert.equal(validateProfile({ overview: 'a', website: 'https://example.org/x' }).ok, true);
  assert.equal(validateProfile({ overview: 'a', website: 'http://example.org' }).ok, true);
  for (const bad of ['ftp://example.org', 'javascript:alert(1)', 'example.org', 'https://']) {
    assert.ok(validateProfile({ overview: 'a', website: bad }).errors.website, bad);
  }
  const r = validateProfile({ overview: 'a', charityNumber: '0012345', companyNumber: '00098765' });
  assert.equal(r.value.charityNumber, '0012345');
  assert.equal(r.value.companyNumber, '00098765');
  assert.equal(validateProfile({ overview: 'a' }).value.charityNumber, '');
});

test('amounts: non-negative, at most two decimals, empty means unknown', () => {
  assert.deepEqual(parseAmount(''), { ok: true, value: null });
  assert.deepEqual(parseAmount('0'), { ok: true, value: 0 });
  assert.deepEqual(parseAmount('£45,000.50'), { ok: true, value: 45000.5 });
  for (const bad of ['-1', '1.234', 'abc', '1e5', '1.']) assert.equal(parseAmount(bad).ok, false, bad);
});

test('bid: required fields, outcome enum with Unknown default', () => {
  assert.ok(validateBid({}, TODAY).errors.title);
  assert.ok(validateBid({}, TODAY).errors.funder);
  const ok = validateBid({ title: 'T', funder: 'F' }, TODAY);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.outcome, 'unknown');
  assert.equal(ok.value.requestedAmount, null);
  assert.ok(validateBid({ title: 'T', funder: 'F', outcome: 'maybe' }, TODAY).errors.outcome);
  for (const o of ['successful', 'unsuccessful', 'awaiting', 'withdrawn', 'unknown']) assert.equal(validateBid({ title: 'T', funder: 'F', outcome: o }, TODAY).ok, true);
  assert.ok(validateBid({ title: 'x'.repeat(201), funder: 'F' }, TODAY).errors.title);
  assert.ok(validateBid({ title: 'T', funder: 'F', summary: 'x'.repeat(5001) }, TODAY).errors.summary);
  assert.ok(validateBid({ title: 'T', funder: 'F', feedback: 'x'.repeat(10001) }, TODAY).errors.feedback);
});

test('bid: awarded amount only when Successful; amounts validated', () => {
  assert.ok(validateBid({ title: 'T', funder: 'F', outcome: 'unsuccessful', awardedAmount: '10' }, TODAY).errors.awardedAmount);
  const ok = validateBid({ title: 'T', funder: 'F', outcome: 'successful', requestedAmount: '100', awardedAmount: '50.25' }, TODAY);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.awardedAmount, 50.25);
  assert.ok(validateBid({ title: 'T', funder: 'F', requestedAmount: '-5' }, TODAY).errors.requestedAmount);
});

test('bid: dates are checked against the supplied London today', () => {
  const b = (o) => validateBid({ title: 'T', funder: 'F', ...o }, TODAY);
  assert.equal(b({ submissionDate: '2026-11-15' }).ok, true);
  assert.ok(b({ submissionDate: '2026-11-16' }).errors.submissionDate);
  assert.ok(b({ submissionDate: '2026-02-31' }).errors.submissionDate);
  assert.equal(b({ submissionDate: '2026-01-01', decisionDate: '2026-01-01' }).ok, true);
  assert.ok(b({ submissionDate: '2026-02-01', decisionDate: '2026-01-31' }).errors.decisionDate);
  assert.ok(b({ decisionDate: '2026-11-16' }).errors.decisionDate);
  assert.equal(b({ decisionDate: '2026-03-01' }).ok, true);
});

test('files: every allowed extension in mixed case; unsupported, zero bytes and size boundary', () => {
  for (const ext of Object.keys(FILE_TYPES)) {
    assert.equal(validateFile({ name: `a.${ext}`, size: 5, type: '' }).ok, true, ext);
    assert.equal(validateFile({ name: `A.${ext.toUpperCase()}`, size: 5, type: '' }).ok, true, ext);
  }
  assert.equal(validateFile({ name: 'a.exe', size: 5, type: '' }).code, 'extension');
  assert.equal(validateFile({ name: 'noext', size: 5, type: '' }).code, 'extension');
  assert.equal(validateFile({ name: 'a.pdf.exe', size: 5, type: '' }).code, 'extension');
  assert.equal(validateFile({ name: 'a.pdf', size: 0, type: 'application/pdf' }).code, 'empty');
  assert.equal(validateFile({ name: 'a.pdf', size: 10 * MIB, type: '' }).ok, true);
  assert.equal(validateFile({ name: 'a.pdf', size: 10 * MIB + 1, type: '' }).code, 'too-large');
  assert.equal(LIMITS.maxFileBytes, 10 * MIB);
  assert.equal(LIMITS.maxTotalBytes, 100 * MIB);
  assert.equal(validateFile({ name: 'a.pdf', size: 11, type: 'application/pdf' }, { ...LIMITS, maxFileBytes: 10 }).code, 'too-large');
});

test('files: contradictory MIME rejected; empty or generic MIME accepted', () => {
  assert.equal(validateFile({ name: 'a.pdf', size: 5, type: 'image/png' }).code, 'mime');
  assert.equal(validateFile({ name: 'a.png', size: 5, type: 'application/pdf' }).code, 'mime');
  assert.equal(validateFile({ name: 'a.pdf', size: 5, type: 'application/octet-stream' }).ok, true);
  assert.equal(validateFile({ name: 'a.pdf', size: 5, type: '' }).ok, true);
  assert.equal(validateFile({ name: 'a.csv', size: 5, type: 'application/vnd.ms-excel' }).ok, true);
  assert.equal(validateFile({ name: 'a.jpg', size: 5, type: 'image/jpeg' }).ok, true);
  assert.equal(validateFile({ name: 'a.pdf', size: 5, type: 'application/pdf; charset=x' }).ok, true);
});

test('document: title defaults from the filename and is shortened to 200; tags limited', () => {
  assert.equal(defaultTitle('accounts.pdf'), 'accounts.pdf');
  const long = 'a'.repeat(300) + '.pdf';
  assert.equal(defaultTitle(long).length, 200);
  assert.equal(validateDocumentMeta({ title: defaultTitle(long) }).ok, true);
  assert.ok(validateDocumentMeta({ title: 'x'.repeat(201) }).errors.title);
  assert.ok(validateDocumentMeta({ title: '' }).errors.title);
  assert.equal(validateDocumentMeta({ title: 'a', tags: Array.from({ length: 10 }, (_, i) => 't' + i).join(',') }).ok, true);
  assert.ok(validateDocumentMeta({ title: 'a', tags: Array.from({ length: 11 }, (_, i) => 't' + i).join(',') }).errors.tags);
  assert.equal(validateDocumentMeta({ title: 'a', tags: 'x'.repeat(50) }).ok, true);
  assert.ok(validateDocumentMeta({ title: 'a', tags: 'x'.repeat(51) }).errors.tags);
  assert.deepEqual(parseTags(' a, ,b ,'), ['a', 'b']);
  assert.ok(validateDocumentMeta({ title: 'a', description: 'x'.repeat(2001) }).errors.description);
  assert.ok(validateDocumentMeta({ title: 'a', period: 'x'.repeat(101) }).errors.period);
  assert.ok(validateDocumentMeta({ title: 'a', category: 'nope' }).errors.category);
  assert.equal(validateDocumentMeta({ title: 'a' }).value.category, 'general');
});

test('sorting: bids by submission date descending, undated last, stable ID tie-break; documents newest first', () => {
  const bids = [
    { id: 'b', submissionDate: '2026-01-01' }, { id: 'u2', submissionDate: null }, { id: 'a', submissionDate: '2026-01-01' },
    { id: 'c', submissionDate: '2026-05-01' }, { id: 'u1', submissionDate: '' },
  ];
  assert.deepEqual(sortBids(bids).map((x) => x.id), ['c', 'a', 'b', 'u1', 'u2']);
  assert.deepEqual(sortBids([...bids].reverse()).map((x) => x.id), ['c', 'a', 'b', 'u1', 'u2']);
  const docs = [{ id: 'b', uploadedAt: '2026-01-01T00:00:00Z' }, { id: 'a', uploadedAt: '2026-01-01T00:00:00Z' }, { id: 'z', uploadedAt: '2026-03-01T00:00:00Z' }];
  assert.deepEqual(sortDocuments(docs).map((x) => x.id), ['z', 'a', 'b']);
});

test('search matches title and funder; documents match title, filename, description and tags', () => {
  assert.equal(matchesBid({ title: 'Fresh Start', funder: 'Bridgeway' }, 'bridge'), true);
  assert.equal(matchesBid({ title: 'Fresh Start', funder: 'Bridgeway' }, 'zzz'), false);
  const d = { title: 'Annual accounts', filename: 'acc.txt', description: 'income', tags: ['finance'] };
  for (const q of ['annual', 'ACC.TXT', 'income', 'fin']) assert.equal(matchesDocument(d, q), true, q);
  assert.equal(matchesDocument(d, 'nope'), false);
});

test('routes parse and unknown organisation paths are rejected', () => {
  assert.deepEqual(parseOrgHash('#/organisation'), { page: 'bids' });
  assert.deepEqual(parseOrgHash('#/organisation/documents'), { page: 'documents' });
  assert.deepEqual(parseOrgHash('#/organisation/bids/new'), { page: 'bid-new' });
  assert.deepEqual(parseOrgHash('#/organisation/bids/abc'), { page: 'bid-detail', id: 'abc' });
  assert.deepEqual(parseOrgHash('#/organisation/bids/abc/edit'), { page: 'bid-edit', id: 'abc' });
  assert.equal(parseOrgHash('#/organisation/nope'), null);
});

test('seed content: three bids with the required outcomes, four documents, all marked synthetic', () => {
  let n = 0;
  const s = materialiseSeed(new Date('2026-11-15T10:00:00Z'), () => 'id' + ++n);
  assert.deepEqual(s.bids.map((b) => b.outcome).sort(), ['awaiting', 'successful', 'unsuccessful']);
  assert.equal(s.documents.filter((d) => d.ownerType === 'organisation').length, 4);
  assert.equal(s.documents.filter((d) => d.ownerType === 'bid').length, 4);
  assert.equal(s.documents.filter((d) => d.role === 'feedback').length, 1);
  assert.ok(s.bids.every((b) => b.synthetic) && s.documents.every((d) => d.synthetic));
  assert.equal(s.blobs.size, s.documents.length);
  assert.equal(s.profile.charityNumber, '');
});
