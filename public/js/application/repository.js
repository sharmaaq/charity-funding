// Application drafts in the organisation database (schema 2, store `applications`).
//
// Transaction rules are the same as the organisation repository's: every write is ONE readwrite transaction,
// nothing is awaited inside it except IndexedDB requests, and a promise resolves only from the transaction's `complete`
// event, so "Saved" is never reported before the browser has committed.
//
// Phase B adds the manager-supplied proposal PDF (a field on the application record) and read access to frozen
// snapshots; the snapshot itself is written by package.js through `transact`, in one transaction. Phase C adds attempts
// and receipts. All five stores already exist (schema 2).

import { OrgError, mapError } from '../org/db.js';
import { LIMITS as ORG_LIMITS } from '../org/validation.js';
import { newId } from '../org/repository.js';
import { SCHEMA_VERSION } from './schema.js';

export const APPLICATION_STORE = 'applications';
export const GRANT_INDEX = 'grantId';
// Store names are spelled out here (not imported from org/db.js) so this module links against any version of db.js.
const DOCUMENTS_STORE = 'documents';
const SNAPSHOTS_STORE = 'submissionSnapshots';
const SNAPSHOT_FILES_STORE = 'submissionFiles';
export const APPLICATION_DB_STORES = Object.freeze(['applications', 'submissionSnapshots', 'submissionFiles', 'submissionAttempts', 'submissionReceipts']);

// Bytes already held by the organisation file store, the frozen packages and the manager-supplied proposals.
export function totalStoredBytes(documents, snapshotFiles, applications) {
  const n = (list) => list.reduce((t, x) => t + (Number.isFinite(x && x.size) ? x.size : 0), 0);
  return n(documents) + n(snapshotFiles) + n(applications.map((a) => a.proposalReplacement || {}));
}
export function capacityError(usedBytes, requiredBytes) {
  const mb = (n) => (n / 1048576).toFixed(1);
  const free = Math.max(0, ORG_LIMITS.maxTotalBytes - usedBytes);
  return new OrgError('capacity', `There is not enough room in the 100 MB browser file store: this needs ${mb(requiredBytes)} MB and ${mb(free)} MB is free. Delete a stored file or an old package and try again. Your draft is kept.`, { requiredBytes, freeBytes: free });
}

const isObj = (v) => v !== null && typeof v === 'object';
const corrupt = (what) => new OrgError('corrupt', `A saved application could not be read (${what}). Nothing has been changed or deleted.`);

function checkApplication(a) {
  if (!isObj(a) || typeof a.id !== 'string' || typeof a.grantId !== 'string' || !Number.isInteger(a.draftRevision) || !isObj(a.answers)
    || typeof a.createdAt !== 'string' || typeof a.updatedAt !== 'string') throw corrupt('application record');
  return a;
}

