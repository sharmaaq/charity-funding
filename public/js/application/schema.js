// The G-001 questionnaire as data, plus every validation and finance rule.
//
// PURE MODULE: no DOM, no storage, no clock, no imports, no browser globals. It is imported by the browser app and
// by Node tests, and later phases import this same file on the server so both sides validate identically.
//
// Conventions (spec section 4):
// - Unknown is null. Never 0, "No" or an empty string standing in for "not answered".
// - Money is integer pence. Dates are YYYY-MM-DD strings. Text limits count Unicode code points.
// - Answers are { value, raw?, origin, sourceRefs, confirmedAt, editedAt }. `raw` exists only when the manager typed
//   something that could not be parsed (value is then null) so the text stays visible beside its error.

export const SCHEMA_VERSION = 1;
export const GRANT_ID = 'G-001';

export const LIMITS = Object.freeze({
  shortText: 200,
  address: 500,
  narrative: 4000,
  geography: 1000,
  explanation: 1000,
  email: 254,
  phone: 50,
  url: 2000,
  identifier: 30,
  maxPence: 99999999999, // GBP 999,999,999.99
  requestBelowPence: 10000000, // a specified request must be under GBP 100,000
  maxPeople: 10000000,
  maxPeriodDays: 366, // inclusive, supported one-year path
});

export const MAJOR_GRANTS_MESSAGE = 'Requests of GBP 100,000 or more go through the foundation\'s Major Grants route, which this demo path does not cover. Enter an amount below GBP 100,000.';

export const ORIGINS = Object.freeze(['profile', 'manager', 'manual-document-excerpt', 'historical-bid', 'suggested-draft', 'synthetic-demo']);

export const SECTIONS = Object.freeze([
  { id: 'organisation', label: 'Organisation' },
  { id: 'request', label: 'Funding request' },
  { id: 'work', label: 'Work and evidence' },
  { id: 'finances', label: 'Finances' },
  { id: 'documents', label: 'Documents' },
]);
export const REVIEW_SECTION = Object.freeze({ id: 'review', label: 'Review and submit' });

const YES_NO = Object.freeze([
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Not sure yet' },
]);

export const ORG_TYPES = Object.freeze([
  { value: 'registered-charity', label: 'Registered charity' },
  { value: 'synthetic-registered-charity', label: 'Registered charity (synthetic demo, no registration number)' },
  { value: 'exempt', label: 'Exempt charity' },
  { value: 'excepted', label: 'Excepted charity' },
  { value: 'unknown', label: 'Not sure yet' },
]);

export const ACCOUNTS_KINDS = Object.freeze([
  { value: 'independently-examined', label: 'Independently examined annual accounts' },
  { value: 'audited', label: 'Audited annual accounts' },
  { value: 'management', label: 'Management accounts' },
  { value: 'synthetic-accounts-example', label: 'Synthetic accounts example (not a real filing)' },
  { value: 'other', label: 'Other' },
]);

export const AMOUNT_MODES = Object.freeze([
  { value: 'specified', label: 'A specific amount' },
  { value: 'discretion', label: 'Funder discretion (no amount stated)' },
]);

// Field definition keys: id, section, label, type, required (default true), when (all conditions must hold),
// minWords/maxWords, maxChars, options, fixed (not editable), hint, none (a "None recorded" shortcut), dest (spec column).
// types: text textarea date money integer email phone url enum yesno document rows-income rows-expense
const f = (def) => Object.freeze({ required: true, ...def });

