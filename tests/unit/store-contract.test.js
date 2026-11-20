// The same contract runs against every store. The memory store always runs. The Firestore + Cloud Storage store runs
// only when emulators are configured (FIRESTORE_EMULATOR_HOST and STORAGE_EMULATOR_HOST); otherwise it is reported
// as skipped, never silently passed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../../server/store/memory.js';
import { ServiceError } from '../../server/errors.js';

const implementations = [['memory', async () => createMemoryStore()]];
const haveEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST);
if (haveEmulators) {
  implementations.push(['firestore+storage (emulators)', async () => {
    const { createGcpStore } = await import('../../server/store/gcp.js');
    return createGcpStore({ projectId: 'demo-charity-funding', bucket: 'demo-bucket' });
  }]);
}

const charity = (id, members = []) => ({ id, name: id.toUpperCase(), website: 'https://example.org', theme: { preset: 'default' }, notice: {}, members, createdAt: 'x', createdBy: 'test' });
const uid = () => `c${Math.random().toString(36).slice(2, 8)}`;

for (const [name, make] of implementations) {
  test(`[${name}] charities: create, read, duplicate refused, update, members lookup`, async () => {
    const s = await make();
    const a = uid();
    const b = uid();
    await s.createCharity(charity(a, ['one@x.example']));
    await s.createCharity(charity(b, ['one@x.example', 'two@x.example']));
    await assert.rejects(s.createCharity(charity(a)), (e) => e instanceof ServiceError && e.code === 'exists');
    assert.equal((await s.getCharity(a)).name, a.toUpperCase());
    assert.equal(await s.getCharity(uid()), null);
    assert.deepEqual((await s.charitiesForUser('one@x.example')).map((c) => c.id).sort(), [a, b].sort());
    assert.deepEqual((await s.charitiesForUser('two@x.example')).map((c) => c.id), [b]);
    assert.deepEqual(await s.charitiesForUser('none@x.example'), []);
    const next = await s.updateCharity(a, { members: ['two@x.example'] });
    assert.deepEqual(next.members, ['two@x.example']);
    assert.equal(next.name, a.toUpperCase());
    await assert.rejects(s.updateCharity(uid(), {}), (e) => e.code === 'not-found');
  });

  test(`[${name}] records are separate per charity`, async () => {
    const s = await make();
    const a = uid();
    const b = uid();
    await s.createCharity(charity(a));
    await s.createCharity(charity(b));
    await s.tx(a, async (tx) => { tx.set('bids', 'x1', { id: 'x1', title: 'A bid' }); });
    assert.deepEqual(await s.get(a, 'bids', 'x1'), { id: 'x1', title: 'A bid' });
    assert.equal(await s.get(b, 'bids', 'x1'), undefined);
    assert.deepEqual(await s.list(b, 'bids'), []);
    assert.equal((await s.list(a, 'bids')).length, 1);
  });

  test(`[${name}] a transaction applies all its writes or none`, async () => {
    const s = await make();
    const a = uid();
    await s.createCharity(charity(a));
    await s.tx(a, async (tx) => { tx.set('bids', 'k1', { id: 'k1' }); tx.set('bids', 'k2', { id: 'k2' }); });
    await assert.rejects(s.tx(a, async (tx) => {
      tx.set('bids', 'k3', { id: 'k3' });
      tx.delete('bids', 'k1');
      throw new ServiceError('invalid', 'boom');
    }), (e) => e.code === 'invalid');
    assert.deepEqual((await s.list(a, 'bids')).map((r) => r.id).sort(), ['k1', 'k2']);
    // add never overwrites
    await s.tx(a, async (tx) => { tx.add('submissionSnapshots', 'snap', { id: 'snap', v: 1 }); });
    await assert.rejects(s.tx(a, async (tx) => { tx.add('submissionSnapshots', 'snap', { id: 'snap', v: 2 }); tx.set('bids', 'k9', { id: 'k9' }); }), (e) => e.code === 'exists');
    assert.equal((await s.get(a, 'submissionSnapshots', 'snap')).v, 1);
    assert.equal(await s.get(a, 'bids', 'k9'), undefined);
  });

  test(`[${name}] concurrent transactions do not lose updates`, async () => {
    const s = await make();
    const a = uid();
    await s.createCharity(charity(a));
    await s.tx(a, async (tx) => { tx.set('meta', 'counter', { key: 'counter', n: 0 }); });
    await Promise.all(Array.from({ length: 8 }, () => s.tx(a, async (tx) => {
      const cur = await tx.get('meta', 'counter');
      tx.set('meta', 'counter', { key: 'counter', n: cur.n + 1 });
    })));
    assert.equal((await s.get(a, 'meta', 'counter')).n, 8);
  });

  test(`[${name}] files are separate per charity and kind`, async () => {
    const s = await make();
    const a = uid();
    const b = uid();
    await s.files.put(a, 'files', 'f1', Buffer.from('hello'), 'text/plain');
    const got = await s.files.get(a, 'files', 'f1');
    assert.equal(got.bytes.toString(), 'hello');
    assert.equal(got.mime, 'text/plain');
    assert.equal(await s.files.get(b, 'files', 'f1'), null);
    assert.equal(await s.files.get(a, 'submission-files', 'f1'), null);
    await s.files.delete(a, 'files', 'f1');
    assert.equal(await s.files.get(a, 'files', 'f1'), null);
    await s.files.delete(a, 'files', 'f1'); // deleting twice is harmless
  });

  test(`[${name}] unsafe charity IDs, collections, record IDs and file kinds are refused`, async () => {
    const s = await make();
    const a = uid();
    for (const bad of ['../x', 'A', 'a/b', '', 'x'.repeat(60)]) await assert.rejects(Promise.resolve().then(() => s.get(bad, 'bids', 'x')), /Invalid charity ID/, bad);
    await assert.rejects(Promise.resolve().then(() => s.get(a, 'charities', 'x')), /Unknown collection/);
    await assert.rejects(Promise.resolve().then(() => s.get(a, 'bids', '../x')), /Invalid record ID/);
    await assert.rejects(Promise.resolve().then(() => s.files.get(a, 'secrets', 'x')), /Unknown file kind/);
    await assert.rejects(Promise.resolve().then(() => s.files.get(a, 'files', 'a/b')), /Invalid file ID/);
  });
}

if (!haveEmulators) {
  test('[firestore+storage] contract run', { skip: 'FIRESTORE_EMULATOR_HOST / STORAGE_EMULATOR_HOST not set: the Firestore store was not exercised by this suite' }, () => {});
}