// options: { now: () => Date, hooks: () => ({ abortNext, code }) }   (hooks exist only for tests)
export function createApplicationRepository(db, options = {}) {
  const now = options.now || (() => new Date());
  const hooks = typeof options.hooks === 'function' ? options.hooks : () => ({});

  function run(names, mode, label, work) {
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(names, mode);
      } catch (e) {
        reject(mapError(e));
        return;
      }
      let result;
      let failure = null;
      const fail = (err) => {
        if (!failure) failure = err instanceof OrgError ? err : mapError(err);
        try { tx.abort(); } catch { /* already finished */ }
      };
      const stores = {};
      for (const n of names) stores[n] = tx.objectStore(n);
      const ctx = {
        stores,
        fail,
        done: (v) => { result = v; },
        on: (req, cb) => { req.onsuccess = () => { try { cb(req.result); } catch (e) { fail(e); } }; },
        afterWrites: () => {
          const h = hooks() || {};
          if (h.abortNext === label) {
            h.abortNext = null;
            fail(new OrgError(h.code === 'quota' ? 'quota' : 'aborted'));
          }
        },
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || (tx.error ? mapError(tx.error) : new OrgError('aborted')));
      try {
        work(ctx);
      } catch (e) {
        fail(e);
      }
    });
  }

  const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

  return {
    // The one application for a grant, or null.
    getByGrant(grantId) {
      return run([APPLICATION_STORE], 'readonly', 'getByGrant', (c) => {
        c.on(c.stores[APPLICATION_STORE].index(GRANT_INDEX).get(grantId), (rec) => c.done(rec ? checkApplication(rec) : null));
      });
    },

    get(id) {
      return run([APPLICATION_STORE], 'readonly', 'get', (c) => {
        c.on(c.stores[APPLICATION_STORE].get(id), (rec) => c.done(rec ? checkApplication(rec) : null));
      });
    },

    list() {
      return run([APPLICATION_STORE], 'readonly', 'list', (c) => {
        c.on(c.stores[APPLICATION_STORE].getAll(), (all) => c.done(all.map(checkApplication)));
      });
    },

    // Returns the existing application for the grant, or creates it with `initialAnswers` in the same transaction,
    // so at most one active draft exists per grant. Resolves { application, created }.
    getOrCreate(grantId, initialAnswers) {
      const stamp = now().toISOString();
      const record = {
        id: newId(), grantId, schemaVersion: SCHEMA_VERSION, draftRevision: 1, answers: clone(initialAnswers || {}),
        createdAt: stamp, updatedAt: stamp, lastSnapshotId: null,
      };
      return run([APPLICATION_STORE], 'readwrite', 'getOrCreate', (c) => {
        const store = c.stores[APPLICATION_STORE];
        c.on(store.index(GRANT_INDEX).get(grantId), (existing) => {
          if (existing) { c.done({ application: checkApplication(existing), created: false }); return; }
          store.put(record);
          c.afterWrites();
          c.done({ application: record, created: true });
        });
      });
    },

    // Generic transaction runner for package.js (same rules as above: IndexedDB requests only inside `work`).
    transact: run,

    // The manager's own proposal PDF, stored on the application record so it survives reload until a package is frozen.
    // replacement: { filename, mime, size, sha256, pageCount, managerChecked, checkedAt, blob } or null to remove it.
    // Counts against the shared 100 MiB budget. Like an answer save, it needs the current draftRevision and bumps it,
    // because changing an attachment must invalidate any review that was based on the old one.
    setProposalReplacement(id, { expectedRevision, replacement }) {
      const stamp = now().toISOString();
      return run([APPLICATION_STORE, DOCUMENTS_STORE, SNAPSHOT_FILES_STORE], 'readwrite', 'setProposalReplacement', (c) => {
        const apps = c.stores[APPLICATION_STORE];
        const got = {};
        let pending = 4;
        const next = () => { if (--pending === 0) write(); };
        c.on(apps.get(id), (cur) => { got.cur = cur; next(); });
        c.on(apps.getAll(), (all) => { got.apps = all; next(); });
        c.on(c.stores[DOCUMENTS_STORE].getAll(), (all) => { got.docs = all; next(); });
        c.on(c.stores[SNAPSHOT_FILES_STORE].getAll(), (all) => { got.files = all; next(); });
        function write() {
          const cur = got.cur;
          if (!cur) { c.fail(new OrgError('not-found')); return; }
          checkApplication(cur);
          if (cur.draftRevision !== expectedRevision) { c.fail(new OrgError('conflict', undefined, { currentRevision: cur.draftRevision })); return; }
          if (replacement) {
            const used = totalStoredBytes(got.docs, got.files, got.apps.filter((a) => a.id !== id));
            const total = used + replacement.size;
            if (total > ORG_LIMITS.maxTotalBytes) { c.fail(capacityError(used, replacement.size)); return; }
          }
          const updated = { ...cur, draftRevision: cur.draftRevision + 1, updatedAt: stamp };
          if (replacement) updated.proposalReplacement = { ...replacement }; else delete updated.proposalReplacement;
          apps.put(updated);
          c.afterWrites();
          c.done(updated);
        }
      });
    },

    getSnapshot(snapshotId) {
      return run([SNAPSHOTS_STORE], 'readonly', 'getSnapshot', (c) => {
        c.on(c.stores[SNAPSHOTS_STORE].get(snapshotId), (rec) => c.done(rec || null));
      });
    },

    // Snapshots of an application, oldest first.
    listSnapshots(applicationId) {
      return run([SNAPSHOTS_STORE], 'readonly', 'listSnapshots', (c) => {
        c.on(c.stores[SNAPSHOTS_STORE].index('applicationId').getAll(applicationId), (all) => c.done(all.sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : a.id < b.id ? -1 : 1))));
      });
    },

    // Copies of a snapshot's outgoing attachments, in package order: [{ id, snapshotId, role, filename, mime, size, sha256, blob }].
    getSnapshotFiles(snapshotId) {
      return run([SNAPSHOT_FILES_STORE], 'readonly', 'getSnapshotFiles', (c) => {
        c.on(c.stores[SNAPSHOT_FILES_STORE].index('snapshotId').getAll(snapshotId), (all) => c.done(all.sort((a, b) => (a.order || 0) - (b.order || 0))));
      });
    },

    // Optimistic save: succeeds only when the stored draftRevision is still `expectedRevision`.
    // On success the revision goes up by one. A mismatch rejects with OrgError('conflict') and changes nothing.
    save(id, { expectedRevision, answers }) {
      if (!isObj(answers)) return Promise.reject(new OrgError('invalid', 'The answers could not be saved because they are not in the expected format.'));
      const stamp = now().toISOString();
      const copy = clone(answers);
      return run([APPLICATION_STORE], 'readwrite', 'saveApplication', (c) => {
        const store = c.stores[APPLICATION_STORE];
        c.on(store.get(id), (cur) => {
          if (!cur) { c.fail(new OrgError('not-found')); return; }
          checkApplication(cur);
          if (cur.draftRevision !== expectedRevision) { c.fail(new OrgError('conflict', undefined, { currentRevision: cur.draftRevision })); return; }
          const next = { ...cur, answers: copy, draftRevision: cur.draftRevision + 1, updatedAt: stamp };
          store.put(next);
          c.afterWrites();
          c.done(next);
        });
      });
    },
  };
}
