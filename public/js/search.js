// Word search over the grant cards on screen (REQ-038). Pure: no DOM, no clock.

export const searchWords = (query) => String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);

// True when every word typed appears in the grant's name, funder, summary, reason or note (case-insensitive).
export function grantMatches(grant, noteText, query) {
  const words = searchWords(query);
  if (words.length === 0) return true;
  const hay = [grant.name, grant.funder, grant.summary, grant.reason, noteText].map((s) => String(s ?? '')).join('\n').toLowerCase();
  return words.every((w) => hay.includes(w));
}

// notes: { [grantId]: { text } } (or undefined).
export function filterGrants(grants, notes, query) {
  if (searchWords(query).length === 0) return grants;
  return grants.filter((g) => grantMatches(g, notes && notes[g.id] ? notes[g.id].text : '', query));
}
