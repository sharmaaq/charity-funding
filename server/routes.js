// The platform API: /api/me, /api/charities/{cid}/..., /api/admin/*.
//
// Rules enforced here, for every route:
//  - the caller is already authenticated (server.js); identity comes only from the verified IAP JWT;
//  - every write must be same-origin (Origin host equals Host);
//  - /api/charities/{cid}/... checks membership (or admin) on EVERY call before touching data, and answers 404 with the
//    same body for a charity that does not exist and one the caller may not open, so IDs cannot be probed;
//  - /api/admin/* answers 404 to non-admins;
//  - the charity ID passed to the services is the validated ID from the path, never anything else the client sent.
import { randomUUID } from 'node:crypto';
import { ServiceError } from './errors.js';
import { isEmail, normaliseEmail } from './config.js';
import { CHARITY_ID_RE, COLLECTIONS, RECORD_ID_RE } from './store/contract.js';
import { notFoundBody, parseJsonField, readJson, readUpload, sameOrigin, sendError, sendFile, sendJson } from './http.js';
import { createOrgService } from './services/org.js';
import { createApplicationService } from './services/applications.js';
import { createWorkspaceService } from './services/workspace.js';
import { DEFAULT_THEME, GENERIC_CHARITY_NOTICE, seedCharity, seedAll, CHARITIES } from './seed/index.js';

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_MEMBERS = 200;

export const publicCharity = (c) => ({ id: c.id, name: c.name, website: c.website || '', theme: c.theme || { ...DEFAULT_THEME }, notice: c.notice || { ...GENERIC_CHARITY_NOTICE } });