export const FIELDS = Object.freeze([
  // ---- Organisation ----
  f({ id: 'org.name', section: 'organisation', label: 'Organisation name', type: 'text', fixed: true, dest: 'C', hint: 'This demo is fixed to YOR Plc.' }),
  f({ id: 'org.type', section: 'organisation', label: 'Legal status', type: 'enum', options: ORG_TYPES, dest: 'C', hint: 'Choose the synthetic option for the worked demo. No registration number is ever invented.', controls: true }),
  f({ id: 'org.charityNumber', section: 'organisation', label: 'Registration number', type: 'text', maxChars: LIMITS.identifier, required: false, when: [{ id: 'org.type', in: ['registered-charity'] }], dest: 'C', hint: 'Only for a real registered charity.' }),
  f({ id: 'org.companyNumber', section: 'organisation', label: 'Company number', type: 'text', maxChars: LIMITS.identifier, required: false, dest: 'I', hint: 'Optional.' }),
  f({ id: 'org.address', section: 'organisation', label: 'Address', type: 'textarea', maxChars: LIMITS.address, rows: 3, dest: 'C', hint: 'Used to prepare the application. Up to 500 characters.' }),
  f({ id: 'org.postcode', section: 'organisation', label: 'Postcode', type: 'text', maxChars: 20, dest: 'C' }),
  f({ id: 'org.website', section: 'organisation', label: 'Website', type: 'url', required: false, dest: 'C', hint: 'Optional. A full address starting with http:// or https://.' }),
  f({ id: 'org.overview', section: 'organisation', label: 'What does the organisation do?', type: 'textarea', minWords: 30, maxWords: 500, dest: 'P' }),
  f({ id: 'org.geography', section: 'organisation', label: 'Where do you work?', type: 'textarea', maxChars: LIMITS.geography, rows: 3, dest: 'P', hint: 'For example London. Newham or East London is a possible narrower scope to consider.' }),
  f({ id: 'contact.firstName', section: 'organisation', label: 'Contact first name', type: 'text', dest: 'C' }),
  f({ id: 'contact.lastName', section: 'organisation', label: 'Contact last name', type: 'text', dest: 'C' }),
  f({ id: 'contact.role', section: 'organisation', label: 'Contact role', type: 'text', dest: 'C' }),
  f({ id: 'contact.employment', section: 'organisation', label: 'Contact is', type: 'enum', options: [{ value: 'staff', label: 'Paid staff' }, { value: 'volunteer', label: 'Volunteer' }], dest: 'C' }),
  f({ id: 'contact.email', section: 'organisation', label: 'Contact email', type: 'email', dest: 'C' }),
  f({ id: 'contact.phone', section: 'organisation', label: 'Contact telephone', type: 'phone', dest: 'C' }),
  f({ id: 'compliance.ukTaxResident', section: 'organisation', label: 'Is the organisation resident in the UK for tax purposes?', type: 'yesno', dest: 'C', hint: 'Never inferred from the postcode.' }),
  f({ id: 'compliance.safeguarding', section: 'organisation', label: 'Does the organisation have a safeguarding policy?', type: 'yesno', dest: 'C', controls: true }),
  f({ id: 'compliance.safeguardingExplanation', section: 'organisation', label: 'Explain why there is no safeguarding policy', type: 'textarea', maxChars: LIMITS.explanation, rows: 3, when: [{ id: 'compliance.safeguarding', in: ['no'] }], dest: 'C' }),
  f({ id: 'compliance.safeguardingReviewed', section: 'organisation', label: 'Safeguarding policy last reviewed', type: 'date', required: false, when: [{ id: 'compliance.safeguarding', in: ['yes'] }], dest: 'I', hint: 'Optional. A document date alone is not policy approval.' }),
  f({ id: 'compliance.demographics', section: 'organisation', label: 'Demographic information about the people you support', type: 'textarea', maxChars: LIMITS.explanation, rows: 4, dest: 'C', hint: 'Enter facts you hold, or state clearly that they are unknown or not collected.' }),
  f({ id: 'compliance.contactPermission', section: 'organisation', label: 'May the funder contact you about other opportunities?', type: 'yesno', required: false, dest: 'C', hint: 'Optional. Left unanswered unless you choose.' }),

  // ---- Funding request ----
  f({ id: 'request.type', section: 'request', label: 'Type of funding', type: 'enum', fixed: true, options: [{ value: 'core', label: 'Operating / core costs' }], dest: 'C', hint: 'Project, capital and multi-year funding need a different template and are not supported here.' }),
  f({ id: 'request.title', section: 'request', label: 'Request title', type: 'text', dest: 'P' }),
  f({ id: 'request.amountMode', section: 'request', label: 'How will you state the amount?', type: 'enum', options: AMOUNT_MODES, dest: 'I', controls: true }),
  f({ id: 'request.amountPence', section: 'request', label: 'Amount requested (GBP)', type: 'money', positive: true, belowPence: LIMITS.requestBelowPence, when: [{ id: 'request.amountMode', in: ['specified'] }], dest: 'C', hint: 'Under GBP 100,000. Illustrative until the budget is confirmed.' }),
  f({ id: 'request.start', section: 'request', label: 'Funding period starts', type: 'date', dest: 'P' }),
  f({ id: 'request.end', section: 'request', label: 'Funding period ends', type: 'date', dest: 'P', hint: 'Up to 366 days after the start.' }),
  f({ id: 'request.people', section: 'request', label: 'People the funding would reach (planned)', type: 'integer', dest: 'P', hint: 'A whole number greater than zero.' }),
  f({ id: 'request.reason', section: 'request', label: 'Why are you asking, and what would the funding cover?', type: 'textarea', minWords: 50, maxWords: 350, dest: 'P' }),
  f({ id: 'eligibility.previousApplication', section: 'request', label: 'Has the organisation applied to this funder before?', type: 'yesno', dest: 'C', controls: true, hint: 'An empty local archive does not mean No.' }),
  f({ id: 'eligibility.previousOutcome', section: 'request', label: 'What happened to the earlier application?', type: 'enum', options: [{ value: 'decided', label: 'A decision was made' }, { value: 'pending', label: 'Still being considered' }, { value: 'unknown', label: 'Not sure yet' }], when: [{ id: 'eligibility.previousApplication', in: ['yes'] }], dest: 'I', controls: true }),
  f({ id: 'eligibility.previousOutcomeDate', section: 'request', label: 'Date of the earlier decision', type: 'date', when: [{ id: 'eligibility.previousApplication', in: ['yes'] }, { id: 'eligibility.previousOutcome', in: ['decided'] }], dest: 'I' }),

  // ---- Work and evidence ----
  f({ id: 'work.need', section: 'work', label: 'What need are you responding to?', type: 'textarea', minWords: 50, maxWords: 500, dest: 'P' }),
  f({ id: 'work.activities', section: 'work', label: 'What will you do?', type: 'textarea', minWords: 50, maxWords: 500, dest: 'P' }),
  f({ id: 'work.beneficiaries', section: 'work', label: 'Who benefits?', type: 'textarea', minWords: 30, maxWords: 300, dest: 'P' }),
  f({ id: 'work.annualPeople', section: 'work', label: 'People supported in a typical year', type: 'integer', dest: 'C', hint: 'A whole number greater than zero.' }),
  f({ id: 'work.peopleNotes', section: 'work', label: 'How were these numbers counted, and over what period?', type: 'textarea', maxChars: 500, rows: 3, dest: 'P' }),
  f({ id: 'work.outcomes', section: 'work', label: 'What will change, and how will you know?', type: 'textarea', minWords: 50, maxWords: 500, dest: 'P' }),
  f({ id: 'work.inclusion', section: 'work', label: 'How do you make your services inclusive and accessible?', type: 'textarea', minWords: 30, maxWords: 300, dest: 'P' }),
  f({ id: 'work.partnerships', section: 'work', label: 'Partnerships and referral relationships', type: 'textarea', maxWords: 300, none: 'None recorded.', dest: 'P', hint: 'Describe them, or choose None recorded.' }),
  f({ id: 'work.leadership', section: 'work', label: 'Who leads and governs the work?', type: 'textarea', minWords: 30, maxWords: 300, dest: 'P' }),
  f({ id: 'work.caseStudy', section: 'work', label: 'Case study', type: 'textarea', required: false, maxWords: 250, dest: 'P', hint: 'Optional. Anonymised only: no identifiable resident data.' }),
  f({ id: 'work.videoUrl', section: 'work', label: 'Video link', type: 'url', required: false, dest: 'C', hint: 'Optional.' }),

  // ---- Finances ----
  f({ id: 'finance.reportingEnd', section: 'finances', label: 'Latest accounts: year ended', type: 'date', dest: 'C' }),
  f({ id: 'finance.historicalIncomePence', section: 'finances', label: 'Income in the latest accounts (GBP)', type: 'money', dest: 'C', hint: 'Taken from the accounts, not estimated.' }),
  f({ id: 'finance.incomeRows', section: 'finances', label: 'Forecast income', type: 'rows-income', dest: 'P', hint: 'At least one row. Secured cannot be more than the target. Do not include the grant you are asking for.' }),
  f({ id: 'finance.expenseRows', section: 'finances', label: 'Forecast expenditure', type: 'rows-expense', dest: 'P', hint: 'At least one row.' }),
  f({ id: 'finance.forecastStart', section: 'finances', label: 'Forecast period starts', type: 'date', dest: 'P' }),
  f({ id: 'finance.forecastEnd', section: 'finances', label: 'Forecast period ends', type: 'date', dest: 'P' }),
  f({ id: 'finance.fundraising', section: 'finances', label: 'How will you raise the rest of the money?', type: 'textarea', minWords: 50, maxWords: 400, dest: 'P' }),
  f({ id: 'finance.reserves', section: 'finances', label: 'Reserves', type: 'textarea', maxWords: 250, none: 'None to explain.', dest: 'P', hint: 'Explain, or choose None to explain.' }),
  f({ id: 'finance.fallback', section: 'finances', label: 'What if you raise less than planned?', type: 'textarea', minWords: 30, maxWords: 300, dest: 'P' }),

  // ---- Documents ----
  f({ id: 'evidence.accountsId', section: 'documents', label: 'Accounts document', type: 'document', dest: 'U', hint: 'Choose a stored PDF or DOCX. Nothing is selected for you, and nothing is read from it.' }),
  f({ id: 'evidence.accountsPeriod', section: 'documents', label: 'Period the accounts cover', type: 'text', maxChars: 100, dest: 'U' }),
  f({ id: 'evidence.accountsKind', section: 'documents', label: 'Kind of accounts document', type: 'enum', options: ACCOUNTS_KINDS, dest: 'U' }),
]);

