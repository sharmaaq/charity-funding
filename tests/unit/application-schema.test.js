import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIELDS, LIMITS, parseMoney, parseWholeNumber, countWords, codePoints, validateValue, evaluate, financeTotals, fieldById,
  isApplicable, outgoingValues, parseInput, formatPence, isRealDate, SECTIONS,
} from '../../public/js/application/schema.js';
import { setManagerAnswer, confirmAnswer, editedAnswersThatWouldChange } from '../../public/js/application/answers.js';
import { buildSuggestions, initialAnswers, staleMap, diffSuggestions, GENERIC_DEFAULTS } from '../../public/js/application/prefill.js';
import { buildExampleAnswers, EXAMPLE_FIELD_IDS } from '../../public/js/application/example.js';
import { parseApplicationHash, appHash } from '../../public/js/application/routes.js';

const NOW = '2026-11-15T10:00:00.000Z';
const profile = { name: 'Your Place', overview: 'A demo charity that houses people. '.repeat(6), beneficiaries: 'People at risk', geography: 'London', activities: 'Housing and advice', charityNumber: '', companyNumber: '', website: '', updatedAt: '2026-11-01T00:00:00.000Z', synthetic: true };

test('schema.js is pure: no imports and no browser globals', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'js', 'application', 'schema.js'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(src));
  for (const g of ["document.get", "document.create", "window.", "localStorage", "indexedDB", "Date.now", "new Date("]) assert.ok(!src.includes(g), g);
});

test('money parses strictly to integer pence', () => {
  assert.deepEqual(parseMoney('50,000'), { ok: true, value: 5000000 });
  assert.deepEqual(parseMoney('£1,250.50'), { ok: true, value: 125050 });
  assert.deepEqual(parseMoney('99999.99'), { ok: true, value: 9999999 });
  assert.deepEqual(parseMoney('0.1'), { ok: true, value: 10 });
  assert.deepEqual(parseMoney('  '), { ok: true, value: null });
  for (const bad of ['1e5', '1.234', '-5', '£-5', '1,2,3', '12,34', '0x10', '1 000', 'abc', '5.', '.5', '1000000000000']) assert.equal(parseMoney(bad).ok, false, bad);
  assert.equal(parseMoney('999,999,999.99').value, LIMITS.maxPence);
  assert.equal(parseMoney('1,000,000,000').ok, false);
  assert.deepEqual(parseWholeNumber('250'), { ok: true, value: 250 });
  assert.equal(parseWholeNumber('2.5').ok, false);
  assert.equal(parseWholeNumber('').value, null);
});

test('unknown is null: empty input never becomes 0, No or an empty string', () => {
  assert.equal(parseInput(fieldById('request.amountPence'), '').value, null);
  assert.equal(parseInput(fieldById('work.annualPeople'), '   ').value, null);
  assert.equal(parseInput(fieldById('org.address'), '  \n ').value, null);
  const a = setManagerAnswer({}, 'request.amountPence', parseInput(fieldById('request.amountPence'), ''), NOW);
  assert.equal(a['request.amountPence'].value, null);
  assert.equal(a['request.amountPence'].confirmedAt, null);
  const bad = parseInput(fieldById('request.amountPence'), '1e5');
  assert.equal(bad.value, null);
  assert.equal(bad.raw, '1e5');
  const ev = evaluate({ 'request.amountMode': { value: 'specified', origin: 'manager', confirmedAt: NOW }, 'request.amountPence': { value: null, raw: '1e5', origin: 'manager', confirmedAt: NOW } });
  assert.equal(ev.fields['request.amountPence'].status, 'review');
  assert.ok(ev.fields['request.amountPence'].errors.length);
});

test('words and code points', () => {
  assert.equal(countWords('  one two\nthree  '), 3);
  assert.equal(countWords(''), 0);
  assert.equal(codePoints('a😀b'), 3);
  const f = fieldById('org.name');
  assert.ok(validateValue(f, 'x'.repeat(201), null).errors.length);
  assert.equal(validateValue(f, '😀'.repeat(200), null).errors.length, 0);
  assert.ok(validateValue(fieldById('org.address'), 'x '.repeat(251), null).errors.length);
  const reason = fieldById('request.reason');
  assert.match(validateValue(reason, 'too short', null).errors[0], /at least 50 words/);
  assert.match(validateValue(reason, 'w '.repeat(351), null).errors[0], /no more than 350 words/);
  assert.equal(validateValue(reason, 'w '.repeat(50), null).errors.length, 0);
});

