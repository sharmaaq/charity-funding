// A charity's own AI keys (REQ-043, D9). Stored per charity (the charity pays), encrypted with Cloud KMS, in
// meta/aiKeys: { key: 'aiKeys', keys: { [provider]: { enc, last4, savedAt, savedBy } } }.
// `enc` and the key itself never leave this module: the views carry only { connected, last4, savedAt, savedBy }.
import { ServiceError } from '../errors.js';

export const KEY_PROVIDERS = ['anthropic', 'openai', 'gemini'];
export const PROVIDER_LABELS = { anthropic: 'Claude (Anthropic)', openai: 'ChatGPT (OpenAI)', gemini: 'Gemini (your own key, optional)' };
const KEY_RE = /^[\x21-\x7e]{16,300}$/; // printable, no spaces
const CACHE_MS = 10 * 60e3;

export function createAiKeysService({ store, kms, testKey, now = () => new Date() }) {
  const cache = new Map(); // cid -> { keys, exp }
  const record = async (cid) => (await store.get(cid, 'meta', 'aiKeys')) || { key: 'aiKeys', keys: {} };
  const need = () => { if (!kms) throw new ServiceError('unavailable', 'Connecting your own AI keys is not available on this service yet.'); return kms; };

  const view = (rec) => Object.fromEntries(KEY_PROVIDERS.map((p) => {
    const k = rec.keys && rec.keys[p];
    return [p, k ? { connected: true, last4: k.last4, savedAt: k.savedAt, savedBy: k.savedBy } : { connected: false }];
  }));

  const svc = {
    available: () => Boolean(kms),
    clearCache: () => cache.clear(), // tests: the store was wiped
    async connections(cid) { return view(await record(cid)); },

    // Decrypted keys for one request: { anthropic?, openai?, gemini? }. Kept in memory briefly so each AI call does not hit KMS.
    async keysFor(cid) {
      const hit = cache.get(cid);
      if (hit && hit.exp > Date.now()) return hit.keys;
      const rec = await record(cid);
      const keys = {};
      for (const p of KEY_PROVIDERS) {
        if (rec.keys && rec.keys[p] && rec.keys[p].enc) {
          try { keys[p] = await need().decrypt(rec.keys[p].enc); } catch (e) { if (e instanceof ServiceError) throw e; /* an unreadable key counts as not connected */ }
        }
      }
      cache.set(cid, { keys, exp: Date.now() + CACHE_MS });
      return keys;
    },

    // Checks the key with its provider, then saves it encrypted. Returns the new connections view.
    async set(cid, provider, input, email) {
      if (!KEY_PROVIDERS.includes(provider)) throw new ServiceError('not-found');
      const k = need();
      const key = typeof (input && input.key) === 'string' ? input.key.trim() : '';
      if (!KEY_RE.test(key)) throw new ServiceError('invalid', 'Paste the whole key, with no spaces.');
      const problem = await testKey(provider, key);
      if (problem) throw new ServiceError('invalid', problem);
      const enc = await k.encrypt(key);
      await store.tx(cid, async (tx) => {
        const cur = (await tx.get('meta', 'aiKeys')) || { key: 'aiKeys', keys: {} };
        tx.set('meta', 'aiKeys', { ...cur, keys: { ...cur.keys, [provider]: { enc, last4: key.slice(-4), savedAt: now().toISOString(), savedBy: email } } });
      });
      cache.delete(cid);
      return view(await record(cid));
    },

    async remove(cid, provider) {
      if (!KEY_PROVIDERS.includes(provider)) throw new ServiceError('not-found');
      await store.tx(cid, async (tx) => {
        const cur = await tx.get('meta', 'aiKeys');
        if (!cur || !cur.keys || !cur.keys[provider]) return;
        const { [provider]: _gone, ...rest } = cur.keys;
        tx.set('meta', 'aiKeys', { ...cur, keys: rest });
      });
      cache.delete(cid);
      return view(await record(cid));
    },
  };
  return svc;
}
