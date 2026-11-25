// The isolation suite (S4-001 Phase 1). Two charities, five kinds of user. Every charity-scoped route is called as each
// user: members and administrators get the real answer, everyone else gets 404 with the very same body an unknown
// charity gets, and nothing in the charity changes. A coverage test fails if a charity-scoped route has no case here.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startHarness, USERS } from './harness.js';
import { createRoutes } from '../../server/routes.js';
import { readConfig } from '../../server/config.js';
import { createMemoryStore } from '../../server/store/memory.js';
import { createServer } from '../../server.js';

const CHARITIES = { 'your-place': { member: 'a', other: 'b' }, 'our-time': { member: 'b', other: 'a' } };
const NOT_FOUND = { code: 'NOT_FOUND', message: 'Not found.' };
const PDF = Buffer.from('%PDF-1.7\nsynthetic isolation test file');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const uuid = () => crypto.randomUUID();

let h;
const fx = {}; // per-charity fixture ids

function file(name, bytes, type) { return new Blob([bytes], { type }); }
function bidForm(title = 'Isolation bid') {
  const fd = new FormData();
  fd.append('payload', JSON.stringify({ fields: { title, funder: 'Funder', outcome: 'unknown' }, attachmentEdits: [], removeIds: [], newFiles: [{ role: 'bid-document', title: 'Bid' }] }));
  fd.append('file0', file('b.txt', 'bid text', 'text/plain'), 'b.txt');
  return fd;
}
function docForm() {
  const fd = new FormData();
  fd.append('details', JSON.stringify({ category: 'general', title: 'Doc' }));
  fd.append('file', file('d.txt', 'doc text', 'text/plain'), 'd.txt');
  return fd;
}
async function addSnapshot(cid, applicationId, extra = {}) {
  const id = uuid();
  const fileId = uuid();
  await h.store.files.put(cid, 'submission-files', fileId, PDF, 'application/pdf');
  await h.store.tx(cid, async (tx) => {
    tx.add('submissionSnapshots', id, { id, applicationId, grantId: 'G-001', revision: 1, payloadHash: sha(Buffer.from(id)), attachments: [], ...extra });
    tx.add('submissionFiles', fileId, { id: fileId, snapshotId: id, order: 0, role: 'proposal', filename: 'p.pdf', mime: 'application/pdf', size: PDF.length, sha256: sha(PDF) });
  });
  return { id, fileId };
}

test.before(async () => {
  h = await startHarness();
  // Our Time has no opportunities of its own; give it one so its application routes can be exercised.
  await h.store.tx('our-time', async (tx) => { tx.set('opportunities', 'G-001', { id: 'G-001', name: 'Test grant', funder: 'F', assessment: 'suitable', order: 0 }); });
  for (const [cid, { member }] of Object.entries(CHARITIES)) {
    const f = (fx[cid] = {});
    const bid = await h.call(member, 'POST', `/api/charities/${cid}/bids`, { form: bidForm() });
    assert.equal(bid.status, 200, JSON.stringify(bid.body));
    f.bidId = bid.body.id;
    f.bidDocId = (await h.call(member, 'GET', `/api/charities/${cid}/bids/${f.bidId}`)).body.attachments[0].id;
    const doc = await h.call(member, 'POST', `/api/charities/${cid}/documents`, { form: docForm() });
    assert.equal(doc.status, 200, JSON.stringify(doc.body));
    f.docId = doc.body.id;
    const app = await h.call(member, 'POST', `/api/charities/${cid}/applications/get-or-create`, { json: { grantId: 'G-001', initialAnswers: { 'org.name': { value: 'x' } } } });
    assert.equal(app.status, 200, JSON.stringify(app.body));
    f.appId = app.body.application.id;
    const repl = new FormData();
    repl.append('meta', JSON.stringify({ expectedRevision: 1, replacement: { filename: 'mine.pdf', size: PDF.length, sha256: sha(PDF), pageCount: 1, managerChecked: true, checkedAt: 'now' } }));
    repl.append('file', file('mine.pdf', PDF, 'application/pdf'), 'mine.pdf');
    const r = await h.call(member, 'PUT', `/api/charities/${cid}/applications/${f.appId}/proposal-replacement`, { form: repl });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const snap = await addSnapshot(cid, f.appId);
    f.snapId = snap.id;
    f.snapFileId = snap.fileId;
    await h.call(member, 'PUT', R(cid, '/discovery-settings'), { json: { brief: 'Isolation brief' } });
    const run = await h.call(member, 'POST', R(cid, '/discover'), { json: {} });
    assert.equal(run.status, 200, JSON.stringify(run.body));
    f.jobId = run.body.jobId;
    await idle(cid);
    const th = await h.call(member, 'POST', R(cid, '/threads'), { json: { grantId: 'G-001', text: 'Isolation question' } });
    assert.equal(th.status, 200, JSON.stringify(th.body));
    f.threadId = th.body.thread.id;
    await idleThread(cid, f.threadId);
  }
});
test.after(() => h.close());