test('amount modes: zero, negative and 100000 rejected; 99999.99 accepted; discretion is not zero', () => {
  const f = fieldById('request.amountPence');
  assert.ok(validateValue(f, 0, null).errors.length);
  assert.ok(validateValue(f, -1, null).errors.length);
  assert.ok(validateValue(f, 10000000, null).errors[0].includes('Major Grants'));
  assert.equal(validateValue(f, 9999999, null).errors.length, 0);
  const ans = { 'request.amountMode': { value: 'discretion' }, 'request.amountPence': { value: 5000000 } };
  assert.equal(isApplicable(f, { 'request.amountMode': 'discretion' }), false);
  assert.equal(outgoingValues(ans)['request.amountPence'], null);
  const ev = evaluate(ans);
  assert.equal(ev.fields['request.amountPence'].applicable, false);
  assert.ok(ev.warnings.some((w) => w.id === 'discretion'));
});

test('finance arithmetic in integer pence', () => {
  const t = financeTotals(
    [{ targetPence: 700, securedPence: 650 }, { targetPence: 300, securedPence: 100 }],
    [{ amountPence: 900 }, { amountPence: 50 }]);
  assert.equal(t.targetPence, 1000);
  assert.equal(t.securedPence, 750);
  assert.equal(t.expensePence, 950);
  assert.equal(t.gapPence, 200);
  assert.equal(t.targetSurplusPence, 50);
  assert.equal(financeTotals([{ targetPence: 1, securedPence: 1 }], [{ amountPence: 1 }]).gapPence, 0);
  assert.equal(financeTotals([{ targetPence: 1, securedPence: 1 }], [{ amountPence: 1 }]).complete, true);
  assert.equal(financeTotals([{ targetPence: null, securedPence: 1 }], [{ amountPence: 1 }]).complete, false);
});

test('finance rules: secured cannot exceed target; request cannot exceed gap; no negative expenditure; period mismatch warns', () => {
  const inc = fieldById('finance.incomeRows');
  const r = validateValue(inc, [{ label: 'A', targetPence: 100, securedPence: 200 }], null);
  assert.match(r.errors[0], /cannot be more than the target/);
  assert.ok(validateValue(fieldById('finance.expenseRows'), [{ label: 'B', amountPence: -5 }], null).errors.length);
  assert.ok(validateValue(inc, [{ label: '', targetPence: 1, securedPence: 1 }], null).errors.length);
  const ex = buildExampleAnswers(NOW);
  const base = { ...ex };
  assert.equal(evaluate(base).fields['request.amountPence'].errors.length, 0);
  const tooBig = { ...base, 'request.amountPence': { ...base['request.amountPence'], value: 40000100 } };
  assert.ok(evaluate(tooBig).fields['request.amountPence'].errors.some((e) => /Major Grants|gap/.test(e)));
  const lowGap = { ...base, 'request.amountPence': { ...base['request.amountPence'], value: 1000000 }, 'finance.expenseRows': { ...base['finance.expenseRows'], value: [{ label: 'x', amountPence: 6500000 * 100 + 1000000 }] } };
  const e2 = evaluate(lowGap);
  assert.equal(e2.finance.gapPence, 1000000);
  assert.equal(e2.finance.requestWithinGap, true);
  const mism = { ...base, 'finance.forecastEnd': { ...base['finance.forecastEnd'], value: '2028-04-30' } };
  assert.ok(evaluate(mism).warnings.some((w) => w.id === 'period-mismatch'));
  const longer = { ...base, 'request.end': { ...base['request.end'], value: '2028-06-02' } };
  assert.ok(evaluate(longer).fields['request.end'].errors.length);
});

