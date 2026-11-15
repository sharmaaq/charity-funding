// Hash routes for the organisation area.
export const ORG_HOME = '#/organisation';
export const BIDS_HASH = '#/organisation/bids';
export const DOCS_HASH = '#/organisation/documents';
export const BID_NEW_HASH = '#/organisation/bids/new';
export const bidHash = (id) => `#/organisation/bids/${encodeURIComponent(id)}`;
export const bidEditHash = (id) => `${bidHash(id)}/edit`;

export const isOrgHash = (hash) => hash === ORG_HOME || hash.startsWith(ORG_HOME + '/');

// Returns { page, id? } or null when the hash is in the area but not a known route.
export function parseOrgHash(hash) {
  if (hash === ORG_HOME || hash === BIDS_HASH) return { page: 'bids' };
  if (hash === DOCS_HASH) return { page: 'documents' };
  if (hash === BID_NEW_HASH) return { page: 'bid-new' };
  const m = /^#\/organisation\/bids\/([^/]+)(\/edit)?$/.exec(hash);
  if (!m) return null;
  try {
    return { page: m[2] ? 'bid-edit' : 'bid-detail', id: decodeURIComponent(m[1]) };
  } catch {
    return null;
  }
}
