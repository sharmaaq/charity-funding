// Bounded streaming intake of a demo-run request (busboy). Rejects while streaming, before the body is buffered.
// busboy's count limits fire on reaching the limit, so they are set one above the allowed counts; the exact rule (one
// manifest, one proposal, one accounts file, nothing else) is enforced by name in the handlers below.
// Limits:
// more than 21 MiB in total, more than 10 MiB per file, a manifest over 256 KiB, extra or duplicate parts.
import busboy from 'busboy';
import { ManifestError } from './manifest.js';

export const INTAKE_LIMITS = Object.freeze({ maxBodyBytes: 21 * 1024 * 1024, maxFileBytes: 10 * 1024 * 1024, maxManifestBytes: 256 * 1024 });
const FILE_PARTS = ['proposal', 'accounts'];

// Resolves { manifestText, files: { proposal?: { filename, mimeType, bytes: Uint8Array }, accounts?: ... } }.
// Rejects with ManifestError; on rejection the caller responds and the rest of the body is discarded unread.
export function readMultipart(req, limits = INTAKE_LIMITS) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limits.maxBodyBytes) { reject(new ManifestError(413, 'TOO_LARGE', 'The request is larger than 21 MB.')); return; }
    let bb;
    try {
      bb = busboy({ headers: req.headers, limits: { fields: 2, files: 3, parts: 5, fileSize: limits.maxFileBytes, fieldSize: limits.maxManifestBytes, fieldNameSize: 50, headerPairs: 20 } });
    } catch {
      reject(new ManifestError(415, 'UNSUPPORTED_MEDIA', 'The request must be multipart/form-data.'));
      return;
    }
    let settled = false;
    let seen = 0;
    let manifestText = null;
    const files = {};
    const pending = new Set();
    const fail = (err) => {
      if (settled) return;
      settled = true;
      req.unpipe(bb);
      req.removeListener('data', count);
      req.resume(); // discard the remainder without buffering it
      reject(err);
    };
    const count = (chunk) => {
      seen += chunk.length;
      if (seen > limits.maxBodyBytes) fail(new ManifestError(413, 'TOO_LARGE', 'The request is larger than 21 MB.'));
    };
    req.on('data', count);

    bb.on('field', (name, value, info) => {
      if (name !== 'manifest') return fail(new ManifestError(400, 'MALFORMED', `Unexpected form field "${name}".`));
      if (manifestText !== null) return fail(new ManifestError(400, 'MALFORMED', 'The manifest was sent more than once.'));
      if (info.valueTruncated) return fail(new ManifestError(413, 'TOO_LARGE', 'The manifest is larger than 256 KB.'));
      manifestText = value;
    });
    bb.on('file', (name, stream, info) => {
      if (!FILE_PARTS.includes(name)) { stream.resume(); return fail(new ManifestError(400, 'MALFORMED', `Unexpected file part "${name}".`)); }
      if (files[name] || pending.has(name)) { stream.resume(); return fail(new ManifestError(400, 'MALFORMED', `The ${name} file was sent more than once.`)); }
      pending.add(name);
      const chunks = [];
      let size = 0;
      stream.on('data', (c) => { size += c.length; chunks.push(c); });
      stream.on('limit', () => fail(new ManifestError(413, 'TOO_LARGE', `The ${name} file is larger than 10 MB.`)));
      stream.on('close', () => {
        pending.delete(name);
        if (settled) return;
        const buf = Buffer.concat(chunks, size);
        files[name] = { filename: info.filename, mimeType: info.mimeType, bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) };
      });
    });
    bb.on('partsLimit', () => fail(new ManifestError(400, 'MALFORMED', 'Too many parts.')));
    bb.on('filesLimit', () => fail(new ManifestError(400, 'MALFORMED', 'Too many files.')));
    bb.on('fieldsLimit', () => fail(new ManifestError(400, 'MALFORMED', 'Too many fields.')));
    bb.on('error', () => fail(new ManifestError(400, 'MALFORMED', 'The multipart body could not be read.')));
    bb.on('close', () => {
      if (settled) return;
      if (manifestText === null) return fail(new ManifestError(400, 'MALFORMED', 'The manifest part is missing.'));
      settled = true;
      req.removeListener('data', count);
      resolve({ manifestText, files });
    });
    req.on('aborted', () => fail(new ManifestError(400, 'MALFORMED', 'The request was interrupted.')));
    req.pipe(bb);
  });
}
