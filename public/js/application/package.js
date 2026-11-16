// The submission package: what would go out, its hash, and the immutable SubmissionSnapshot.
//
//   normaliseOutgoingAnswers(answers)   whitelisted, trimmed answers that would go out (pure)
//   sourceNotes(answers)                provenance, kept apart from the outgoing payload (pure)
//   preparePackage(input)               builds the proposal, reads the accounts bytes, validates the files and hashes
//                                       everything. Writes nothing.
//   freezeSnapshot(apps, prepared, ...) writes the snapshot and the copies of the attachments in ONE transaction
//
// The canonical form and the hash live in canonical.js (pure, no imports) so the server can import the same file.
import { OrgError } from '../org/db.js';
import { LIMITS as ORG_LIMITS } from '../org/validation.js';
import { newId } from '../org/repository.js';
import { ADAPTER_ID, PACKAGE_MODE, PACKAGE_SCHEMA, canonicalPackage, packageHash, sha256Hex } from './canonical.js';
import { FIELDS, isApplicable, outgoingValues, plainValues } from './schema.js';
import { BODY_SIZE, MAX_PAGES, PROPOSAL_FILENAME, ProposalError, buildProposal, readPdfPageCount } from './proposal.js';
import { PDF_MIME, validateTransferFile, validateTransferSet } from './transfer.js';
import { totalStoredBytes, capacityError, APPLICATION_STORE } from './repository.js';

export { ADAPTER_ID, PACKAGE_MODE, PACKAGE_SCHEMA, canonicalJson, canonicalPackage, packageHash, packagePayload, sha256Hex } from './canonical.js';
export const SNAPSHOT_SCHEMA = PACKAGE_SCHEMA;

// ---------------------------------------------------------------- outgoing answers
// Fields whose destination is internal-only (I) never go out; the accounts document is an attachment, not an answer
// (its local ID is not part of the hash). Everything else is whitelisted by this table, never by "all of the catalogue".
const EXCLUDED_IDS = new Set(['evidence.accountsId']);
export const OUTGOING_FIELD_IDS = Object.freeze(FIELDS.filter((f) => f.dest !== 'I' && !EXCLUDED_IDS.has(f.id)).map((f) => f.id));

const text = (s) => String(s).replace(/\r\n?/g, '\n').trim();
const trimmedOrOmit = (s) => (typeof s === 'string' && s.trim() !== '' ? text(s) : undefined);

function normaliseRows(rows, keys) {
  return rows.map((r) => {
    const out = { label: text(r.label ?? '') };
    for (const k of keys) out[k] = Number.isSafeInteger(r[k]) ? r[k] : null;
    out.note = trimmedOrOmit(r.note);
    return out;
  });
}

// { [fieldId]: value } for the fields that apply. An applicable field with no answer is null (kept); a field that does
// not apply, and an empty optional field, is omitted. Text is trimmed and uses \n line breaks. Money is integer pence.
export function normaliseOutgoingAnswers(answers) {
  const values = plainValues(answers);
  const all = outgoingValues(answers);
  const out = {};
  for (const fd of FIELDS) {
    if (!OUTGOING_FIELD_IDS.includes(fd.id)) continue;
    if (!isApplicable(fd, values)) continue;
    let v = all[fd.id];
    if (v === undefined) v = null;
    if (v === null && fd.required === false) continue;
    if (typeof v === 'string') v = text(v);
    if (v === '' && fd.required === false) continue;
    if (fd.type === 'rows-income') v = Array.isArray(v) ? normaliseRows(v, ['targetPence', 'securedPence']) : null;
    else if (fd.type === 'rows-expense') v = Array.isArray(v) ? normaliseRows(v, ['amountPence']) : null;
    out[fd.id] = v;
  }
  return out;
}