// ---------------------------------------------------------------------------------------------- the route table
// Each case: pattern (as the router declares it), build(cid, f) -> request, and the status a permitted caller gets.
const R = (cid, p) => `/api/charities/${cid}${p}`;
const CASES = [
  { p: 'GET /api/charities/:cid', build: (cid) => ['GET', R(cid, '')] },
  { p: 'GET /api/charities/:cid/workspace', build: (cid) => ['GET', R(cid, '/workspace')] },
  { p: 'PUT /api/charities/:cid/decisions/:oid', build: (cid) => ['PUT', R(cid, '/decisions/G-001'), { json: { workflow: 'watchlist', override: false } }] },
  { p: 'PUT /api/charities/:cid/notes/:oid', build: (cid) => ['PUT', R(cid, '/notes/G-001'), { json: { text: 'A note' } }] },
  { p: 'GET /api/charities/:cid/ai/models', build: (cid) => ['GET', R(cid, '/ai/models')] },
  { p: 'GET /api/charities/:cid/discover/active', build: (cid) => ['GET', R(cid, '/discover/active')] },
  { p: 'POST /api/charities/:cid/discover', build: async (cid) => { await idle(cid); return ['POST', R(cid, '/discover'), { json: {} }]; } },
  { p: 'GET /api/charities/:cid/jobs/:jid/events', build: (cid, f) => ['GET', R(cid, `/jobs/${f.jobId}/events`)] },
  { p: 'GET /api/charities/:cid/assessments/:oid', build: (cid) => ['GET', R(cid, '/assessments/G-001')] },
  { p: 'POST /api/charities/:cid/opportunities/:oid/assess', build: async (cid) => { await idleAssess(cid); return ['POST', R(cid, '/opportunities/G-001/assess'), { json: {} }]; } },
  { p: 'GET /api/charities/:cid/threads', build: (cid) => ['GET', R(cid, '/threads')] },
  { p: 'POST /api/charities/:cid/threads', build: (cid) => ['POST', R(cid, '/threads'), { json: { grantId: 'G-001', text: 'Another discussion' } }] },
  { p: 'GET /api/charities/:cid/threads/:id', build: (cid, f) => ['GET', R(cid, `/threads/${f.threadId}`)] },
  { p: 'PATCH /api/charities/:cid/threads/:id', build: (cid, f) => ['PATCH', R(cid, `/threads/${f.threadId}`), { json: { title: 'Renamed discussion' } }] },
  { p: 'POST /api/charities/:cid/threads/:id/messages', build: async (cid, f, user) => { await idleThread(cid, f.threadId); return ['POST', R(cid, `/threads/${f.threadId}/messages`), { json: { text: 'And another question' } }]; } },
  { p: 'DELETE /api/charities/:cid/threads/:id', build: async (cid, f) => { if (f.disposableThread) await idleThread(cid, f.disposableThread); return ['DELETE', R(cid, `/threads/${f.disposableThread || f.threadId}`)]; }, disposable: 'thread' },
  { p: 'PUT /api/charities/:cid/discovery-settings', build: (cid) => ['PUT', R(cid, '/discovery-settings'), { json: { hideUnsuitable: true } }] },
  { p: 'GET /api/charities/:cid/profile', build: (cid) => ['GET', R(cid, '/profile')] },
  { p: 'PUT /api/charities/:cid/profile', build: (cid) => ['PUT', R(cid, '/profile'), { json: { overview: 'Changed overview' } }] },
  { p: 'GET /api/charities/:cid/catalogue', build: (cid) => ['GET', R(cid, '/catalogue')] },
  { p: 'GET /api/charities/:cid/usage', build: (cid) => ['GET', R(cid, '/usage')] },
  { p: 'GET /api/charities/:cid/bids', build: (cid) => ['GET', R(cid, '/bids')] },
  { p: 'POST /api/charities/:cid/bids', build: (cid) => ['POST', R(cid, '/bids'), { form: bidForm('Another') }] },
  { p: 'GET /api/charities/:cid/bids/:id', build: (cid, f) => ['GET', R(cid, `/bids/${f.bidId}`)] },
  { p: 'PUT /api/charities/:cid/bids/:id', build: (cid, f) => ['PUT', R(cid, `/bids/${f.bidId}`), { form: (() => { const fd = new FormData(); fd.append('payload', JSON.stringify({ fields: { title: 'Renamed', funder: 'Funder', outcome: 'unknown' }, attachmentEdits: [], removeIds: [], newFiles: [] })); return fd; })() }] },
  { p: 'DELETE /api/charities/:cid/bids/:id', build: (cid, f) => ['DELETE', R(cid, `/bids/${f.disposableBid || f.bidId}`)], disposable: 'bid' },
  { p: 'GET /api/charities/:cid/documents', build: (cid) => ['GET', R(cid, '/documents')] },
  { p: 'POST /api/charities/:cid/documents', build: (cid) => ['POST', R(cid, '/documents'), { form: docForm() }] },
  { p: 'GET /api/charities/:cid/documents/:id', build: (cid, f) => ['GET', R(cid, `/documents/${f.docId}`)] },
  { p: 'PUT /api/charities/:cid/documents/:id', build: (cid, f) => ['PUT', R(cid, `/documents/${f.docId}`), { json: { title: 'Retitled', category: 'general' } }] },
  { p: 'GET /api/charities/:cid/documents/:id/file', build: (cid, f) => ['GET', R(cid, `/documents/${f.docId}/file`)] },
  { p: 'DELETE /api/charities/:cid/documents/:id', build: (cid, f) => ['DELETE', R(cid, `/documents/${f.disposableDoc || f.docId}`)], disposable: 'doc' },
  { p: 'GET /api/charities/:cid/applications', build: (cid) => ['GET', R(cid, '/applications')] },
  { p: 'POST /api/charities/:cid/applications/get-or-create', build: (cid) => ['POST', R(cid, '/applications/get-or-create'), { json: { grantId: 'G-001', initialAnswers: {} } }] },
  { p: 'GET /api/charities/:cid/applications/by-grant/:grantId', build: (cid) => ['GET', R(cid, '/applications/by-grant/G-001')] },
  { p: 'GET /api/charities/:cid/applications/:id', build: (cid, f) => ['GET', R(cid, `/applications/${f.appId}`)] },
  { p: 'PUT /api/charities/:cid/applications/:id/answers', build: async (cid, f, user) => {
    const cur = (await h.call(user, 'GET', R(cid, `/applications/${f.appId}`))).body;
    return ['PUT', R(cid, `/applications/${f.appId}/answers`), { json: { expectedRevision: cur && cur.application ? cur.application.draftRevision : 1, answers: { 'org.name': { value: 'edited' } } } }];
  } },
  { p: 'GET /api/charities/:cid/applications/:id/proposal-replacement/file', build: (cid, f) => ['GET', R(cid, `/applications/${f.appId}/proposal-replacement/file`)] },
  { p: 'GET /api/charities/:cid/applications/:id/snapshots', build: (cid, f) => ['GET', R(cid, `/applications/${f.appId}/snapshots`)] },
  { p: 'POST /api/charities/:cid/applications/:id/snapshots', build: (cid, f) => ['POST', R(cid, `/applications/${f.appId}/snapshots`), { form: (() => { const fd = new FormData(); fd.append('snapshot', '{}'); return fd; })() }], permitted: 400 },
  { p: 'GET /api/charities/:cid/snapshots/:id', build: (cid, f) => ['GET', R(cid, `/snapshots/${f.snapId}`)] },
  { p: 'GET /api/charities/:cid/snapshots/:id/files', build: (cid, f) => ['GET', R(cid, `/snapshots/${f.snapId}/files`)] },
  { p: 'GET /api/charities/:cid/snapshots/:id/files/:fid', build: (cid, f) => ['GET', R(cid, `/snapshots/${f.snapId}/files/${f.snapFileId}`)] },
  { p: 'POST /api/charities/:cid/attempts/acquire', build: async (cid, f) => {
    const s = f.phase1 ? { id: f.snapId } : await addSnapshot(cid, f.appId);
    return ['POST', R(cid, '/attempts/acquire'), { json: { applicationId: f.appId, snapshotId: s.id, payloadHash: sha(Buffer.from(s.id)) } }];
  } },
  { p: 'POST /api/charities/:cid/attempts/finish', build: (cid, f) => ['POST', R(cid, '/attempts/finish'), { json: { attempt: { id: f.attemptId || uuid(), state: 'failed' }, receipt: null } }], permitted: 404, needsAttempt: true },
  { p: 'POST /api/charities/:cid/attempts/interrupt', build: (cid) => ['POST', R(cid, '/attempts/interrupt'), { json: { ids: [], message: 'x' } }] },
  { p: 'GET /api/charities/:cid/attempts', build: (cid) => ['GET', R(cid, '/attempts')] },
  { p: 'GET /api/charities/:cid/receipts', build: (cid) => ['GET', R(cid, '/receipts')] },
  { p: 'PUT /api/charities/:cid/applications/:id/proposal-replacement', build: async (cid, f, user) => {
    const cur = (await h.call(user, 'GET', R(cid, `/applications/${f.appId}`))).body;
    return ['PUT', R(cid, `/applications/${f.appId}/proposal-replacement`), { json: { expectedRevision: cur && cur.application ? cur.application.draftRevision : 1, replacement: null } }];
  }, last: true },
];

