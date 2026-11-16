// The canonical submission-package form and its SHA-256. PURE MODULE: no imports, no DOM, no storage, no clock.
// Browser code, Node tests and (in Phase C) the server import this same file, so both sides compute the same hash.
//
// Canonical form (spec section 6):
//   - JSON text, UTF-8 encoded, no whitespace
//   - object keys sorted by UTF-16 code unit order, recursively; array order preserved
//   - null is kept; a key whose value is `undefined` is omitted (an absent optional field is never written as null)
//   - no timestamps and no generated IDs: only normalised answers, ordered attachment metadata and the adapter identifier
//   - the hash does not include itself

export const PACKAGE_SCHEMA = 'submission.v1';
export const ADAPTER_ID = 'garfield-weston-regular-core-demo.v1';
export const PACKAGE_MODE = 'demo';
// Attachment roles, in the order they appear in the package.
export const ATTACHMENT_ROLES = Object.freeze(['proposal', 'accounts']);

// Canonical JSON text of a value. Throws on anything JSON cannot represent exactly (NaN, Infinity, bigint, functions,
// symbols, undefined inside arrays, non-plain objects). Numbers must be safe integers: the package never carries floats.
export function canonicalJson(value) {
  return write(value, '$');
}

function write(v, at) {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'string': return JSON.stringify(v);
    case 'boolean': return v ? 'true' : 'false';
    case 'number':
      if (!Number.isSafeInteger(v)) throw new TypeError(`${at}: only safe integers can be part of a package`);
      return String(v);
    case 'object': {
      if (Array.isArray(v)) return `[${v.map((x, i) => { if (x === undefined) throw new TypeError(`${at}[${i}]: undefined is not allowed in an array`); return write(x, `${at}[${i}]`); }).join(',')}]`;
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new TypeError(`${at}: only plain objects can be part of a package`);
      const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${write(v[k], `${at}.${k}`)}`).join(',')}}`;
    }
    default:
      throw new TypeError(`${at}: ${typeof v} cannot be part of a package`);
  }
}

export const canonicalBytes = (value) => new TextEncoder().encode(canonicalJson(value));

const HEX = '0123456789abcdef';
export function toHex(buffer) {
  const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let out = '';
  for (const n of b) out += HEX[n >> 4] + HEX[n & 15];
  return out;
}

// SHA-256 of bytes (ArrayBuffer, typed array) or of a string (UTF-8). Lower-case hex.
export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return toHex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}

const isHash = (s) => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);

// attachments: [{ role, filename, mime, size, sha256 }, ...] in package order. Extra properties are ignored on purpose:
// they are local bookkeeping (IDs, versions, flags) and must never change the hash.
export function packagePayload({ answers, attachments, adapter = ADAPTER_ID }) {
  if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) throw new TypeError('answers must be an object');
  if (!Array.isArray(attachments)) throw new TypeError('attachments must be an array');
  return {
    schema: PACKAGE_SCHEMA,
    mode: PACKAGE_MODE,
    adapter,
    answers,
    attachments: attachments.map((a, i) => {
      if (!a || typeof a.role !== 'string' || typeof a.filename !== 'string' || typeof a.mime !== 'string' || !Number.isSafeInteger(a.size) || !isHash(a.sha256)) {
        throw new TypeError(`attachment ${i} is missing role, filename, MIME type, size or a 64-character SHA-256`);
      }
      return { role: a.role, filename: a.filename, mime: a.mime, size: a.size, sha256: a.sha256 };
    }),
  };
}

export const canonicalPackage = (input) => canonicalJson(packagePayload(input));

// The package hash: SHA-256 (lower-case hex) of the canonical package JSON.
export const packageHash = (input) => sha256Hex(canonicalPackage(input));
