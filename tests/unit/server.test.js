import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../server.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// http.request keeps the path exactly as given (fetch would normalise dot segments).
function get(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

let server;
let port;
test.before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
test.after(() => new Promise((r) => server.close(r)));

test('/ serves index.html with security and cache headers', async () => {
  const r = await get(port, '/');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /^text\/html/);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['cache-control'], 'no-cache');
  assert.match(r.body, /<main/);
});

test('assets are served with correct content types', async () => {
  const css = await get(port, '/styles.css');
  assert.equal(css.status, 200);
  assert.match(css.headers['content-type'], /^text\/css/);
  for (const f of ['app.js', 'state.js', 'fixtures.js']) {
    const js = await get(port, `/js/${f}`);
    assert.equal(js.status, 200, f);
    assert.match(js.headers['content-type'], /^text\/javascript/);
  }
});

test('/healthz returns 200 ok', async () => {
  const r = await get(port, '/healthz');
  assert.equal(r.status, 200);
  assert.equal(r.body, 'ok');
});

test('path traversal and files outside public/ return 404', async () => {
  for (const p of [
    '/../server.js',
    '/../package.json',
    '/..%2fserver.js',
    '/%2e%2e/server.js',
    '/%2e%2e%2fpackage.json',
    '/js/../../server.js',
    '/..\\server.js',
    '/%00',
    '/server.js',
    '/package.json',
    '/tests/unit/server.test.js',
  ]) {
    const r = await get(port, p);
    assert.equal(r.status, 404, p);
    assert.ok(!r.body.includes('createServer'), p);
  }
});

test('unknown paths and directories return 404', async () => {
  for (const p of ['/nope', '/js', '/js/', '/js/missing.js', '/index.html/extra']) {
    assert.equal((await get(port, p)).status, 404, p);
  }
});

test('honours PORT and binds to 0.0.0.0', async () => {
  const testPort = 8097;
  const child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(testPort) } });
  try {
    const out = await new Promise((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(() => reject(new Error('server did not start')), 5000);
      child.stdout.on('data', (d) => {
        buf += d;
        if (buf.includes('listening')) {
          clearTimeout(timer);
          resolve(buf);
        }
      });
      child.on('error', reject);
    });
    assert.match(out, new RegExp(`0\\.0\\.0\\.0:${testPort}`));
    const r = await get(testPort, '/healthz');
    assert.equal(r.status, 200);
  } finally {
    child.kill();
  }
});
