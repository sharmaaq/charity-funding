import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFunderUrl, validateFunderPage, usableFunderPages, defaultFunderPage } from '../../public/js/funder-pages.js';
import { FIXTURES, FUNDER_PAGES } from '../../server/seed/your-place-grants.js';
import { createMemoryStore } from '../../server/store/memory.js';
import { seedCharity } from '../../server/seed/index.js';
import { createWorkspaceService } from '../../server/services/workspace.js';

const ok = { id: 'a', funder: 'F', label: 'L', url: 'https://example.org/apply' };

test('https addresses are accepted and normalised', () => {
  assert.deepEqual(validateFunderUrl('https://example.org/a b'), { ok: true, url: 'https://example.org/a%20b' });
  assert.equal(validateFunderUrl('  HTTPS://Example.org  ').ok, true);
});

test('javascript:, http:, data:, file:, credentials and junk are refused', () => {
  for (const u of ['javascript:alert(1)', 'JavaScript:alert(1)', 'http://example.org', 'data:text/html,x', 'file:///etc/passwd', '//example.org', 'https://user:pw@example.org', 'https://', 'example.org', '', '   ', null, undefined, 42, {}]) {
    assert.equal(validateFunderUrl(u).ok, false, String(u));
  }
});

test('an entry needs an ID, funder name, label and https URL', () => {
  assert.equal(validateFunderPage(ok).ok, true);
  assert.deepEqual(Object.keys(validateFunderPage({ ...ok, id: 'bad id' }).errors), ['id']);
  assert.deepEqual(Object.keys(validateFunderPage({ ...ok, funder: ' ' }).errors), ['funder']);
  assert.deepEqual(Object.keys(validateFunderPage({ ...ok, label: 'x'.repeat(201) }).errors), ['label']);
  assert.deepEqual(Object.keys(validateFunderPage({ ...ok, url: 'http://example.org' }).errors), ['url']);
  assert.equal(validateFunderPage(null).ok, false);
});

test('usableFunderPages skips invalid entries; the default is the grant funder, else the first', () => {
  const b = { ...ok, id: 'b' };
  const pages = usableFunderPages([ok, { ...ok, id: 'bad', url: 'javascript:1' }, b]);
  assert.deepEqual(pages.map((p) => p.id), ['a', 'b']);
  assert.equal(defaultFunderPage(pages, 'b').id, 'b');
  assert.equal(defaultFunderPage(pages, 'missing').id, 'a');
  assert.equal(defaultFunderPage(pages, null).id, 'a');
  assert.equal(defaultFunderPage([], 'a'), null);
  assert.deepEqual(usableFunderPages(undefined), []);
});

test('the seed has Garfield Weston as the single entry, with the same URL as before, and G-001 links to it', () => {
  assert.equal(FUNDER_PAGES.length, 1);
  assert.equal(FUNDER_PAGES[0].url, 'https://garfieldweston.org/for-grant-applicants/how-to-apply/');
  assert.equal(validateFunderPage(FUNDER_PAGES[0]).ok, true);
  assert.equal(FIXTURES.find((g) => g.id === 'G-001').funderPageId, FUNDER_PAGES[0].id);
  for (const g of FIXTURES) if (g.funderPageId) assert.ok(FUNDER_PAGES.some((p) => p.id === g.funderPageId));
});
test('the workspace returns the charity own funder pages; a charity seeded earlier is backfilled', async () => {
  const store = createMemoryStore();
  await seedCharity(store, 'your-place');
  await seedCharity(store, 'our-time');
  const ws = createWorkspaceService(store);
  assert.deepEqual((await ws.load('your-place')).funderPages.map((p) => p.id), ['garfield-weston']);
  assert.deepEqual((await ws.load('our-time')).funderPages, []);
  const { funderPageId: _drop, ...bare } = FIXTURES[0];
  await store.tx('your-place', async (tx) => { tx.delete('funderPages', 'garfield-weston'); tx.set('opportunities', 'G-001', { ...bare, order: 0 }); });
  assert.deepEqual((await ws.load('your-place')).funderPages, []);
  const again = await seedCharity(store, 'your-place');
  assert.equal(again.funderPagesAdded, 1);
  const after = await ws.load('your-place');
  assert.equal(after.funderPages.length, 1);
  assert.equal(after.opportunities.find((o) => o.id === 'G-001').funderPageId, 'garfield-weston');
});