const BY_ID = new Map(FIELDS.map((x) => [x.id, x]));
export const fieldById = (id) => BY_ID.get(id) || null;
export const fieldsInSection = (sectionId) => FIELDS.filter((x) => x.section === sectionId);
export const sectionOf = (fieldId) => (fieldById(fieldId) || {}).section || null;
export const sectionLabel = (id) => ([...SECTIONS, REVIEW_SECTION].find((s) => s.id === id) || { label: id }).label;
// Policy and declaration answers, shown apart from narrative on Review.
export const POLICY_FIELD_IDS = Object.freeze(FIELDS.filter((x) => x.id.startsWith('compliance.') || x.id.startsWith('eligibility.')).map((x) => x.id));

export const REASON_TEXT = Object.freeze({
  'suggested-draft': 'Suggested draft: edit it or confirm it',
  'synthetic-demo': 'Illustrative demo answer: confirm during demo review',
  profile: 'Prefilled from the organisation profile: confirm it',
  'historical-bid': 'Prefilled from a past bid: confirm it is still true',
  'unconfirmed': 'Not yet confirmed',
  'unknown-answer': 'Answered "Not sure yet"',
  'source-changed': 'Source changed since this was filled in: confirm or replace',
  'source-removed': 'Source was removed: confirm or replace',
  invalid: 'Needs correcting',
});