// A discovery run starts a background job; wait until the charity has none running before the next request.
async function idle(cid) {
  while ((await h.call('admin', 'GET', R(cid, '/discover/active'))).body.jobId) await new Promise((r) => setTimeout(r, 5));
}

async function idleAssess(cid) {
  while ((await h.call('admin', 'GET', R(cid, '/assessments/G-001'))).body.jobId) await new Promise((r) => setTimeout(r, 5));
}
async function idleThread(cid, id) {
  while ((await h.call('admin', 'GET', R(cid, `/threads/${id}`))).body.jobId) await new Promise((r) => setTimeout(r, 5));
}

async function ensureReplacement(cid, user, f) {
  const app = (await h.call(user, 'GET', R(cid, `/applications/${f.appId}`))).body.application;
  if (app.proposalReplacement) return;
  const fd = new FormData();
  fd.append('meta', JSON.stringify({ expectedRevision: app.draftRevision, replacement: { filename: 'mine.pdf', size: PDF.length, sha256: sha(PDF), pageCount: 1, managerChecked: true, checkedAt: 'now' } }));
  fd.append('file', file('mine.pdf', PDF, 'application/pdf'), 'mine.pdf');
  assert.equal((await h.call(user, 'PUT', R(cid, `/applications/${f.appId}/proposal-replacement`), { form: fd })).status, 200);
}

