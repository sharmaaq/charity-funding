// The organisation repository, as seen from the browser: a client of the charity-scoped API. It keeps the method names
// and return shapes of the old IndexedDB repository, so the views are unchanged. All rules (validation, the 10 MiB and
// 100 MiB limits, atomic writes) now live on the server; the browser repeats the cheap file checks so the manager gets
// the same messages before anything is uploaded.
import { OrgError, mapError } from './db.js';
import { LIMITS, defaultTitle, validateAttachmentMeta, validateBid, validateFile } from './validation.js';
import { formatYmd, londonParts } from '../timing.js';
import { api } from '../remote/http.js';

export { newId } from '../ids.js';
export const ORG_OWNER = 'organisation';
export const SCHEMA_VERSION = 1;

const enc = encodeURIComponent;

// options: { cid, limits, now }
export function createRepository({ cid, limits: extra = {}, now = () => new Date() }) {
  const today = () => formatYmd(londonParts(now()));
  const base = `/api/charities/${enc(cid)}`;
  const limits = { ...LIMITS, ...extra };

  const repo = {
    readOnly: false,
    limits,

    getProfile: () => api(`${base}/profile`),
    updateProfile: (input) => api(`${base}/profile`, { method: 'PUT', json: input }),

    listBids: () => api(`${base}/bids`),
    getBid: async (id) => {
      try { return await api(`${base}/bids/${enc(id)}`); } catch (e) { if (e.code === 'not-found') return null; throw e; }
    },

    // input: { id?, fields, newFiles: [{ file, role, title?, description? }], attachmentEdits: [{ id, role, title, description }], removeIds: [id] }
    // Bid record, new files, metadata edits and removals commit together or not at all (one server transaction).
    async saveBid(input) {
      const { id = null, fields, newFiles = [], attachmentEdits = [], removeIds = [] } = input || {};
      // The same pre-checks the server makes, so the manager sees every problem at once before anything is uploaded.
      const v = validateBid(fields, today());
      const errors = { ...v.errors };
      const fileErrors = [];
      for (const e of attachmentEdits) {
        const m = validateAttachmentMeta(e);
        if (!m.ok) fileErrors.push({ id: e.id, errors: m.errors });
      }
      for (const n of newFiles) {
        const check = validateFile(n.file, limits);
        const meta = validateAttachmentMeta({ role: n.role, title: n.title || defaultTitle(n.file && n.file.name), description: n.description });
        if (!check.ok) fileErrors.push({ name: n.file && n.file.name, message: check.message });
        else if (!meta.ok) fileErrors.push({ name: n.file.name, errors: meta.errors });
      }
      if (!v.ok || fileErrors.length) throw new OrgError('invalid', undefined, { errors, fileErrors });
      const form = new FormData();
      form.append('payload', JSON.stringify({
        fields, attachmentEdits, removeIds,
        newFiles: newFiles.map((n) => ({ role: n.role, title: n.title || defaultTitle(n.file.name), description: n.description })),
      }));
      newFiles.forEach((n, i) => form.append(`file${i}`, n.file, n.file.name));
      const res = await api(id ? `${base}/bids/${enc(id)}` : `${base}/bids`, { method: id ? 'PUT' : 'POST', form });
      return res.id;
    },

    deleteBid: (id) => api(`${base}/bids/${enc(id)}`, { method: 'DELETE' }),

    listDocuments: () => api(`${base}/documents`),
    getDocument: async (id) => {
      try { return await api(`${base}/documents/${enc(id)}`); } catch (e) { if (e.code === 'not-found') return null; throw e; }
    },

    // One request per file. `details`: { category?, title?, description?, documentDate?, period?, tags? }.
    async uploadDocument(file, details = {}) {
      const check = validateFile(file, limits);
      if (!check.ok) throw new OrgError('invalid', check.message, { fileError: check });
      const form = new FormData();
      form.append('details', JSON.stringify({ ...details, title: details.title || defaultTitle(file.name) }));
      form.append('file', file, file.name);
      return api(`${base}/documents`, { method: 'POST', form });
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

    updateDocument: (id, input) => api(`${base}/documents/${enc(id)}`, { method: 'PUT', json: input }),
    async deleteDocument(id) { await api(`${base}/documents/${enc(id)}`, { method: 'DELETE' }); },

    // The original bytes, exactly as uploaded (null when the file is not stored).
    async getBlob(id) {
      try { return await api(`${base}/documents/${enc(id)}/file`, { blob: true }); } catch (e) { if (e.code === 'not-found') return null; throw e; }
    },

    // Source catalogue for later features: the profile, every bid with its outcome, summary, feedback and notes,
    // and every live document's metadata. Original bytes come from getBlob(id). Status is "Stored", never "indexed".
    catalogue: () => api(`${base}/catalogue`),
    usage: () => api(`${base}/usage`),

    // Seeding is an administrator action on the server now; nothing is seeded from the browser.
    async seedOnce() { return { seeded: false }; },
  };
  return repo;
}