// For each included field: where it came from. Complete provenance stays local; it is not part of the hash.
export function sourceNotes(answers) {
  const included = Object.keys(normaliseOutgoingAnswers(answers));
  return included.map((id) => {
    const a = answers && answers[id];
    const fd = FIELDS.find((f) => f.id === id);
    return {
      fieldId: id,
      label: fd ? fd.label : id,
      origin: a ? a.origin : null,
      confirmed: !!(a && a.confirmedAt),
      sources: ((a && a.sourceRefs) || []).map((r) => ({
        kind: r.kind, title: r.title || null, updatedAt: r.updatedAt || null, reportingPeriod: r.reportingPeriod || null,
        locator: r.locator || null, excerpt: r.excerpt || null, synthetic: !!r.synthetic,
      })),
    };
  });
}

// ---------------------------------------------------------------- preparing
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

export class PackageBlocked extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PackageBlocked';
    this.code = code;
    Object.assign(this, details);
  }
}

// input: { answers, application ({ proposalReplacement? }), catalogue, getBlob(id) -> Blob|null, evaluation }
// Resolves a prepared package:
//   { normalised, attachments: [{ role, filename, mime, size, sha256, bytes, source, sourceId, sourceVersion, synthetic, generated, managerChecked?, pageCount? }],
//     payloadHash, canonical, proposal: { source, pageCount, ... } }
// Rejects with PackageBlocked (message safe to show) or ProposalError. Nothing is written.
export async function preparePackage({ answers, application, catalogue, getBlob, evaluation }) {
  if (!evaluation || !evaluation.ready) throw new PackageBlocked('not-ready', 'The package can only be prepared when every applicable answer is present and confirmed.');
  const values = outgoingValues(answers);

  // proposal: the manager's own PDF (only once confirmed), or the generated one
  let proposal;
  const rep = application && application.proposalReplacement;
  if (rep) {
    if (!rep.managerChecked) throw new PackageBlocked('replacement-unchecked', 'Your own proposal PDF has not been confirmed. Confirm its page count, text size and layout, or go back to the generated proposal.');
    const bytes = await bytesOf(rep.blob);
    proposal = { role: 'proposal', filename: rep.filename, mime: PDF_MIME, bytes, source: 'replacement', sourceId: null, sourceVersion: rep.sha256, synthetic: false, generated: false, managerChecked: true, pageCount: rep.pageCount };
  } else {
    const built = await buildProposal(answers); // ProposalError blocks here
    proposal = { role: 'proposal', filename: PROPOSAL_FILENAME, mime: PDF_MIME, bytes: built.bytes, source: 'generated', sourceId: null, sourceVersion: null, synthetic: built.synthetic, generated: true, managerChecked: false, pageCount: built.pageCount };
  }

  // accounts: a stored PDF or DOCX, copied exactly as stored
  const accountsId = values['evidence.accountsId'];
  const doc = accountsId && ((catalogue && catalogue.documents) || []).find((d) => d.id === accountsId);
  if (!doc) throw new PackageBlocked('accounts-missing', 'The selected accounts document is no longer stored. Choose another one in the Documents section.');
  const blob = await getBlob(doc.id);
  if (!blob) throw new PackageBlocked('accounts-missing', `The stored file for "${doc.title}" could not be read. Choose the document again in the Documents section.`);
  const accounts = {
    role: 'accounts', filename: doc.filename, mime: doc.mime, bytes: await bytesOf(blob), source: 'document', sourceId: doc.id, sourceVersion: doc.updatedAt || null,
    synthetic: !!(doc.synthetic || (doc.tags || []).includes('synthetic-accounts-example')), generated: false,
  };

  const files = [proposal, accounts];
  const check = validateTransferSet(files);
  if (!check.ok) throw new PackageBlocked('files', check.errors.map((e) => e.message).join(' '), { errors: check.errors });

  const attachments = [];
  for (const f of files) attachments.push({ ...f, size: f.bytes.length, sha256: await sha256Hex(f.bytes) });
  const normalised = normaliseOutgoingAnswers(answers);
  const input = { answers: normalised, attachments, adapter: ADAPTER_ID };
  return {
    normalised,
    attachments,
    payloadHash: await packageHash(input),
    canonical: canonicalPackage(input),
    proposal: { source: proposal.source, pageCount: proposal.pageCount, filename: proposal.filename, synthetic: proposal.synthetic },
  };
}

