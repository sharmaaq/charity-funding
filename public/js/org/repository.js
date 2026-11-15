// The only code that touches the organisation stores.
//
// Transaction rules (see plan.md): every write is ONE readwrite transaction across every store it touches,
// and a promise resolves only from the transaction's `complete` event, never from a single request's success.
// Anything that must be awaited outside IndexedDB (reading a File's bytes) happens BEFORE the transaction opens,
// because a transaction auto-commits as soon as control returns to the event loop with no pending request.

import { OrgError, mapError, STORES, OWNER_INDEX } from './db.js';
import {
  LIMITS,
  isOutcome,
  defaultTitle,
  labelOf,
  OUTCOMES,
  ROLES,
  CATEGORIES,
  sortBids,
  sortDocuments,
  validateAttachmentMeta,
  validateBid,
  validateDocumentMeta,
  validateFile,
  validateProfile,
} from './validation.js';
import { SEED_BIDS, SEED_DOCUMENTS, SEED_PROFILE } from './seed.js';
import { formatYmd, londonParts } from '../timing.js';

export const ORG_OWNER = 'organisation';
export const SEED_MARKER_KEY = 'seed';
export const PROFILE_KEY = 'profile';
export const SCHEMA_VERSION = 1;

export function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const isObj = (v) => v !== null && typeof v === 'object';
const corrupt = (what) => new OrgError('corrupt', `Some saved organisation records could not be read (${what}). Nothing has been changed or deleted.`);

function checkProfile(p) {
  if (!isObj(p) || typeof p.overview !== 'string') throw corrupt('profile');
}
function checkBid(b) {
  if (!isObj(b) || typeof b.id !== 'string' || typeof b.title !== 'string' || typeof b.funder !== 'string' || !isOutcome(b.outcome)) throw corrupt('past bid');
}
function checkDoc(d) {
  if (!isObj(d) || typeof d.id !== 'string' || (d.ownerType !== 'bid' && d.ownerType !== ORG_OWNER) || typeof d.ownerId !== 'string'
    || typeof d.filename !== 'string' || typeof d.size !== 'number' || typeof d.uploadedAt !== 'string' || !Array.isArray(d.tags)) throw corrupt('document');
}

const stripKey = ({ key, ...rest }) => rest;

// ---------- seed content ----------
export function materialiseSeed(at, makeId = newId) {
  const stamp = (offset = 0) => new Date(at.getTime() - offset).toISOString();
  const blobs = new Map();
  const encoder = new TextEncoder();
  const fileBlob = (text) => new Blob([encoder.encode(text)], { type: 'text/plain' });
  const profile = { key: PROFILE_KEY, name: 'YOR Plc', ...SEED_PROFILE, synthetic: true, updatedAt: stamp() };
  const bids = [];
  const documents = [];
  SEED_BIDS.forEach((s) => {
    const id = makeId();
    bids.push({
      id, title: s.title, funder: s.funder, programme: s.programme, submissionDate: s.submissionDate, outcome: s.outcome,
      requestedAmount: s.requestedAmount, awardedAmount: s.awardedAmount, summary: s.summary, decisionDate: s.decisionDate,
      feedback: s.feedback, notes: s.notes, createdAt: stamp(), updatedAt: stamp(), synthetic: true,
    });
    s.files.forEach((f, i) => {
      const docId = makeId();
      const blob = fileBlob(f.text);
      blobs.set(docId, blob);
      documents.push({
        id: docId, ownerType: 'bid', ownerId: id, role: f.role, category: null, filename: f.filename, mime: 'text/plain', size: blob.size,
        title: f.title, description: '', documentDate: null, period: '', tags: [], uploadedAt: stamp(i * 1000), updatedAt: stamp(i * 1000), synthetic: true,
      });
    });
  });
  SEED_DOCUMENTS.forEach((s, i) => {
    const docId = makeId();
    const blob = fileBlob(s.text);
    blobs.set(docId, blob);
    documents.push({
      id: docId, ownerType: ORG_OWNER, ownerId: ORG_OWNER, role: null, category: s.category, filename: s.filename, mime: 'text/plain', size: blob.size,
      title: s.title, description: s.description, documentDate: null, period: s.period, tags: [...s.tags], uploadedAt: stamp(i * 1000), updatedAt: stamp(i * 1000), synthetic: true,
    });
  });
  return { profile, bids, documents, blobs };
}

