// Organisation profile, past bids and documents for one charity. This is the server-side home of the rules that used to
// live in the browser's IndexedDB repository: validation, the 10 MiB / 100 MiB limits, and atomic writes.
//
// Every function takes `cid` from the authorised request context. Bytes are written to the file store BEFORE the
// transaction that records them (an unreferenced file is harmless and is cleaned up on failure); bytes of removed
// records are deleted AFTER the transaction commits.
import { randomUUID } from 'node:crypto';
import { ServiceError } from '../errors.js';
import {
  LIMITS, defaultTitle, labelOf, OUTCOMES, ROLES, CATEGORIES, sortBids, sortDocuments,
  validateAttachmentMeta, validateBid, validateDocumentMeta, validateFile, validateProfile,
} from '../../public/js/org/validation.js';
import { formatYmd, londonParts } from '../../public/js/timing.js';

export const ORG_OWNER = 'organisation';
export const PROFILE_KEY = 'profile';
export const SCHEMA_VERSION = 1;
const stripKey = ({ key, ...rest }) => rest;
const mb = (n) => (n / 1048576).toFixed(1);

// ---------- pure read models ----------
const orgDocs = (snap) => snap.documents.filter((d) => d.ownerType === ORG_OWNER);
const attachmentsOf = (snap, bidId) => snap.documents.filter((d) => d.ownerType === 'bid' && d.ownerId === bidId);
const roleRank = (d) => ROLES.findIndex((r) => r.value === d.role);
const sortAttachments = (list) => [...list].sort((a, b) => (roleRank(a) - roleRank(b)) || (a.uploadedAt < b.uploadedAt ? -1 : a.uploadedAt > b.uploadedAt ? 1 : a.id < b.id ? -1 : 1));

