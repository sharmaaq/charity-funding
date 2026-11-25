// Encryption for a charity's own AI keys. A kms is { encrypt(text) -> blob, decrypt(blob) -> text }.
//   cloud  Google Cloud KMS over REST with the Cloud Run service account (key name from KMS_KEY).
//   local  AES-256-GCM with a random key held in memory: development only, never on Cloud Run.
// Tests pass their own fake. A key and a blob are never logged, and an error says only which call failed.
import crypto from 'node:crypto';
import { googleToken } from './ai-core.mjs';

export function createCloudKms(keyName, { tokenFn = googleToken, fetchFn = (...a) => globalThis.fetch(...a) } = {}) {
  async function call(op, field, value) {
    const r = await fetchFn(`https://cloudkms.googleapis.com/v1/${keyName}:${op}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await tokenFn()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (!r.ok) throw new Error(`Cloud KMS ${op} failed (${r.status})`);
    return r.json();
  }
  return {
    async encrypt(text) { return `kms:${(await call('encrypt', 'plaintext', Buffer.from(text, 'utf8').toString('base64'))).ciphertext}`; },
    async decrypt(blob) {
      if (!String(blob).startsWith('kms:')) throw new Error('Unknown key format');
      return Buffer.from((await call('decrypt', 'ciphertext', blob.slice(4))).plaintext, 'base64').toString('utf8');
    },
  };
}

export function createLocalKms(secret = crypto.randomBytes(32)) {
  return {
    async encrypt(text) {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', secret, iv);
      const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
      return `aes:${Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')}`;
    },
    async decrypt(blob) {
      if (!String(blob).startsWith('aes:')) throw new Error('Unknown key format');
      const b = Buffer.from(blob.slice(4), 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', secret, b.subarray(0, 12));
      d.setAuthTag(b.subarray(12, 28));
      return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
    },
  };
}
