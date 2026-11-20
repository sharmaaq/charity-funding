// Firestore (Native mode) for records and one private Cloud Storage bucket for file bytes.
// Layout: charities/{cid}, charities/{cid}/{collection}/{id}, gs://<bucket>/charities/{cid}/{kind}/{id}.
// Credentials come from the Cloud Run service account (application default credentials); `authClient` is only passed
// by the seed script when it runs on a developer machine.
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { ServiceError } from '../errors.js';
import { checkFileRef, checkRef } from './contract.js';

const ALREADY_EXISTS = 6;
const NOT_FOUND = 5;

// options: { projectId, bucket, authClient? }
export function createGcpStore({ projectId, bucket, authClient }) {
  const auth = authClient ? { authClient } : {};
  const db = new Firestore({ projectId, ignoreUndefinedProperties: true, ...auth });
  const storage = new Storage({ projectId, ...auth });
  const bkt = storage.bucket(bucket);

  const charityRef = (cid) => db.collection('charities').doc(cid);
  const colRef = (cid, name) => charityRef(cid).collection(name);
  const docRef = (cid, name, id) => colRef(cid, name).doc(id);
  const objectName = (cid, kind, id) => `charities/${cid}/${kind}/${id}`;

  const store = {
    async listCharities() {
      const snap = await db.collection('charities').get();
      return snap.docs.map((d) => d.data()).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },
    async getCharity(cid) {
      checkRef(cid);
      const s = await charityRef(cid).get();
      return s.exists ? s.data() : null;
    },
    async createCharity(c) {
      checkRef(c.id);
      try {
        await charityRef(c.id).create(c);
      } catch (e) {
        if (e && e.code === ALREADY_EXISTS) throw new ServiceError('exists', 'That charity ID is already in use.');
        throw e;
      }
      return c;
    },
    async updateCharity(cid, patch) {
      checkRef(cid);
      return db.runTransaction(async (t) => {
        const s = await t.get(charityRef(cid));
        if (!s.exists) throw new ServiceError('not-found');
        const next = { ...s.data(), ...patch };
        t.set(charityRef(cid), next);
        return next;
      });
    },
    async charitiesForUser(email) {
      const snap = await db.collection('charities').where('members', 'array-contains', String(email).toLowerCase()).get();
      return snap.docs.map((d) => d.data()).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },
    async get(cid, name, id) {
      checkRef(cid, name, id);
      const s = await docRef(cid, name, id).get();
      return s.exists ? s.data() : undefined;
    },
    async list(cid, name) {
      checkRef(cid, name);
      return (await colRef(cid, name).get()).docs.map((d) => d.data());
    },
    tx(cid, fn) {
      checkRef(cid);
      return db.runTransaction(async (t) => {
        const writes = [];
        const tx = {
          get: async (name, id) => { checkRef(cid, name, id); const s = await t.get(docRef(cid, name, id)); return s.exists ? s.data() : undefined; },
          list: async (name) => { checkRef(cid, name); return (await t.get(colRef(cid, name))).docs.map((d) => d.data()); },
          set: (name, id, rec) => { checkRef(cid, name, id); writes.push({ op: 'set', name, id, rec }); },
          add: (name, id, rec) => { checkRef(cid, name, id); writes.push({ op: 'add', name, id, rec }); },
          delete: (name, id) => { checkRef(cid, name, id); writes.push({ op: 'delete', name, id }); },
        };
        const result = await fn(tx);
        for (const w of writes) {
          const ref = docRef(cid, w.name, w.id);
          if (w.op === 'set') t.set(ref, w.rec);
          else if (w.op === 'add') t.create(ref, w.rec);
          else t.delete(ref);
        }
        return result;
      }).catch((e) => {
        if (e && e.code === ALREADY_EXISTS) throw new ServiceError('exists', 'That record already exists.');
        throw e;
      });
    },
    files: {
      async put(cid, kind, id, bytes, mime) {
        checkFileRef(cid, kind, id);
        await bkt.file(objectName(cid, kind, id)).save(Buffer.from(bytes), { contentType: mime || 'application/octet-stream', resumable: false });
      },
      async get(cid, kind, id) {
        checkFileRef(cid, kind, id);
        const file = bkt.file(objectName(cid, kind, id));
        try {
          const [bytes] = await file.download();
          const [meta] = await file.getMetadata();
          return { bytes, mime: meta.contentType || 'application/octet-stream' };
        } catch (e) {
          if (e && (e.code === 404 || e.code === NOT_FOUND)) return null;
          throw e;
        }
      },
      async delete(cid, kind, id) {
        checkFileRef(cid, kind, id);
        try { await bkt.file(objectName(cid, kind, id)).delete({ ignoreNotFound: true }); } catch { /* best effort */ }
      },
    },
  };
  return store;
}