export function readBids(snap) {
  return sortBids(snap.bids).map((b) => {
    const att = attachmentsOf(snap, b.id);
    return { ...b, attachmentCount: att.length, hasBidDocument: att.some((d) => d.role === 'bid-document') };
  });
}
export function readBid(snap, id) {
  const b = snap.bids.find((x) => x.id === id);
  if (!b) return null;
  const attachments = sortAttachments(attachmentsOf(snap, id));
  return { ...b, attachments, attachmentCount: attachments.length, hasBidDocument: attachments.some((d) => d.role === 'bid-document') };
}
export function readCatalogue(snap, now) {
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

// Bytes held by the charity: organisation files, frozen package copies and manager-supplied proposals.
export function totalStoredBytes(documents, snapshotFiles, applications) {
  const n = (list) => list.reduce((t, x) => t + (Number.isFinite(x && x.size) ? x.size : 0), 0);
  return n(documents) + n(snapshotFiles) + n(applications.map((a) => a.proposalReplacement || {}));
}
export function capacityError(usedBytes, requiredBytes, maxTotalBytes = LIMITS.maxTotalBytes) {
  const free = Math.max(0, maxTotalBytes - usedBytes);
  return new ServiceError('capacity', `There is not enough room in the ${Math.round(maxTotalBytes / 1048576)} MB file store for this charity: this needs ${mb(requiredBytes)} MB and ${mb(free)} MB is free. Delete a stored file or an old package and try again. Nothing was changed.`, { requiredBytes, freeBytes: free });
}

// options: { now, limits }
export function createOrgService(store, options = {}) {
  const now = options.now || (() => new Date());
  const limits = { ...LIMITS, ...(options.limits || {}) };
  const today = () => formatYmd(londonParts(now()));
  const newId = () => randomUUID();

  async function snapshot(cid) {
    const [profile, bids, documents] = await Promise.all([store.get(cid, 'meta', PROFILE_KEY), store.list(cid, 'bids'), store.list(cid, 'documents')]);
    return { profile: profile || null, bids, documents };
  }
  async function usedBytes(cid) {
    const [docs, files, apps] = await Promise.all([store.list(cid, 'documents'), store.list(cid, 'submissionFiles'), store.list(cid, 'applications')]);
    return totalStoredBytes(docs, files, apps);
  }
  const txUsed = async (tx) => totalStoredBytes(await tx.list('documents'), await tx.list('submissionFiles'), await tx.list('applications'));

  // The profile of a charity that has none yet: name and website only, nothing invented.
  async function defaultProfile(cid) {
    const c = await store.getCharity(cid);
    return { name: c ? c.name : '', overview: '', beneficiaries: '', geography: '', activities: '', charityNumber: '', companyNumber: '', website: c ? c.website || '' : '', synthetic: false, updatedAt: null };
  }

  const svc = {
    limits,

    async getProfile(cid) {
      const p = await store.get(cid, 'meta', PROFILE_KEY);
      return p ? stripKey(p) : defaultProfile(cid);
    },

    async updateProfile(cid, input) {
      const v = validateProfile(input);
      if (!v.ok) throw new ServiceError('invalid', 'Some details need correcting.', { errors: v.errors });
      const charity = await store.getCharity(cid);
      return store.tx(cid, async (tx) => {
        const existing = await tx.get('meta', PROFILE_KEY);
        const record = { ...(existing || {}), key: PROFILE_KEY, name: charity.name, ...v.value, synthetic: false, updatedAt: now().toISOString() };
        tx.set('meta', PROFILE_KEY, record);
        return stripKey(record);
      });
    },

    async listBids(cid) { return readBids(await snapshot(cid)); },
    async getBid(cid, id) { return readBid(await snapshot(cid), id); },

    // input: { id?, fields, newFiles: [{ role, title?, description?, filename, mimeType, bytes }], attachmentEdits, removeIds }
    async saveBid(cid, input) {
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
        const file = { name: n.filename, size: n.bytes.length, type: n.mimeType };
        const check = validateFile(file, limits);
        const meta = validateAttachmentMeta({ role: n.role, title: n.title || defaultTitle(n.filename), description: n.description });
        if (!check.ok) fileErrors.push({ name: n.filename, message: check.message });
        else if (!meta.ok) fileErrors.push({ name: n.filename, errors: meta.errors });
        else staged.push({ n, check, meta: meta.value });
      }
      if (!v.ok || fileErrors.length) throw new ServiceError('invalid', 'Some details need correcting.', { errors, fileErrors });

      const bidId = existingId || newId();
      const removeSet = new Set(removeIds);
      const prepared = staged.map((s) => ({ id: newId(), mime: s.check.mime, size: s.n.bytes.length, filename: s.n.filename, meta: s.meta, bytes: s.n.bytes }));
      const addedBytes = prepared.reduce((n, p) => n + p.size, 0);
      for (const p of prepared) await store.files.put(cid, 'files', p.id, p.bytes, p.mime);
      const stamp = now().toISOString();
      try {
        await store.tx(cid, async (tx) => {
          const bid = await tx.get('bids', bidId);
          const docs = await tx.list('documents');
          const used = await txUsed(tx);
          if (existingId && !bid) throw new ServiceError('not-found');
          const owned = docs.filter((d) => d.ownerType === 'bid' && d.ownerId === bidId);
          const ownedIds = new Set(owned.map((d) => d.id));
          if ([...removeSet].some((r) => !ownedIds.has(r)) || edits.some((e) => !ownedIds.has(e.id))) throw new ServiceError('not-found');
          const removedBytes = owned.filter((d) => removeSet.has(d.id)).reduce((n, d) => n + d.size, 0);
          if (prepared.length && used - removedBytes + addedBytes > limits.maxTotalBytes) throw capacityError(used - removedBytes, addedBytes, limits.maxTotalBytes);
          tx.set('bids', bidId, {
            ...(bid || {}), ...v.value, id: bidId,
            createdAt: bid ? bid.createdAt : stamp, updatedAt: stamp, synthetic: bid ? !!bid.synthetic : false,
          });
          for (const r of removeSet) tx.delete('documents', r);
          for (const e of edits) {
            if (removeSet.has(e.id)) continue;
            const cur = owned.find((d) => d.id === e.id);
            tx.set('documents', e.id, { ...cur, role: e.role, title: e.title, description: e.description, updatedAt: stamp });
          }
          for (const p of prepared) {
            tx.set('documents', p.id, {
              id: p.id, ownerType: 'bid', ownerId: bidId, role: p.meta.role, category: null, filename: p.filename, mime: p.mime, size: p.size,
              title: p.meta.title, description: p.meta.description, documentDate: null, period: '', tags: [], uploadedAt: stamp, updatedAt: stamp, synthetic: false,
            });
          }
        });
      } catch (e) {
        for (const p of prepared) await store.files.delete(cid, 'files', p.id);
        throw e;
      }
      for (const r of removeSet) await store.files.delete(cid, 'files', r);
      return bidId;
    },

    async deleteBid(cid, id) {
      const removed = await store.tx(cid, async (tx) => {
        const docs = (await tx.list('documents')).filter((d) => d.ownerType === 'bid' && d.ownerId === id);
        docs.forEach((d) => tx.delete('documents', d.id));
        tx.delete('bids', id);
        return docs.map((d) => d.id);
      });
      for (const r of removed) await store.files.delete(cid, 'files', r);
      return { removedFiles: removed.length };
    },

    async listDocuments(cid) { return sortDocuments(orgDocs(await snapshot(cid))); },
    async getDocument(cid, id) { return (await snapshot(cid)).documents.find((d) => d.id === id) || null; },

    // file: { filename, mimeType, bytes }. details: { category?, title?, description?, documentDate?, period?, tags? }
    async uploadDocument(cid, file, details = {}) {
      const check = validateFile({ name: file.filename, size: file.bytes.length, type: file.mimeType }, limits);
      if (!check.ok) throw new ServiceError('invalid', check.message, { fileError: check });
      const m = validateDocumentMeta({ ...details, title: details.title || defaultTitle(file.filename) });
      if (!m.ok) throw new ServiceError('invalid', 'Some details need correcting.', { errors: m.errors });
      const stamp = now().toISOString();
      const record = {
        id: newId(), ownerType: ORG_OWNER, ownerId: ORG_OWNER, role: null, category: m.value.category, filename: file.filename, mime: check.mime, size: file.bytes.length,
        title: m.value.title, description: m.value.description, documentDate: m.value.documentDate, period: m.value.period, tags: m.value.tags,
        uploadedAt: stamp, updatedAt: stamp, synthetic: false,
      };
      await store.files.put(cid, 'files', record.id, file.bytes, check.mime);
      try {
        await store.tx(cid, async (tx) => {
          const used = await txUsed(tx);
          if (used + record.size > limits.maxTotalBytes) throw capacityError(used, record.size, limits.maxTotalBytes);
          tx.set('documents', record.id, record);
        });
      } catch (e) {
        await store.files.delete(cid, 'files', record.id);
        throw e;
      }
      return record;
    },

    async updateDocument(cid, id, input) {
      const m = validateDocumentMeta(input);
      if (!m.ok) throw new ServiceError('invalid', 'Some details need correcting.', { errors: m.errors });
      return store.tx(cid, async (tx) => {
        const cur = await tx.get('documents', id);
        if (!cur || cur.ownerType !== ORG_OWNER) throw new ServiceError('not-found');
        const record = { ...cur, ...m.value, updatedAt: now().toISOString() };
        tx.set('documents', id, record);
        return record;
      });
    },

    async deleteDocument(cid, id) {
      await store.tx(cid, async (tx) => {
        const cur = await tx.get('documents', id);
        if (!cur) throw new ServiceError('not-found');
        tx.delete('documents', id);
      });
      await store.files.delete(cid, 'files', id);
    },

    // The record and the original bytes, or null. Only documents of THIS charity are reachable.
    async getFile(cid, id) {
      const doc = await store.get(cid, 'documents', id);
      if (!doc) return null;
      const f = await store.files.get(cid, 'files', id);
      return f ? { doc, bytes: f.bytes, mime: doc.mime || f.mime } : null;
    },

    async catalogue(cid) {
      const snap = await snapshot(cid);
      if (!snap.profile) snap.profile = { key: PROFILE_KEY, ...(await defaultProfile(cid)) };
      return readCatalogue(snap, now);
    },

    async usage(cid) {
      return { fileCount: (await store.list(cid, 'documents')).length, totalBytes: await usedBytes(cid), maxTotalBytes: limits.maxTotalBytes, maxFileBytes: limits.maxFileBytes };
    },
  };
  return svc;
}
