// Application drafts in the organisation database (schema 2, store `applications`).
//
// Transaction rules are the same as the organisation repository's: every write is ONE readwrite transaction,
// nothing is awaited inside it except IndexedDB requests, and a promise resolves only from the transaction's `complete`
// event, so "Saved" is never reported before the browser has committed.
//
// Phases B and C add snapshots, files, attempts and receipts to this module; the stores for them already exist.

import { OrgError, mapError } from '../org/db.js';
import { newId } from '../org/repository.js';
import { SCHEMA_VERSION } from './schema.js';

export const APPLICATION_STORE = 'applications';
export const GRANT_INDEX = 'grantId';
export const APPLICATION_DB_STORES = Object.freeze(['applications', 'submissionSnapshots', 'submissionFiles', 'submissionAttempts', 'submissionReceipts']);

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
