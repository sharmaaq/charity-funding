import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES, validateFixtureTiming } from '../../public/js/fixtures.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

test('six fixtures with unique IDs, three suitable and three unsuitable', () => {
  assert.equal(FIXTURES.length, 6);
  assert.equal(new Set(FIXTURES.map((g) => g.id)).size, 6);
  assert.deepEqual(FIXTURES.map((g) => g.id), ['G-001', 'G-002', 'G-003', 'G-004', 'G-005', 'G-006']);
  assert.equal(FIXTURES.filter((g) => g.assessment === 'suitable').length, 3);
  assert.equal(FIXTURES.filter((g) => g.assessment === 'unsuitable').length, 3);
});

test('every fixture has a reason, guidance URL and sources', () => {
  for (const g of FIXTURES) {
    assert.ok(g.name && g.funder && g.amount && g.timing && g.summary, `${g.id} basic fields`);
    assert.ok(g.reason && g.reason.length > 20, `${g.id} reason`);
    assert.match(g.guidanceUrl, /^https:\/\//, `${g.id} guidance URL`);
    assert.ok(g.guidanceLabel, `${g.id} guidance label`);
    assert.ok(Array.isArray(g.sources) && g.sources.length > 0, `${g.id} sources`);
    for (const s of g.sources) {
      assert.ok(s.label);
      assert.match(s.url, /^https:\/\//);
    }
  }
});

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? listFiles(p) : [p];
  });
}

test('no file under public/ names the real charity or its registration number', () => {
  // Built from fragments so this test file does not itself contain the strings.
  const forbidden = [['Your', 'Place'].join(' '), ['Your', 'Place'].join(''), ['1147', '794'].join('')];
  const files = listFiles(publicDir);
  assert.ok(files.length >= 4, 'public/ files found');
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8').toLowerCase();
    for (const bad of forbidden) {
      assert.ok(!text.includes(bad.toLowerCase()), `${path.relative(publicDir, f)} contains a forbidden string`);
    }
  }
});

test('timing fields are valid and no grant opens after it closes', () => {
  assert.deepEqual(validateFixtureTiming(), []);
  assert.deepEqual(validateFixtureTiming([{ id: 'X', opensOn: '2026-12-01', closesOn: '2026-11-01' }]), ['X opens after it closes']);
  assert.equal(validateFixtureTiming([{ id: 'X', closesAt: '17 November' }]).length, 1);
  assert.equal(validateFixtureTiming([{ id: 'X', opensOn: '2026-02-31' }]).length, 1);
});