async function dump(cid) {
  const out = {};
  for (const c of ['meta', 'opportunities', 'decisions', 'bids', 'documents', 'applications', 'submissionSnapshots', 'submissionFiles', 'submissionAttempts', 'submissionReceipts', 'funderPages', 'notes', 'assessments', 'threads']) out[c] = await h.store.list(cid, c);
  return JSON.stringify(out);
}

test('coverage: every charity-scoped route in the router has an isolation case', () => {
  const routes = createRoutes({ store: createMemoryStore(), config: readConfig({}) });
  const scoped = routes.patterns.filter((p) => p.includes('/api/charities/:cid'));
  const covered = new Set(CASES.map((c) => c.p));
  assert.deepEqual(scoped.filter((p) => !covered.has(p)), [], 'routes without a case');
  assert.deepEqual([...covered].filter((p) => !scoped.includes(p)), [], 'cases for routes that do not exist');
});

test('everyone who is not a member (and not an admin) gets 404, identical to an unknown charity, and changes nothing', async () => {
  const unknown = await h.call('a', 'GET', R('no-such-charity', '/workspace'));
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.body, NOT_FOUND);
  for (const [cid, { other }] of Object.entries(CHARITIES)) {
    const f = fx[cid];
    const before = await dump(cid);
    for (const user of [other, 'nobody']) {
      for (const c of CASES) {
        const [method, path, opts] = await c.build(cid, { ...f, attemptId: uuid(), phase1: true }, user);
        const res = await h.call(user, method, path, opts);
        assert.equal(res.status, 404, `${user} ${c.p} on ${cid}`);
        assert.deepEqual(res.body, NOT_FOUND, `${user} ${c.p} on ${cid}`);
      }
    }
    assert.equal(await dump(cid), before, `${cid} was changed by a non-member`);
  }
});

