// Pure rules for the organisation area: no DOM, no storage, no clock. Dates are YYYY-MM-DD strings and
// "today" is always passed in (the Europe/London date, from the timing helpers in the app).
import { parseYmd } from '../timing.js';

export const MIB = 1024 * 1024;
export const LIMITS = Object.freeze({ maxFileBytes: 10 * MIB, maxTotalBytes: 100 * MIB });

export const FIELD_LIMITS = Object.freeze({
  overview: 2000,
  profileOther: 1000,
  identifier: 50,
  website: 300,
  title: 200,
  funder: 200,
  programme: 200,
  summary: 5000,
  feedback: 10000,
  notes: 10000,
  description: 2000,
  period: 100,
  tag: 50,
  maxTags: 10,
});

export const OUTCOMES = Object.freeze([
  { value: 'successful', label: 'Successful' },
  { value: 'unsuccessful', label: 'Unsuccessful' },
  { value: 'awaiting', label: 'Awaiting decision' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'unknown', label: 'Unknown' },
]);
export const ROLES = Object.freeze([
  { value: 'bid-document', label: 'Bid document' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'supporting', label: 'Supporting document' },
]);
export const CATEGORIES = Object.freeze([
  { value: 'general', label: 'General' },
  { value: 'charity-commission', label: 'Charity Commission submission' },
  { value: 'companies-house', label: 'Companies House filing' },
  { value: 'financial', label: 'Financial/accounts' },
  { value: 'governance', label: 'Governance/policy' },
  { value: 'impact', label: 'Impact/service evidence' },
  { value: 'other', label: 'Other' },
]);

export const labelOf = (list, value) => (list.find((x) => x.value === value) || { label: String(value ?? '') }).label;
export const isOutcome = (v) => OUTCOMES.some((o) => o.value === v);
export const isRole = (v) => ROLES.some((o) => o.value === v);
export const isCategory = (v) => CATEGORIES.some((o) => o.value === v);

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Allowed extensions, the canonical MIME stored with the file, and the browser-reported MIME values that agree with it.
export const FILE_TYPES = Object.freeze({
  pdf: { label: 'PDF', mime: 'application/pdf', accepts: ['application/pdf'] },
  docx: { label: 'DOCX', mime: DOCX, accepts: [DOCX] },
  xlsx: { label: 'XLSX', mime: XLSX, accepts: [XLSX] },
  csv: { label: 'CSV', mime: 'text/csv', accepts: ['text/csv', 'application/csv', 'text/x-csv', 'application/vnd.ms-excel', 'text/plain'] },
  txt: { label: 'TXT', mime: 'text/plain', accepts: ['text/plain'] },
  png: { label: 'PNG', mime: 'image/png', accepts: ['image/png'] },
  jpg: { label: 'JPEG', mime: 'image/jpeg', accepts: ['image/jpeg', 'image/pjpeg'] },
  jpeg: { label: 'JPEG', mime: 'image/jpeg', accepts: ['image/jpeg', 'image/pjpeg'] },
});
export const ACCEPT_ATTRIBUTE = Object.keys(FILE_TYPES).map((e) => '.' + e).join(',');
export const ALLOWED_TYPES_TEXT = 'PDF, DOCX, XLSX, CSV, TXT, PNG and JPEG';
const GENERIC_MIMES = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-download', 'application/download']);