// ---------- pure read models over a snapshot { profile, bids, documents } ----------
const orgDocs = (snap) => snap.documents.filter((d) => d.ownerType === ORG_OWNER);
const attachmentsOf = (snap, bidId) => snap.documents.filter((d) => d.ownerType === 'bid' && d.ownerId === bidId);
const roleRank = (d) => ROLES.findIndex((r) => r.value === d.role);
const sortAttachments = (list) => [...list].sort((a, b) => (roleRank(a) - roleRank(b)) || (a.uploadedAt < b.uploadedAt ? -1 : a.uploadedAt > b.uploadedAt ? 1 : a.id < b.id ? -1 : 1));

function readBids(snap) {
  return sortBids(snap.bids).map((b) => {
    const att = attachmentsOf(snap, b.id);
    return { ...b, attachmentCount: att.length, hasBidDocument: att.some((d) => d.role === 'bid-document') };
  });
}
function readBid(snap, id) {
  const b = snap.bids.find((x) => x.id === id);
  if (!b) return null;
  const attachments = sortAttachments(attachmentsOf(snap, id));
  return { ...b, attachments, attachmentCount: attachments.length, hasBidDocument: attachments.some((d) => d.role === 'bid-document') };
}
function readCatalogue(snap, now) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now().toISOString(),
    profile: snap.profile ? stripKey(snap.profile) : null,
    bids: sortBids(snap.bids).map((b) => ({
      ...b,
      outcomeLabel: labelOf(OUTCOMES, b.outcome),
      attachmentIds: sortAttachments(attachmentsOf(snap, b.id)).map((d) => d.id),
    })),
    documents: snap.documents.map((d) => ({
      ...d,
      roleLabel: d.role ? labelOf(ROLES, d.role) : null,
      categoryLabel: d.category ? labelOf(CATEGORIES, d.category) : null,
      status: 'Stored',
    })),
  };
}
const readUsage = (snap, limits) => ({
  fileCount: snap.documents.length,
  totalBytes: snap.documents.reduce((n, d) => n + d.size, 0),
  maxTotalBytes: limits.maxTotalBytes,
  maxFileBytes: limits.maxFileBytes,
});

const toOwnerKey = (type, id) => [type, id];

