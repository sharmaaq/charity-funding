import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
};

const HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };

function send(res, status, type, body) {
  res.writeHead(status, { ...HEADERS, 'Content-Type': type });
  res.end(body);
}

function notFound(res) {
  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
      }
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        return notFound(res);
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
      send(res, 500, 'text/plain; charset=utf-8', 'Server error');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // 8090 is this project's local default; Cloud Run always supplies PORT.
  const port = Number(process.env.PORT) || 8090;
  createServer().listen(port, '0.0.0.0', () => {
    console.log(`charity-funding listening on 0.0.0.0:${port}`);
  });
}