test('members and administrators are served on every route (and a different charity stays closed to them)', async () => {
  for (const [cid, { member }] of Object.entries(CHARITIES)) {
    for (const user of [member, 'both', 'admin']) {
      const f = { ...fx[cid] };
      await ensureReplacement(cid, user, f);
      for (const c of CASES) {
        if (c.disposable === 'bid') f.disposableBid = (await h.call(user, 'POST', R(cid, '/bids'), { form: bidForm('Disposable') })).body.id;
        if (c.disposable === 'thread') {
          f.disposableThread = (await h.call(user, 'POST', R(cid, '/threads'), { json: { text: 'Disposable' } })).body.thread.id;
        }
        if (c.disposable === 'doc') f.disposableDoc = (await h.call(user, 'POST', R(cid, '/documents'), { form: docForm() })).body.id;
        if (c.needsAttempt) {
          const s = await addSnapshot(cid, f.appId);
          f.attemptId = (await h.call(user, 'POST', R(cid, '/attempts/acquire'), { json: { applicationId: f.appId, snapshotId: s.id, payloadHash: sha(Buffer.from(s.id)) } })).body.id;
        }
        const [method, path, opts] = await c.build(cid, f, user);
        const res = await h.call(user, method, path, opts);
        const want = c.needsAttempt ? 200 : c.permitted || 200;
        assert.equal(res.status, want, `${user} ${c.p} on ${cid}: ${res.bytes.toString().slice(0, 200)}`);
      }
    }
  }
});

test('/api/me: members see only their own charities; admins see all; nobody sees none', async () => {
  const ids = async (u) => (await h.call(u, 'GET', '/api/me')).body;
  const a = await ids('a');
  assert.deepEqual([a.email, a.isAdmin, a.charities.map((c) => c.id)], [USERS.a, false, ['your-place']]);
  assert.deepEqual((await ids('b')).charities.map((c) => c.id), ['our-time']);
  assert.deepEqual((await ids('both')).charities.map((c) => c.id).sort(), ['our-time', 'your-place']);
  const admin = await ids('admin');
  assert.equal(admin.isAdmin, true);
  assert.deepEqual(admin.charities.map((c) => c.id).sort(), ['our-time', 'your-place']);
  assert.deepEqual((await ids('nobody')).charities, []);
});

test('IDs from another charity do not work inside your own charity path (files and records)', async () => {
  const yp = fx['your-place'];
  const ot = fx['our-time'];
  // an application of another charity is simply "not there" for you: the lookup answers with a null application
  const foreignApp = await h.call('a', 'GET', R('your-place', `/applications/${ot.appId}`));
  assert.deepEqual(foreignApp.body, { application: null });
  assert.deepEqual((await h.call('a', 'GET', R('your-place', `/snapshots/${ot.snapId}`))).body, { snapshot: null });
  for (const path of [`/documents/${ot.docId}`, `/documents/${ot.docId}/file`, `/documents/${ot.bidDocId}/file`, `/bids/${ot.bidId}`, `/snapshots/${ot.snapId}/files/${ot.snapFileId}`, `/applications/${ot.appId}/proposal-replacement/file`]) {
    const res = await h.call('a', 'GET', R('your-place', path));
    assert.equal(res.status, 404, path);
    assert.doesNotMatch(res.bytes.toString(), /Isolation|isolation test file|bid text|doc text/);
  }
  // a snapshot file addressed through the wrong snapshot of the same charity is also refused
  const other = await addSnapshot('your-place', yp.appId);
  assert.equal((await h.call('a', 'GET', R('your-place', `/snapshots/${other.id}/files/${yp.snapFileId}`))).status, 404);
  // own file downloads work and carry the right bytes
  const dl = await h.call('a', 'GET', R('your-place', `/documents/${yp.docId}/file`));
  assert.equal(dl.status, 200);
  assert.equal(dl.bytes.toString(), 'doc text');
  assert.match(dl.headers.get('content-disposition'), /^attachment/);
});