// ---------- small pure helpers ----------
export const codePoints = (s) => Array.from(String(s ?? '')).length;
export const countWords = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function isRealDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return false;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  const dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= dim;
}
// Whole days from a to b (b - a); both must be real dates.
export function daysBetween(a, b) {
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400000);
}

const MONEY_HELP = 'Enter an amount in pounds such as 50,000 or 1,250.50: digits only, commas allowed, at most two decimal places.';

// Strict pounds -> integer pence. Never uses floating point. Empty is "not answered" (value null).
// Returns { ok: true, value: pence|null } or { ok: false, message }.
export function parseMoney(input) {
  let s = String(input ?? '').trim();
  if (s === '') return { ok: true, value: null };
  if (/^-/.test(s) || /^£\s*-/.test(s)) return { ok: false, message: 'An amount cannot be negative.' };
  s = s.replace(/^£\s*/, '').replace(/^gbp\s*/i, '');
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return { ok: false, message: MONEY_HELP };
  const pounds = m[1].replace(/,/g, '');
  if (pounds.length > 12) return { ok: false, message: 'That amount is too large.' };
  const pence = Number(pounds) * 100 + Number((m[2] || '').padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(pence) || pence > LIMITS.maxPence) return { ok: false, message: 'Amounts cannot be more than GBP 999,999,999.99.' };
  return { ok: true, value: pence };
}

