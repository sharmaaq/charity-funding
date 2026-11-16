// Strict validation of a demo-run manifest (spec section 8) and of the bytes that arrive with it.
//
// The rules come from the same browser modules the manager's review used, so the two sides cannot drift:
//   schema.js     field table, per-value validation, applicability
//   canonical.js  canonical JSON and the package hash
//   transfer.js   which files may go into a demo transfer
//   package.js    the whitelist of outgoing fields
// Everything here runs BEFORE any browser starts.
import { FIELDS, LIMITS, fieldById, isApplicable, validateValue, isRealDate, daysBetween, financeTotals, MAJOR_GRANTS_MESSAGE } from '../public/js/application/schema.js';
import { ADAPTER_ID, PACKAGE_SCHEMA, packageHash, sha256Hex } from '../public/js/application/canonical.js';
import { validateTransferFile, validateTransferSet } from '../public/js/application/transfer.js';
import { OUTGOING_FIELD_IDS } from '../public/js/application/package.js';

export const MANIFEST_KEYS = Object.freeze(['schemaVersion', 'adapterId', 'applicationId', 'snapshotId', 'draftRevision', 'attemptId', 'mode', 'syntheticApplicant', 'answers', 'attachments', 'payloadHash', 'review']);
const ATTACHMENT_KEYS = ['role', 'filename', 'mimeType', 'sizeBytes', 'sha256', 'synthetic'];
const REVIEW_KEYS = ['demoReviewed', 'demoTransfer', 'reviewedPayloadHash'];
const INCOME_ROW_KEYS = ['label', 'targetPence', 'securedPence', 'note'];
const EXPENSE_ROW_KEYS = ['label', 'amountPence', 'note'];
export const MAX_ROWS = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
export const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);
const isHash = (s) => typeof s === 'string' && HASH_RE.test(s);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const OUTGOING = new Set(OUTGOING_FIELD_IDS);
const STRING_TYPES = new Set(['text', 'textarea', 'date', 'email', 'phone', 'url', 'enum', 'yesno']);