test('worked example: exact spec values, totals, and only the accounts selection is missing', () => {
  const ex = buildExampleAnswers(NOW);
  assert.ok(EXAMPLE_FIELD_IDS.every((id) => fieldById(id)));
  assert.ok(Object.values(ex).every((a) => a.origin === 'synthetic-demo' && a.sourceRefs[0].synthetic === true));
  const ev = evaluate(ex);
  assert.deepEqual(ev.finance.expensePence, 690000000);
  assert.equal(ev.finance.targetPence, 700000000);
  assert.equal(ev.finance.securedPence, 650000000);
  assert.equal(ev.finance.gapPence, 40000000);
  assert.equal(ev.finance.targetSurplusPence, 10000000);
  assert.equal(ev.finance.requestWithinGap, true);
  assert.equal(formatPence(ev.finance.gapPence), '£400,000');
  assert.deepEqual(ev.issues.filter((i) => i.kind === 'missing').map((i) => i.fieldId), ['evidence.accountsId']);
  const review = ev.issues.filter((i) => i.kind === 'review').map((i) => i.fieldId).sort();
  assert.deepEqual(review, ['compliance.demographics', 'compliance.safeguarding', 'compliance.ukTaxResident', 'eligibility.previousApplication']);
  assert.equal(ex['contact.email'].value, 'alex.morgan@example.org');
  assert.equal(ex['org.postcode'].value, 'E16 1AA');
  assert.equal(ex['request.amountPence'].value, 5000000);
  assert.equal(ex['org.charityNumber'], undefined);
  assert.equal(ex['org.website'], undefined);
  assert.equal(ex['work.caseStudy'], undefined);
});