test('every write must be same-origin', async () => {
  const res = await h.call('a', 'PUT', R('your-place', '/discovery-settings'), { json: { hideUnsuitable: true }, origin: false });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'ORIGIN_REJECTED');
  const foreign = await h.call('a', 'PUT', R('your-place', '/discovery-settings'), { json: { hideUnsuitable: true }, headers: { Origin: 'https://evil.example' } });
  assert.equal(foreign.status, 403);
});

test('the charity ID in the path is validated before anything else', async () => {
  for (const bad of ['..', '%2e%2e', 'Your-Place', 'a%2Fb', 'x'.repeat(80)]) {
    const res = await h.call('a', 'GET', `/api/charities/${bad}/workspace`);
    assert.ok([404, 405].includes(res.status), bad);
  }
});

// ---------------------------------------------------------------------------------------------- behaviour kept from the browser store
test('decisions on different grants by different people both survive; a stale application save is 409', async () => {
  const cid = 'your-place';
  const [r1, r2] = await Promise.all([
    h.call('a', 'PUT', R(cid, '/decisions/G-002'), { json: { workflow: 'watchlist', override: false } }),
    h.call('both', 'PUT', R(cid, '/decisions/G-003'), { json: { workflow: 'passed', override: false } }),
  ]);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  const ws = (await h.call('a', 'GET', R(cid, '/workspace'))).body;
  assert.equal(ws.grants['G-002'].workflow, 'watchlist');
  assert.equal(ws.grants['G-003'].workflow, 'passed');
  assert.equal(ws.opportunities.filter((o) => o.foundBy !== 'ai').length, 6);

  const app = (await h.call('a', 'GET', R(cid, `/applications/${fx[cid].appId}`))).body.application;
  const save = (user, rev, text) => h.call(user, 'PUT', R(cid, `/applications/${app.id}/answers`), { json: { expectedRevision: rev, answers: { x: text } } });
  const first = await save('a', app.draftRevision, 'one');
  assert.equal(first.status, 200);
  assert.equal(first.body.draftRevision, app.draftRevision + 1);
  const stale = await save('both', app.draftRevision, 'two');
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'conflict');
  assert.equal(stale.body.currentRevision, app.draftRevision + 1);
  assert.equal((await h.call('a', 'GET', R(cid, `/applications/${app.id}`))).body.application.answers.x, 'one');
});

test('decisions are validated and a decision for an unknown grant is refused', async () => {
  const cid = 'your-place';
  assert.equal((await h.call('a', 'PUT', R(cid, '/decisions/G-001'), { json: { workflow: 'bogus', override: false } })).status, 400);
  assert.equal((await h.call('a', 'PUT', R(cid, '/decisions/G-001'), { json: { workflow: 'new', override: 'yes' } })).status, 400);
  assert.equal((await h.call('a', 'PUT', R(cid, '/decisions/G-999'), { json: { workflow: 'new', override: false } })).status, 404);
  assert.equal((await h.call('a', 'PUT', R(cid, '/discovery-settings'), { json: { freshId: 'G-999' } })).status, 400);
  assert.equal((await h.call('a', 'PUT', R(cid, '/discovery-settings'), { json: { brief: 7 } })).status, 400);
});

// ---------------------------------------------------------------------------------------------- admin
test('every /api/admin route answers 404 to non-admins, including members', async () => {
  const routes = createRoutes({ store: createMemoryStore(), config: readConfig({}) });
  const adminPatterns = routes.patterns.filter((p) => p.includes('/api/admin/'));
  assert.ok(adminPatterns.length >= 6);
  for (const pat of adminPatterns) {
    const [method, pattern] = pat.split(' ');
    const path = pattern.replace(':cid', 'your-place').replace(':email', 'x%40y.example');
    for (const user of ['a', 'both', 'nobody']) {
      const res = await h.call(user, method, path, method === 'GET' ? {} : { json: { name: 'X', website: 'https://x.example', members: [], email: 'x@y.example' } });
      assert.equal(res.status, 404, `${user} ${pat}`);
      assert.deepEqual(res.body, NOT_FOUND);
    }
  }
});