// Whole numbers with optional comma grouping. Empty is "not answered".
export function parseWholeNumber(input) {
  const s = String(input ?? '').trim();
  if (s === '') return { ok: true, value: null };
  if (!/^(\d{1,3}(?:,\d{3})+|\d+)$/.test(s)) return { ok: false, message: 'Enter a whole number such as 250, with no decimals or letters.' };
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isSafeInteger(n)) return { ok: false, message: 'That number is too large.' };
  return { ok: true, value: n };
}

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// "50,000" or "1,250.50" for input boxes.
export function formatPenceInput(pence) {
  if (!Number.isSafeInteger(pence)) return '';
  const whole = Math.floor(pence / 100);
  const rest = pence % 100;
  return group(whole) + (rest ? '.' + String(rest).padStart(2, '0') : '');
}
// "£50,000" or "£1,250.50" for display.
export function formatPence(pence) {
  if (!Number.isSafeInteger(pence)) return '';
  const neg = pence < 0;
  return (neg ? '-£' : '£') + formatPenceInput(Math.abs(pence));
}
export const formatGroupedNumber = (n) => (Number.isSafeInteger(n) ? group(n) : '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '';
  } catch {
    return false;
  }
}
const isNonEmpty = (v) => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '') && !(Array.isArray(v) && v.length === 0);

// ---------- parsing what the manager types ----------
// Returns { value, raw?, error? }. Text keeps its original formatting; empty becomes null.
export function parseInput(field, text) {
  const t = String(text ?? '');
  switch (field.type) {
    case 'money': {
      const r = parseMoney(t);
      return r.ok ? { value: r.value } : { value: null, raw: t, error: r.message };
    }
    case 'integer': {
      const r = parseWholeNumber(t);
      return r.ok ? { value: r.value } : { value: null, raw: t, error: r.message };
    }
    default:
      return { value: t.trim() === '' ? null : t };
  }
}

// ---------- values, applicability ----------
// answers: { [fieldId]: Answer }. Returns { [fieldId]: value|null } for every field in the table.
export function plainValues(answers) {
  const out = {};
  for (const fd of FIELDS) {
    const a = answers && answers[fd.id];
    out[fd.id] = a && a.value !== undefined ? a.value : null;
  }
  return out;
}

export function isApplicable(field, values) {
  for (const c of field.when || []) {
    const dep = fieldById(c.id);
    if (dep && !isApplicable(dep, values)) return false;
    if (!c.in.includes(values[c.id])) return false;
  }
  return true;
}

// The values that would go out: anything not applicable is null, never a leftover or a zero.
export function outgoingValues(answers) {
  const values = plainValues(answers);
  const out = {};
  for (const fd of FIELDS) out[fd.id] = isApplicable(fd, values) ? values[fd.id] : null;
  return out;
}

// ---------- finance ----------
const validPence = (n) => Number.isSafeInteger(n) && n >= 0 && n <= LIMITS.maxPence;
const sum = (list) => list.reduce((n, x) => n + x, 0);

