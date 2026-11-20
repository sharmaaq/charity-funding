// The browser's only way to reach saved data: same-origin fetches to /api. Failures become OrgError with the same codes
// the old IndexedDB repositories used, so the existing views and tests of error states keep working.
import { OrgError } from '../org/db.js';

// Rebuilds an OrgError from an error response body { code, message, ...extra }.
function errorFrom(status, body) {
  const b = body && typeof body === 'object' ? body : {};
  const { code, message, ...extra } = b;
  if (status === 401) return new OrgError('unauthenticated', message, { status });
  const known = typeof code === 'string' ? code.toLowerCase().replace(/_/g, '-') : null;
  // A message that is only the code itself (the server's default) is dropped, so the readable default for that code shows.
  return new OrgError(known || (status === 404 ? 'not-found' : 'unknown'), typeof message === 'string' && message !== code ? message : undefined, { ...extra, status });
}

async function parse(res) {
  const type = res.headers.get('content-type') || '';
  if (!/json/.test(type)) return null;
  try { return await res.json(); } catch { return null; }
}

// opts: { method, json, form (FormData), raw (return the Response body as a Blob) }
export async function api(url, { method = 'GET', json, form, blob = false, signal, keepalive = false } = {}) {
  const init = { method, cache: 'no-store', headers: {}, credentials: 'same-origin', signal };
  if (keepalive) init.keepalive = true; // small writes survive a page unload
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers['Content-Type'] = 'application/json'; }
  if (form) init.body = form;
  if (method !== 'GET') init.headers.Accept = 'application/json';
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new OrgError('unavailable', undefined, { cause: e });
  }
  if (!res.ok) throw errorFrom(res.status, await parse(res));
  if (blob) return res.blob();
  return parse(res);
}
