// Applications, frozen submission snapshots, attempts and demo receipts for one charity.
// The IndexedDB transactions of the browser app are now Firestore (or in-memory) transactions here, with the same rules:
// the optimistic draftRevision check, immutable snapshots (records are only ever added), the attempt lock, and one
// receipt per attempt.
import { randomUUID } from 'node:crypto';
import { ServiceError } from '../errors.js';
import { LIMITS } from '../../public/js/org/validation.js';
import { ADAPTER_ID, PACKAGE_MODE, PACKAGE_SCHEMA, packageHash, sha256Hex } from '../../public/js/application/canonical.js';
import { SCHEMA_VERSION } from '../../public/js/application/schema.js';
import { capacityError, totalStoredBytes } from './org.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
// Firestore documents are limited to 1 MiB; leave headroom for the other fields.
const MAX_DOC_JSON = 900 * 1024;
const jsonSize = (v) => Buffer.byteLength(JSON.stringify(v));
const byCaptured = (a, b) => (a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : a.id < b.id ? -1 : 1);

// options: { now, limits }
export function createApplicationService(store, options = {}) {
  const now = options.now || (() => new Date());
  const limits = { ...LIMITS, ...(options.limits || {}) };
  const newId = () => randomUUID();
  const txUsed = async (tx, exceptAppId = null) => {
    const apps = await tx.list('applications');
    return totalStoredBytes(await tx.list('documents'), await tx.list('submissionFiles'), apps.filter((a) => a.id !== exceptAppId));
  };

  const svc = {
    async list(cid) { return store.list(cid, 'applications'); },
    async get(cid, id) { return (await store.get(cid, 'applications', id)) || null; },
    async getByGrant(cid, grantId) { return (await store.list(cid, 'applications')).find((a) => a.grantId === grantId) || null; },

    // The existing application for the grant, or a new one with `initialAnswers`: at most one draft per grant.
    async getOrCreate(cid, grantId, initialAnswers) {
      if (typeof grantId !== 'string' || !(await store.get(cid, 'opportunities', grantId))) throw new ServiceError('not-found');
      if (initialAnswers !== undefined && !isObj(initialAnswers)) throw new ServiceError('invalid', 'The starting answers are not in the expected format.');
      if (jsonSize(initialAnswers || {}) > MAX_DOC_JSON) throw new ServiceError('invalid', 'The answers are too large to save.');
      const stamp = now().toISOString();
      return store.tx(cid, async (tx) => {
        const existing = (await tx.list('applications')).find((a) => a.grantId === grantId);
        if (existing) return { application: existing, created: false };
        const record = { id: newId(), grantId, schemaVersion: SCHEMA_VERSION, draftRevision: 1, answers: initialAnswers || {}, createdAt: stamp, updatedAt: stamp, lastSnapshotId: null };
        tx.add('applications', record.id, record);
        return { application: record, created: true };
      });
    },

    // Optimistic save: succeeds only when the stored draftRevision is still `expectedRevision`.
    async save(cid, id, { expectedRevision, answers }) {
      if (!isObj(answers)) throw new ServiceError('invalid', 'The answers could not be saved because they are not in the expected format.');
      if (jsonSize(answers) > MAX_DOC_JSON) throw new ServiceError('invalid', 'The answers are too large to save.');
      const stamp = now().toISOString();
      return store.tx(cid, async (tx) => {
        const cur = await tx.get('applications', id);
        if (!cur) throw new ServiceError('not-found');
        if (cur.draftRevision !== expectedRevision) throw new ServiceError('conflict', 'This application was changed in another tab or window since you opened it.', { currentRevision: cur.draftRevision });
        const next = { ...cur, answers, draftRevision: cur.draftRevision + 1, updatedAt: stamp };
        tx.set('applications', id, next);
        return next;
      });
    },

    // replacement: { filename, mime, size, sha256, pageCount, managerChecked, checkedAt } plus `bytes`, or null to remove it.
    async setProposalReplacement(cid, id, { expectedRevision, replacement, bytes }) {
      const stamp = now().toISOString();
      let fileId = null;
      let meta = null;
      if (replacement && !bytes) {
        // Metadata only (the manager ticks or unticks "I have checked this PDF"): the stored file and its hash stay.
        return store.tx(cid, async (tx) => {
          const cur = await tx.get('applications', id);
          if (!cur) throw new ServiceError('not-found');
          if (cur.draftRevision !== expectedRevision) throw new ServiceError('conflict', 'This application was changed in another tab or window since you opened it.', { currentRevision: cur.draftRevision });
          const rep = cur.proposalReplacement;
          if (!rep || rep.sha256 !== replacement.sha256) throw new ServiceError('invalid', 'There is no stored proposal file to update.');
          const next = { ...cur, draftRevision: cur.draftRevision + 1, updatedAt: stamp, proposalReplacement: { ...rep, managerChecked: replacement.managerChecked === true, checkedAt: replacement.managerChecked === true ? (replacement.checkedAt || stamp) : null } };
          tx.set('applications', id, next);
          return next;
        });
      }
      if (replacement) {
        if (!bytes || !bytes.length || bytes.length !== replacement.size) throw new ServiceError('invalid', 'The proposal file is missing or its size does not match.');
        if (!HASH_RE.test(String(replacement.sha256)) || (await sha256Hex(bytes)) !== replacement.sha256) throw new ServiceError('invalid', 'The proposal file does not match its checksum.');
        fileId = newId();
        meta = {
          filename: String(replacement.filename), mime: 'application/pdf', size: bytes.length, sha256: replacement.sha256,
          pageCount: Number.isInteger(replacement.pageCount) ? replacement.pageCount : null,
          managerChecked: replacement.managerChecked === true, checkedAt: replacement.checkedAt || null, fileId,
        };
        await store.files.put(cid, 'submission-files', fileId, bytes, 'application/pdf');
      }
      let previousFileId = null;
      try {
        const updated = await store.tx(cid, async (tx) => {
          const cur = await tx.get('applications', id);
          if (!cur) throw new ServiceError('not-found');
          if (cur.draftRevision !== expectedRevision) throw new ServiceError('conflict', 'This application was changed in another tab or window since you opened it.', { currentRevision: cur.draftRevision });
          if (meta) {
            const used = await txUsed(tx, id);
            if (used + meta.size > limits.maxTotalBytes) throw capacityError(used, meta.size, limits.maxTotalBytes);
          }
          previousFileId = cur.proposalReplacement ? cur.proposalReplacement.fileId : null;
          const next = { ...cur, draftRevision: cur.draftRevision + 1, updatedAt: stamp };
          if (meta) next.proposalReplacement = meta; else delete next.proposalReplacement;
          tx.set('applications', id, next);
          return next;
        });
        if (previousFileId) await store.files.delete(cid, 'submission-files', previousFileId);
        return updated;
      } catch (e) {
        if (fileId) await store.files.delete(cid, 'submission-files', fileId);
        throw e;
      }
    },

    async getProposalReplacementFile(cid, id) {
      const app = await store.get(cid, 'applications', id);
      if (!app || !app.proposalReplacement) return null;
      const f = await store.files.get(cid, 'submission-files', app.proposalReplacement.fileId);
      return f ? { bytes: f.bytes, mime: 'application/pdf', filename: app.proposalReplacement.filename } : null;
    },

    // ---------------------------------------------------------------- snapshots
    async getSnapshot(cid, id) { return (await store.get(cid, 'submissionSnapshots', id)) || null; },
    async listSnapshots(cid, applicationId) { return (await store.list(cid, 'submissionSnapshots')).filter((s) => s.applicationId === applicationId).sort(byCaptured); },
    async getSnapshotFiles(cid, snapshotId) { return (await store.list(cid, 'submissionFiles')).filter((f) => f.snapshotId === snapshotId).sort((a, b) => (a.order || 0) - (b.order || 0)); },
    async getSnapshotFile(cid, snapshotId, fileId) {
      const rec = await store.get(cid, 'submissionFiles', fileId);
      if (!rec || rec.snapshotId !== snapshotId) return null;
      const f = await store.files.get(cid, 'submission-files', fileId);
      return f ? { rec, bytes: f.bytes } : null;
    },

    // Writes the SubmissionSnapshot and the copies of the outgoing attachments in ONE transaction. Records are added,
    // never overwritten. At commit it re-reads the draft revision, the manager's replacement proposal and the accounts
    // document's version, and rejects with `conflict` / `source-changed` if any differ from what was hashed.
    // input: { snapshot, files: [{ bytes }] } in the same order as snapshot.attachments.
    async freezeSnapshot(cid, applicationId, { snapshot, files }) {
      if (!isObj(snapshot) || !Array.isArray(files) || !Array.isArray(snapshot.attachments) || files.length !== snapshot.attachments.length || files.length === 0) throw new ServiceError('invalid', 'The package is not in the expected format.');
      if (snapshot.applicationId !== applicationId || !UUID_RE.test(String(snapshot.id)) || !isObj(snapshot.answers) || snapshot.schema !== PACKAGE_SCHEMA || snapshot.mode !== PACKAGE_MODE || snapshot.adapter !== ADAPTER_ID) throw new ServiceError('invalid', 'The package is not in the expected format.');
      if (jsonSize(snapshot) > MAX_DOC_JSON) throw new ServiceError('invalid', 'The package is too large to save.');
      // The server recomputes every checksum and the package hash from the bytes it was sent.
      const hashed = [];
      for (let i = 0; i < files.length; i++) {
        const a = snapshot.attachments[i];
        if (!isObj(a) || !UUID_RE.test(String(a.fileId)) || files[i].bytes.length !== a.size || (await sha256Hex(files[i].bytes)) !== a.sha256) throw new ServiceError('invalid', 'A package file does not match its checksum.');
        hashed.push({ role: a.role, filename: a.filename, mime: a.mime, size: a.size, sha256: a.sha256 });
      }
      let recomputed;
      try { recomputed = await packageHash({ answers: snapshot.answers, attachments: hashed, adapter: snapshot.adapter }); } catch { recomputed = null; }
      if (recomputed !== snapshot.payloadHash) throw new ServiceError('invalid', 'The package hash does not match its contents.');

      const records = snapshot.attachments.map((a, i) => ({ id: a.fileId, snapshotId: snapshot.id, order: i, role: a.role, filename: a.filename, mime: a.mime, size: a.size, sha256: a.sha256 }));
      const newBytes = records.reduce((n, f) => n + f.size, 0);
      const accounts = snapshot.attachments.find((a) => a.role === 'accounts');
      const replacement = snapshot.attachments.find((a) => a.source === 'replacement');
      for (const [i, f] of files.entries()) await store.files.put(cid, 'submission-files', records[i].id, f.bytes, records[i].mime);
      let result;
      try {
        result = await store.tx(cid, async (tx) => {
          const app = await tx.get('applications', applicationId);
          const doc = accounts ? await tx.get('documents', accounts.sourceId) : undefined;
          const snaps = (await tx.list('submissionSnapshots')).filter((s) => s.applicationId === applicationId);
          const used = await txUsed(tx);
          if (!app) throw new ServiceError('not-found');
          if (app.draftRevision !== snapshot.revision) throw new ServiceError('conflict', 'This application changed in another tab or window since this review was prepared. Nothing was saved. Open the review again.', { currentRevision: app.draftRevision });
          if (replacement && !(app.proposalReplacement && app.proposalReplacement.sha256 === replacement.sha256 && app.proposalReplacement.managerChecked)) throw new ServiceError('source-changed');
          if (!replacement && app.proposalReplacement) throw new ServiceError('source-changed');
          if (accounts && (!doc || (doc.updatedAt || null) !== (accounts.sourceVersion || null) || doc.size !== accounts.size)) throw new ServiceError('source-changed');
          const existing = snaps.find((s) => s.payloadHash === snapshot.payloadHash);
          if (existing) return { snapshot: existing, created: false };
          if (used + newBytes > limits.maxTotalBytes) throw capacityError(used, newBytes, limits.maxTotalBytes);
          tx.add('submissionSnapshots', snapshot.id, snapshot);
          for (const f of records) tx.add('submissionFiles', f.id, f);
          tx.set('applications', applicationId, { ...app, lastSnapshotId: snapshot.id }); // revision and updatedAt unchanged: only the pointer moves
          return { snapshot, created: true };
        });
      } catch (e) {
        for (const f of records) await store.files.delete(cid, 'submission-files', f.id);
        throw e;
      }
      if (!result.created) for (const f of records) await store.files.delete(cid, 'submission-files', f.id);
      return result;
    },

    // ---------------------------------------------------------------- attempts and receipts
    // ONE transaction checks that this snapshot has no receipt and no running attempt, then writes a running attempt.
    async acquireAttempt(cid, { applicationId, snapshotId, payloadHash, retryId = null }, startedBy = null) {
      const stamp = now().toISOString();
      if (!(await svc.getSnapshot(cid, snapshotId))) throw new ServiceError('not-found');
      return store.tx(cid, async (tx) => {
        const attempts = (await tx.list('submissionAttempts')).filter((a) => a.snapshotId === snapshotId);
        const receipts = (await tx.list('submissionReceipts')).filter((r) => r.applicationId === applicationId);
        if (receipts.some((r) => r.snapshotId === snapshotId)) throw new ServiceError('already-submitted', 'This exact package already has a demo receipt. Change an answer or a file to prepare a new package.');
        if (attempts.some((a) => a.state === 'running')) throw new ServiceError('attempt-active', 'A demo run for this package is already in progress, possibly in another tab.');
        let attempt;
        if (retryId) {
          const prev = attempts.find((a) => a.id === retryId);
          if (!prev || !['interrupted_unknown', 'failed', 'cancelled'].includes(prev.state)) throw new ServiceError('not-found', 'That attempt cannot be retried.');
          attempt = { ...prev, state: 'running', step: 'check', startedAt: stamp, endedAt: null, error: null, startedBy, tries: (prev.tries || 1) + 1, history: [...(prev.history || []), { state: prev.state, error: prev.error || null, events: prev.events, startedAt: prev.startedAt, endedAt: prev.endedAt }], events: [] };
        } else {
          attempt = { id: newId(), applicationId, snapshotId, payloadHash, mode: 'demo', state: 'running', step: 'check', events: [], startedAt: stamp, endedAt: null, error: null, receiptId: null, tries: 1, history: [], startedBy };
        }
        tx.set('submissionAttempts', attempt.id, attempt);
        return attempt;
      });
    },

    // Final attempt state and (when completed) the receipt, in ONE transaction. A receipt already stored for this attempt
    // is kept (one receipt per attempt): a duplicate final event never makes a second receipt.
    async finishAttempt(cid, attempt, receipt = null) {
      if (!isObj(attempt) || !UUID_RE.test(String(attempt.id)) || (receipt && (!isObj(receipt) || !UUID_RE.test(String(receipt.id))))) throw new ServiceError('invalid', 'The attempt is not in the expected format.');
      if (jsonSize({ attempt, receipt }) > MAX_DOC_JSON) throw new ServiceError('invalid', 'The attempt is too large to save.');
      return store.tx(cid, async (tx) => {
        const prior = await tx.get('submissionAttempts', attempt.id);
        if (!prior) throw new ServiceError('not-found');
        const existing = (await tx.list('submissionReceipts')).find((r) => r.attemptId === attempt.id);
        const kept = existing || receipt;
        const final = { ...attempt, startedBy: prior.startedBy ?? attempt.startedBy ?? null, receiptId: kept ? kept.id : null };
        tx.set('submissionAttempts', attempt.id, final);
        if (receipt && !existing) tx.add('submissionReceipts', receipt.id, receipt);
        return { attempt: final, receipt: kept || null };
      });
    },

    // Running attempts that no live page holds any more become interrupted_unknown. Never retried automatically.
    async markInterrupted(cid, ids, message) {
      if (!ids.length) return [];
      const stamp = now().toISOString();
      return store.tx(cid, async (tx) => {
        const out = [];
        for (const id of ids) {
          const a = await tx.get('submissionAttempts', id);
          if (a && a.state === 'running') {
            const upd = { ...a, state: 'interrupted_unknown', endedAt: stamp, error: { code: 'INTERRUPTED', message } };
            tx.set('submissionAttempts', id, upd);
            out.push(upd);
          }
        }
        return out;
      });
    },

    async listAttempts(cid) { return (await store.list(cid, 'submissionAttempts')).sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0)); },
    async listReceipts(cid) { return (await store.list(cid, 'submissionReceipts')).sort((a, b) => (a.confirmedAt < b.confirmedAt ? 1 : a.confirmedAt > b.confirmedAt ? -1 : 0)); },
  };
  return svc;
}