// incomeRows: [{ label, targetPence, securedPence }], expenseRows: [{ label, amountPence }].
// Rows with an unreadable amount are ignored and `complete` is false. Nothing is invented for missing rows.
export function financeTotals(incomeRows, expenseRows) {
  const inc = Array.isArray(incomeRows) ? incomeRows : [];
  const exp = Array.isArray(expenseRows) ? expenseRows : [];
  const okInc = inc.filter((r) => r && validPence(r.targetPence) && validPence(r.securedPence));
  const okExp = exp.filter((r) => r && validPence(r.amountPence));
  const targetPence = sum(okInc.map((r) => r.targetPence));
  const securedPence = sum(okInc.map((r) => r.securedPence));
  const expensePence = sum(okExp.map((r) => r.amountPence));
  return {
    targetPence,
    securedPence,
    expensePence,
    gapPence: Math.max(0, expensePence - securedPence), // current unsecured gap: E - S, never negative
    targetSurplusPence: targetPence - expensePence, // T - E: positive surplus, negative shortfall
    hasIncome: inc.length > 0,
    hasExpense: exp.length > 0,
    complete: okInc.length === inc.length && okExp.length === exp.length && inc.length > 0 && exp.length > 0,
  };
}

// ---------- validating one value ----------
// Returns { errors: string[], rowErrors?: [{...}] }
export function validateValue(field, value, raw, values = {}) {
  const errors = [];
  if (raw !== undefined && raw !== null && raw !== '' && (field.type === 'money' || field.type === 'integer')) {
    return { errors: [field.type === 'money' ? (parseMoney(raw).message || MONEY_HELP) : (parseWholeNumber(raw).message || 'Enter a whole number.')] };
  }
  if (!isNonEmpty(value)) return { errors };
  switch (field.type) {
    case 'text':
    case 'textarea': {
      const s = String(value);
      const max = field.maxChars || (field.type === 'text' ? LIMITS.shortText : LIMITS.narrative);
      if (codePoints(s) > max) errors.push(`Use no more than ${max.toLocaleString('en-GB')} characters (currently ${codePoints(s).toLocaleString('en-GB')}).`);
      if (field.type === 'textarea' || field.minWords || field.maxWords) {
        const w = countWords(s);
        if (field.minWords && w < field.minWords) errors.push(`Write at least ${plural(field.minWords, 'word')} (currently ${w}).`);
        if (field.maxWords && w > field.maxWords) errors.push(`Use no more than ${plural(field.maxWords, 'word')} (currently ${w}).`);
      }
      break;
    }
    case 'date':
      if (!isRealDate(value)) errors.push('Enter a real date.');
      break;
    case 'money':
      if (!Number.isSafeInteger(value) || value < 0) errors.push('An amount must be a whole number of pence of zero or more.');
      else if (value > LIMITS.maxPence) errors.push('Amounts cannot be more than GBP 999,999,999.99.');
      else if (field.positive && value <= 0) errors.push('The amount must be more than zero. Choose Funder discretion if you do not want to state one.');
      else if (field.belowPence && value >= field.belowPence) errors.push(MAJOR_GRANTS_MESSAGE);
      break;
    case 'integer':
      if (!Number.isSafeInteger(value) || value <= 0) errors.push('Enter a whole number greater than zero.');
      else if (value > LIMITS.maxPeople) errors.push(`Enter a number no larger than ${group(LIMITS.maxPeople)}.`);
      break;
    case 'email':
      if (!EMAIL_RE.test(String(value)) || codePoints(value) > LIMITS.email) errors.push('Enter an email address such as name@example.org.');
      break;
    case 'phone': {
      const s = String(value);
      const digits = s.replace(/\D/g, '').length;
      if (!/^[+()\d][\d\s()+-]*$/.test(s) || digits < 7 || digits > 20 || codePoints(s) > LIMITS.phone) errors.push('Enter a telephone number using digits, spaces, + ( ) and -.');
      break;
    }
    case 'url':
      if (codePoints(value) > LIMITS.url || !isHttpUrl(String(value))) errors.push('Enter a full web address starting with http:// or https://.');
      break;
    case 'enum':
    case 'yesno': {
      const opts = field.type === 'yesno' ? YES_NO : field.options;
      if (!opts.some((o) => o.value === value)) errors.push('Choose one of the options.');
      break;
    }
    case 'document':
      if (typeof value !== 'string' || value === '') errors.push('Choose a stored document.');
      break;
    case 'rows-income':
    case 'rows-expense':
      return validateRows(field, value);
    default:
      break;
  }
  return { errors };
}

