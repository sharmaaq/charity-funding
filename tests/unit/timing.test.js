import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from '../../public/js/fixtures.js';
import { withPreviewTiming, isTimingPreview } from '../../public/js/preview.js';
import {
  londonParts,
  addOneMonthClamped,
  isUpcoming,
  isDueSoon,
  timingMarkers,
  nextChangeAt,
  nextLondonMidnight,
  validateTiming,
} from '../../public/js/timing.js';

// Base clock: 15 November 2026, 10:00 London (GMT, so 10:00Z).
const NOW = new Date('2026-11-15T10:00:00Z');
const opens = (d) => ({ opensOn: d });
const closes = (d) => ({ closesOn: d });
const at = (iso) => ({ closesAt: iso });

test('londonParts uses the London calendar date, not UTC', () => {
  assert.deepEqual(londonParts(new Date('2026-11-15T10:00:00Z')), { y: 2026, m: 11, d: 15, hh: 10, mm: 0, ss: 0 });
  // 23:30 UTC on a summer date is already 00:30 the next day in London.
  const p = londonParts(new Date('2026-07-01T23:30:00Z'));
  assert.deepEqual([p.y, p.m, p.d, p.hh, p.mm], [2026, 7, 2, 0, 30]);
});

test('London date around the clock changes', () => {
  // Spring forward 29 March 2026 (01:00 UTC): 23:30Z on the 28th is still the 28th (GMT); on the 29th it is 00:30 on the 30th (BST).
  assert.equal(londonParts(new Date('2026-03-28T23:30:00Z')).d, 28);
  assert.equal(londonParts(new Date('2026-03-29T23:30:00Z')).d, 30);
  // Fall back 25 October 2026: 23:30Z on the 24th is 00:30 on the 25th (BST); on the 25th it is 23:30 on the 25th (GMT).
  assert.equal(londonParts(new Date('2026-10-24T23:30:00Z')).d, 25);
  assert.equal(londonParts(new Date('2026-10-25T23:30:00Z')).d, 25);
});

test('Upcoming: tomorrow through seven days ahead, inclusive', () => {
  assert.equal(isUpcoming(opens('2026-11-16'), NOW), true);
  assert.equal(isUpcoming(opens('2026-11-22'), NOW), true);
  assert.equal(isUpcoming(opens('2026-11-15'), NOW), false);
  assert.equal(isUpcoming(opens('2026-11-23'), NOW), false);
  assert.equal(isUpcoming(opens('2026-11-14'), NOW), false);
});

test('Upcoming uses the London date at 23:30 UTC in summer', () => {
  const now = new Date('2026-07-01T23:30:00Z'); // 2 July in London
  assert.equal(isUpcoming(opens('2026-07-03'), now), true);
  assert.equal(isUpcoming(opens('2026-07-02'), now), false); // opens today in London
  assert.equal(isUpcoming(opens('2026-07-09'), now), true);
  assert.equal(isUpcoming(opens('2026-07-10'), now), false);
});

test('Due soon: today through one calendar month ahead, inclusive', () => {
  assert.equal(isDueSoon(closes('2026-11-15'), NOW), true);
  assert.equal(isDueSoon(closes('2026-12-15'), NOW), true);
  assert.equal(isDueSoon(closes('2026-11-14'), NOW), false);
  assert.equal(isDueSoon(closes('2026-12-16'), NOW), false);
});

test('Due soon with an exact closing time', () => {
  assert.equal(isDueSoon(at('2026-11-15T17:00:00+00:00'), NOW), true); // later today
  assert.equal(isDueSoon(at('2026-11-15T09:00:00+00:00'), NOW), false); // earlier today: passed
  assert.equal(isDueSoon(at('2026-11-15T10:00:00+00:00'), NOW), false); // exactly now: passed
  assert.equal(isDueSoon(at('2026-12-15T17:00:00+00:00'), NOW), true);
  assert.equal(isDueSoon(at('2026-12-16T00:00:00+00:00'), NOW), false);
  // An offset instant is converted to its London date (23:30 BST on 1 July is 22:30Z, still 1 July).
  assert.equal(isDueSoon(at('2026-07-01T23:30:00+01:00'), new Date('2026-07-01T10:00:00Z')), true);
});

