// The real Garfield Weston connector, delivered as a disabled capability with a readiness report (spec section 12).
// No code here navigates anywhere or contacts any funder or Blackbaud system. prepare() refuses before
// doing anything, and submit() always throws FINAL_SUBMISSION_DISABLED. The gates are what section 12 requires; every one is unmet in this demo.
export const LIVE_ADAPTER_ID = 'garfield-weston-regular-core-live';

export const LIVE_GATES = Object.freeze([
  { id: 'applicant-authority', label: 'Authority from a real applicant organisation' },
  { id: 'automation-permitted', label: 'Confirmation that the funder permits automated completion' },
  { id: 'portal-map', label: 'Authenticated current form mapping not verified' },
  { id: 'eligibility', label: 'Verified current eligibility' },
  { id: 'real-identity', label: 'Non-synthetic organisation identity and content' },
  { id: 'reviewed-documents', label: 'Reviewed real documents' },
  { id: 'organisation-programme', label: 'Verified organisation and programme in the portal' },
  { id: 'session-isolation', label: 'Credential and session isolation' },
  { id: 'durable-ledger', label: 'Durable duplicate-prevention ledger' },
  { id: 'final-authority', label: 'Final review and send authority for a specific application' },
  { id: 'receipt-evidence', label: 'Receipt and reconciliation test evidence' },
]);

export class LiveNotConfigured extends Error {
  constructor() {
    super('Live submission is not configured. Nothing was sent.');
    this.code = 'LIVE_NOT_CONFIGURED';
  }
}

export class FinalSubmissionDisabled extends Error {
  constructor() {
    super('Final submission is disabled in this platform. Nothing was sent.');
    this.code = 'FINAL_SUBMISSION_DISABLED';
  }
}

export const liveAdapter = Object.freeze({
  describe: () => ({ id: LIVE_ADAPTER_ID, version: '0', mode: 'live', readiness: 'unavailable' }),
  readiness: () => ({ available: false, gates: LIVE_GATES.map((g) => ({ ...g, met: false })) }),
  blockers: () => LIVE_GATES.map((g) => g.label),
  validate: () => ({ ok: false, code: 'LIVE_NOT_CONFIGURED' }),
  inspect: async () => { throw new LiveNotConfigured(); },
  prepare: async () => { throw new LiveNotConfigured(); },
  compare: () => { throw new LiveNotConfigured(); },
  // No argument, flag or environment variable changes this. Submission is always done by the manager on the funder's own site.
  submit: async () => { throw new FinalSubmissionDisabled(); },
  reconcile: async () => { throw new LiveNotConfigured(); },
});
