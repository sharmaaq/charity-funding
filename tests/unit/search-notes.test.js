import test from 'node:test';
import assert from 'node:assert/strict';
import { filterGrants, grantMatches, searchWords } from '../../public/js/search.js';
import { NOTE_MAX, validateNote } from '../../public/js/notes.js';

const G = [
  { id: 'a', name: 'Regular Grants', funder: 'Example Trust', summary: 'Core costs for charities', reason: 'Fits the charity.' },
  { id: 'b', name: 'Community Fund', funder: 'Other Foundation', summary: 'Youth projects', reason: 'Too small.' },
];

test('searchWords splits on whitespace and ignores case and empty input', () => {
  assert.deepEqual(searchWords('  Core   COSTS '), ['core', 'costs']);
  assert.deepEqual(searchWords(''), []);
  assert.deepEqual(searchWords(undefined), []);
});

test('a grant matches when every word is in its name, funder, summary, reason or note', () => {
  assert.equal(grantMatches(G[0], '', 'regular trust'), true);
  assert.equal(grantMatches(G[0], '', 'regular foundation'), false);
  assert.equal(grantMatches(G[0], '', 'FITS'), true);
  assert.equal(grantMatches(G[0], 'phone Sam on Monday', 'sam monday core'), true);
  assert.equal(grantMatches(G[0], '', ''), true);
});

test('filterGrants uses saved notes and returns the same list for an empty search', () => {
  assert.equal(filterGrants(G, {}, '   '), G);
  assert.deepEqual(filterGrants(G, {}, 'youth').map((g) => g.id), ['b']);
  assert.deepEqual(filterGrants(G, { a: { text: 'youth worker contact' } }, 'youth').map((g) => g.id), ['a', 'b']);
  assert.deepEqual(filterGrants(G, {}, 'nothing here'), []);
});

test('validateNote accepts text up to the limit, including empty, and nothing else', () => {
  assert.deepEqual(validateNote(''), { ok: true, text: '' });
  assert.equal(validateNote('x'.repeat(NOTE_MAX)).ok, true);
  assert.equal(validateNote('x'.repeat(NOTE_MAX + 1)).ok, false);
  for (const bad of [null, undefined, 5, {}, ['a']]) assert.equal(validateNote(bad).ok, false);
});