function validateRows(field, rows) {
  const errors = [];
  const rowErrors = [];
  const income = field.type === 'rows-income';
  if (!Array.isArray(rows)) return { errors: ['Add at least one row.'] };
  rows.forEach((r, i) => {
    const e = {};
    const n = i + 1;
    const label = r && typeof r.label === 'string' ? r.label.trim() : '';
    if (!label) e.label = `Row ${n}: enter a name.`;
    else if (codePoints(label) > LIMITS.shortText) e.label = `Row ${n}: use no more than ${LIMITS.shortText} characters for the name.`;
    if (r && r.note && codePoints(r.note) > LIMITS.shortText) e.note = `Row ${n}: use no more than ${LIMITS.shortText} characters for the note.`;
    const amount = (key, rawKey, what) => {
      if (r && r[rawKey]) { e[key] = `Row ${n}: ${what} is not a valid amount. ${MONEY_HELP}`; return; }
      if (!r || r[key] === null || r[key] === undefined) { e[key] = `Row ${n}: enter ${what}. Enter 0 only if it really is nothing.`; return; }
      if (!validPence(r[key])) e[key] = `Row ${n}: ${what} must be zero or more and no more than GBP 999,999,999.99.`;
    };
    if (income) {
      amount('targetPence', 'targetRaw', 'the target');
      amount('securedPence', 'securedRaw', 'the amount secured');
      if (!e.targetPence && !e.securedPence && r.securedPence > r.targetPence) e.securedPence = `Row ${n}: the amount secured cannot be more than the target.`;
    } else {
      amount('amountPence', 'amountRaw', 'the amount');
    }
    rowErrors.push(e);
    errors.push(...Object.values(e));
  });
  return { errors, rowErrors };
}