// ---------- IndexedDB repository ----------
// options: { now: () => Date, limits, hooks: () => ({ abortNext, code }) }  (hooks exist only for tests)
export function createRepository(db, options = {}) {
  const now = options.now || (() => new Date());
  const limits = { ...LIMITS, ...(options.limits || {}) };
  const hooks = typeof options.hooks === 'function' ? options.hooks : () => ({});
  const today = () => formatYmd(londonParts(now()));

  // Runs `work` inside ONE transaction. `work` may only issue IndexedDB requests (directly or from their callbacks).
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
        // Read a request's result in a callback; exceptions abort the transaction.
        on: (req, cb) => { req.onsuccess = () => { try { cb(req.result); } catch (e) { fail(e); } }; },
        // Test hook: abort the transaction after all writes are queued but before it can commit.
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

  const snapshot = () => run([STORES.meta, STORES.bids, STORES.documents], 'readonly', 'snapshot', (c) => {
    const out = {};
    let pending = 3;
    const finish = () => { if (--pending === 0) c.done(out); };
    c.on(c.stores.meta.get(PROFILE_KEY), (p) => { if (p !== undefined) checkProfile(p); out.profile = p || null; finish(); });
    c.on(c.stores.bids.getAll(), (all) => { all.forEach(checkBid); out.bids = all; finish(); });
    c.on(c.stores.documents.getAll(), (all) => { all.forEach(checkDoc); out.documents = all; finish(); });
  });

  // Bytes are read before any transaction opens.
  async function prepareFile(file, role) {
    const check = validateFile(file, limits);
    if (!check.ok) throw new OrgError('invalid', check.message, { fileError: check });
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: check.mime });
    if (blob.size !== file.size) throw new OrgError('unknown', `"${file.name}" changed while it was being read. Please choose it again.`);
    return { blob, mime: check.mime, size: blob.size, filename: file.name, role };
  }

  const capacityError = (total) => new OrgError('capacity', `Adding this would take the stored files to ${(total / 1048576).toFixed(1)} MB, over the ${Math.round(limits.maxTotalBytes / 1048576)} MB limit for this browser store. Delete a stored file and try again.`);

  const repo = {
    readOnly: false,
    limits,

    async getProfile() {
      const s = await snapshot();
      return s.profile ? stripKey(s.profile) : null;
    },

    async updateProfile(input) {
      const v = validateProfile(input);
      if (!v.ok) throw new OrgError('invalid', undefined, { errors: v.errors });
      return run([STORES.meta], 'readwrite', 'updateProfile', (c) => {
        c.on(c.stores.meta.get(PROFILE_KEY), (existing) => {
          const record = { ...(existing || {}), key: PROFILE_KEY, name: 'YOR Plc', ...v.value, synthetic: false, updatedAt: now().toISOString() };
          c.stores.meta.put(record);
          c.afterWrites();
          c.done(stripKey(record));
        });
      });
    },

    async listBids() {
      return readBids(await snapshot());
    },

    async getBid(id) {
      return readBid(await snapshot(), id);
    },

    // input: { id?, fields, newFiles: [{ file, role, title?, description? }], attachmentEdits: [{ id, role, title, description }], removeIds: [id] }
    // Bid record, new files and their blobs, metadata edits and removals commit together or not at all.
    async saveBid(input) {
      const { id: existingId = null, fields, newFiles = [], attachmentEdits = [], removeIds = [] } = input || {};
      const v = validateBid(fields, today());
      const errors = { ...v.errors };
      const fileErrors = [];
      const edits = [];
      for (const e of attachmentEdits) {
        const m = validateAttachmentMeta(e);
        if (!m.ok) fileErrors.push({ id: e.id, errors: m.errors });
        else edits.push({ id: e.id, ...m.value });
      }
      const staged = [];
      for (const n of newFiles) {
        const check = validateFile(n.file, limits);
        const meta = validateAttachmentMeta({ role: n.role, title: n.title || defaultTitle(n.file && n.file.name), description: n.description });
        if (!check.ok) fileErrors.push({ name: n.file && n.file.name, message: check.message });
        else if (!meta.ok) fileErrors.push({ name: n.file.name, errors: meta.errors });
        else staged.push({ file: n.file, meta: meta.value });
      }
      if (!v.ok || fileErrors.length) throw new OrgError('invalid', undefined, { errors, fileErrors });

      const prepared = [];
      for (const s of staged) {
        const p = await prepareFile(s.file, s.meta.role); // every non-IndexedDB await happens before the transaction opens
        prepared.push({ ...p, id: newId(), meta: s.meta });
      }
      const bidId = existingId || newId();
      const removeSet = new Set(removeIds);
      const stamp = now().toISOString();

      return run([STORES.bids, STORES.documents, STORES.files], 'readwrite', 'saveBid', (c) => {
        const { bids, documents, files } = c.stores;
        const got = {};
        let pending = 2;
        const next = () => { if (--pending === 0) writeAll(); };
        c.on(bids.get(bidId), (b) => { got.bid = b; next(); });
        c.on(documents.getAll(), (all) => { got.docs = all; next(); });

        function writeAll() {
          if (existingId && !got.bid) { c.fail(new OrgError('not-found')); return; }
          const owned = got.docs.filter((d) => d.ownerType === 'bid' && d.ownerId === bidId);
          const ownedIds = new Set(owned.map((d) => d.id));
          if ([...removeSet].some((r) => !ownedIds.has(r)) || edits.some((e) => !ownedIds.has(e.id))) { c.fail(new OrgError('not-found')); return; }
          // Capacity is checked inside the same transaction that writes.
          const removedBytes = owned.filter((d) => removeSet.has(d.id)).reduce((n, d) => n + d.size, 0);
          const total = got.docs.reduce((n, d) => n + d.size, 0) - removedBytes + prepared.reduce((n, p) => n + p.size, 0);
          if (prepared.length && total > limits.maxTotalBytes) { c.fail(capacityError(total)); return; }

          const record = {
            ...(got.bid || {}), ...v.value, id: bidId,
            createdAt: got.bid ? got.bid.createdAt : stamp, updatedAt: stamp, synthetic: got.bid ? !!got.bid.synthetic : false,
          };
          bids.put(record);
          for (const r of removeSet) { documents.delete(r); files.delete(r); }
          for (const e of edits) {
            if (removeSet.has(e.id)) continue;
            const cur = owned.find((d) => d.id === e.id);
            documents.put({ ...cur, role: e.role, title: e.title, description: e.description, updatedAt: stamp });
          }
          for (const p of prepared) {
            documents.put({
              id: p.id, ownerType: 'bid', ownerId: bidId, role: p.meta.role, category: null, filename: p.filename, mime: p.mime, size: p.size,
              title: p.meta.title, description: p.meta.description, documentDate: null, period: '', tags: [], uploadedAt: stamp, updatedAt: stamp, synthetic: false,
            });
            files.put({ id: p.id, blob: p.blob });
          }
          c.afterWrites();
          c.done(bidId);
        }
      });
    },

    // Deletes the bid, every document it owns and their blobs, atomically.
    async deleteBid(id) {
      return run([STORES.bids, STORES.documents, STORES.files], 'readwrite', 'deleteBid', (c) => {
        const { bids, documents, files } = c.stores;
        c.on(documents.index(OWNER_INDEX).getAllKeys(IDBKeyRange.only(toOwnerKey('bid', id))), (keys) => {
          keys.forEach((k) => { documents.delete(k); files.delete(k); });
          bids.delete(id);
          c.afterWrites();
          c.done({ removedFiles: keys.length });
        });
      });
    },

    async listDocuments() {
      return sortDocuments(orgDocs(await snapshot()));
    },

    async getDocument(id) {
      return (await snapshot()).documents.find((d) => d.id === id) || null;
    },

    // One transaction per file. `details`: { category?, title?, description?, documentDate?, period?, tags? }.
    async uploadDocument(file, details = {}) {
      const m = validateDocumentMeta({ ...details, title: details.title || defaultTitle(file && file.name) });
      if (!m.ok) throw new OrgError('invalid', undefined, { errors: m.errors });
      const p = await prepareFile(file, null);
      const stamp = now().toISOString();
      const record = {
        id: newId(), ownerType: ORG_OWNER, ownerId: ORG_OWNER, role: null, category: m.value.category, filename: p.filename, mime: p.mime, size: p.size,
        title: m.value.title, description: m.value.description, documentDate: m.value.documentDate, period: m.value.period, tags: m.value.tags,
        uploadedAt: stamp, updatedAt: stamp, synthetic: false,
      };
      return run([STORES.documents, STORES.files], 'readwrite', 'uploadDocument', (c) => {
        c.on(c.stores.documents.getAll(), (all) => {
          const total = all.reduce((n, d) => n + d.size, 0) + p.size;
          if (total > limits.maxTotalBytes) { c.fail(capacityError(total)); return; }
          c.stores.documents.put(record);
          c.stores.files.put({ id: record.id, blob: p.blob });
          c.afterWrites();
          c.done(record);
        });
      });
    },

    // Sequential, so one failure never undoes the others. Resolves with one result per file.
    async uploadDocuments(fileList, details = {}) {
      const results = [];
      for (const file of Array.from(fileList)) {
        try {
          results.push({ name: file.name, ok: true, document: await repo.uploadDocument(file, details) });
        } catch (e) {
          const err = mapError(e);
          results.push({ name: file.name, ok: false, error: err, message: err.message });
        }
      }
      return results;
    },

    async updateDocument(id, input) {
      const m = validateDocumentMeta(input);
      if (!m.ok) throw new OrgError('invalid', undefined, { errors: m.errors });
      return run([STORES.documents], 'readwrite', 'updateDocument', (c) => {
        c.on(c.stores.documents.get(id), (cur) => {
          if (!cur || cur.ownerType !== ORG_OWNER) { c.fail(new OrgError('not-found')); return; }
          const record = { ...cur, ...m.value, updatedAt: now().toISOString() };
          c.stores.documents.put(record);
          c.afterWrites();
          c.done(record);
        });
      });
    },

    // Metadata and bytes together.
    async deleteDocument(id) {
      return run([STORES.documents, STORES.files], 'readwrite', 'deleteDocument', (c) => {
        c.on(c.stores.documents.get(id), (cur) => {
          if (!cur) { c.fail(new OrgError('not-found')); return; }
          c.stores.documents.delete(id);
          c.stores.files.delete(id);
          c.afterWrites();
          c.done(undefined);
        });
      });
    },

    // The original bytes, exactly as uploaded.
    async getBlob(id) {
      return run([STORES.files], 'readonly', 'getBlob', (c) => {
        c.on(c.stores.files.get(id), (rec) => c.done(rec && rec.blob instanceof Blob ? rec.blob : null));
      });
    },

    // Source catalogue for later features: the profile, every bid with its outcome, summary, feedback and notes,
    // and every live document's metadata. Original bytes come from getBlob(id). Status is "Stored", never "indexed".
    async catalogue() {
      return readCatalogue(await snapshot(), now);
    },

    async usage() {
      return readUsage(await snapshot(), limits);
    },

    // Runs once, guarded by its own marker. An empty list never triggers seeding.
    async seedOnce() {
      const seed = materialiseSeed(now());
      return run([STORES.meta, STORES.bids, STORES.documents, STORES.files], 'readwrite', 'seed', (c) => {
        c.on(c.stores.meta.get(SEED_MARKER_KEY), (marker) => {
          if (marker) { c.done({ seeded: false }); return; }
          c.stores.meta.put(seed.profile);
          seed.bids.forEach((b) => c.stores.bids.put(b));
          seed.documents.forEach((d) => {
            c.stores.documents.put(d);
            c.stores.files.put({ id: d.id, blob: seed.blobs.get(d.id) });
          });
          c.stores.meta.put({ key: SEED_MARKER_KEY, completedAt: now().toISOString(), schemaVersion: SCHEMA_VERSION });
          c.afterWrites();
          c.done({ seeded: true });
        });
      });
    },
  };
  return repo;
}

// ---------- read-only fallback: the seed content from memory, used only when IndexedDB cannot be opened ----------
export function createSeedRepository(options = {}) {
  const now = options.now || (() => new Date());
  const limits = { ...LIMITS, ...(options.limits || {}) };
  const seed = materialiseSeed(now());
  const snap = { profile: seed.profile, bids: seed.bids, documents: seed.documents };
  const refuse = () => Promise.reject(new OrgError('read-only'));
  return {
    readOnly: true,
    limits,
    getProfile: async () => stripKey(snap.profile),
    listBids: async () => readBids(snap),
    getBid: async (id) => readBid(snap, id),
    listDocuments: async () => sortDocuments(orgDocs(snap)),
    getDocument: async (id) => snap.documents.find((d) => d.id === id) || null,
    getBlob: async (id) => seed.blobs.get(id) || null,
    catalogue: async () => readCatalogue(snap, now),
    usage: async () => readUsage(snap, limits),
    seedOnce: async () => ({ seeded: false }),
    updateProfile: refuse,
    saveBid: refuse,
    deleteBid: refuse,
    uploadDocument: refuse,
    uploadDocuments: refuse,
    updateDocument: refuse,
    deleteDocument: refuse,
  };
}