export class ManifestError extends Error {
  constructor(status, code, message, fieldErrors = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
  toJSON() {
    return { code: this.code, message: this.message, fieldErrors: this.fieldErrors, retryable: false };
  }
}
const malformed = (message) => new ManifestError(400, 'MALFORMED', message);

function exactKeys(obj, keys, where, { optional = [] } = {}) {
  const extra = Object.keys(obj).filter((k) => !keys.includes(k));
  if (extra.length) throw malformed(`${where} has unexpected keys: ${extra.join(', ')}.`);
  const missing = keys.filter((k) => !optional.includes(k) && !Object.prototype.hasOwnProperty.call(obj, k));
  if (missing.length) throw malformed(`${where} is missing: ${missing.join(', ')}.`);
}

// "org.name" -> answers.org.name. Every outgoing ID has exactly one dot.
export function nestAnswers(flat) {
  const out = {};
  for (const [id, v] of Object.entries(flat)) {
    const [a, b] = id.split('.');
    (out[a] ||= {})[b] = v;
  }
  return out;
}

function flattenAnswers(nested) {
  if (!isPlain(nested)) throw malformed('answers must be an object.');
  const flat = {};
  for (const [a, group] of Object.entries(nested)) {
    if (!isPlain(group)) throw malformed(`answers.${a} must be an object.`);
    for (const [b, v] of Object.entries(group)) {
      const id = `${a}.${b}`;
      if (!OUTGOING.has(id)) throw new ManifestError(422, 'UNKNOWN_FIELD', 'The package contains a field this adapter does not accept.', [{ path: id, code: 'UNKNOWN_FIELD', message: 'This field is not part of the demo application.' }]);
      if (v === undefined) continue;
      flat[id] = v;
    }
  }
  return flat;
}

function checkRows(id, rows, keys, amountKeys) {
  if (!Array.isArray(rows)) return 'must be a list of rows';
  if (rows.length > MAX_ROWS) return `can have at most ${MAX_ROWS} rows`;
  for (const [i, r] of rows.entries()) {
    if (!isPlain(r)) return `row ${i + 1} is not an object`;
    const extra = Object.keys(r).filter((k) => !keys.includes(k));
    if (extra.length) return `row ${i + 1} has unexpected keys`;
    if (typeof r.label !== 'string') return `row ${i + 1} needs a text label`;
    if (r.note !== undefined && typeof r.note !== 'string') return `row ${i + 1} note must be text`;
    for (const k of amountKeys) if (!Number.isSafeInteger(r[k])) return `row ${i + 1} ${k} must be a whole number of pence`;
  }
  return null;
}

// Types first (validateValue assumes them), then the same value rules as the browser, then applicability and the
// cross-field rules evaluate() applies. Unknown is never accepted: the browser would show it as Needs review.
export function validateAnswers(flat) {
  const errors = [];
  const add = (path, code, message) => errors.push({ path, code, message });
  for (const [id, v] of Object.entries(flat)) {
    const fd = fieldById(id);
    if (v === null) continue;
    if (STRING_TYPES.has(fd.type) && typeof v !== 'string') add(id, 'TYPE', 'must be text');
    else if ((fd.type === 'money' || fd.type === 'integer') && !Number.isSafeInteger(v)) add(id, 'TYPE', 'must be a whole number');
    else if (fd.type === 'rows-income' || fd.type === 'rows-expense') {
      const msg = fd.type === 'rows-income' ? checkRows(id, v, INCOME_ROW_KEYS, ['targetPence', 'securedPence']) : checkRows(id, v, EXPENSE_ROW_KEYS, ['amountPence']);
      if (msg) add(id, 'TYPE', msg);
    }
  }
  if (errors.length) return errors;

  // request.amountMode is preparation-only and never goes out; the amount's presence says which mode was chosen.
  const values = { ...flat, 'request.amountMode': flat['request.amountPence'] !== undefined && flat['request.amountPence'] !== null ? 'specified' : 'discretion' };
  for (const fd of FIELDS) {
    if (!OUTGOING.has(fd.id)) continue;
    const v = flat[fd.id];
    const present = v !== undefined && v !== null && v !== '';
    const applicable = isApplicable(fd, values);
    if (!applicable) { if (present) add(fd.id, 'NOT_APPLICABLE', 'is not applicable to the other answers'); continue; }
    if (!present) { if (fd.required !== false) add(fd.id, 'REQUIRED', 'needs an answer'); continue; }
    if (v === 'unknown') { add(fd.id, 'UNKNOWN_ANSWER', 'is still "not sure"; a known answer is required'); continue; }
    if (fd.fixed && fd.id === 'request.type' && v !== 'core') add(fd.id, 'UNSUPPORTED', 'only core funding is supported');
    const res = validateValue(fd, v, null, values);
    for (const m of res.errors) add(fd.id, fd.id === 'request.amountPence' && m === MAJOR_GRANTS_MESSAGE ? 'REGULAR_LIMIT' : 'INVALID', m);
  }
  const period = (s, e, what) => {
    if (!isRealDate(flat[s]) || !isRealDate(flat[e])) return;
    const d = daysBetween(flat[s], flat[e]);
    if (d <= 0) add(e, 'PERIOD', `the ${what} must end after it starts`);
    else if (d + 1 > LIMITS.maxPeriodDays) add(e, 'PERIOD', `the ${what} can be at most ${LIMITS.maxPeriodDays} days`);
  };
  period('request.start', 'request.end', 'funding period');
  period('finance.forecastStart', 'finance.forecastEnd', 'forecast period');
  const fin = financeTotals(flat['finance.incomeRows'], flat['finance.expenseRows']);
  if (Number.isSafeInteger(flat['request.amountPence']) && fin.complete && flat['request.amountPence'] > fin.gapPence) {
    add('request.amountPence', 'OVER_GAP', 'the request is more than the current unsecured gap');
  }
  return errors;
}

// text: the manifest part as UTF-8 text. headers: { idempotencyKey, schema }.
// Resolves { manifest, flat } or throws ManifestError. Does not look at file bytes.
export function parseManifest(text, headers) {
  let m;
  try { m = JSON.parse(text); } catch { throw malformed('The manifest is not valid JSON.'); }
  if (!isPlain(m)) throw malformed('The manifest must be a JSON object.');
  exactKeys(m, MANIFEST_KEYS, 'The manifest');
  if (m.mode !== 'demo') throw new ManifestError(400, 'MODE_NOT_SUPPORTED', 'Only demo runs are accepted. Live submission is not available.');
  if (m.schemaVersion !== PACKAGE_SCHEMA || headers.schema !== PACKAGE_SCHEMA) throw malformed(`Schema must be ${PACKAGE_SCHEMA} in both the manifest and the X-Submission-Schema header.`);
  if (m.adapterId !== ADAPTER_ID) throw new ManifestError(400, 'UNKNOWN_ADAPTER', 'This adapter is not available.');
  for (const k of ['applicationId', 'snapshotId', 'attemptId']) if (!isUuid(m[k])) throw malformed(`${k} must be a lower-case UUID.`);
  if (headers.idempotencyKey !== m.attemptId) throw malformed('The Idempotency-Key header must equal attemptId.');
  if (!Number.isSafeInteger(m.draftRevision) || m.draftRevision < 1) throw malformed('draftRevision must be a positive whole number.');
  if (m.syntheticApplicant !== true) throw new ManifestError(422, 'SYNTHETIC_ONLY', 'The demo accepts only the synthetic demo applicant.');
  if (!isHash(m.payloadHash)) throw malformed('payloadHash must be 64 lower-case hexadecimal characters.');
  if (!isPlain(m.review)) throw malformed('review must be an object.');
  exactKeys(m.review, REVIEW_KEYS, 'review');
  if (m.review.demoReviewed !== true || m.review.demoTransfer !== true) throw new ManifestError(422, 'NOT_CONFIRMED', 'Both demo confirmations are required.');
  if (m.review.reviewedPayloadHash !== m.payloadHash) throw new ManifestError(409, 'HASH_CONFLICT', 'The reviewed package hash does not match this package.');
  if (!Array.isArray(m.attachments) || m.attachments.length !== 2) throw malformed('attachments must list exactly the proposal and the accounts.');
  m.attachments.forEach((a, i) => {
    if (!isPlain(a)) throw malformed(`attachments[${i}] must be an object.`);
    exactKeys(a, ATTACHMENT_KEYS, `attachments[${i}]`);
    if (typeof a.filename !== 'string' || a.filename.length === 0 || a.filename.length > 255 || typeof a.mimeType !== 'string' || !Number.isSafeInteger(a.sizeBytes) || !isHash(a.sha256) || typeof a.synthetic !== 'boolean') {
      throw malformed(`attachments[${i}] has a missing or wrongly typed value.`);
    }
  });
  if (m.attachments[0].role !== 'proposal' || m.attachments[1].role !== 'accounts') throw malformed('attachments must be the proposal, then the accounts.');
  const flat = flattenAnswers(m.answers);
  const fieldErrors = validateAnswers(flat);
  if (fieldErrors.length) throw new ManifestError(422, 'VALIDATION_FAILED', 'Review the highlighted fields.', fieldErrors);
  return { manifest: m, flat };
}

// files: { proposal: { filename, mimeType, bytes }, accounts: {...} }. Checks the bytes against the manifest and
// recomputes the package hash from what actually arrived. Throws ManifestError.
export async function verifyFiles(manifest, flat, files) {
  const set = [];
  for (const a of manifest.attachments) {
    const f = files[a.role];
    if (!f) throw malformed(`The ${a.role} file is missing.`);
    if (f.filename !== a.filename || f.mimeType !== a.mimeType) throw malformed(`The ${a.role} file name or type does not match the manifest.`);
    const check = validateTransferFile({ role: a.role, filename: f.filename, mime: f.mimeType, bytes: f.bytes });
    if (!check.ok) throw new ManifestError(check.code === 'too-large' ? 413 : 415, 'UNSUPPORTED_FILE', check.message);
    set.push({ role: a.role, filename: f.filename, mime: f.mimeType, bytes: f.bytes });
  }
  const total = validateTransferSet(set);
  if (!total.ok) throw new ManifestError(413, 'TOO_LARGE', total.errors.map((e) => e.message).join(' '));
  const attachments = [];
  for (const [i, a] of manifest.attachments.entries()) {
    const bytes = files[a.role].bytes;
    const sha = await sha256Hex(bytes);
    if (bytes.length !== a.sizeBytes || sha !== a.sha256) throw new ManifestError(422, 'FILE_HASH_MISMATCH', `The ${a.role} bytes do not match the reviewed package.`, [{ path: `attachments[${i}]`, code: 'FILE_HASH_MISMATCH', message: 'size or SHA-256 differs' }]);
    attachments.push({ role: a.role, filename: a.filename, mime: a.mimeType, size: bytes.length, sha256: sha });
  }
  const hash = await packageHash({ answers: flat, attachments, adapter: manifest.adapterId });
  if (hash !== manifest.payloadHash) throw new ManifestError(422, 'PAYLOAD_HASH_MISMATCH', 'The package hash recomputed by the server does not match the reviewed package.');
  return attachments;
}
