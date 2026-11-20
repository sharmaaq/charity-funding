// In-memory store: unit, integration and Playwright tests and local development. Same contract as gcp.js.
import { ServiceError } from '../errors.js';
import { checkFileRef, checkRef } from './contract.js';

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

export function createMemoryStore() {
  const charities = new Map(); // cid -> charity
  const data = new Map(); // cid -> Map(coll -> Map(id -> record))
  const files = new Map(); // `${cid}/${kind}/${id}` -> { bytes, mime }
  let queue = Promise.resolve();

  const coll = (cid, name) => {
    if (!data.has(cid)) data.set(cid, new Map());
    const c = data.get(cid);
    if (!c.has(name)) c.set(name, new Map());
    return c.get(name);
  };

  const store = {
    async listCharities() { return [...charities.values()].map(clone).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); },
    async getCharity(cid) { checkRef(cid); return clone(charities.get(cid)) || null; },
    async createCharity(c) {
      checkRef(c.id);
      if (charities.has(c.id)) throw new ServiceError('exists', 'That charity ID is already in use.');
      charities.set(c.id, clone(c));
      return clone(c);
    },
    async updateCharity(cid, patch) {
      checkRef(cid);
      const cur = charities.get(cid);
      if (!cur) throw new ServiceError('not-found');
      const next = { ...cur, ...clone(patch) };
      charities.set(cid, next);
      return clone(next);
    },
    async charitiesForUser(email) {
      const e = String(email).toLowerCase();
      return (await store.listCharities()).filter((c) => (c.members || []).includes(e));
    },
    async get(cid, name, id) { checkRef(cid, name, id); return clone(coll(cid, name).get(id)); },
    async list(cid, name) { checkRef(cid, name); return [...coll(cid, name).values()].map(clone); },

    // Transactions run one at a time. Writes are staged and applied together, or not at all.
    tx(cid, fn) {
      checkRef(cid);
      const run = async () => {
        const writes = [];
        const tx = {
          get: async (name, id) => { checkRef(cid, name, id); return clone(coll(cid, name).get(id)); },
          list: async (name) => { checkRef(cid, name); return [...coll(cid, name).values()].map(clone); },
          set: (name, id, rec) => { checkRef(cid, name, id); writes.push({ op: 'set', name, id, rec: clone(rec) }); },
          add: (name, id, rec) => { checkRef(cid, name, id); writes.push({ op: 'add', name, id, rec: clone(rec) }); },
          delete: (name, id) => { checkRef(cid, name, id); writes.push({ op: 'delete', name, id }); },
        };
        const result = await fn(tx);
        for (const w of writes) if (w.op === 'add' && coll(cid, w.name).has(w.id)) throw new ServiceError('exists', 'That record already exists.');
        for (const w of writes) {
          if (w.op === 'delete') coll(cid, w.name).delete(w.id);
          else coll(cid, w.name).set(w.id, w.rec);
        }
        return result;
      };
      const p = queue.then(run, run);
      queue = p.catch(() => {});
      return p;
    },

    files: {
      async put(cid, kind, id, bytes, mime) { checkFileRef(cid, kind, id); files.set(`${cid}/${kind}/${id}`, { bytes: Buffer.from(bytes), mime }); },
      async get(cid, kind, id) {
        checkFileRef(cid, kind, id);
        const f = files.get(`${cid}/${kind}/${id}`);
        return f ? { bytes: Buffer.from(f.bytes), mime: f.mime } : null;
      },
      async delete(cid, kind, id) { checkFileRef(cid, kind, id); files.delete(`${cid}/${kind}/${id}`); },
    },

    // Tests only.
    _clear() { charities.clear(); data.clear(); files.clear(); },
  };
  return store;
}
