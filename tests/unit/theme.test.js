import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const css = fs.readFileSync(path.join(pub, 'styles.css'), 'utf8');

function token(name) {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${name} is defined`);
  return m[1].toUpperCase();
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('the nine brand tokens are defined with the verified values', () => {
  const expected = {
    purple: '#442C86', lime: '#D7DB2D', navy: '#232551', ink: '#262626', lilac: '#F5F3F8',
    coral: '#ED6A53', orange: '#EA720D', teal: '#00959A', 'light-teal': '#87C0CA',
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(token(name), value, name);
});

test('text pairs meet WCAG AA (4.5:1) and decorative pairs meet 3:1; ratios are printed', () => {
  const white = '#FFFFFF';
  const t = (n) => token(n);
  const text = [
    ['white on purple', white, t('purple')],
    ['navy on lime', t('navy'), t('lime')],
    ['purple on lime', t('purple'), t('lime')],
    ['ink on white', t('ink'), white],
    ['ink on lilac', t('ink'), t('lilac')],
    ['purple on white', t('purple'), white],
    ['purple on lilac', t('purple'), t('lilac')],
    // derived values used by the stylesheet
    ['muted on white', t('muted'), white],
    ['muted on lilac', t('muted'), t('lilac')],
    ['white on purple-dark (hover)', white, t('purple-dark')],
    ['navy on lime-dark (hover)', t('navy'), t('lime-dark')],
    ['purple on lilac-hover', t('purple'), t('lilac-hover')],
    ['ink on white (quiet buttons)', t('ink'), white],
    ['ok-fg on ok-bg', t('ok-fg'), t('ok-bg')],
    ['bad-fg on bad-bg', t('bad-fg'), t('bad-bg')],
    ['white on purple-dark pressed', white, '#281A55'],
  ];
  for (const [label, fg, bg] of text) {
    const r = ratio(fg, bg);
    console.log(`  contrast ${label}: ${r.toFixed(2)}:1`);
    assert.ok(r >= 4.5, `${label} is ${r.toFixed(2)}`);
  }
  const large = [
    ['coral on white (large wordmark text)', t('coral'), white],
    ['neutral border on white (control border)', t('neutral-border'), white],
    ['navy outline on white (focus)', t('navy'), white],
    ['lime outline on purple (focus)', t('lime'), t('purple')],
  ];
  for (const [label, fg, bg] of large) {
    const r = ratio(fg, bg);
    console.log(`  contrast ${label}: ${r.toFixed(2)}:1`);
    assert.ok(r >= 3, `${label} is ${r.toFixed(2)}`);
  }
});

test('decorative coral border on lilac is measured and reported only (the badge icon and text carry the meaning)', () => {
  const r = ratio(token('coral'), token('lilac'));
  console.log('  contrast coral border on lilac (decoration only): ' + r.toFixed(2) + ':1');
  assert.ok(r > 2);
});

test('Lilita One and Urbanist are declared with font-display swap and their files and licences exist', () => {
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  const byFamily = (name) => faces.filter((f) => f.includes(`font-family: "${name}"`));
  assert.equal(byFamily('Lilita One').length, 1);
  assert.deepEqual(byFamily('Urbanist').map((f) => f.match(/font-weight:\s*(\d+)/)[1]).sort(), ['600', '800']);
  for (const f of faces) {
    assert.match(f, /font-display:\s*swap/);
    const url = f.match(/url\("([^"]+)"\)/)[1];
    assert.ok(url.startsWith('/fonts/'), url);
    assert.ok(fs.existsSync(path.join(pub, url)), `${url} exists`);
    assert.ok(fs.statSync(path.join(pub, url)).size > 1000);
  }
  for (const l of ['LICENSE-lilita-one.txt', 'LICENSE-urbanist.txt']) {
    assert.match(fs.readFileSync(path.join(pub, 'fonts', l), 'utf8'), /SIL OPEN FONT LICENSE/i);
  }
});

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

test('no file under public/ loads a font, stylesheet or script from another origin', () => {
  const offenders = [];
  for (const file of walk(pub)) {
    if (!/\.(html|css|js)$/.test(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const checks = [
      /<link\b[^>]*\bhref=["']https?:/gi,
      /<script\b[^>]*\bsrc=["']https?:/gi,
      /@import\s+(url\()?["']?https?:/gi,
      /url\(\s*["']?https?:/gi,
      /\bimport\s*(\(|[^;]*from)\s*["']https?:/gi,
    ];
    for (const re of checks) if (re.test(src)) offenders.push(`${path.relative(pub, file)} ${re}`);
  }
  assert.deepEqual(offenders, []);
});
