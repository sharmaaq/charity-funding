// The application rules that used to be IndexedDB transactions in the browser, now on the server: the draftRevision check,
// snapshot freezing (immutable, checksummed, source checks), the attempt lock and one receipt per attempt.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startHarness } from './harness.js';
import { examplePackage } from './fixture.js';
import { ADAPTER_ID, PACKAGE_MODE, PACKAGE_SCHEMA, packageHash } from '../../public/js/application/canonical.js';

const CID = 'your-place';
const base = `/api/charities/${CID}`;
let h;
let pkg;
test.before(async () => { h = await startHarness(); pkg = await examplePackage(); });
test.after(() => h.close());

const uuid = () => crypto.randomUUID();
async function newApp(grantId = 'G-001') {
  // Applications are unique per grant: use a fresh harness state by deleting any existing one through the store.
  for (const a of await h.store.list(CID, 'applications')) await h.store.tx(CID, async (tx) => { tx.delete('applications', a.id); });
  const r = await h.call('a', 'POST', `${base}/applications/get-or-create`, { json: { grantId, initialAnswers: { 'org.name': { value: 'x' } } } });
  assert.equal(r.status, 200);
  return r.body.application;
}
async function accountsDoc() {
  const fd = new FormData();
  fd.append('details', JSON.stringify({ title: 'Accounts', category: 'financial' }));
  fd.append('file', new Blob([pkg.files.accounts.bytes], { type: 'application/pdf' }), pkg.files.accounts.filename);
  const r = await h.call('a', 'POST', `${base}/documents`, { form: fd });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
function snapshotFor(app, doc, over = {}) {
  const fileIds = [uuid(), uuid()];
  const snapshot = {
    id: uuid(), applicationId: app.id, grantId: app.grantId, revision: app.draftRevision, mode: PACKAGE_MODE, schema: PACKAGE_SCHEMA, adapter: ADAPTER_ID,
    capturedAt: '2026-11-20T10:00:00.000Z', answers: pkg.normalised, origins: {},
    attachments: [
      { role: 'proposal', filename: pkg.files.proposal.filename, mime: 'application/pdf', size: pkg.attachments[0].size, sha256: pkg.attachments[0].sha256, fileId: fileIds[0], source: 'generated', sourceId: null, sourceVersion: null, synthetic: true, generated: true },
      { role: 'accounts', filename: pkg.files.accounts.filename, mime: 'application/pdf', size: pkg.attachments[1].size, sha256: pkg.attachments[1].sha256, fileId: fileIds[1], source: 'document', sourceId: doc.id, sourceVersion: doc.updatedAt, synthetic: true, generated: false },
    ],
    sourceNotes: [], proposal: { source: 'generated', pageCount: 3 }, confirmations: { reviewedAt: 'r', transferAt: 't' }, payloadHash: pkg.payloadHash, ...over,
  };
  return snapshot;
}
function freezeForm(snapshot, bytes = [pkg.files.proposal.bytes, pkg.files.accounts.bytes]) {
  const fd = new FormData();
  fd.append('snapshot', JSON.stringify(snapshot));
  bytes.forEach((b, i) => fd.append(`file${i}`, new Blob([b], { type: 'application/pdf' }), `file${i}`));
  return fd;
}
const freeze = (app, snapshot, bytes) => h.call('a', 'POST', `${base}/applications/${app.id}/snapshots`, { form: freezeForm(snapshot, bytes) });

test('freezing writes the snapshot and its file copies once; the same package again returns the same snapshot', async () => {
  const app = await newApp();
  const doc = await accountsDoc();
  const snap = snapshotFor(app, doc);
  const first = await freeze(app, snap);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.created, true);
  assert.equal(first.body.snapshot.id, snap.id);
  assert.equal((await h.call('a', 'GET', `${base}/applications/${app.id}`)).body.application.lastSnapshotId, snap.id);
  assert.equal((await h.call('a', 'GET', `${base}/applications/${app.id}`)).body.application.draftRevision, app.draftRevision, 'only the pointer moves');
  const again = await freeze(app, snapshotFor(app, doc));
  assert.equal(again.body.created, false);
  assert.equal(again.body.snapshot.id, snap.id);
  assert.equal((await h.call('a', 'GET', `${base}/applications/${app.id}/snapshots`)).body.length, 1);
  // the stored copies are exactly what was reviewed
  const files = (await h.call('a', 'GET', `${base}/snapshots/${snap.id}/files`)).body;
  assert.deepEqual(files.map((f) => f.role), ['proposal', 'accounts']);
  for (const [i, f] of files.entries()) {
    const bytes = (await h.call('a', 'GET', `${base}/snapshots/${snap.id}/files/${f.id}`)).bytes;
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), pkg.attachments[i].sha256);
  }
  assert.equal(await packageHash({ answers: snap.answers, attachments: files, adapter: ADAPTER_ID }), snap.payloadHash);
});

