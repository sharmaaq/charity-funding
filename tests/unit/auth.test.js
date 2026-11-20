import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createAuth, IAP_HEADER, IAP_ISSUER } from '../../server/auth.js';
import { IAP_AUDIENCE, readConfig } from '../../server/config.js';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = publicKey.export({ type: 'spki', format: 'pem' });
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

function jwt(payload = {}, { key = privateKey, kid = 'k1' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', typ: 'JWT', kid });
  const body = b64({ iss: IAP_ISSUER, aud: IAP_AUDIENCE, email: 'Person@Example.org', iat: now - 10, exp: now + 600, ...payload });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

const req = (headers = {}) => ({ headers });
const adminCfg = readConfig({ ADMIN_EMAILS: 'Boss@Example.org, other@example.org' });
const mk = (cfg = adminCfg) => createAuth(cfg, { getKeys: async () => ({ k1: pem }) });

test('a valid IAP token gives the lower-cased email', async () => {
  const u = await mk().authenticate(req({ [IAP_HEADER]: jwt() }));
  assert.deepEqual(u, { email: 'person@example.org', isAdmin: false });
});

test('admins come from ADMIN_EMAILS, compared case-insensitively', async () => {
  const a = await mk().authenticate(req({ [IAP_HEADER]: jwt({ email: 'BOSS@example.org' }) }));
  assert.equal(a.isAdmin, true);
  assert.equal(a.email, 'boss@example.org');
});

test('missing, malformed, expired, wrong-audience, wrong-issuer and wrongly signed tokens are all refused', async () => {
  const auth = mk();
  const now = Math.floor(Date.now() / 1000);
  const cases = {
    missing: req(),
    empty: req({ [IAP_HEADER]: '' }),
    garbage: req({ [IAP_HEADER]: 'not.a.jwt' }),
    expired: req({ [IAP_HEADER]: jwt({ iat: now - 7200, exp: now - 3600 }) }),
    audience: req({ [IAP_HEADER]: jwt({ aud: '/projects/1/locations/x/services/other' }) }),
    issuer: req({ [IAP_HEADER]: jwt({ iss: 'https://accounts.google.com' }) }),
    signature: req({ [IAP_HEADER]: jwt({}, { key: other.privateKey }) }),
    unknownKey: req({ [IAP_HEADER]: jwt({}, { kid: 'nope' }) }),
    noEmail: req({ [IAP_HEADER]: jwt({ email: undefined }) }),
    badEmail: req({ [IAP_HEADER]: jwt({ email: 'not an email' }) }),
  };
  for (const [name, r] of Object.entries(cases)) assert.equal(await auth.authenticate(r), null, name);
});

test('the unsigned email headers and anything else the browser sends are never trusted', async () => {
  const u = await mk().authenticate(req({
    'x-goog-authenticated-user-email': 'accounts.google.com:boss@example.org',
    'x-goog-authenticated-user-id': 'accounts.google.com:1',
    'x-forwarded-email': 'boss@example.org',
    cookie: 'dev_user_email=boss%40example.org',
  }));
  assert.equal(u, null);
});

test('rotated keys are re-fetched once', async () => {
  let calls = 0;
  const auth = createAuth(adminCfg, { getKeys: async () => { calls += 1; return calls === 1 ? { old: pem } : { k1: pem }; } });
  assert.ok(await auth.authenticate(req({ [IAP_HEADER]: jwt() })));
  assert.equal(calls, 2);
});

test('the development identity works locally, with a per-request override only in that mode', async () => {
  const cfg = readConfig({ DEV_USER_EMAIL: 'Dev@Test.example', ADMIN_EMAILS: 'dev@test.example' });
  const auth = createAuth(cfg);
  assert.deepEqual(await auth.authenticate(req()), { email: 'dev@test.example', isAdmin: true });
  assert.equal((await auth.authenticate(req({ cookie: 'dev_user_email=other%40test.example' }))).email, 'other@test.example');
});

test('without IAP and without a development identity nobody is signed in, whatever the request says', async () => {
  const auth = createAuth(readConfig({}));
  assert.equal(await auth.authenticate(req({ cookie: 'dev_user_email=a%40b.example' })), null);
});

test('a development identity is refused on Cloud Run', async () => {
  assert.throws(() => readConfig({ K_SERVICE: 'charity-funding', DEV_USER_EMAIL: 'dev@test.example', DATA_BUCKET: 'b' }), /DEV_USER_EMAIL must not be set on Cloud Run/);
  // Even a hand-built configuration cannot turn the development identity on there.
  const sneaky = { onCloudRun: true, devUserEmail: 'dev@test.example', admins: new Set(), iapAudience: IAP_AUDIENCE };
  const auth = createAuth(sneaky, { getKeys: async () => ({ k1: pem }) });
  assert.equal(await auth.authenticate(req({ cookie: 'dev_user_email=dev%40test.example' })), null);
  assert.ok(await auth.authenticate(req({ [IAP_HEADER]: jwt() })));
});

test('Cloud Run needs a data bucket', () => {
  assert.throws(() => readConfig({ K_SERVICE: 'charity-funding' }), /DATA_BUCKET must be set/);
  const cfg = readConfig({ K_SERVICE: 'charity-funding', DATA_BUCKET: 'b', ADMIN_EMAILS: 'a@b.example;c@d.example' });
  assert.deepEqual([...cfg.admins].sort(), ['a@b.example', 'c@d.example']);
  assert.equal(cfg.iapAudience, '/projects/36580608208/locations/europe-west1/services/charity-funding');
});
