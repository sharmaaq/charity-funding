// Rules for the files that may go into a demo transfer. PURE MODULE: no imports, no DOM, no storage.
// Phase C imports this same file on the server so both sides apply the same rules.
//
// Exactly one proposal PDF and one accounts PDF or DOCX; each at most 10 MiB; together at most 20 MiB. These are limits
// of this demo, not claims about any real portal. Extension, MIME type and the file's own first bytes must agree, and
// a file is never accepted because it was renamed: a text file called accounts.pdf fails the header check.

export const MIB = 1024 * 1024;
export const TRANSFER_LIMITS = Object.freeze({ maxFileBytes: 10 * MIB, maxTotalBytes: 20 * MIB });
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_MIME = 'application/pdf';

const KINDS = Object.freeze({
  pdf: { mime: PDF_MIME, magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  docx: { mime: DOCX_MIME, magic: [0x50, 0x4b, 0x03, 0x04] }, // PK\3\4 (a zip container)
});
const ROLE_KINDS = Object.freeze({ proposal: ['pdf'], accounts: ['pdf', 'docx'] });
export const ROLE_LABEL = Object.freeze({ proposal: 'Proposal', accounts: 'Accounts' });

export const extensionOf = (name) => {
  const s = String(name ?? '');
  const i = s.lastIndexOf('.');
  return i < 0 || i === s.length - 1 ? '' : s.slice(i + 1).toLowerCase();
};

const startsWith = (bytes, magic) => bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);

// file: { role, filename, mime, bytes: Uint8Array }. Returns { ok: true, kind } or { ok: false, code, message }.
export function validateTransferFile(file, limits = TRANSFER_LIMITS) {
  const name = String((file && file.filename) ?? '');
  const role = file && file.role;
  const allowed = ROLE_KINDS[role];
  if (!allowed) return { ok: false, code: 'role', message: `"${name}" has an unknown role.` };
  const what = ROLE_LABEL[role].toLowerCase();
  const ext = extensionOf(name);
  const kind = KINDS[ext] && allowed.includes(ext) ? KINDS[ext] : null;
  if (!kind) {
    return { ok: false, code: 'extension', message: `"${name}" cannot be used as the ${what}: only ${allowed.map((k) => k.toUpperCase()).join(' or ')} files are accepted. A file is never renamed to fit.` };
  }
  const bytes = file.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return { ok: false, code: 'empty', message: `"${name}" is empty, so it cannot be used as the ${what}.` };
  if (bytes.length > limits.maxFileBytes) return { ok: false, code: 'too-large', message: `"${name}" is ${bytes.length.toLocaleString('en-GB')} bytes, over the ${limits.maxFileBytes / MIB} MiB limit for one file in a demo transfer.` };
  if (file.mime !== kind.mime) return { ok: false, code: 'mime', message: `"${name}" is recorded as ${file.mime || 'an unknown type'}, but a .${ext} file must be ${kind.mime}.` };
  if (!startsWith(bytes, kind.magic)) return { ok: false, code: 'header', message: `"${name}" does not start like a real ${ext.toUpperCase()} file, so it was not accepted. It may be a different kind of file with the wrong name.` };
  return { ok: true, kind: ext };
}

// files: the whole set, in package order. Exactly one proposal then one accounts file.
export function validateTransferSet(files, limits = TRANSFER_LIMITS) {
  const errors = [];
  if (!Array.isArray(files)) return { ok: false, errors: [{ code: 'shape', message: 'The files are not in the expected form.' }] };
  const roles = files.map((f) => f && f.role);
  if (roles.length !== 2 || roles[0] !== 'proposal' || roles[1] !== 'accounts') {
    errors.push({ code: 'set', message: 'A demo transfer needs exactly one proposal PDF and one accounts PDF or DOCX.' });
  }
  let total = 0;
  for (const f of files) {
    const r = validateTransferFile(f, limits);
    if (!r.ok) errors.push({ role: f && f.role, ...r });
    else total += f.bytes.length;
  }
  if (!errors.length && total > limits.maxTotalBytes) errors.push({ code: 'total-too-large', message: `The two files together are ${total.toLocaleString('en-GB')} bytes, over the ${limits.maxTotalBytes / MIB} MiB limit for a demo transfer.` });
  return { ok: errors.length === 0, errors, totalBytes: total };
}
