import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest, createEventReader, StreamError, MILESTONES } from '../../public/js/application/run-protocol.js';
import { MANIFEST_KEYS, parseManifest } from '../../server/manifest.js';
import { STEPS } from '../../server/demo-runner.js';
import { OUTGOING_FIELD_IDS } from '../../public/js/application/package.js';
import { exampleRun } from '../integration/fixture.js';

const A = '0e0e0e0e-1111-4222-8333-444444444444';
const enc = (s) => new TextEncoder().encode(s);
const ev = (seq, extra) => JSON.stringify({ seq, attemptId: A, at: 't', ...extra });

test('the browser manifest has exactly the keys the server requires and passes server validation', async () => {
  const r = await exampleRun();
  assert.deepEqual(Object.keys(r.manifest).sort(), [...MANIFEST_KEYS].sort());
  const { flat } = parseManifest(JSON.stringify(r.manifest), { idempotencyKey: r.attemptId, schema: 'submission.v1' });
  assert.deepEqual(flat, r.flat);
  assert.ok(Object.keys(flat).every((k) => OUTGOING_FIELD_IDS.includes(k)));
  assert.equal(JSON.stringify(r.manifest).includes('sourceRefs'), false, 'no provenance goes out');
  assert.equal(r.manifest.answers.request.amountPence, 5000000, 'money stays a number of pence');
});

test('buildManifest maps snapshot attachments and binds the review to the hash', () => {
  const snap = { id: 's', applicationId: 'a', revision: 2, answers: { 'org.name': 'YOR Plc' }, attachments: [{ role: 'proposal', filename: 'p.pdf', mime: 'application/pdf', size: 3, sha256: 'h', synthetic: true, fileId: 'x' }], payloadHash: 'H' };
  const m = buildManifest(snap, A);
  assert.deepEqual(m.attachments[0], { role: 'proposal', filename: 'p.pdf', mimeType: 'application/pdf', sizeBytes: 3, sha256: 'h', synthetic: true });
  assert.deepEqual(m.review, { demoReviewed: true, demoTransfer: true, reviewedPayloadHash: 'H' });
  assert.deepEqual(m.answers, { org: { name: 'YOR Plc' } });
  assert.equal(m.mode, 'demo');
});

test('milestones match the server steps one to one', () => {
  assert.deepEqual(MILESTONES.map((m) => m.step), STEPS);
});

test('NDJSON: arbitrary chunk boundaries, including inside a multi-byte character', () => {
  const text = `${ev(1, { type: 'step', step: 'check', status: 'complete' })}\n${ev(2, { type: 'heartbeat' })}\n${ev(3, { type: 'step', step: 'fill', status: 'started', note: '£ – é' })}\n${ev(4, { type: 'completed', receipt: {} })}`;
  const bytes = enc(text);
  for (const size of [1, 2, 3, 7, bytes.length]) {
    const seen = [];
    const reader = createEventReader(A, (e) => seen.push(e));
    for (let i = 0; i < bytes.length; i += size) reader.push(bytes.subarray(i, i + size));
    const terminal = reader.end();
    assert.deepEqual(seen.map((e) => e.seq), [1, 3, 4], 'heartbeats are not passed on');
    assert.equal(seen[1].note, '£ – é');
    assert.equal(terminal.type, 'completed');
  }
});

test('NDJSON: a gap, a foreign attempt, an event after the end or garbage is a stream error', () => {
  const bad = [
    `${ev(1, { type: 'step' })}\n${ev(3, { type: 'step' })}\n`,
    `${JSON.stringify({ seq: 1, attemptId: 'other', type: 'step' })}\n`,
    `${ev(1, { type: 'completed' })}\n${ev(2, { type: 'step' })}\n`,
    'not json\n',
    `${ev(1, { type: 'surprise' })}\n`,
  ];
  for (const text of bad) {
    const reader = createEventReader(A, () => {});
    assert.throws(() => { reader.push(enc(text)); reader.end(); }, StreamError);
  }
});

test('NDJSON: end of stream without a terminal event returns null (interrupted, outcome unknown)', () => {
  const reader = createEventReader(A, () => {});
  reader.push(enc(`${ev(1, { type: 'step', step: 'check', status: 'complete' })}\n`));
  assert.equal(reader.end(), null);
});