test('freezing is refused when a file does not match its checksum or the hash does not match the contents', async () => {
  const app = await newApp();
  const doc = await accountsDoc();
  const filesBefore = (await h.store.list(CID, 'submissionFiles')).length;
  const tampered = Buffer.from(pkg.files.proposal.bytes);
  tampered[tampered.length - 1] ^= 1;
  const bad1 = await freeze(app, snapshotFor(app, doc), [tampered, pkg.files.accounts.bytes]);
  assert.equal(bad1.status, 400);
  const bad2 = await freeze(app, snapshotFor(app, doc, { payloadHash: 'f'.repeat(64) }));
  assert.equal(bad2.status, 400);
  const bad3 = await freeze(app, snapshotFor(app, doc, { answers: { ...pkg.normalised, 'request.title': 'Changed after hashing' } }));
  assert.equal(bad3.status, 400);
  assert.equal((await h.call('a', 'GET', `${base}/applications/${app.id}/snapshots`)).body.length, 0);
  assert.equal((await h.store.list(CID, 'submissionFiles')).length, filesBefore, 'no stray file records');
});

test('freezing a stale revision is a 409 conflict, and a changed source document is source-changed; nothing is written', async () => {
  const app = await newApp();
  const doc = await accountsDoc();
  const stale = snapshotFor(app, doc);
  assert.equal((await h.call('a', 'PUT', `${base}/applications/${app.id}/answers`, { json: { expectedRevision: app.draftRevision, answers: { x: 1 } } })).status, 200);
  const r1 = await freeze(app, stale);
  assert.equal(r1.status, 409);
  assert.equal(r1.body.code, 'conflict');
  // fresh revision, but the accounts document changed after it was read
  const cur = (await h.call('a', 'GET', `${base}/applications/${app.id}`)).body.application;
  const snap = snapshotFor(cur, doc);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal((await h.call('a', 'PUT', `${base}/documents/${doc.id}`, { json: { title: 'Accounts (edited)', category: 'financial' } })).status, 200);
  const r2 = await freeze(cur, snap);
  assert.equal(r2.status, 409);
  assert.equal(r2.body.code, 'source-changed');
  // a package that ignores the manager's own proposal is source-changed too
  const doc2 = (await h.call('a', 'GET', `${base}/documents/${doc.id}`)).body;
  const fd = new FormData();
  fd.append('meta', JSON.stringify({ expectedRevision: cur.draftRevision, replacement: { filename: 'mine.pdf', size: 8, sha256: crypto.createHash('sha256').update('%PDF-1.4').digest('hex'), pageCount: 1, managerChecked: true, checkedAt: 'n' } }));
  fd.append('file', new Blob(['%PDF-1.4']), 'mine.pdf');
  const rep = await h.call('a', 'PUT', `${base}/applications/${app.id}/proposal-replacement`, { form: fd });
  assert.equal(rep.status, 200);
  assert.equal(rep.body.draftRevision, cur.draftRevision + 1);
  const r3 = await freeze(rep.body, snapshotFor(rep.body, doc2));
  assert.equal(r3.status, 409);
  assert.equal(r3.body.code, 'source-changed');
  assert.equal((await h.call('a', 'GET', `${base}/applications/${app.id}/snapshots`)).body.length, 0);
});

test('a manager proposal: needs the current revision, a matching checksum, and can be removed', async () => {
  const app = await newApp();
  const bytes = Buffer.from('%PDF-1.4 my own');
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const put = (rev, meta, body = bytes) => { const fd = new FormData(); fd.append('meta', JSON.stringify({ expectedRevision: rev, replacement: { filename: 'mine.pdf', size: body.length, sha256: sha, pageCount: 2, managerChecked: false, ...meta } })); fd.append('file', new Blob([body]), 'mine.pdf'); return h.call('a', 'PUT', `${base}/applications/${app.id}/proposal-replacement`, { form: fd }); };
  assert.equal((await put(app.draftRevision + 5)).status, 409);
  assert.equal((await put(app.draftRevision, {}, Buffer.from('different bytes'))).status, 400);
  const ok = await put(app.draftRevision);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.proposalReplacement.sha256, sha);
  assert.equal(ok.body.proposalReplacement.fileId.length > 10, true);
  const dl = await h.call('a', 'GET', `${base}/applications/${app.id}/proposal-replacement/file`);
  assert.equal(dl.bytes.toString(), bytes.toString());
  const gone = await h.call('a', 'PUT', `${base}/applications/${app.id}/proposal-replacement`, { json: { expectedRevision: ok.body.draftRevision, replacement: null } });
  assert.equal(gone.status, 200);
  assert.equal('proposalReplacement' in gone.body, false);
  assert.equal((await h.call('a', 'GET', `${base}/applications/${app.id}/proposal-replacement/file`)).status, 404);
});

