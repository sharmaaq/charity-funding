import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './server/api.js';
import { createAuth } from './server/auth.js';
import { readConfig } from './server/config.js';
import { createRoutes } from './server/routes.js';
import { sendJson } from './server/http.js';
import { createStore } from './server/store/index.js';
import { seedAll } from './server/seed/index.js';
import { createFakeRunner } from './server/ai/fake-runner.js';
import { runAI } from './server/ai/runners.js';
import { createCloudKms, createLocalKms } from './server/ai/kms.js';
import { testKey } from './server/ai/ai-core.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };

function send(res, status, type, body) {
  res.writeHead(status, { ...HEADERS, 'Content-Type': type });
  res.end(body);
}

function notFound(res) {
  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SIGN_OUT_HREF = '/?gcp-iap-mode=CLEAR_LOGIN_COOKIE';

// The plain page for a signed-in account that belongs to no charity. No charity data is sent.
export function notSetUpPage(email) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not set up</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:2rem 1rem;color:#1f1b2e;background:#fff}main{max-width:36rem;margin:0 auto}a{color:#442C86}</style></head>
<body><main><h1>Not set up</h1><p data-testid="not-set-up">Your Google account (${escapeHtml(email)}) is not set up for any charity. Ask your administrator to add you.</p><p><a href="${SIGN_OUT_HREF}">Sign out</a></p></main></body></html>`;
}

// options: { config, store, auth?, api? (the /api/submission-* handler), now?, limits?, authOptions? }
export function createServer(options) {
  const { config, store } = options;
  const now = options.now || (() => new Date());
  const auth = options.auth || createAuth(config, options.authOptions);
  const api = options.api || createApi();
  const devMode = Boolean(config.devUserEmail) && !config.onCloudRun;
  // The AI runner: the real one, or a scripted fake (tests pass `ai`; AI_FAKE=1 does the same, in development mode only).
  // Keys a charity connects are encrypted with Cloud KMS (KMS_KEY); in development, with a key held in memory.
  const fake = devMode && process.env.AI_FAKE === '1';
  const ai = {
    runAI: fake ? createFakeRunner({ delayMs: Number(process.env.AI_FAKE_DELAY_MS) || 30 }) : runAI,
    testKey: fake ? async (_p, key) => (key.startsWith('bad') ? 'The key was rejected (401): invalid (fake check).' : null) : testKey,
    kms: config.kmsKey ? createCloudKms(config.kmsKey) : (devMode ? createLocalKms() : null),
    ...(options.ai || {}),
  };
  const routes = createRoutes({
    store, config, now, ai, limits: options.limits || {},
    devDefaults: devMode ? { members: { 'your-place': [config.devUserEmail, 'both@test.example'], 'our-time': ['b@test.example', 'both@test.example'] } } : null,
  });
  const hasAccess = async (user) => user.isAdmin || (await store.charitiesForUser(user.email)).length > 0;

  return http.createServer(async (req, res) => {
    try {
      // Every request, including static files, needs an identity. In production IAP has already rejected anonymous
      // requests; one that reaches us without a valid IAP JWT is refused too.
      const user = await auth.authenticate(req);
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return notFound(res); }
      if (!user) {
        if (pathname.startsWith('/api/')) return sendJson(res, 401, { code: 'UNAUTHENTICATED', message: 'Sign in with your Google account.' });
        return send(res, 401, 'text/plain; charset=utf-8', 'Sign in required');
      }

      if (pathname.startsWith('/api/')) {
        if (pathname === '/api/submission-capabilities' || pathname === '/api/submission-demo-runs') {
          if (!(await hasAccess(user))) return sendJson(res, 403, { code: 'NOT_SET_UP', message: 'Your account is not set up for any charity.' });
          return await api(req, res, pathname);
        }
        if (await routes(req, res, pathname, user)) return undefined;
        return sendJson(res, 404, { code: 'NOT_FOUND', message: 'Not found.' });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
      }
      // new URL() normalises dot segments, so also check the raw path.
      const rawPath = req.url.split('?')[0].split('#')[0];
      const dotdot = /(^|[\\/])\.\.([\\/]|$)/;
      if (pathname.includes('\0') || pathname.includes('\\') || dotdot.test(rawPath) || dotdot.test(pathname)) {
        return notFound(res);
      }
      if (pathname === '/healthz') {
        return send(res, 200, 'text/plain; charset=utf-8', 'ok');
      }
      if (pathname === '/') pathname = '/index.html';
      // The application page itself is only for accounts that belong to a charity (or admins).
      if (pathname.endsWith('.html') && !(await hasAccess(user))) {
        return send(res, 403, 'text/html; charset=utf-8', req.method === 'HEAD' ? undefined : notSetUpPage(user.email));
      }
      const resolved = path.resolve(publicDir, '.' + pathname);
      if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) {
        return notFound(res);
      }
      let data;
      try {
        const stat = await fs.stat(resolved);
        if (!stat.isFile()) return notFound(res);
        data = await fs.readFile(resolved);
      } catch {
        return notFound(res);
      }
      const type = TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
      send(res, 200, type, req.method === 'HEAD' ? undefined : data);
    } catch {
      if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'Server error');
      else res.destroy();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = readConfig(); // throws on an unsafe configuration (a development identity or no bucket on Cloud Run)
  const store = await createStore(config);
  if (!config.dataBucket) {
    // Local development: in-memory data, seeded at start, with the development user as a member of Your Place.
    await seedAll(store);
    if (config.devUserEmail) await store.updateCharity('your-place', { members: [config.devUserEmail] });
    else console.log('No DEV_USER_EMAIL set: every request will be refused. Set DEV_USER_EMAIL=you@example.org for local use.');
  }
  // 8090 is this project's local default; Cloud Run always supplies PORT.
  const port = Number(process.env.PORT) || 8090;
  createServer({ config, store }).listen(port, '0.0.0.0', () => {
    console.log(`charity-funding listening on 0.0.0.0:${port}`);
  });
}
