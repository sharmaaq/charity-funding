// Hash routes for the application workspace: #/planning/<grantId>/application[/review | /section/<id> | /field/<id>]
export const PLANNING_HASH = '#/planning';

export const appHash = (grantId) => `${PLANNING_HASH}/${encodeURIComponent(grantId)}/application`;
export const reviewHash = (grantId) => `${appHash(grantId)}/review`;
export const sectionHash = (grantId, sectionId) => `${appHash(grantId)}/section/${encodeURIComponent(sectionId)}`;
export const fieldHash = (grantId, fieldId) => `${appHash(grantId)}/field/${encodeURIComponent(fieldId)}`;

export const isApplicationHash = (hash) => /^#\/planning\/[^/]+\/application(\/|$)/.test(hash);

// Returns { grantId, page: 'workspace' | 'review', section?, field? } or null when the hash is not a known application route.
export function parseApplicationHash(hash) {
  const m = /^#\/planning\/([^/]+)\/application(?:\/(review)|\/(section|field)\/([^/]+))?$/.exec(hash);
  if (!m) return null;
  try {
    const grantId = decodeURIComponent(m[1]);
    if (m[2]) return { grantId, page: 'review' };
    if (m[3] === 'section') return { grantId, page: 'workspace', section: decodeURIComponent(m[4]) };
    if (m[3] === 'field') return { grantId, page: 'workspace', field: decodeURIComponent(m[4]) };
    return { grantId, page: 'workspace' };
  } catch {
    return null;
  }
}
