// Identity. The ONLY source of identity in production is the Identity-Aware Proxy JWT (x-goog-iap-jwt-assertion),
// verified for signature, issuer, audience and expiry. The unsigned x-goog-authenticated-user-email header and anything
// the browser supplies are never read.
//
// Development and tests: DEV_USER_EMAIL (or, in that mode only, a `dev_user_email` cookie so a test can act as another
// user). readConfig() refuses DEV_USER_EMAIL when K_SERVICE is set, and this module independently refuses it too.
import { OAuth2Client } from 'google-auth-library';
import { isEmail, normaliseEmail } from './config.js';

export const IAP_HEADER = 'x-goog-iap-jwt-assertion';
export const IAP_ISSUER = 'https://cloud.google.com/iap';
const KEY_TTL_MS = 60 * 60 * 1000;

function cookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

// options (tests): { getKeys: async () => ({ [kid]: pem }), nowMs: () => number }
export function createAuth(config, options = {}) {
  const client = new OAuth2Client();
  const nowMs = options.nowMs || Date.now;
  let keys = null;
  let keysAt = 0;
  async function getKeys(force = false) {
    if (!force && keys && nowMs() - keysAt < KEY_TTL_MS) return keys;
    keys = options.getKeys ? await options.getKeys() : (await client.getIapPublicKeys()).pubkeys;
    keysAt = nowMs();
    return keys;
  }

  const result = (email) => {
    const e = normaliseEmail(email);
    return isEmail(e) ? { email: e, isAdmin: config.admins.has(e) } : null;
  };

  // Resolves { email, isAdmin } or null (not signed in / invalid). Never throws.
  async function authenticate(req) {
    if (config.devUserEmail && !config.onCloudRun) {
      const override = cookie(req, 'dev_user_email');
      return result(override || config.devUserEmail);
    }
    const token = req.headers[IAP_HEADER];
    if (typeof token !== 'string' || token === '') return null;
    try {
      let ticket;
      try {
        ticket = await client.verifySignedJwtWithCertsAsync(token, await getKeys(), config.iapAudience, [IAP_ISSUER]);
      } catch (e) {
        // Keys may have rotated: refresh once, then fail for any reason.
        ticket = await client.verifySignedJwtWithCertsAsync(token, await getKeys(true), config.iapAudience, [IAP_ISSUER]);
      }
      const payload = ticket.getPayload();
      if (!payload || typeof payload.email !== 'string') return null;
      return result(payload.email);
    } catch {
      return null;
    }
  }
  return { authenticate };
}
