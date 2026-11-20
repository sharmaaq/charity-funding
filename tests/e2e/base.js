// Every e2e test starts from freshly seeded server data (Your Place and Our Time) and the default identity:
// a@test.example, a member of Your Place only. Other identities: b@test.example (Our Time only),
// both@test.example (both), nobody@test.example (no charity). Switch with `asUser(context, baseURL, 'b')`.
import { test as base, expect } from '@playwright/test';

export const EMAILS = { a: 'a@test.example', b: 'b@test.example', both: 'both@test.example', nobody: 'nobody@test.example' };

export async function asUser(context, baseURL, who) {
  const url = new URL(baseURL);
  await context.addCookies([{ name: 'dev_user_email', value: encodeURIComponent(EMAILS[who] || who), domain: url.hostname, path: '/' }]);
}

// The page keeps html[data-pending] at the number of decision/setting writes still on their way to the server.
export async function settled(page) {
  await page.waitForFunction(() => document.documentElement.dataset.pending === '0');
}

export async function resetServer(request, baseURL) {
  const res = await request.post('/api/dev/reset', { headers: { Origin: new URL(baseURL).origin } });
  if (!res.ok()) throw new Error(`reset failed: ${res.status()}`);
}

export const test = base.extend({
  freshData: [async ({ request, baseURL }, use) => {
    await resetServer(request, baseURL);
    await use();
  }, { auto: true }],
});
export { expect };
