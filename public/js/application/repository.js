// Application drafts, frozen snapshots, demo attempts and receipts, as seen from the browser: a client of the
// charity-scoped API with the method names and return shapes of the old IndexedDB repository.
//
// The rules that used to be IndexedDB transactions now run on the server as single transactions (the optimistic
// draftRevision check, one draft per grant, immutable snapshots, the attempt lock, one receipt per attempt). A promise
// here resolves only after the server has committed, so "Saved" is never shown before the data is stored.
import { OrgError } from '../org/db.js';
import { api } from '../remote/http.js';

export const APPLICATION_STORE = 'applications';
export const GRANT_INDEX = 'grantId';

const isObj = (v) => v !== null && typeof v === 'object';
const enc = encodeURIComponent;

// options: { cid, userEmail }
export function createApplicationRepository({ cid, userEmail = null }) {
  const base = `/api/charities/${enc(cid)}`;
  return {
    userEmail,

    // The one application for a grant, or null.
    async getByGrant(grantId) { return (await api(`${base}/applications/by-grant/${enc(grantId)}`)).application; },
    async get(id) { return (await api(`${base}/applications/${enc(id)}`)).application; },
    list: () => api(`${base}/applications`),

    // Returns the existing application for the grant, or creates it with `initialAnswers`, so at most one active draft
    // exists per grant. Resolves { application, created }.
    getOrCreate: (grantId, initialAnswers) => api(`${base}/applications/get-or-create`, { method: 'POST', json: { grantId, initialAnswers } }),

    // Optimistic save: succeeds only when the stored draftRevision is still `expectedRevision`.
    // On success the revision goes up by one. A mismatch rejects with OrgError('conflict') and changes nothing.
    save(id, { expectedRevision, answers }) {
      if (!isObj(answers)) return Promise.reject(new OrgError('invalid', 'The answers could not be saved because they are not in the expected format.'));
      return api(`${base}/applications/${enc(id)}/answers`, { method: 'PUT', json: { expectedRevision, answers } });
    },

    // The manager's own proposal PDF, stored with the application so it survives reload until a package is frozen.
    // replacement: { filename, mime, size, sha256, pageCount, managerChecked, checkedAt, blob } or null to remove it.
    // Like an answer save, it needs the current draftRevision and bumps it.
    setProposalReplacement(id, { expectedRevision, replacement }) {
      const url = `${base}/applications/${enc(id)}/proposal-replacement`;
      if (!replacement) return api(url, { method: 'PUT', json: { expectedRevision, replacement: null } });
      const { blob, ...meta } = replacement;
      // No file bytes: only the manager's check changed, and the server keeps the stored file.
      if (!blob) return api(url, { method: 'PUT', json: { expectedRevision, replacement: meta } });
      const form = new FormData();
      form.append('meta', JSON.stringify({ expectedRevision, replacement: meta }));
      form.append('file', blob, meta.filename);
      return api(url, { method: 'PUT', form });
    },
    getProposalReplacementBlob: async (id) => {
      try { return await api(`${base}/applications/${enc(id)}/proposal-replacement/file`, { blob: true }); } catch (e) { if (e.code === 'not-found') return null; throw e; }
    },

    async getSnapshot(snapshotId) { return (await api(`${base}/snapshots/${enc(snapshotId)}`)).snapshot; },
    // Snapshots of an application, oldest first.
    listSnapshots: (applicationId) => api(`${base}/applications/${enc(applicationId)}/snapshots`),
    // Copies of a snapshot's outgoing attachments, in package order: [{ id, snapshotId, role, filename, mime, size, sha256, blob }].
    async getSnapshotFiles(snapshotId) {
      const list = await api(`${base}/snapshots/${enc(snapshotId)}/files`);
      return Promise.all(list.map(async (f) => ({ ...f, blob: await api(`${base}/snapshots/${enc(snapshotId)}/files/${enc(f.id)}`, { blob: true }) })));
    },

    // Writes the frozen snapshot and its attachment copies in one server transaction (package.js builds both).
    // files: [{ bytes: Uint8Array, mime }] in attachment order. Resolves { snapshot, created }.
    freezeSnapshot(applicationId, snapshot, files) {
      const form = new FormData();
      form.append('snapshot', JSON.stringify(snapshot));
      files.forEach((f, i) => form.append(`file${i}`, new Blob([f.bytes], { type: f.mime }), `file${i}`));
      return api(`${base}/applications/${enc(applicationId)}/snapshots`, { method: 'POST', form });
    },

    // The attempt lock: the server checks that this snapshot has no receipt and no running attempt, then writes a running
    // attempt in one transaction, so a second tab or a double click cannot start a second run for the same snapshot.
    // retryId: deliberately retry an interrupted or failed attempt with the SAME attempt ID (and so the same DEMO reference).
    acquireAttempt: ({ applicationId, snapshotId, payloadHash, retryId = null }) => api(`${base}/attempts/acquire`, { method: 'POST', json: { applicationId, snapshotId, payloadHash, retryId } }),

    // Final attempt state and (when completed) the receipt, in one transaction. A receipt already stored for this attempt
    // is kept: a duplicate final event never makes a second receipt.
    finishAttempt: (attempt, receipt = null) => api(`${base}/attempts/finish`, { method: 'POST', json: { attempt, receipt } }),

    // Running attempts that no live page holds any more become interrupted_unknown. Never retried automatically.
    async markInterrupted(ids, message) {
      if (!ids.length) return [];
      return api(`${base}/attempts/interrupt`, { method: 'POST', json: { ids, message } });
    },

    listAttempts: () => api(`${base}/attempts`),
    listReceipts: () => api(`${base}/receipts`),
  };
}
