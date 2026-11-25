// The data-access contract. Every method takes the charity ID first; it always comes from the authorised request
// context, never from a client-supplied string other than the validated charity ID.
//
//   store.listCharities()                      -> [charity]
//   store.getCharity(cid)                      -> charity | null
//   store.createCharity(charity)               -> charity   (rejects ServiceError('exists') if the ID is taken)
//   store.updateCharity(cid, patch)            -> charity   (shallow merge; rejects 'not-found')
//   store.charitiesForUser(email)              -> [charity] where the lower-cased email is a member
//   store.get(cid, coll, id)                   -> record | undefined
//   store.list(cid, coll)                      -> [record]
//   store.tx(cid, async (tx) => result)        -> result.   tx.get/list read; tx.set/add/delete queue writes that are
//                                                 applied atomically when the callback resolves. Reads come BEFORE
//                                                 writes, and a read never sees a write queued in the same callback.
//                                                 `add` fails with 'exists' if the record exists (immutable records).
//   store.files.put(cid, kind, id, bytes, mime), .get(cid, kind, id) -> { bytes, mime } | null, .delete(cid, kind, id)
//
// Charity records: { id, name, website, theme, notice, members: [lower-cased email], createdAt, createdBy }.
export const COLLECTIONS = Object.freeze([
  'meta', 'opportunities', 'funderPages', 'decisions', 'bids', 'documents', 'applications',
  'submissionSnapshots', 'submissionFiles', 'submissionAttempts', 'submissionReceipts', 'audit', 'notes',
]);
export const FILE_KINDS = Object.freeze(['files', 'submission-files']);
export const CHARITY_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const RECORD_ID_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function checkRef(cid, coll, id) {
  if (!CHARITY_ID_RE.test(String(cid))) throw new Error('Invalid charity ID.');
  if (coll !== undefined && !COLLECTIONS.includes(coll)) throw new Error('Unknown collection.');
  if (id !== undefined && !RECORD_ID_RE.test(String(id))) throw new Error('Invalid record ID.');
}
export function checkFileRef(cid, kind, id) {
  if (!CHARITY_ID_RE.test(String(cid))) throw new Error('Invalid charity ID.');
  if (!FILE_KINDS.includes(kind)) throw new Error('Unknown file kind.');
  if (!RECORD_ID_RE.test(String(id))) throw new Error('Invalid file ID.');
}