// ---------------------------------------------------------------- manager-supplied proposal PDF
// file: a File. Resolves a replacement record for apps.setProposalReplacement (managerChecked is false until the manager
// confirms). Rejects with PackageBlocked. A file is NEVER called format-verified: only the page count is read.
export async function inspectReplacementProposal(file) {
  const name = String((file && file.name) ?? '');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = validateTransferFile({ role: 'proposal', filename: name, mime: file.type === '' || file.type === 'application/octet-stream' ? PDF_MIME : file.type, bytes });
  if (!r.ok) throw new PackageBlocked(`replacement-${r.code}`, r.message);
  let pageCount;
  try {
    pageCount = await readPdfPageCount(bytes);
  } catch (e) {
    throw new PackageBlocked('replacement-unreadable', e instanceof ProposalError ? e.message : `"${name}" could not be read as a PDF.`);
  }
  if (pageCount > MAX_PAGES) throw new PackageBlocked('replacement-too-long', `"${name}" has ${pageCount} pages. A proposal can have at most ${MAX_PAGES}.`);
  return {
    filename: name, mime: PDF_MIME, size: bytes.length, sha256: await sha256Hex(bytes), pageCount,
    managerChecked: false, checkedAt: null, blob: new Blob([bytes], { type: PDF_MIME }),
  };
}
export const REPLACEMENT_CHECK_TEXT = (pageCount) => `I have checked this PDF: it has ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}, the text is at least ${BODY_SIZE} points and the layout is readable.`;