// Lower-case slug from a name: letters, digits and single hyphens, at most 40 characters.
export function slugify(name) {
  const s = String(name).toLowerCase().normalize('NFKD').replace(/[^\x00-\x7f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return s;
}

function validateNewCharity(input) {
  const i = input || {};
  const errors = {};
  const name = String(i.name ?? '').trim();
  if (!name) errors.name = 'Enter the charity name.';
  else if (name.length > 100) errors.name = 'The name must be 100 characters or fewer.';
  const website = String(i.website ?? '').trim();
  let siteOk = false;
  try { const u = new URL(website); siteOk = u.protocol === 'https:' && u.hostname !== '' && website.length <= 300; } catch { /* not a URL */ }
  if (!siteOk) errors.website = 'Enter the charity\'s website address, starting with https://.';
  let id = String(i.id ?? '').trim() || slugify(name);
  if (!CHARITY_ID_RE.test(id) || id.length < 2) errors.id = 'The ID must be 2 to 40 characters: lower-case letters, digits and hyphens.';
  if (Object.keys(errors).length) throw new ServiceError('invalid', 'Some details need correcting.', { errors });
  return { id, name, website };
}

// ctx: { store, config, now, limits, dev }   dev: true only in local/test mode (memory store, DEV_USER_EMAIL)
export function createRoutes({ store, config, now = () => new Date(), limits = {}, devDefaults = null }) {
  const org = createOrgService(store, { now, limits });
  const apps = createApplicationService(store, { now, limits });
  const workspace = createWorkspaceService(store, { now });
  const routes = [];
  const add = (method, pattern, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-z]+)/gi, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, pattern });
  };

  async function audit(cid, user, action, detail = {}) {
    const rec = { id: randomUUID(), at: now().toISOString(), by: user.email, action, detail };
    await store.tx(cid, async (tx) => { tx.add('audit', rec.id, rec); });
  }

  // ---------------------------------------------------------------- /api/me
  add('GET', '/api/me', async ({ user, res }) => {
    const list = user.isAdmin ? await store.listCharities() : await store.charitiesForUser(user.email);
    sendJson(res, 200, { email: user.email, isAdmin: user.isAdmin, charities: list.map(publicCharity) });
  });

  // ---------------------------------------------------------------- charity-scoped: C(...) wraps the membership guard
  const C = (handler) => async (c) => {
    const { cid, user, res } = c;
    const charity = CHARITY_ID_RE.test(cid) ? await store.getCharity(cid) : null;
    if (!charity || !(user.isAdmin || (charity.members || []).includes(user.email))) return sendJson(res, 404, notFoundBody());
    return handler({ ...c, charity });
  };
  const rid = (c, key = 'id') => {
    const v = c.params[key];
    if (!RECORD_ID_RE.test(v)) throw new ServiceError('not-found');
    return v;
  };
  const found = (v) => { if (v === null || v === undefined) throw new ServiceError('not-found'); return v; };
  const P = '/api/charities/:cid';

  add('GET', P, C(({ charity, res }) => sendJson(res, 200, publicCharity(charity))));

  // workspace: opportunities, decisions, discovery settings
  add('GET', `${P}/workspace`, C(async ({ cid, res }) => sendJson(res, 200, await workspace.load(cid))));
  add('PUT', `${P}/decisions/:oid`, C(async ({ cid, req, res, params }) => sendJson(res, 200, await workspace.setDecision(cid, rid({ params }, 'oid'), await readJson(req)))));
  add('PUT', `${P}/discovery-settings`, C(async ({ cid, req, res }) => sendJson(res, 200, await workspace.updateSettings(cid, await readJson(req)))));

  // organisation profile
  add('GET', `${P}/profile`, C(async ({ cid, res }) => sendJson(res, 200, await org.getProfile(cid))));
  add('PUT', `${P}/profile`, C(async ({ cid, req, res }) => sendJson(res, 200, await org.updateProfile(cid, await readJson(req)))));
  add('GET', `${P}/catalogue`, C(async ({ cid, res }) => sendJson(res, 200, await org.catalogue(cid))));
  add('GET', `${P}/usage`, C(async ({ cid, res }) => sendJson(res, 200, await org.usage(cid))));

  // past bids. Save: multipart { payload: JSON { fields, attachmentEdits, removeIds, newFiles: [{ role, title, description }] }, file0..fileN }
  const saveBid = (id) => C(async ({ cid, req, res }) => {
    const up = await readUpload(req, { maxFileBytes: org.limits.maxFileBytes });
    const payload = parseJsonField(up.fields.payload, 'The bid');
    const newFiles = (Array.isArray(payload.newFiles) ? payload.newFiles : []).map((n, i) => {
      const f = up.files.find((x) => x.field === `file${i}`);
      if (!f) throw new ServiceError('invalid', 'A file is missing from the upload.');
      return { role: n.role, title: n.title, description: n.description, filename: f.filename, mimeType: f.mimeType, bytes: f.bytes };
    });
    const saved = await org.saveBid(cid, { id: id ? id(req) : null, fields: payload.fields, attachmentEdits: payload.attachmentEdits || [], removeIds: payload.removeIds || [], newFiles });
    sendJson(res, 200, { id: saved });
  });
  add('GET', `${P}/bids`, C(async ({ cid, res }) => sendJson(res, 200, await org.listBids(cid))));
  add('POST', `${P}/bids`, saveBid(null));
  add('GET', `${P}/bids/:id`, C(async ({ cid, res, params }) => sendJson(res, 200, found(await org.getBid(cid, rid({ params }))))));
  add('PUT', `${P}/bids/:id`, (c) => saveBid(() => rid(c))(c));
  add('DELETE', `${P}/bids/:id`, C(async ({ cid, res, params }) => sendJson(res, 200, await org.deleteBid(cid, rid({ params })))));

  // organisation documents. Upload: multipart { details: JSON, file }
  add('GET', `${P}/documents`, C(async ({ cid, res }) => sendJson(res, 200, await org.listDocuments(cid))));
  add('POST', `${P}/documents`, C(async ({ cid, req, res }) => {
    const up = await readUpload(req, { maxFiles: 1, maxFileBytes: org.limits.maxFileBytes });
    const f = up.files.find((x) => x.field === 'file');
    if (!f) throw new ServiceError('invalid', 'No file was sent.');
    const details = up.fields.details ? parseJsonField(up.fields.details, 'The document details') : {};
    sendJson(res, 200, await org.uploadDocument(cid, f, details));
  }));
  add('GET', `${P}/documents/:id`, C(async ({ cid, res, params }) => sendJson(res, 200, found(await org.getDocument(cid, rid({ params }))))));
  add('PUT', `${P}/documents/:id`, C(async ({ cid, req, res, params }) => sendJson(res, 200, await org.updateDocument(cid, rid({ params }), await readJson(req)))));
  add('DELETE', `${P}/documents/:id`, C(async ({ cid, res, params }) => { await org.deleteDocument(cid, rid({ params })); sendJson(res, 200, {}); }));
  add('GET', `${P}/documents/:id/file`, C(async ({ cid, res, params }) => {
    const f = found(await org.getFile(cid, rid({ params })));
    sendFile(res, { bytes: f.bytes, mime: f.mime, filename: f.doc.filename });
  }));

  // applications
  add('GET', `${P}/applications`, C(async ({ cid, res }) => sendJson(res, 200, await apps.list(cid))));
  add('POST', `${P}/applications/get-or-create`, C(async ({ cid, req, res }) => {
    const b = await readJson(req);
    sendJson(res, 200, await apps.getOrCreate(cid, b.grantId, b.initialAnswers));
  }));
  add('GET', `${P}/applications/by-grant/:grantId`, C(async ({ cid, res, params }) => sendJson(res, 200, { application: await apps.getByGrant(cid, rid({ params }, 'grantId')) })));
  add('GET', `${P}/applications/:id`, C(async ({ cid, res, params }) => sendJson(res, 200, { application: await apps.get(cid, rid({ params })) })));
  add('PUT', `${P}/applications/:id/answers`, C(async ({ cid, req, res, params }) => sendJson(res, 200, await apps.save(cid, rid({ params }), await readJson(req)))));
  add('PUT', `${P}/applications/:id/proposal-replacement`, C(async ({ cid, req, res, params }) => {
    const id = rid({ params });
    if (/^application\/json/i.test(req.headers['content-type'] || '')) {
      const b = await readJson(req);
      if (b.replacement !== null && (typeof b.replacement !== 'object' || b.replacement === undefined)) throw new ServiceError('invalid', 'Send the file as multipart/form-data.');
      return sendJson(res, 200, await apps.setProposalReplacement(cid, id, { expectedRevision: b.expectedRevision, replacement: b.replacement }));
    }
    const up = await readUpload(req, { maxFiles: 1, maxFileBytes: org.limits.maxFileBytes });
    const f = up.files.find((x) => x.field === 'file');
    const meta = parseJsonField(up.fields.meta, 'The proposal details');
    if (!f) throw new ServiceError('invalid', 'No file was sent.');
    return sendJson(res, 200, await apps.setProposalReplacement(cid, id, { expectedRevision: meta.expectedRevision, replacement: meta.replacement, bytes: f.bytes }));
  }));
  add('GET', `${P}/applications/:id/proposal-replacement/file`, C(async ({ cid, res, params }) => sendFile(res, found(await apps.getProposalReplacementFile(cid, rid({ params }))))));
  add('GET', `${P}/applications/:id/snapshots`, C(async ({ cid, res, params }) => sendJson(res, 200, await apps.listSnapshots(cid, rid({ params })))));
  // Freeze: multipart { snapshot: JSON, file0..fileN } in attachment order.
  add('POST', `${P}/applications/:id/snapshots`, C(async ({ cid, req, res, params }) => {
    const id = rid({ params });
    const up = await readUpload(req, { maxFiles: 4 });
    const snapshot = parseJsonField(up.fields.snapshot, 'The package');
    const files = (Array.isArray(snapshot.attachments) ? snapshot.attachments : []).map((_, i) => {
      const f = up.files.find((x) => x.field === `file${i}`);
      if (!f) throw new ServiceError('invalid', 'A package file is missing from the upload.');
      return { bytes: f.bytes };
    });
    sendJson(res, 200, await apps.freezeSnapshot(cid, id, { snapshot, files }));
  }));
  add('GET', `${P}/snapshots/:id`, C(async ({ cid, res, params }) => sendJson(res, 200, { snapshot: await apps.getSnapshot(cid, rid({ params })) })));
  add('GET', `${P}/snapshots/:id/files`, C(async ({ cid, res, params }) => sendJson(res, 200, await apps.getSnapshotFiles(cid, rid({ params })))));
  add('GET', `${P}/snapshots/:id/files/:fid`, C(async ({ cid, res, params }) => {
    const f = found(await apps.getSnapshotFile(cid, rid({ params }), rid({ params }, 'fid')));
    sendFile(res, { bytes: f.bytes, mime: f.rec.mime, filename: f.rec.filename });
  }));

  // attempts and receipts
  add('POST', `${P}/attempts/acquire`, C(async ({ cid, req, res, user }) => sendJson(res, 200, await apps.acquireAttempt(cid, await readJson(req), user.email))));
  add('POST', `${P}/attempts/finish`, C(async ({ cid, req, res }) => { const b = await readJson(req); sendJson(res, 200, await apps.finishAttempt(cid, b.attempt, b.receipt || null)); }));
  add('POST', `${P}/attempts/interrupt`, C(async ({ cid, req, res }) => {
    const b = await readJson(req);
    if (!Array.isArray(b.ids) || b.ids.some((x) => !RECORD_ID_RE.test(String(x)))) throw new ServiceError('invalid', 'The attempt list is not in the expected format.');
    sendJson(res, 200, await apps.markInterrupted(cid, b.ids, String(b.message || '')));
  }));
  add('GET', `${P}/attempts`, C(async ({ cid, res }) => sendJson(res, 200, await apps.listAttempts(cid))));
  add('GET', `${P}/receipts`, C(async ({ cid, res }) => sendJson(res, 200, await apps.listReceipts(cid))));

  // ---------------------------------------------------------------- admin (404 for everyone else)
  const A = (handler) => async (c) => (c.user.isAdmin ? handler(c) : sendJson(c.res, 404, notFoundBody()));
  const memberEmail = (v) => {
    const e = normaliseEmail(v);
    if (!isEmail(e)) throw new ServiceError('invalid', 'Enter a valid email address.');
    return e;
  };
  add('GET', '/api/admin/charities', A(async ({ res }) => sendJson(res, 200, (await store.listCharities()).map((c) => ({ ...publicCharity(c), members: c.members || [], createdAt: c.createdAt, createdBy: c.createdBy })))));
  add('POST', '/api/admin/charities', A(async ({ req, res, user }) => {
    const v = validateNewCharity(await readJson(req));
    const charity = await store.createCharity({ ...v, theme: { ...DEFAULT_THEME }, notice: { ...GENERIC_CHARITY_NOTICE }, members: [], createdAt: now().toISOString(), createdBy: user.email });
    await audit(charity.id, user, 'charity.create', { name: charity.name, website: charity.website });
    sendJson(res, 200, { ...publicCharity(charity), members: [] });
  }));
  const adminCharity = async (cid) => {
    const c = CHARITY_ID_RE.test(cid) ? await store.getCharity(cid) : null;
    if (!c) throw new ServiceError('not-found');
    return c;
  };
  add('PUT', '/api/admin/charities/:cid/members', A(async ({ req, res, user, params }) => {
    await adminCharity(params.cid);
    const b = await readJson(req);
    if (!Array.isArray(b.members) || b.members.length > MAX_MEMBERS) throw new ServiceError('invalid', 'Send a list of member email addresses.');
    const members = [...new Set(b.members.map(memberEmail))].sort();
    const next = await store.updateCharity(params.cid, { members });
    await audit(params.cid, user, 'members.set', { count: members.length });
    sendJson(res, 200, { id: next.id, members: next.members });
  }));
  add('POST', '/api/admin/charities/:cid/members', A(async ({ req, res, user, params }) => {
    const c = await adminCharity(params.cid);
    const email = memberEmail((await readJson(req)).email);
    const members = [...new Set([...(c.members || []), email])].sort();
    if (members.length > MAX_MEMBERS) throw new ServiceError('invalid', `A charity can have at most ${MAX_MEMBERS} members.`);
    const next = await store.updateCharity(params.cid, { members });
    await audit(params.cid, user, 'member.add', { email });
    sendJson(res, 200, { id: next.id, members: next.members });
  }));
  add('DELETE', '/api/admin/charities/:cid/members/:email', A(async ({ res, user, params }) => {
    const c = await adminCharity(params.cid);
    const email = memberEmail(decodeURIComponent(params.email));
    const next = await store.updateCharity(params.cid, { members: (c.members || []).filter((m) => m !== email) });
    await audit(params.cid, user, 'member.remove', { email });
    sendJson(res, 200, { id: next.id, members: next.members });
  }));
  add('POST', '/api/admin/charities/:cid/seed', A(async ({ res, user, params }) => {
    if (!CHARITIES[params.cid]) throw new ServiceError('not-found');
    const out = await seedCharity(store, params.cid, { now });
    await audit(params.cid, user, 'seed', { seeded: out.seeded });
    sendJson(res, 200, out);
  }));

  // ---------------------------------------------------------------- development only
  if (devDefaults) {
    // Read-only view of a stored collection, for tests that check what the server holds. Exists only with the dev identity.
    add('GET', '/api/dev/state/:cid/:coll', async ({ res, params }) => {
      if (!CHARITY_ID_RE.test(params.cid) || !COLLECTIONS.includes(params.coll)) return sendJson(res, 404, notFoundBody());
      sendJson(res, 200, { records: await store.list(params.cid, params.coll) });
    });
    add('POST', '/api/dev/reset', async ({ req, res }) => {
      const body = /^application\/json/i.test(req.headers['content-type'] || '') ? await readJson(req) : {};
      store._clear();
      await seedAll(store, { now });
      const members = { ...devDefaults.members, ...(body.members || {}) };
      for (const [cid, list] of Object.entries(members)) await store.updateCharity(cid, { members: list.map(normaliseEmail) });
      sendJson(res, 200, { ok: true });
    });
  }

  // ---------------------------------------------------------------- dispatch
  // Resolves true when the path belongs to this router (a response was sent), false otherwise.
  async function handle(req, res, pathname, user) {
    for (const r of routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      if (r.method !== req.method && !(r.method === 'GET' && req.method === 'HEAD')) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = m[i + 1]; });
      if (WRITE.has(req.method) && !sameOrigin(req)) {
        sendJson(res, 403, { code: 'ORIGIN_REJECTED', message: 'This endpoint only accepts requests from this application.' });
        return true;
      }
      try {
        await r.handler({ req, res, user, params, cid: params.cid });
      } catch (e) {
        if (!(e instanceof ServiceError) && process.env.NODE_ENV !== 'test') console.error(JSON.stringify({ event: 'route-error', route: r.method + ' ' + r.re.source, message: String(e && e.message) }));
        sendError(res, e);
      }
      return true;
    }
    // A known path with a different method gets 405; anything else is not ours.
    const pathMatches = routes.some((r) => r.re.test(pathname));
    if (pathMatches) { sendJson(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' }); return true; }
    return false;
  }
  // Every route as "METHOD pattern" (the isolation tests check that each charity-scoped one is covered).
  handle.patterns = routes.map((r) => `${r.method} ${r.pattern}`);
  return handle;
}