test('an administrator onboards a charity and manages members without a deploy', async () => {
  const bad = await h.call('admin', 'POST', '/api/admin/charities', { json: { name: '', website: 'http://nope' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.name && bad.body.errors.website);
  const made = await h.call('admin', 'POST', '/api/admin/charities', { json: { name: 'Third Charity', website: 'https://third.example' } });
  assert.equal(made.status, 200);
  assert.equal(made.body.id, 'third-charity');
  assert.equal((await h.call('admin', 'POST', '/api/admin/charities', { json: { name: 'Third Charity', website: 'https://third.example' } })).status, 409);
  // nobody sees it yet
  assert.equal((await h.call('nobody', 'GET', '/api/charities/third-charity/workspace')).status, 404);
  const add = await h.call('admin', 'POST', '/api/admin/charities/third-charity/members', { json: { email: 'NoBody@Test.Example' } });
  assert.deepEqual(add.body.members, ['nobody@test.example']);
  const ws = await h.call('nobody', 'GET', '/api/charities/third-charity/workspace');
  assert.equal(ws.status, 200);
  assert.deepEqual(ws.body.opportunities, []);
  assert.deepEqual((await h.call('nobody', 'GET', '/api/me')).body.charities.map((c) => c.id), ['third-charity']);
  assert.equal((await h.call('admin', 'POST', '/api/admin/charities/third-charity/members', { json: { email: 'not an email' } })).status, 400);
  const set = await h.call('admin', 'PUT', '/api/admin/charities/third-charity/members', { json: { members: ['b@test.example', 'b@test.example', 'a@test.example'] } });
  assert.deepEqual(set.body.members, ['a@test.example', 'b@test.example']);
  assert.equal((await h.call('nobody', 'GET', '/api/charities/third-charity/workspace')).status, 404);
  const rm = await h.call('admin', 'DELETE', '/api/admin/charities/third-charity/members/a%40test.example');
  assert.deepEqual(rm.body.members, ['b@test.example']);
  const list = (await h.call('admin', 'GET', '/api/admin/charities')).body;
  assert.ok(list.some((c) => c.id === 'third-charity' && c.members.length === 1));
  // every change is audited with who, when and what
  const audit = await h.store.list('third-charity', 'audit');
  assert.deepEqual(audit.map((a) => a.action).sort(), ['charity.create', 'member.add', 'member.remove', 'members.set']);
  assert.ok(audit.every((a) => a.by === USERS.admin && a.at && a.detail));
});

test('seeding is idempotent and creates Your Place and Our Time as specified', async () => {
  const h2 = await startHarness({ members: {} });
  try {
    const yp = (await h2.call('a', 'GET', '/api/charities/your-place/workspace'));
    assert.equal(yp.status, 404);
    const ws = (await h2.call('admin', 'GET', '/api/charities/your-place/workspace')).body;
    assert.deepEqual(ws.opportunities.map((o) => o.id), ['G-001', 'G-002', 'G-003', 'G-004', 'G-005', 'G-006']);
    assert.match(ws.brief, /^Find grants for Your Place/);
    assert.ok(ws.applicationDefaults.overview.includes('{name}'));
    const before = await h2.store.list('your-place', 'bids');
    assert.equal(before.length, 3);
    const again = await h2.call('admin', 'POST', '/api/admin/charities/your-place/seed');
    assert.equal(again.body.seeded, false);
    assert.equal((await h2.store.list('your-place', 'bids')).length, 3);
    // Our Time: name, website and default theme only
    const ot = (await h2.call('admin', 'GET', '/api/charities/our-time')).body;
    assert.deepEqual([ot.id, ot.name, ot.website, ot.theme], ['our-time', 'Our Time', 'https://ourtimecharity.org.uk', { preset: 'default' }]);
    const otws = (await h2.call('admin', 'GET', '/api/charities/our-time/workspace')).body;
    assert.deepEqual(otws.opportunities, []);
    assert.equal('brief' in otws, false);
    assert.equal((await h2.call('admin', 'GET', '/api/charities/our-time/bids')).body.length, 0);
    assert.equal((await h2.call('admin', 'GET', '/api/charities/our-time/documents')).body.length, 0);
    const prof = (await h2.call('admin', 'GET', '/api/charities/our-time/profile')).body;
    assert.deepEqual([prof.name, prof.overview, prof.website, prof.synthetic], ['Our Time', '', 'https://ourtimecharity.org.uk', false]);
    // Your Place's seeded files can be downloaded
    const docs = (await h2.call('admin', 'GET', '/api/charities/your-place/documents')).body;
    assert.equal(docs.length, 4);
    const f = await h2.call('admin', 'GET', `/api/charities/your-place/documents/${docs[0].id}/file`);
    assert.equal(f.status, 200);
    assert.match(f.bytes.toString(), /Synthetic demo example/);
    assert.doesNotMatch(JSON.stringify([ws, docs]), /YOR/);
  } finally { await h2.close(); }
});

// ---------------------------------------------------------------------------------------------- sign-in
test('without an identity every request, including static files, is refused', async () => {
  const store = createMemoryStore();
  const server = createServer({ config: readConfig({}), store });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const p of ['/', '/index.html', '/styles.css', '/js/app.js', '/fonts/lilita-one-latin-400-normal.woff2', '/healthz', '/api/me', '/api/charities/your-place/workspace', '/api/submission-capabilities']) {
      const res = await fetch(base + p, { headers: { 'x-goog-authenticated-user-email': 'accounts.google.com:a@test.example', Cookie: 'dev_user_email=a%40test.example' } });
      assert.equal(res.status, 401, p);
      assert.doesNotMatch(await res.text(), /<main|Your Place|G-001/);
    }
  } finally { await new Promise((r) => server.close(r)); }
});

