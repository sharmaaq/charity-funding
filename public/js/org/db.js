// Typed errors for the organisation and application stores. Storage is now on the server: the old IndexedDB opening code
// is gone, and the same error codes come back from the API (see remote/http.js), so the views keep their handling.

export const ERROR_MESSAGES = Object.freeze({
  unavailable: 'The server could not be reached, so this could not be loaded or saved. Check your connection and try again.',
  quota: 'There is no room left to store this. Remove a stored file, then try again. Nothing was changed.',
  aborted: 'The save was cancelled before it finished. Nothing was changed. Please try again.',
  corrupt: 'Some saved records could not be read. Nothing has been changed or deleted.',
  capacity: 'There is not enough room in the 100 MB file store for this charity. Delete a stored file and try again.',
  conflict: 'This application was changed in another tab or window since you opened it.',
  'source-changed': 'A document or file this package depends on changed while it was being prepared. Nothing was saved. Review the package again.',
  'not-found': 'That record no longer exists. It may have been deleted in another tab.',
  invalid: 'Some details need correcting.',
  'read-only': 'Saving is unavailable, so this cannot be changed.',
  unauthenticated: 'Your sign-in has ended. Reload the page to sign in again.',
  unknown: 'The server reported an unexpected error. Nothing was changed.',
});

export class OrgError extends Error {
  constructor(code, message, extra = {}) {
    super(message || ERROR_MESSAGES[code] || ERROR_MESSAGES.unknown);
    this.name = 'OrgError';
    this.code = code;
    Object.assign(this, extra);
  }
}

export function mapError(e) {
  if (e instanceof OrgError) return e;
  return new OrgError('unknown', undefined, { cause: e });
}
