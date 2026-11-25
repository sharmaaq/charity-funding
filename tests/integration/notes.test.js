import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.js';

let h;
test.before(async () => { h = await startHarness(); });
test.after(() => h.close());

const ws = async (user, cid = 'your-place') => (await h.call(user, 'GET', `/api/charities/${cid}/workspace`)).body;
const put = (user, oid, text, cid = 'your-place') => h.call(user, 'PUT', `/api/charities/${cid}/notes/${oid}`, { json: { text } });

test('a member saves a note and the workspace returns it with who and when', async () => {
  const res = await put('a', 'G-001', 'Ring the programme officer on Monday');
  assert.equal(res.status, 200);
  assert.equal(res.body.note.text, 'Ring the programme officer on Monday');
  const w = await ws('a');
  assert.equal(w.notes['G-001'].text, 'Ring the programme officer on Monday');
  assert.equal(w.notes['G-001'].updatedBy, 'a@test.example');
  assert.match(w.notes['G-001'].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('a second member of the charity sees and can replace the note', async () => {
  assert.equal((await put('both', 'G-001', 'Replaced')).status, 200);
  const w = await ws('a');
  assert.equal(w.notes['G-001'].text, 'Replaced');
  assert.equal(w.notes['G-001'].updatedBy, 'both@test.example');
});

test('notes on different grants do not touch each other, and decisions leave them alone', async () => {
  await put('a', 'G-002', 'Second');
  await h.call('a', 'PUT', '/api/charities/your-place/decisions/G-002', { json: { workflow: 'passed', override: false } });
  await h.call('a', 'PUT', '/api/charities/your-place/decisions/G-002', { json: { workflow: 'new', override: false } });
  const w = await ws('a');
  assert.equal(w.notes['G-001'].text, 'Replaced');
  assert.equal(w.notes['G-002'].text, 'Second');
});

test('empty text deletes the note', async () => {
  const res = await put('a', 'G-002', '');
  assert.equal(res.status, 200);
  assert.equal(res.body.note, null);
  assert.equal((await ws('a')).notes['G-002'], undefined);
});

test('text over 5,000 characters, non-text and unknown grants are refused', async () => {
  assert.equal((await put('a', 'G-001', 'x'.repeat(5001))).status, 400);
  assert.equal((await put('a', 'G-001', 'x'.repeat(5000))).status, 200);
  const bad = await h.call('a', 'PUT', '/api/charities/your-place/notes/G-001', { json: { text: 12 } });
  assert.equal(bad.status, 400);
  assert.equal((await put('a', 'G-999', 'hello')).status, 404);
  assert.equal((await put('a', 'bad id', 'hello')).status, 404);
});

test('a non-member gets 404 and changes nothing; another charity never sees the note', async () => {
  const before = JSON.stringify((await ws('a')).notes);
  const res = await put('b', 'G-001', 'Intruder');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { code: 'NOT_FOUND', message: 'Not found.' });
  assert.equal(JSON.stringify((await ws('a')).notes), before);
  assert.deepEqual((await ws('b', 'our-time')).notes, {});
});

test('a note must be sent from this site', async () => {
  const res = await h.call('a', 'PUT', '/api/charities/your-place/notes/G-001', { json: { text: 'x' }, origin: false });
  assert.equal(res.status, 403);
});