test('one draft per grant, even when two people open it at once; a grant the charity does not have is refused', async () => {
  for (const a of await h.store.list(CID, 'applications')) await h.store.tx(CID, async (tx) => { tx.delete('applications', a.id); });
  const results = await Promise.all([h.call('a', 'POST', `${base}/applications/get-or-create`, { json: { grantId: 'G-002', initialAnswers: {} } }), h.call('both', 'POST', `${base}/applications/get-or-create`, { json: { grantId: 'G-002', initialAnswers: {} } })]);
  assert.deepEqual(results.map((r) => r.status), [200, 200]);
  assert.equal(results[0].body.application.id, results[1].body.application.id);
  assert.deepEqual(results.map((r) => r.body.created).sort(), [false, true]);
  assert.equal((await h.call('a', 'POST', `${base}/applications/get-or-create`, { json: { grantId: 'G-404', initialAnswers: {} } })).status, 404);
  assert.equal((await h.call('a', 'PUT', `${base}/applications/${results[0].body.application.id}/answers`, { json: { expectedRevision: 1, answers: 'not an object' } })).status, 400);
});

test('attempt lock, receipts and interruption', async () => {
  const app = await newApp();
  const doc = await accountsDoc();
  const snap = snapshotFor(app, doc);
  assert.equal((await freeze(app, snap)).status, 200);
  const acquire = (extra = {}) => h.call('a', 'POST', `${base}/attempts/acquire`, { json: { applicationId: app.id, snapshotId: snap.id, payloadHash: snap.payloadHash, ...extra } });
  const first = await acquire();
  assert.equal(first.status, 200);
  assert.equal(first.body.state, 'running');
  assert.equal(first.body.startedBy, 'a@test.example');
  const second = await acquire();
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'attempt-active');
  // another user's running attempt can only be judged by that user's own page: it is listed with who started it
  assert.equal((await h.call('both', 'GET', `${base}/attempts`)).body[0].startedBy, 'a@test.example');
  const interrupted = await h.call('a', 'POST', `${base}/attempts/interrupt`, { json: { ids: [first.body.id], message: 'closed' } });
  assert.equal(interrupted.body[0].state, 'interrupted_unknown');
  // a deliberate retry keeps the attempt ID and counts the tries
  const retry = await acquire({ retryId: first.body.id });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.id, first.body.id);
  assert.equal(retry.body.tries, 2);
  assert.equal((await acquire({ retryId: 'nonexistent' })).status, 409, 'a running attempt blocks everything');
  const receipt = { id: uuid(), attemptId: first.body.id, applicationId: app.id, snapshotId: snap.id, mode: 'demo', reference: `DEMO-${first.body.id}`, confirmedAt: '2026-11-20T10:05:00.000Z', payloadHash: snap.payloadHash, target: 'controlled-test-portal' };
  const fin = await h.call('a', 'POST', `${base}/attempts/finish`, { json: { attempt: { ...retry.body, state: 'demo_completed' }, receipt } });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.receipt.id, receipt.id);
  assert.equal(fin.body.attempt.receiptId, receipt.id);
  // a duplicate final event keeps the first receipt
  const dup = await h.call('a', 'POST', `${base}/attempts/finish`, { json: { attempt: { ...retry.body, state: 'demo_completed' }, receipt: { ...receipt, id: uuid() } } });
  assert.equal(dup.body.receipt.id, receipt.id);
  assert.equal((await h.call('a', 'GET', `${base}/receipts`)).body.length, 1);
  const after = await acquire();
  assert.equal(after.status, 409);
  assert.equal(after.body.code, 'already-submitted');
  assert.equal((await h.call('a', 'POST', `${base}/attempts/finish`, { json: { attempt: { id: uuid(), state: 'failed' } } })).status, 404);
  assert.equal((await h.call('a', 'POST', `${base}/attempts/acquire`, { json: { applicationId: app.id, snapshotId: uuid(), payloadHash: 'x' } })).status, 404);
});

test('frozen packages count against the charity\'s file budget', async () => {
  const small = await startHarness({ limits: { maxTotalBytes: 100 * 1024 } });
  try {
    const app = (await small.call('a', 'POST', `${base}/applications/get-or-create`, { json: { grantId: 'G-001', initialAnswers: {} } })).body.application;
    const fd = new FormData();
    fd.append('details', JSON.stringify({ title: 'Accounts', category: 'financial' }));
    fd.append('file', new Blob([pkg.files.accounts.bytes], { type: 'application/pdf' }), pkg.files.accounts.filename);
    const doc = (await small.call('a', 'POST', `${base}/documents`, { form: fd })).body;
    const used = (await small.call('a', 'GET', `${base}/usage`)).body.totalBytes;
    assert.ok(used < 100 * 1024);
    const snap = snapshotFor(app, doc);
    const total = pkg.attachments[0].size + pkg.attachments[1].size;
    const res = await small.call('a', 'POST', `${base}/applications/${app.id}/snapshots`, { form: freezeForm(snap) });
    if (used + total > 100 * 1024) { assert.equal(res.status, 413); assert.equal(res.body.code, 'capacity'); } else { assert.equal(res.status, 200); }
  } finally { await small.close(); }
});
