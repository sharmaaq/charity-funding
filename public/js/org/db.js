// Opens the organisation database and maps IndexedDB failures to typed errors.
// Rule: nothing in this app ever deletes or recreates this database to recover from an error.
// (The grant-state rule in state.js, which discards unreadable data, deliberately does not apply here.)

export const DB_NAME = 'charity-funding.organisation';
export const DB_VERSION = 2;
export const STORES = Object.freeze({ meta: 'meta', bids: 'bids', documents: 'documents', files: 'files' });
export const OWNER_INDEX = 'owner';
// Added by schema 2 (S3-001 Phase A). Only `applications` is used in Phase A; the rest exist so Phase B and C need no second migration.
export const APP_STORES = Object.freeze({
  applications: 'applications',
  snapshots: 'submissionSnapshots',
  snapshotFiles: 'submissionFiles',
  attempts: 'submissionAttempts',
  receipts: 'submissionReceipts',
});
export const APP_GRANT_INDEX = 'grantId';

export const ERROR_MESSAGES = Object.freeze({
  unavailable: 'This browser did not allow this site to open its local storage database (IndexedDB).',
  blocked: 'Another tab of this site is still using an older version of the organisation database. Close other tabs of this site, then choose Retry.',
  quota: 'The browser has no room left to store this. Free some browser storage or remove a stored file, then try again. Nothing was changed.',
  aborted: 'The save was cancelled by the browser before it finished. Nothing was changed. Please try again.',
  'unknown-schema': 'This browser holds organisation data saved in a format this version of the app does not recognise. Nothing has been changed or deleted.',
  corrupt: 'Some saved organisation records could not be read. Nothing has been changed or deleted.',
  capacity: 'There is not enough room in the 100 MB organisation file store. Delete a stored file and try again.',
  conflict: 'This application was changed in another tab or window since you opened it.',
  'source-changed': 'A document or file this package depends on changed while it was being prepared. Nothing was saved. Review the package again.',
  'not-found': 'That record no longer exists. It may have been deleted in another tab.',
  invalid: 'Some details need correcting.',
  'read-only': 'Saving is unavailable in this browser, so this cannot be changed.',
  unknown: 'The organisation store reported an unexpected error. Nothing was changed.',
});

export class OrgError extends Error {
  constructor(code, message, extra = {}) {
    super(message || ERROR_MESSAGES[code] || ERROR_MESSAGES.unknown);
    this.name = 'OrgError';
    this.code = code;
    Object.assign(this, extra);
  }
}

export function mapError(e) {
  if (e instanceof OrgError) return e;
  const name = e && e.name;
  const cause = { cause: e };
  switch (name) {
    case 'QuotaExceededError': return new OrgError('quota', undefined, cause);
    case 'VersionError': return new OrgError('unknown-schema', undefined, cause);
    case 'AbortError': return new OrgError('aborted', undefined, cause);
    case 'SecurityError':
    case 'InvalidStateError':
    case 'NotSupportedError': return new OrgError('unavailable', undefined, cause);
    default: return new OrgError('unknown', undefined, cause);
  }
}

function createStoresV1(db) {
  db.createObjectStore(STORES.meta, { keyPath: 'key' });
  db.createObjectStore(STORES.bids, { keyPath: 'id' });
  const docs = db.createObjectStore(STORES.documents, { keyPath: 'id' });
  docs.createIndex(OWNER_INDEX, ['ownerType', 'ownerId']);
  db.createObjectStore(STORES.files, { keyPath: 'id' });
}

// Purely additive: creates stores that do not exist yet and never reads, clears, recreates or seeds anything.
function createStoresV2(db) {
  const apps = db.createObjectStore(APP_STORES.applications, { keyPath: 'id' });
  apps.createIndex(APP_GRANT_INDEX, 'grantId', { unique: true }); // one active draft per grant
  const snaps = db.createObjectStore(APP_STORES.snapshots, { keyPath: 'id' });
  snaps.createIndex('applicationId', 'applicationId');
  const sfiles = db.createObjectStore(APP_STORES.snapshotFiles, { keyPath: 'id' });
  sfiles.createIndex('snapshotId', 'snapshotId');
  const attempts = db.createObjectStore(APP_STORES.attempts, { keyPath: 'id' });
  attempts.createIndex('applicationId', 'applicationId');
  attempts.createIndex('snapshotId', 'snapshotId');
  const receipts = db.createObjectStore(APP_STORES.receipts, { keyPath: 'id' });
  receipts.createIndex('applicationId', 'applicationId');
  receipts.createIndex('attemptId', 'attemptId', { unique: true }); // duplicate final events cannot create a second receipt
}

// Resolves to an open IDBDatabase, or rejects with an OrgError (unavailable, blocked, unknown-schema, unknown).
export function openDb(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) {
      reject(new OrgError('unavailable'));
      return;
    }
    let req;
    try {
      req = factory.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(mapError(e));
      return;
    }
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return false;
      settled = true;
      fn(value);
      return true;
    };
    req.onupgradeneeded = (ev) => {
      // A brand-new database gets every store. A schema-1 database only gains the schema-2 stores:
      // its four existing stores and their data are never altered, recreated or reseeded.
      if (!ev.oldVersion) createStoresV1(req.result);
      if (ev.oldVersion < 2) createStoresV2(req.result);
    };
    req.onsuccess = () => {
      const db = req.result;
      const missing = [...Object.values(STORES), ...Object.values(APP_STORES)].filter((n) => !db.objectStoreNames.contains(n));
      if (settled || missing.length) {
        db.close();
        settle(reject, new OrgError('unknown-schema'));
        return;
      }
      db.onversionchange = () => db.close();
      settle(resolve, db);
    };
    req.onerror = (ev) => {
      if (ev && ev.preventDefault) ev.preventDefault();
      settle(reject, mapError(req.error));
    };
    req.onblocked = () => settle(reject, new OrgError('blocked'));
  });
}
