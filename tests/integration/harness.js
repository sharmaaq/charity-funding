// A real server on a random port over the in-memory store, with a development identity per request (a cookie), so a test
// can act as any user. Two charities are seeded: Your Place (full demo content) and Our Time (record only).
import { createServer } from '../../server.js';
import { readConfig } from '../../server/config.js';
import { createMemoryStore } from '../../server/store/memory.js';
import { seedAll } from '../../server/seed/index.js';
import { createFakeRunner } from '../../server/ai/fake-runner.js';

export const USERS = Object.freeze({
  a: 'a@test.example', // member of Your Place only
  b: 'b@test.example', // member of Our Time only
  both: 'both@test.example', // member of both
  admin: 'admin@test.example', // an administrator who is a member of nothing
  nobody: 'nobody@test.example', // signed in, belongs to nothing
});

// options: { api, limits, members, defaultUser, ai } (ai: { runAI }; the default is the scripted fake, so no test ever calls a real AI) (defaultUser: who a request is when it names no user)
export async function startHarness(options = {}) {
  const store = createMemoryStore();
  await seedAll(store);
  const members = options.members || { 'your-place': [USERS.a, USERS.both], 'our-time': [USERS.b, USERS.both] };
  for (const [cid, list] of Object.entries(members)) await store.updateCharity(cid, { members: list });
  const config = readConfig({ DEV_USER_EMAIL: options.defaultUser || USERS.nobody, ADMIN_EMAILS: USERS.admin });
  const server = createServer({ config, store, api: options.api, limits: options.limits, ai: options.ai || { runAI: createFakeRunner({ delayMs: 5 }) } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // call(user, method, path, { json, form, headers }) -> { status, body (parsed JSON when JSON), headers, bytes }
  async function call(user, method, path, { json, form, headers = {}, origin = true } = {}) {
    const h = { ...headers };
    if (user) h.Cookie = `dev_user_email=${encodeURIComponent(USERS[user] || user)}`;
    if (origin && method !== 'GET' && !h.Origin) h.Origin = base;
    let body;
    if (json !== undefined) { body = JSON.stringify(json); h['Content-Type'] = 'application/json'; }
    if (form) body = form;
    const res = await fetch(base + path, { method, headers: h, body });
    const bytes = Buffer.from(await res.arrayBuffer());
    let parsed = null;
    if (/json/.test(res.headers.get('content-type') || '')) { try { parsed = JSON.parse(bytes.toString('utf8')); } catch { parsed = null; } }
    return { status: res.status, body: parsed, headers: res.headers, bytes };
  }
  return { store, config, server, base, call, close: () => new Promise((r) => server.close(r)) };
}