// ---------- the whole answer set ----------
// ctx: { stale: { [fieldId]: 'changed' | 'removed' } } (computed against the live source catalogue by prefill.js)
// Returns { fields, counts, sections, finance, issues, warnings, ready }.
export function evaluate(answers, ctx = {}) {
  const values = plainValues(answers);
  const stale = ctx.stale || {};
  const fields = {};
  const counts = { missing: 0, review: 0, confirmed: 0 };
  const sections = {};
  for (const s of SECTIONS) sections[s.id] = { missing: 0, review: 0, confirmed: 0 };

  for (const fd of FIELDS) {
    const applicable = isApplicable(fd, values);
    if (!applicable) {
      fields[fd.id] = { applicable: false, required: false, status: 'hidden', errors: [], reasons: [] };
      continue;
    }
    const a = (answers && answers[fd.id]) || null;
    const value = a ? a.value ?? null : null;
    const raw = a && a.raw ? a.raw : null;
    const has = isNonEmpty(value) || !!raw;
    const required = fd.required !== false;
    const res = has ? validateValue(fd, value, raw, values) : { errors: [] };
    const entry = { applicable: true, required, status: 'optional', errors: [...res.errors], rowErrors: res.rowErrors, reasons: [] };
    fields[fd.id] = entry;
    if (!has) {
      if (required) entry.status = 'missing';
      continue;
    }
    if (entry.errors.length) entry.reasons.push('invalid');
    if (!fd.fixed) {
      if (value === 'unknown') entry.reasons.push('unknown-answer');
      if (fd.id === 'eligibility.previousOutcome' && value === 'pending') entry.reasons.push('unknown-answer');
      if (stale[fd.id]) entry.reasons.push(stale[fd.id] === 'removed' ? 'source-removed' : 'source-changed');
      if (!(a && a.confirmedAt)) {
        const origin = a ? a.origin : null;
        entry.reasons.push(origin === 'suggested-draft' ? 'suggested-draft' : origin === 'synthetic-demo' ? 'synthetic-demo' : origin === 'profile' ? 'profile' : origin === 'historical-bid' ? 'historical-bid' : 'unconfirmed');
      }
    }
    entry.status = entry.reasons.length ? 'review' : 'confirmed';
  }

  // Cross-field rules. These can only add errors; they never invent values.
  const warnings = [];
  const addError = (id, message) => {
    const e = fields[id];
    if (!e || !e.applicable) return;
    e.errors.push(message);
    if (!e.reasons.includes('invalid')) e.reasons.push('invalid');
    if (e.status === 'confirmed' || e.status === 'optional') e.status = 'review';
  };
  const period = (startId, endId, what) => {
    const s = values[startId];
    const e = values[endId];
    if (isRealDate(s) && isRealDate(e)) {
      const days = daysBetween(s, e);
      if (days <= 0) addError(endId, `The ${what} must end after it starts.`);
      else if (days + 1 > LIMITS.maxPeriodDays) addError(endId, `The ${what} can be at most ${LIMITS.maxPeriodDays} days, which is the one-year path this demo supports.`);
    }
  };
  period('request.start', 'request.end', 'funding period');
  period('finance.forecastStart', 'finance.forecastEnd', 'forecast period');

  const inc = values['finance.incomeRows'];
  const exp = values['finance.expenseRows'];
  const finance = financeTotals(inc, exp);
  finance.requestPence = values['request.amountMode'] === 'specified' && Number.isSafeInteger(values['request.amountPence']) ? values['request.amountPence'] : null;
  finance.requestWithinGap = null;
  if (finance.requestPence !== null && finance.complete && fields['finance.incomeRows'].errors.length === 0 && fields['finance.expenseRows'].errors.length === 0) {
    finance.requestWithinGap = finance.requestPence <= finance.gapPence;
    if (!finance.requestWithinGap) {
      addError('request.amountPence', `The request (${formatPence(finance.requestPence)}) is more than the current unsecured gap of ${formatPence(finance.gapPence)}. Correct the forecast or the amount. This is a consistency rule of this demo, not a funder rule.`);
    }
  }
  if (finance.hasIncome && finance.hasExpense && finance.complete && finance.targetSurplusPence < 0) {
    warnings.push({ id: 'target-shortfall', fieldId: 'finance.incomeRows', message: `Target income is ${formatPence(-finance.targetSurplusPence)} below planned expenditure.` });
  }
  if (finance.complete && finance.targetSurplusPence > 0) {
    warnings.push({ id: 'target-surplus', fieldId: 'finance.incomeRows', message: `Target income is ${formatPence(finance.targetSurplusPence)} above planned expenditure. Explain the surplus in the fundraising or reserves answers.` });
  }
  const mismatch = isRealDate(values['request.start']) && isRealDate(values['finance.forecastStart'])
    && (values['request.start'] !== values['finance.forecastStart'] || values['request.end'] !== values['finance.forecastEnd']);
  if (mismatch) warnings.push({ id: 'period-mismatch', fieldId: 'finance.forecastStart', message: 'The forecast period is different from the funding period. Check that both are intended.' });
  if (values['request.amountMode'] === 'discretion') warnings.push({ id: 'discretion', fieldId: 'request.amountMode', message: 'No amount will be stated. The proposal will describe the financial gap instead, and no amount is entered anywhere.' });

  const issues = [];
  for (const fd of FIELDS) {
    const e = fields[fd.id];
    if (!e.applicable) continue;
    if (e.status === 'missing') { counts.missing += 1; sections[fd.section].missing += 1; issues.push({ kind: 'missing', fieldId: fd.id, section: fd.section, label: fd.label, message: `${fd.label}: needs an answer.` }); }
    else if (e.status === 'review') {
      counts.review += 1; sections[fd.section].review += 1;
      const detail = [...e.errors, ...e.reasons.filter((r) => r !== 'invalid').map((r) => REASON_TEXT[r])].filter(Boolean)[0];
      issues.push({ kind: 'review', fieldId: fd.id, section: fd.section, label: fd.label, reasons: e.reasons, message: `${fd.label}: ${detail}` });
    } else if (e.status === 'confirmed') { counts.confirmed += 1; sections[fd.section].confirmed += 1; }
  }
  return { values, fields, counts, sections, finance, issues, warnings, ready: counts.missing === 0 && counts.review === 0 };
}
