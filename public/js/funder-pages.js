// Funder application pages: links only. The app never contacts a funder; it offers these as plain links that open in a new tab.
// Each entry: { id, funder, label, url }. The URL must be https. Shared by the server (seed, dev fixtures) and the browser.

export const FUNDER_PAGE_ID_RE = /^[A-Za-z0-9._-]{1,100}$/;
const TEXT_MAX = 200;
const URL_MAX = 2000;

// Returns { ok: true, url } (normalised) or { ok: false, message }. https only; no credentials in the URL.
export function validateFunderUrl(value) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > URL_MAX) return { ok: false, message: 'The page address must be a web address (https://...).' };
  const text = value.trim();
  if (!/^https:\/\//i.test(text)) return { ok: false, message: 'The page address must start with https://.' };
  let u;
  try { u = new URL(text); } catch { return { ok: false, message: 'The page address is not a valid web address.' }; }
  if (u.protocol !== 'https:' || !u.hostname) return { ok: false, message: 'The page address must start with https://.' };
  if (u.username || u.password) return { ok: false, message: 'The page address must not contain a user name or password.' };
  return { ok: true, url: u.href };
}

// Returns { ok: true, page } with trimmed text and a normalised URL, or { ok: false, errors: { field: message } }.
export function validateFunderPage(input) {
  const i = input && typeof input === 'object' ? input : {};
  const errors = {};
  if (typeof i.id !== 'string' || !FUNDER_PAGE_ID_RE.test(i.id)) errors.id = 'The ID must be 1 to 100 letters, digits, dots, hyphens or underscores.';
  for (const k of ['funder', 'label']) {
    if (typeof i[k] !== 'string' || i[k].trim() === '' || i[k].trim().length > TEXT_MAX) errors[k] = `The ${k === 'funder' ? 'funder name' : 'page label'} must be 1 to ${TEXT_MAX} characters.`;
  }
  const u = validateFunderUrl(i.url);
  if (!u.ok) errors.url = u.message;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, page: { id: i.id, funder: i.funder.trim(), label: i.label.trim(), url: u.url } };
}

// The valid entries only, in the given order (an invalid stored entry is skipped, never linked).
export function usableFunderPages(list) {
  const out = [];
  for (const p of Array.isArray(list) ? list : []) {
    const v = validateFunderPage(p);
    if (v.ok) out.push(v.page);
  }
  return out;
}

// The entry the review screen preselects: the grant's own funder page, else the first entry (null when there are none).
export function defaultFunderPage(pages, funderPageId) {
  return pages.find((p) => p.id === funderPageId) || pages[0] || null;
}

// The text shown for an entry in the choice.
export const funderPageText = (p) => `${p.funder} - ${p.label}`;
