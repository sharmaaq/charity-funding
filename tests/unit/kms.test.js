import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudKms, createLocalKms } from '../../server/ai/kms.js';
import { createAiKeysService } from '../../server/services/ai-keys.js';
import { createMemoryStore } from '../../server/store/memory.js';

const KEY = 'projects/p/locations/europe-west1/keyRings/r/cryptoKeys/k';

test('cloud KMS calls encrypt and decrypt over REST with the service-account token and base64 text', async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
    const b = JSON.parse(init.body);
    return new Response(JSON.stringify(b.plaintext ? { ciphertext: `CT(${b.plaintext})` } : { plaintext: b.ciphertext.slice(3, -1) }), { status: 200 });
  };
  const kms = createCloudKms(KEY, { tokenFn: async () => 'tok', fetchFn });
  const blob = await kms.encrypt('secret value');
  assert.match(blob, /^kms:CT\(/);
  assert.equal(calls[0].url, `https://cloudkms.googleapis.com/v1/${KEY}:encrypt`);
  assert.equal(calls[0].auth, 'Bearer tok');
  assert.equal(calls[0].body.plaintext, Buffer.from('secret value').toString('base64'));
  assert.equal(await kms.decrypt(blob), 'secret value');
  assert.equal(calls[1].url, `https://cloudkms.googleapis.com/v1/${KEY}:decrypt`);
  await assert.rejects(kms.decrypt('aes:xxx'), /Unknown key format/);
});

test('a KMS failure says which call failed and nothing else', async () => {
  const kms = createCloudKms(KEY, { tokenFn: async () => 't', fetchFn: async () => new Response('{"error":{"message":"secret detail"}}', { status: 403 }) });
  await assert.rejects(kms.encrypt('abc'), (e) => e.message === 'Cloud KMS encrypt failed (403)');
});

test('local development encryption round-trips, uses a fresh nonce and rejects tampering', async () => {
  const kms = createLocalKms();
  const a = await kms.encrypt('hello key');
  assert.notEqual(a, await kms.encrypt('hello key'));
  assert.ok(!a.includes('hello'));
  assert.equal(await kms.decrypt(a), 'hello key');
  await assert.rejects(kms.decrypt(`${a.slice(0, -3)}AAA`));
  await assert.rejects(createLocalKms().decrypt(a));
});

test('the key service keeps only the last four characters in its views and caches decrypted keys briefly', async () => {
  const store = createMemoryStore();
  await store.createCharity({ id: 'c1', name: 'C', members: [] });
  let decrypts = 0;
  const kms = { encrypt: async (t) => `x:${t}`, decrypt: async (b) => { decrypts += 1; return b.slice(2); } };
  const svc = createAiKeysService({ store, kms, testKey: async () => null });
  const view = await svc.set('c1', 'openai', { key: 'sk-test-0123456789abcdef' }, 'a@x.org');
  assert.deepEqual(Object.keys(view.openai).sort(), ['connected', 'last4', 'savedAt', 'savedBy']);
  assert.equal(view.openai.last4, 'cdef');
  assert.deepEqual(await svc.keysFor('c1'), { openai: 'sk-test-0123456789abcdef' });
  await svc.keysFor('c1');
  assert.equal(decrypts, 1);
  await svc.remove('c1', 'openai');
  assert.deepEqual(await svc.keysFor('c1'), {});
});