export function fileExtension(name) {
  const s = String(name ?? '');
  const i = s.lastIndexOf('.');
  return i < 0 || i === s.length - 1 ? '' : s.slice(i + 1).toLowerCase();
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < MIB) return `${Math.round(n / 1024)} KB`;
  const mb = n / MIB;
  return `${mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

// file: { name, size, type } (a File works). Returns { ok, ... } and never throws.
export function validateFile(file, limits = LIMITS) {
  const name = String((file && file.name) ?? '');
  const size = file && file.size;
  const type = String((file && file.type) ?? '').toLowerCase().split(';')[0].trim();
  const ext = fileExtension(name);
  const spec = Object.prototype.hasOwnProperty.call(FILE_TYPES, ext) ? FILE_TYPES[ext] : null;
  if (!spec) return { ok: false, code: 'extension', message: `"${name}" is not an allowed file type. Allowed: ${ALLOWED_TYPES_TEXT}.` };
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return { ok: false, code: 'empty', message: `"${name}" is empty (0 bytes), so it was not added.` };
  if (size > limits.maxFileBytes) {
    return { ok: false, code: 'too-large', message: `"${name}" is ${size.toLocaleString('en-GB')} bytes, which is over the ${formatBytes(limits.maxFileBytes)} limit for one file.` };
  }
  if (!GENERIC_MIMES.has(type) && !spec.accepts.includes(type)) {
    return { ok: false, code: 'mime', message: `"${name}" has a .${ext} name but your browser reports it as ${type}, so it was not added.` };
  }
  return { ok: true, extension: ext, mime: spec.mime, typeLabel: spec.label };
}

// ---------- shared field helpers ----------
const trim = (v) => String(v ?? '').trim();

function checkLength(errors, key, value, max, label) {
  if (value.length > max) errors[key] = `${label} must be ${max.toLocaleString('en-GB')} characters or fewer.`;
}

export function parseAmount(text) {
  const raw = trim(text).replace(/^£\s*/, '').replace(/,/g, '');
  if (raw === '') return { ok: true, value: null };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(raw)) return { ok: false };
  return { ok: true, value: Number(raw) };
}

function checkDate(errors, key, text, label) {
  const v = trim(text);
  if (v === '') return null;
  if (!parseYmd(v)) {
    errors[key] = `Enter ${label} as a real date.`;
    return null;
  }
  return v;
}

export function parseTags(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',');
  return list.map((t) => String(t).trim()).filter(Boolean);
}

export function shortenTitle(name) {
  const max = FIELD_LIMITS.title;
  const s = String(name ?? '');
  if (s.length <= max) return s;
  let cut = s.slice(0, max - 1);
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return cut + '…';
}
export const defaultTitle = shortenTitle;

// ---------- records ----------
export function validateProfile(input) {
  const errors = {};
  const i = input || {};
  const v = {
    overview: trim(i.overview),
    beneficiaries: trim(i.beneficiaries),
    geography: trim(i.geography),
    activities: trim(i.activities),
    charityNumber: trim(i.charityNumber),
    companyNumber: trim(i.companyNumber),
    website: trim(i.website),
  };
  if (!v.overview) errors.overview = 'Describe what the charity does.';
  checkLength(errors, 'overview', v.overview, FIELD_LIMITS.overview, 'What the charity does');
  checkLength(errors, 'beneficiaries', v.beneficiaries, FIELD_LIMITS.profileOther, 'Who the charity supports');
  checkLength(errors, 'geography', v.geography, FIELD_LIMITS.profileOther, 'Where the charity works');
  checkLength(errors, 'activities', v.activities, FIELD_LIMITS.profileOther, 'Main activities');
  checkLength(errors, 'charityNumber', v.charityNumber, FIELD_LIMITS.identifier, 'Charity number');
  checkLength(errors, 'companyNumber', v.companyNumber, FIELD_LIMITS.identifier, 'Company number');
  checkLength(errors, 'website', v.website, FIELD_LIMITS.website, 'Website');
  if (v.website && !errors.website) {
    let ok = false;
    try {
      const u = new URL(v.website);
      ok = (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '';
    } catch { /* not a URL */ }
    if (!ok) errors.website = 'Enter a full web address starting with http:// or https://.';
  }
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateBid(input, today) {
  const errors = {};
  const i = input || {};
  const v = {
    title: trim(i.title),
    funder: trim(i.funder),
    programme: trim(i.programme),
    outcome: trim(i.outcome) || 'unknown',
    summary: trim(i.summary),
    feedback: trim(i.feedback),
    notes: trim(i.notes),
  };
  if (!v.title) errors.title = 'Enter the bid title.';
  if (!v.funder) errors.funder = 'Enter the funder.';
  checkLength(errors, 'title', v.title, FIELD_LIMITS.title, 'Bid title');
  checkLength(errors, 'funder', v.funder, FIELD_LIMITS.funder, 'Funder');
  checkLength(errors, 'programme', v.programme, FIELD_LIMITS.programme, 'Programme or round');
  checkLength(errors, 'summary', v.summary, FIELD_LIMITS.summary, 'Bid summary');
  checkLength(errors, 'feedback', v.feedback, FIELD_LIMITS.feedback, 'Funder feedback');
  checkLength(errors, 'notes', v.notes, FIELD_LIMITS.notes, 'Internal learning notes');
  if (!isOutcome(v.outcome)) errors.outcome = 'Choose an outcome.';

  v.submissionDate = checkDate(errors, 'submissionDate', i.submissionDate, 'the submission date');
  if (v.submissionDate && v.submissionDate > today) errors.submissionDate = 'The submission date cannot be in the future.';
  v.decisionDate = checkDate(errors, 'decisionDate', i.decisionDate, 'the decision date');
  if (v.decisionDate && !errors.decisionDate) {
    if (v.decisionDate > today) errors.decisionDate = 'The decision date cannot be in the future.';
    else if (v.submissionDate && !errors.submissionDate && v.decisionDate < v.submissionDate) errors.decisionDate = 'The decision date cannot be earlier than the submission date.';
  }

  const requested = parseAmount(i.requestedAmount);
  if (!requested.ok) errors.requestedAmount = 'Enter an amount in pounds with at most two decimal places, or leave it empty if unknown.';
  v.requestedAmount = requested.ok ? requested.value : null;
  const awarded = parseAmount(i.awardedAmount);
  if (!awarded.ok) errors.awardedAmount = 'Enter an amount in pounds with at most two decimal places, or leave it empty if unknown.';
  v.awardedAmount = awarded.ok ? awarded.value : null;
  if (awarded.ok && awarded.value !== null && v.outcome !== 'successful') errors.awardedAmount = 'An awarded amount can only be recorded for a successful bid.';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

// Organisation document details (title, category, description, date, period, tags).
export function validateDocumentMeta(input, { requireTitle = true } = {}) {
  const errors = {};
  const i = input || {};
  const v = {
    title: trim(i.title),
    category: trim(i.category) || 'general',
    description: trim(i.description),
    period: trim(i.period),
    tags: parseTags(i.tags),
  };
  if (requireTitle && !v.title) errors.title = 'Enter a title.';
  checkLength(errors, 'title', v.title, FIELD_LIMITS.title, 'Title');
  checkLength(errors, 'description', v.description, FIELD_LIMITS.description, 'Description');
  checkLength(errors, 'period', v.period, FIELD_LIMITS.period, 'Reporting period');
  if (!isCategory(v.category)) errors.category = 'Choose a category.';
  v.documentDate = checkDate(errors, 'documentDate', i.documentDate, 'the document date');
  if (v.tags.length > FIELD_LIMITS.maxTags) errors.tags = `Use at most ${FIELD_LIMITS.maxTags} tags.`;
  else if (v.tags.some((t) => t.length > FIELD_LIMITS.tag)) errors.tags = `Each tag must be ${FIELD_LIMITS.tag} characters or fewer.`;
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

// Details of an attachment on a bid (title, description, role).
export function validateAttachmentMeta(input) {
  const errors = {};
  const i = input || {};
  const v = { title: trim(i.title), description: trim(i.description), role: trim(i.role) || 'bid-document' };
  if (!v.title) errors.title = 'Enter a title.';
  checkLength(errors, 'title', v.title, FIELD_LIMITS.title, 'Title');
  checkLength(errors, 'description', v.description, FIELD_LIMITS.description, 'Description');
  if (!isRole(v.role)) errors.role = 'Choose a role.';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

// ---------- ordering and search ----------
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Submission date descending, undated last, stable ID tie-break.
export function sortBids(bids) {
  return [...bids].sort((a, b) => {
    const da = a.submissionDate || '';
    const db = b.submissionDate || '';
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? 1 : -1;
    }
    return byId(a, b);
  });
}

// Newest upload first, stable ID tie-break.
export function sortDocuments(docs) {
  return [...docs].sort((a, b) => {
    if (a.uploadedAt !== b.uploadedAt) return a.uploadedAt < b.uploadedAt ? 1 : -1;
    return byId(a, b);
  });
}

const norm = (s) => String(s ?? '').toLowerCase();
export function matchesBid(bid, query) {
  const q = norm(trim(query));
  return q === '' || norm(bid.title).includes(q) || norm(bid.funder).includes(q);
}
export function matchesDocument(doc, query) {
  const q = norm(trim(query));
  if (q === '') return true;
  return [doc.title, doc.filename, doc.description, ...(doc.tags || [])].some((s) => norm(s).includes(q));
}
