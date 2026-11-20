import test from 'node:test';
import assert from 'node:assert/strict';
import { LAST_CHARITY_KEY, OLD_DB_NAME, OLD_STATE_KEY, cleanOldBrowserData, pickCharity, readLastCharity, splitWordmark, writeLastCharity } from '../../public/js/remote/session.js';
import { OrgError } from '../../public/js/org/db.js';
import { proposalFilename } from '../../public/js/application/proposal.js';

const list = [{ id: 'our-time', name: 'Our Time' }, { id: 'your-place', name: 'Your Place' }, { id: 'abc', name: 'Abc Trust' }];

test('the last charity is used if the user can still open it, otherwise the first alphabetically', () => {
  assert.equal(pickCharity(list, 'your-place').id, 'your-place');
  assert.equal(pickCharity(list, 'gone').id, 'abc');
  assert.equal(pickCharity(list, null).id, 'abc');
  assert.equal(pickCharity([], 'x'), null);
  assert.equal(pickCharity(undefined, 'x'), null);
});

test('the wordmark splits the name into two parts', () => {
  assert.deepEqual(splitWordmark('Your Place'), { a: 'Your', b: 'Place' });
  assert.deepEqual(splitWordmark('Our Time Charity'), { a: 'Our', b: 'Time Charity' });
  assert.deepEqual(splitWordmark('Solo'), { a: 'Solo', b: '' });
  assert.deepEqual(splitWordmark('  '), { a: '', b: '' });
});

test('last charity is remembered in localStorage under charity-funding.lastCharity, and storage failures are harmless', () => {
  const data = {};
  const storage = { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
  writeLastCharity(storage, 'our-time');
  assert.equal(data['charity-funding.lastCharity'], 'our-time');
  assert.equal(LAST_CHARITY_KEY, 'charity-funding.lastCharity');
  assert.equal(readLastCharity(storage), 'our-time');
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readLastCharity(broken), null);
  writeLastCharity(broken, 'x');
  assert.equal(readLastCharity(null), null);
});

test('old browser data is deleted, never migrated', () => {
  const removed = [];
  const deleted = [];
  cleanOldBrowserData({ removeItem: (k) => removed.push(k) }, { deleteDatabase: (n) => deleted.push(n) });
  assert.deepEqual(removed, ['charity-funding.demo.v1']);
  assert.deepEqual(deleted, ['charity-funding.organisation']);
  assert.equal(OLD_STATE_KEY, 'charity-funding.demo.v1');
  assert.equal(OLD_DB_NAME, 'charity-funding.organisation');
  // unavailable storage or IndexedDB must not throw
  cleanOldBrowserData({ removeItem() { throw new Error('x'); } }, { deleteDatabase() { throw new Error('x'); } });
  cleanOldBrowserData(null, null);
});

test('OrgError keeps its code and extra detail', () => {
  const e = new OrgError('conflict', undefined, { currentRevision: 3 });
  assert.equal(e.code, 'conflict');
  assert.equal(e.currentRevision, 3);
  assert.match(e.message, /changed in another tab/);
});

test('the proposal file name follows the applicant', () => {
  assert.equal(proposalFilename('Your Place'), 'your-place-proposal.pdf');
  assert.equal(proposalFilename('Our Time'), 'our-time-proposal.pdf');
  assert.equal(proposalFilename(''), 'charity-proposal.pdf');
  assert.equal(proposalFilename('!!!'), 'charity-proposal.pdf');
});
