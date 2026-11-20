// Errors raised by the services and the stores. The route layer turns them into JSON { code, message, ...extra }.
// The browser rebuilds an OrgError from the same code, so the existing views keep their error handling.
export const STATUS = Object.freeze({
  invalid: 400,
  'not-found': 404,
  conflict: 409,
  'source-changed': 409,
  'already-submitted': 409,
  'attempt-active': 409,
  exists: 409,
  capacity: 413,
  forbidden: 403,
  unknown: 500,
});

export class ServiceError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code);
    this.name = 'ServiceError';
    this.code = code;
    this.extra = extra;
  }
  get status() { return STATUS[this.code] || 400; }
  toJSON() { return { code: this.code, message: this.message, ...this.extra }; }
}