test('a date-only deadline stays due through the end of that London date', () => {
  assert.equal(isDueSoon(closes('2026-07-01'), new Date('2026-07-01T22:59:00Z')), true); // 23:59 BST on 1 July
  assert.equal(isDueSoon(closes('2026-07-01'), new Date('2026-07-01T23:30:00Z')), false); // already 2 July in London
});

test('month arithmetic clamps to the end of the month', () => {
  assert.deepEqual(addOneMonthClamped({ y: 2027, m: 1, d: 31 }), { y: 2027, m: 2, d: 28 });
  assert.deepEqual(addOneMonthClamped({ y: 2028, m: 1, d: 31 }), { y: 2028, m: 2, d: 29 });
  assert.deepEqual(addOneMonthClamped({ y: 2026, m: 3, d: 31 }), { y: 2026, m: 4, d: 30 });
  assert.deepEqual(addOneMonthClamped({ y: 2026, m: 12, d: 15 }), { y: 2027, m: 1, d: 15 });
  const jan31 = new Date('2027-01-31T12:00:00Z');
  assert.equal(isDueSoon(closes('2027-02-28'), jan31), true);
  assert.equal(isDueSoon(closes('2027-03-01'), jan31), false);
  const jan31leap = new Date('2028-01-31T12:00:00Z');
  assert.equal(isDueSoon(closes('2028-02-29'), jan31leap), true);
  assert.equal(isDueSoon(closes('2028-03-01'), jan31leap), false);
});

test('both markers can coexist; missing, invalid and rolling dates give none', () => {
  assert.deepEqual(timingMarkers({ opensOn: '2026-11-17', closesOn: '2026-12-05' }, NOW), ['upcoming', 'dueSoon']);
  assert.deepEqual(timingMarkers({}, NOW), []);
  assert.deepEqual(timingMarkers({ opensOn: 'rolling', closesOn: 'Open at snapshot' }, NOW), []);
  assert.deepEqual(timingMarkers({ opensOn: '2026-02-30', closesOn: '2026-13-01' }, NOW), []);
  assert.deepEqual(timingMarkers({ closesAt: '2026-11-17 12:00' }, NOW), []); // no offset: not an instant
  assert.deepEqual(timingMarkers({ opensOn: null, closesOn: undefined }, NOW), []);
  assert.deepEqual(timingMarkers(null, NOW), []);
  assert.deepEqual(timingMarkers({ closesOn: '2026-11-20' }, new Date('nonsense')), []);
});

test('opening after closing gives no markers and is flagged by validation', () => {
  const bad = { id: 'X', opensOn: '2026-11-20', closesOn: '2026-11-18' };
  assert.deepEqual(timingMarkers(bad, NOW), []);
  assert.equal(validateTiming([bad]).length, 1);
});

test('nextChangeAt: next London midnight, or an earlier closing instant', () => {
  assert.equal(nextChangeAt([], NOW).toISOString(), '2026-11-16T00:00:00.000Z');
  // Summer: London midnight is 23:00Z the day before.
  assert.equal(nextChangeAt([], new Date('2026-07-01T10:00:00Z')).toISOString(), '2026-07-01T23:00:00.000Z');
  // One case each side of a clock change.
  assert.equal(nextLondonMidnight(new Date('2026-03-28T12:00:00Z')).toISOString(), '2026-03-29T00:00:00.000Z');
  assert.equal(nextLondonMidnight(new Date('2026-03-29T12:00:00Z')).toISOString(), '2026-03-29T23:00:00.000Z');
  assert.equal(nextLondonMidnight(new Date('2026-10-24T12:00:00Z')).toISOString(), '2026-10-24T23:00:00.000Z');
  assert.equal(nextLondonMidnight(new Date('2026-10-25T12:00:00Z')).toISOString(), '2026-10-26T00:00:00.000Z');
  // 23:30 UTC in summer: the next London midnight is the following 23:00Z.
  assert.equal(nextLondonMidnight(new Date('2026-07-01T23:30:00Z')).toISOString(), '2026-07-02T23:00:00.000Z');
  const soon = [{ closesAt: '2026-11-15T12:00:00+00:00' }, { closesAt: '2026-11-15T09:00:00+00:00' }, { closesOn: '2026-11-20' }];
  assert.equal(nextChangeAt(soon, NOW).toISOString(), '2026-11-15T12:00:00.000Z');
});

