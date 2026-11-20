// Small HTTP helpers shared by the routers.
import busboy from 'busboy';
import { ServiceError } from './errors.js';

export const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function sendJson(res, status, body, extra = {}) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { ...JSON_HEADERS, ...extra });
  res.end(JSON.stringify(body));
}

export function sendError(res, e) {
  if (e instanceof ServiceError) return sendJson(res, e.status, e.toJSON());
  return sendJson(res, 500, { code: 'SERVER_ERROR', message: 'Server error.', retryable: true });
}

export const notFoundBody = () => ({ code: 'NOT_FOUND', message: 'Not found.' });

// Same-origin only: the Origin header's host must equal the Host header. The service has two public addresses and runs
// on localhost in development; each is its own origin. No CORS headers are ever sent. Required on every write.
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin || !req.headers.host) return false;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export function readJson(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json/i.test(req.headers['content-type'] || '')) { reject(new ServiceError('invalid', 'The request must be JSON.')); return; }
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) { req.resume(); reject(new ServiceError('capacity', 'The request is too large.')); return; }
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > maxBytes) { done = true; req.resume(); reject(new ServiceError('capacity', 'The request is too large.')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new ServiceError('invalid', 'The request is not valid JSON.')); }
    });
    req.on('error', () => { if (!done) { done = true; reject(new ServiceError('invalid', 'The request could not be read.')); } });
  });
}

export const MAX_UPLOAD_BODY = 45 * 1024 * 1024;

// Bounded multipart intake. Resolves { fields: { name: text }, files: [{ field, filename, mimeType, bytes: Buffer }] }.
// opts: { maxFiles, maxFileBytes (a file one byte over is kept so validation can name it), maxBodyBytes, maxFieldBytes }
export function readUpload(req, { maxFiles = 12, maxFileBytes = 10 * 1024 * 1024, maxBodyBytes = MAX_UPLOAD_BODY, maxFieldBytes = 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^multipart\/form-data/i.test(req.headers['content-type'] || '')) { reject(new ServiceError('invalid', 'The request must be multipart/form-data.')); return; }
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBodyBytes) { req.resume(); reject(new ServiceError('capacity', 'The upload is too large.')); return; }
    let bb;
    try {
      bb = busboy({ headers: req.headers, limits: { fields: 10, files: maxFiles + 1, parts: maxFiles + 12, fileSize: maxFileBytes + 1, fieldSize: maxFieldBytes, fieldNameSize: 50, headerPairs: 30 } });
    } catch {
      reject(new ServiceError('invalid', 'The request must be multipart/form-data.'));
      return;
    }
    let settled = false;
    let seen = 0;
    const fields = {};
    const files = [];
    const fail = (err) => {
      if (settled) return;
      settled = true;
      req.unpipe(bb);
      req.removeListener('data', count);
      req.resume();
      reject(err);
    };
    const count = (chunk) => {
      seen += chunk.length;
      if (seen > maxBodyBytes) fail(new ServiceError('capacity', 'The upload is too large.'));
    };
    req.on('data', count);
    bb.on('field', (name, value, info) => {
      if (info.valueTruncated) return fail(new ServiceError('capacity', 'A form field is too large.'));
      if (Object.prototype.hasOwnProperty.call(fields, name)) return fail(new ServiceError('invalid', `The field "${name}" was sent more than once.`));
      fields[name] = value;
    });
    bb.on('file', (name, stream, info) => {
      const chunks = [];
      let size = 0;
      stream.on('data', (c) => { size += c.length; chunks.push(c); });
      stream.on('close', () => {
        if (settled) return;
        files.push({ field: name, filename: info.filename, mimeType: info.mimeType, bytes: Buffer.concat(chunks, size) });
      });
    });
    bb.on('filesLimit', () => fail(new ServiceError('invalid', 'Too many files.')));
    bb.on('partsLimit', () => fail(new ServiceError('invalid', 'Too many parts.')));
    bb.on('fieldsLimit', () => fail(new ServiceError('invalid', 'Too many fields.')));
    bb.on('error', () => fail(new ServiceError('invalid', 'The multipart body could not be read.')));
    bb.on('close', () => {
      if (settled) return;
      settled = true;
      req.removeListener('data', count);
      resolve({ fields, files });
    });
    req.on('aborted', () => fail(new ServiceError('invalid', 'The request was interrupted.')));
    req.pipe(bb);
  });
}

export function parseJsonField(text, what = 'The request') {
  try { return JSON.parse(text); } catch { throw new ServiceError('invalid', `${what} is not valid JSON.`); }
}

export function sendFile(res, { bytes, mime, filename }) {
  const safe = String(filename || 'file').replace(/[^\w.\- ]+/g, '_');
  res.writeHead(200, {
    'Content-Type': mime || 'application/octet-stream',
    'Content-Length': bytes.length,
    'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename || 'file')}`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(bytes);
}
