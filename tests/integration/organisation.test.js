// Profile, past bids and documents over HTTP: the rules the browser's IndexedDB repository used to enforce.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.js';

const base = '/api/charities/your-place';
let h;
test.before(async () => { h = await startHarness(); });
test.after(() => h.close());

const bidForm = (payload, files = {}) => {
  const fd = new FormData();
  fd.append('payload', JSON.stringify(payload));
  Object.entries(files).forEach(([k, [name, text, type]]) => fd.append(k, new Blob([text], { type }), name));
  return fd;
};
const fields = { title: 'A bid', funder: 'Funder', outcome: 'unknown' };

test('profile: seeded content reads back, validation errors are per field, the name follows the charity', async () => {
  const p = (await h.call('a', 'GET', `${base}/profile`)).body;
  assert.equal(p.name, 'Your Place');
  assert.match(p.overview, /^Your Place is a demo charity/);
  const bad = await h.call('a', 'PUT', `${base}/profile`, { json: { overview: '', website: 'ftp://x' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'invalid');
  assert.ok(bad.body.errors.overview && bad.body.errors.website);
  const ok = await h.call('a', 'PUT', `${base}/profile`, { json: { overview: 'New text', beneficiaries: 'B', charityNumber: '00123', name: 'Hacked' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, 'Your Place', 'a client cannot rename the organisation');
  assert.equal(ok.body.charityNumber, '00123');
  assert.equal(ok.body.synthetic, false);
  assert.equal((await h.call('a', 'GET', `${base}/catalogue`)).body.profile.overview, 'New text');
});

test('bids: create with a file, edit an attachment, remove one, delete the bid and its files', async () => {
  const created = await h.call('a', 'POST', `${base}/bids`, { form: bidForm({ fields, newFiles: [{ role: 'bid-document', title: 'The bid' }, { role: 'feedback', title: 'Feedback' }] }, { file0: ['bid.txt', 'bid text', 'text/plain'], file1: ['fb.txt', 'feedback', 'text/plain'] }) });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const id = created.body.id;
  let bid = (await h.call('a', 'GET', `${base}/bids/${id}`)).body;
  assert.equal(bid.attachmentCount, 2);
  assert.equal(bid.hasBidDocument, true);
  assert.deepEqual(bid.attachments.map((d) => d.role), ['bid-document', 'feedback']);
  const [d1, d2] = bid.attachments;
  const edit = await h.call('a', 'PUT', `${base}/bids/${id}`, { form: bidForm({ fields: { ...fields, title: 'Renamed' }, attachmentEdits: [{ id: d1.id, role: 'supporting', title: 'Retitled', description: 'd' }], removeIds: [d2.id], newFiles: [] }) });
  assert.equal(edit.status, 200);
  bid = (await h.call('a', 'GET', `${base}/bids/${id}`)).body;
  assert.deepEqual([bid.title, bid.attachmentCount, bid.attachments[0].role, bid.attachments[0].title], ['Renamed', 1, 'supporting', 'Retitled']);
  assert.equal((await h.call('a', 'GET', `${base}/documents/${d2.id}/file`)).status, 404, 'the removed file is gone');
  // validation: nothing is written when any part is invalid
  const bad = await h.call('a', 'PUT', `${base}/bids/${id}`, { form: bidForm({ fields: { title: '', funder: '' }, newFiles: [{ role: 'bid-document', title: 'x' }] }, { file0: ['x.exe', 'x', 'application/octet-stream'] }) });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.title && bad.body.errors.funder);
  assert.equal(bad.body.fileErrors.length, 1);
  assert.equal((await h.call('a', 'GET', `${base}/bids/${id}`)).body.title, 'Renamed');
  assert.equal((await h.call('a', 'PUT', `${base}/bids/${id}`, { form: bidForm({ fields, removeIds: ['not-mine'], newFiles: [] }) })).status, 404);
  assert.equal((await h.call('a', 'PUT', `${base}/bids/nope`, { form: bidForm({ fields, newFiles: [] }) })).status, 404);
  // delete removes the bid, its documents and their bytes
  const del = await h.call('a', 'DELETE', `${base}/bids/${id}`);
  assert.deepEqual(del.body, { removedFiles: 1 });
  assert.equal((await h.call('a', 'GET', `${base}/bids/${id}`)).status, 404);
  assert.equal(await h.store.files.get('your-place', 'files', d1.id), null);
});

test('documents: upload, update metadata, download exact bytes, delete; unsafe or empty files are refused', async () => {
  const up = (name, bytes, type, details = {}) => { const fd = new FormData(); fd.append('details', JSON.stringify(details)); fd.append('file', new Blob([bytes], { type }), name); return h.call('a', 'POST', `${base}/documents`, { form: fd }); };
  const ok = await up('accounts.csv', 'a,b\n1,2\n', 'text/csv', { category: 'general', tags: 'x, y' });
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.body.title, ok.body.mime, ok.body.size, ok.body.tags], ['accounts.csv', 'text/csv', 8, ['x', 'y']]);
  assert.equal((await up('empty.txt', '', 'text/plain')).status, 400);
  assert.equal((await up('page.html', '<b>x</b>', 'text/html')).status, 400);
  assert.equal((await up('mismatch.pdf', 'x', 'image/png')).status, 400);
  assert.equal((await up('ok.txt', 'x', 'text/plain', { category: 'nonsense' })).status, 400);
  const upd = await h.call('a', 'PUT', `${base}/documents/${ok.body.id}`, { json: { title: 'Renamed', category: 'impact', period: 'FY26' } });
  assert.equal(upd.body.title, 'Renamed');
  assert.ok(upd.body.updatedAt >= ok.body.updatedAt);
  const dl = await h.call('a', 'GET', `${base}/documents/${ok.body.id}/file`);
  assert.equal(dl.bytes.toString(), 'a,b\n1,2\n');
  assert.equal(dl.headers.get('content-type'), 'text/csv');
  assert.equal(dl.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await h.call('a', 'DELETE', `${base}/documents/${ok.body.id}`)).status, 200);
  assert.equal((await h.call('a', 'GET', `${base}/documents/${ok.body.id}/file`)).status, 404);
  assert.equal((await h.call('a', 'DELETE', `${base}/documents/${ok.body.id}`)).status, 404);
  const list = (await h.call('a', 'GET', `${base}/documents`)).body;
  assert.ok(list.every((d) => d.ownerType === 'organisation'), 'bid attachments are not in the organisation list');
});

test('a very large upload is refused while streaming', async () => {
  const fd = new FormData();
  fd.append('details', '{}');
  fd.append('file', new Blob([Buffer.alloc(11 * 1024 * 1024, 1)], { type: 'application/pdf' }), 'big.pdf');
  const res = await h.call('a', 'POST', `${base}/documents`, { form: fd });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /10 MB limit/);
});