test('the timing module reads no clock', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'js', 'timing.js'), 'utf8');
  assert.doesNotMatch(src, /Date\.now\(|new Date\(\s*\)/);
});

test('real fixtures at the base clock: G-003 and G-005 due soon, G-004 not, none upcoming', () => {
  const by = (id) => timingMarkers(FIXTURES.find((g) => g.id === id), NOW);
  assert.deepEqual(by('G-003'), ['dueSoon']);
  assert.deepEqual(by('G-005'), ['dueSoon']);
  assert.deepEqual(by('G-004'), []); // 20 December is after 15 December
  for (const g of FIXTURES) assert.ok(!timingMarkers(g, NOW).includes('upcoming'), g.id);
  assert.deepEqual(by('G-001'), []);
  assert.deepEqual(by('G-002'), []);
  assert.deepEqual(by('G-006'), []);
});

test('real fixtures carry only the three documented closing times and no opening dates', () => {
  assert.deepEqual(validateTiming(FIXTURES), []);
  for (const g of FIXTURES) assert.equal(g.opensOn, undefined, g.id);
  const withTiming = FIXTURES.filter((g) => g.closesAt || g.closesOn).map((g) => g.id);
  assert.deepEqual(withTiming, ['G-003', 'G-004', 'G-005']);
  assert.equal(FIXTURES.find((g) => g.id === 'G-003').closesAt, '2026-11-17T12:00:00+00:00');
  assert.equal(FIXTURES.find((g) => g.id === 'G-004').closesAt, '2026-12-20T17:00:00+00:00');
  assert.equal(FIXTURES.find((g) => g.id === 'G-005').closesAt, '2026-11-27T17:00:00+00:00');
});

test('preview timing overlay: G-001 upcoming, G-002 both, G-003 due soon; timing text untouched', () => {
  assert.equal(isTimingPreview('?preview=timing'), true);
  assert.equal(isTimingPreview(''), false);
  assert.equal(isTimingPreview('?preview=other'), false);
  const kinds = (id) => {
    const g = FIXTURES.find((x) => x.id === id);
    return timingMarkers(withPreviewTiming(g, NOW), NOW);
  };
  assert.deepEqual(kinds('G-001'), ['upcoming']);
  assert.deepEqual(kinds('G-002'), ['upcoming', 'dueSoon']);
  assert.deepEqual(kinds('G-003'), ['dueSoon']);
  assert.deepEqual(kinds('G-006'), []);
  // The overlay returns copies; the real fixtures and their timing text are not changed.
  const g1 = FIXTURES.find((g) => g.id === 'G-001');
  assert.equal(withPreviewTiming(g1, NOW).timing, g1.timing);
  assert.equal(g1.opensOn, undefined);
  // It follows the supplied date rather than a fixed one.
  const later = new Date('2027-03-01T10:00:00Z');
  assert.deepEqual(timingMarkers(withPreviewTiming(g1, later), later), ['upcoming']);
});

test('marker badge text meets 4.5:1 against its background', () => {
  const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'styles.css'), 'utf8');
  const tok = (n) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))[1];
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const pairs = [
    ['New: white on purple', '#FFFFFF', tok('purple')],
    ['Upcoming: navy on light teal', tok('navy'), tok('light-teal')],
    ['Due soon: navy on lime', tok('navy'), tok('lime')],
  ];
  for (const [label, fg, bg] of pairs) {
    const r = ratio(fg, bg);
    console.log(`  contrast ${label}: ${r.toFixed(2)}:1`);
    assert.ok(r >= 4.5, `${label} ${r.toFixed(2)}`);
  }
  // The stylesheet really uses these pairs.
  assert.match(css, /\.marker-fresh\s*\{[^}]*background:\s*var\(--purple\);\s*color:\s*#fff/);
  assert.match(css, /\.marker-upcoming\s*\{[^}]*background:\s*var\(--light-teal\);\s*color:\s*var\(--navy\)/);
  assert.match(css, /\.marker-dueSoon\s*\{[^}]*background:\s*var\(--lime\);\s*color:\s*var\(--navy\)/);
});