test('a signed-in account that belongs to no charity gets the plain page and no data', async () => {
  const page = await h.call('nobody', 'GET', '/');
  assert.equal(page.status, 403);
  const html = page.bytes.toString();
  assert.match(html, /Your Google account \(nobody@test\.example\) is not set up for any charity\. Ask your administrator to add you\./);
  assert.match(html, /gcp-iap-mode=CLEAR_LOGIN_COOKIE/);
  assert.doesNotMatch(html, /<main id="main"|app\.js|Your Place/);
  assert.equal((await h.call('nobody', 'GET', '/index.html')).status, 403);
  assert.equal((await h.call('nobody', 'GET', '/api/submission-capabilities')).status, 403);
  assert.equal((await h.call('a', 'GET', '/')).status, 200);
  assert.equal((await h.call('admin', 'GET', '/')).status, 200);
  // the email in the page is escaped
  const evil = await h.call('a"b<i>c@t.example', 'GET', '/');
  assert.equal(evil.status, 403);
  assert.doesNotMatch(evil.bytes.toString(), /<i>c/);
  assert.match(evil.bytes.toString(), /a&quot;b&lt;i&gt;c@t\.example/);
});

test('the file limits are enforced on the server: 10 MiB per file and a per-charity total', async () => {
  const h2 = await startHarness({ limits: { maxTotalBytes: 1024 * 1024 } });
  try {
    const up = (bytes, name = 'big.pdf', type = 'application/pdf') => {
      const fd = new FormData();
      fd.append('details', JSON.stringify({ title: name }));
      fd.append('file', new Blob([bytes], { type }), name);
      return h2.call('a', 'POST', '/api/charities/your-place/documents', { form: fd });
    };
    const used = (await h2.call('a', 'GET', '/api/charities/your-place/usage')).body.totalBytes;
    const ok = await up(Buffer.alloc(300 * 1024, 1));
    assert.equal(ok.status, 200);
    const tooMuch = await up(Buffer.alloc(900 * 1024, 1), 'two.pdf');
    assert.equal(tooMuch.status, 413);
    assert.equal(tooMuch.body.code, 'capacity');
    assert.equal((await h2.call('a', 'GET', '/api/charities/your-place/usage')).body.totalBytes, used + 300 * 1024);
    const over = await up(Buffer.alloc(11 * 1024 * 1024, 1), 'huge.pdf');
    assert.equal(over.status, 400);
    assert.match(over.body.message, /over the 10 MB limit/);
    const wrongType = await up(Buffer.from('x'), 'evil.exe', 'application/octet-stream');
    assert.equal(wrongType.status, 400);
  } finally { await h2.close(); }
});
