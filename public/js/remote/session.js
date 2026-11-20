// Who is signed in and which charity is open. Identity comes from the server (/api/me, which reads the verified IAP
// token); the browser only remembers which charity was used last.
export const LAST_CHARITY_KEY = 'charity-funding.lastCharity';
// Browser-side storage from before the server held the data. Deleted on first load; nothing is migrated.
export const OLD_DB_NAME = 'charity-funding.organisation';
export const OLD_STATE_KEY = 'charity-funding.demo.v1';
export const SIGN_OUT_HREF = '/?gcp-iap-mode=CLEAR_LOGIN_COOKIE';

// The remembered charity if the user may still open it, otherwise the first alphabetically (null when there are none).
export function pickCharity(charities, lastId) {
  if (!Array.isArray(charities) || charities.length === 0) return null;
  const hit = lastId && charities.find((c) => c.id === lastId);
  if (hit) return hit;
  return [...charities].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'))[0];
}

// "Your Place" -> { a: "Your", b: "Place" }; a one-word name has no second part.
export function splitWordmark(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { a: '', b: '' };
  return { a: parts[0], b: parts.slice(1).join(' ') };
}

export function readLastCharity(storage) {
  try { return storage && storage.getItem(LAST_CHARITY_KEY); } catch { return null; }
}
export function writeLastCharity(storage, id) {
  try { if (storage) storage.setItem(LAST_CHARITY_KEY, id); } catch { /* optional convenience */ }
}

// Deletes the old IndexedDB database and the old localStorage grant state. Safe to call on every load.
export function cleanOldBrowserData(storage = globalThis.localStorage, idb = globalThis.indexedDB) {
  try { if (storage) storage.removeItem(OLD_STATE_KEY); } catch { /* storage unavailable */ }
  try { if (idb && typeof idb.deleteDatabase === 'function') idb.deleteDatabase(OLD_DB_NAME); } catch { /* unavailable */ }
}