test('example text carries no real identifiers', () => {
  const ex = buildExampleAnswers(NOW);
  const strings = [];
  const walk = (v) => { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  Object.values(ex).forEach((a) => walk(a.value));
  for (const t of strings) {
    if (t === '00000000000') continue;
    assert.ok(!/[0-9]{6,}/.test(t), t);
    assert.ok(!/Submit to Garfield Weston/i.test(t));
  }
});

test('suggested defaults: profile first, then paragraph defaults; every paragraph fits its limits', () => {
  const s = buildSuggestions(profile);
  assert.equal(s['org.overview'].origin, 'profile');
  assert.equal(buildSuggestions({ ...profile, overview: '' })['org.overview'].value, GENERIC_DEFAULTS.overview.replace('{name}', profile.name));
  assert.equal(buildSuggestions({ ...profile, overview: '' })['org.overview'].origin, 'suggested-draft');
  for (const id of ['request.reason', 'work.need', 'work.activities', 'work.beneficiaries', 'work.outcomes', 'finance.fundraising', 'finance.fallback']) {
    assert.equal(s[id].origin, 'suggested-draft', id);
    assert.deepEqual(validateValue(fieldById(id), s[id].value, null).errors, [], id);
  }
  for (const id of ['contact.email', 'org.charityNumber', 'eligibility.previousApplication', 'compliance.safeguarding', 'work.annualPeople']) assert.equal(s[id], undefined, id);
  const init = initialAnswers(profile, NOW);
  assert.equal(init['org.name'].confirmedAt, NOW);
  assert.equal(init['request.reason'].confirmedAt, null);
  const ev = evaluate(init);
  assert.ok(ev.fields['request.reason'].reasons.includes('suggested-draft'));
  assert.equal(ev.fields['request.reason'].status, 'review');
});

test('status strip counts only visible applicable fields', () => {
  const base = evaluate({});
  const hidden = FIELDS.filter((f) => f.when).length;
  const optional = FIELDS.filter((f) => f.required === false && !f.when).length;
  assert.equal(base.counts.missing, FIELDS.length - hidden - optional);
  const yes = evaluate({ 'eligibility.previousApplication': { value: 'yes' } });
  assert.equal(yes.fields['eligibility.previousOutcome'].applicable, true);
  assert.equal(yes.fields['eligibility.previousOutcomeDate'].applicable, false);
  assert.equal(yes.counts.missing, base.counts.missing); // -1 previousApplication answered (review), +1 outcome
  assert.equal(evaluate({ 'org.type': { value: 'registered-charity' } }).fields['org.charityNumber'].applicable, true);
  assert.equal(evaluate({ 'org.type': { value: 'synthetic-registered-charity' } }).fields['org.charityNumber'].applicable, false);
  assert.equal(SECTIONS.length, 5);
});

test('unknown answers need review and are never confirmed', () => {
  const ev = evaluate({ 'compliance.safeguarding': { value: 'unknown', origin: 'manager', confirmedAt: NOW } });
  assert.equal(ev.fields['compliance.safeguarding'].status, 'review');
  assert.ok(ev.fields['compliance.safeguarding'].reasons.includes('unknown-answer'));
  assert.equal(evaluate({ 'compliance.safeguarding': { value: 'no', origin: 'manager', confirmedAt: NOW } }).fields['compliance.safeguardingExplanation'].status, 'missing');
});

test('manager edits win: suggestions never overwrite, refresh only offers', () => {
  let answers = initialAnswers(profile, NOW);
  answers = setManagerAnswer(answers, 'org.geography', { value: 'Newham' }, NOW);
  const changed = { ...profile, geography: 'East London', overview: 'Brand new overview. '.repeat(10), updatedAt: '2026-11-10T00:00:00.000Z' };
  const diff = diffSuggestions(answers, buildSuggestions(changed));
  const geo = diff.find((d) => d.fieldId === 'org.geography');
  assert.equal(geo.edited, true);
  assert.equal(answers['org.geography'].value, 'Newham');
  assert.equal(diff.find((d) => d.fieldId === 'org.overview').edited, false);
  assert.equal(diff.find((d) => d.fieldId === 'request.reason'), undefined); // unchanged suggestion is not listed
  const cleared = setManagerAnswer(answers, 'org.geography', { value: null }, NOW);
  assert.equal(diffSuggestions(cleared, buildSuggestions(profile)).find((d) => d.fieldId === 'org.geography').edited, true);
  const ex = buildExampleAnswers(NOW);
  assert.deepEqual(editedAnswersThatWouldChange(answers, { 'org.geography': { value: 'Newham' } }), []);
  assert.deepEqual(editedAnswersThatWouldChange(answers, { 'org.geography': { value: 'Other' } }), ['org.geography']);
  assert.ok(editedAnswersThatWouldChange(setManagerAnswer(answers, 'org.overview', { value: 'mine' }, NOW), ex).includes('org.overview'));
});

test('stale sources are flagged and confirmation clears the flag', () => {
  let answers = initialAnswers(profile, NOW);
  const cat = { profile, bids: [], documents: [] };
  assert.deepEqual(staleMap(answers, cat), {});
  const cat2 = { ...cat, profile: { ...profile, updatedAt: '2026-11-12T00:00:00.000Z' } };
  assert.equal(staleMap(answers, cat2)['org.overview'], 'changed');
  assert.equal(evaluate(answers, { stale: staleMap(answers, cat2) }).fields['org.overview'].reasons.includes('source-changed'), true);
  answers = { ...answers, 'evidence.accountsId': { value: 'doc1', origin: 'manager', sourceRefs: [{ kind: 'document', recordId: 'doc1', updatedAt: 'a' }], confirmedAt: NOW, editedAt: NOW } };
  assert.equal(staleMap(answers, { ...cat, documents: [] })['evidence.accountsId'], 'removed');
  assert.equal(staleMap(answers, { ...cat, documents: [{ id: 'doc1', updatedAt: 'b' }] })['evidence.accountsId'], 'changed');
  assert.deepEqual(staleMap(answers, null), {});
  const ok = confirmAnswer(answers, 'evidence.accountsId', NOW, [{ kind: 'document', recordId: 'doc1', updatedAt: 'b' }]);
  assert.deepEqual(staleMap(ok, { ...cat, documents: [{ id: 'doc1', updatedAt: 'b' }] }), {});
});

test('dates and routes', () => {
  assert.equal(isRealDate('2028-02-29'), true);
  assert.equal(isRealDate('2027-02-29'), false);
  assert.deepEqual(parseApplicationHash(appHash('G-001')), { grantId: 'G-001', page: 'workspace' });
  assert.deepEqual(parseApplicationHash('#/planning/G-001/application/review'), { grantId: 'G-001', page: 'review' });
  assert.deepEqual(parseApplicationHash('#/planning/G-001/application/field/org.type'), { grantId: 'G-001', page: 'workspace', field: 'org.type' });
  assert.equal(parseApplicationHash('#/planning/G-001/application/nope'), null);
});