// ---------------------------------------------------------------- freezing
// Writes the SubmissionSnapshot and the copies of the outgoing attachments in ONE readwrite transaction.
//
// Everything slow (building, reading blobs, SHA-256) happened in preparePackage BEFORE this opens a transaction, so the
// transaction contains only IndexedDB requests. At commit it re-reads the draft revision, the manager's replacement
// proposal and the accounts document's version, and aborts with `conflict` / `source-changed` if any differ from what was
// hashed. It also counts the copies against the shared 100 MiB budget.
//
// ctx: { application: { id, grantId, draftRevision }, answers (the full answer set, for origins and source notes),
//        confirmations: { reviewedAt, transferAt }, capturedAt }
// Resolves { snapshot, created }. If a snapshot with the same hash already exists for this application it is returned
// unchanged (created: false), so reviewing the same package twice never makes a duplicate.
export function freezeSnapshot(apps, prepared, ctx) {
  const id = newId();
  const files = prepared.attachments.map((a, i) => ({
    id: newId(), snapshotId: id, order: i, role: a.role, filename: a.filename, mime: a.mime, size: a.size, sha256: a.sha256,
    blob: new Blob([a.bytes], { type: a.mime }),
  }));
  const origins = {};
  for (const fid of Object.keys(prepared.normalised)) origins[fid] = ctx.answers[fid] ? ctx.answers[fid].origin : null;
  const snapshot = {
    id,
    applicationId: ctx.application.id,
    grantId: ctx.application.grantId,
    revision: ctx.application.draftRevision,
    mode: PACKAGE_MODE,
    schema: PACKAGE_SCHEMA,
    adapter: ADAPTER_ID,
    capturedAt: ctx.capturedAt,
    answers: prepared.normalised,
    origins,
    attachments: prepared.attachments.map((a, i) => ({
      role: a.role, filename: a.filename, mime: a.mime, size: a.size, sha256: a.sha256, fileId: files[i].id,
      source: a.source, sourceId: a.sourceId, sourceVersion: a.sourceVersion, synthetic: !!a.synthetic, generated: !!a.generated,
      ...(a.managerChecked ? { managerChecked: true } : {}), ...(Number.isInteger(a.pageCount) ? { pageCount: a.pageCount } : {}),
    })),
    sourceNotes: sourceNotes(ctx.answers),
    proposal: { source: prepared.proposal.source, pageCount: prepared.proposal.pageCount },
    confirmations: { reviewedAt: ctx.confirmations.reviewedAt, transferAt: ctx.confirmations.transferAt },
    payloadHash: prepared.payloadHash,
  };
  const newBytes = files.reduce((n, f) => n + f.size, 0);
  const accounts = prepared.attachments.find((a) => a.role === 'accounts');
  const replacement = prepared.attachments.find((a) => a.source === 'replacement');

  return apps.transact([APPLICATION_STORE, 'documents', 'submissionSnapshots', 'submissionFiles'], 'readwrite', 'freezeSnapshot', (c) => {
    const st = c.stores;
    const got = {};
    let pending = 6;
    const next = () => { if (--pending === 0) write(); };
    c.on(st[APPLICATION_STORE].get(ctx.application.id), (v) => { got.app = v; next(); });
    c.on(st[APPLICATION_STORE].getAll(), (v) => { got.apps = v; next(); });
    c.on(st.documents.get(accounts.sourceId), (v) => { got.doc = v; next(); });
    c.on(st.documents.getAll(), (v) => { got.docs = v; next(); });
    c.on(st.submissionFiles.getAll(), (v) => { got.files = v; next(); });
    c.on(st.submissionSnapshots.index('applicationId').getAll(ctx.application.id), (v) => { got.snaps = v; next(); });

    function write() {
      const app = got.app;
      if (!app) { c.fail(new OrgError('not-found')); return; }
      if (app.draftRevision !== ctx.application.draftRevision) { c.fail(new OrgError('conflict', 'This application changed in another tab or window since this review was prepared. Nothing was saved. Open the review again.', { currentRevision: app.draftRevision })); return; }
      if (replacement && !(app.proposalReplacement && app.proposalReplacement.sha256 === replacement.sha256 && app.proposalReplacement.managerChecked)) { c.fail(new OrgError('source-changed')); return; }
      if (!replacement && app.proposalReplacement) { c.fail(new OrgError('source-changed')); return; }
      if (!got.doc || (got.doc.updatedAt || null) !== (accounts.sourceVersion || null) || got.doc.size !== accounts.size) { c.fail(new OrgError('source-changed')); return; }
      const existing = got.snaps.find((s) => s.payloadHash === prepared.payloadHash);
      if (existing) { c.done({ snapshot: existing, created: false }); return; }
      const used = totalStoredBytes(got.docs, got.files, got.apps);
      if (used + newBytes > ORG_LIMITS.maxTotalBytes) { c.fail(capacityError(used, newBytes)); return; }
      st.submissionSnapshots.add(snapshot); // add, never put: an existing record can never be overwritten
      for (const f of files) st.submissionFiles.add(f);
      st[APPLICATION_STORE].put({ ...app, lastSnapshotId: id }); // revision and updatedAt unchanged: only the pointer moves
      c.afterWrites();
      c.done({ snapshot, created: true });
    }
  });
}

// What a frozen snapshot hashes to, recomputed from its own stored fields and its stored file copies.
// Used to prove a snapshot (and its attachment bytes) is exactly what was reviewed, after a reload.
export async function verifySnapshot(apps, snapshotId) {
  const snap = await apps.getSnapshot(snapshotId);
  if (!snap) return { ok: false, reason: 'missing' };
  const files = await apps.getSnapshotFiles(snapshotId);
  const attachments = [];
  for (const f of files) {
    const sha256 = await sha256Hex(await bytesOf(f.blob));
    attachments.push({ role: f.role, filename: f.filename, mime: f.mime, size: f.blob.size, sha256 });
  }
  const hash = await packageHash({ answers: snap.answers, attachments, adapter: snap.adapter });
  return { ok: hash === snap.payloadHash, hash, expected: snap.payloadHash, attachments };
}
