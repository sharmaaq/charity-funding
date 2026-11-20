# S3-002: Draft-only testing guardrails

- Created: 2026-11-16
- Type: iteration
- Agreement: user explicitly requires testing without submitting; technical controls proposed
- Delivery: specification only; no code changes or live portal access
- Predecessor: [S3-001](../S3-001-automated-submission/ticket.md)
- Specification: [spec.md](spec.md)

The user asks whether the Garfield Weston specification is sufficient for an agent to prepare a real draft and requires guardrails preventing submission. The scope is specifically G-001 Regular Grants, currently one-year core support. Existing synthetic data does not constitute a genuine application. Official current guidance confirms saved drafts; authenticated fields remain unmapped.

This follow-up preserves delivered S3-001. Its controlled demo can still submit to the isolated fake target; the new default for any real-portal experiment is draft-only with no final-submit capability. This instruction does not initiate a real portal experiment or authorise account creation/transfers in this turn.

REQ-027/028 extended; REQ-029 adds enforceable local/portal draft-only modes and evidence of non-submission. Claude reviews/plans implementation separately. Missing live access/mapping must not prevent local preparation or permit guessed final-action controls. No live-submission feature is requested by this ticket.

Research rechecked 2026-11-16: the [funder's application page](https://garfieldweston.org/for-grant-applicants/how-to-apply/) explicitly links draft applications; [vendor guidance](https://webfiles-sc1.blackbaud.com/files/support/helpfiles/grantsconnect/content/gc-applicants-apply-for-grants.html) distinguishes autosaved forms from final submission. This does not establish whether funder staff can inspect unsubmitted drafts or whether saves trigger internal notifications.

Validation: documentation-only; see shared status for link/whitespace check results. No application tests, external drafts, account creation, declarations or submissions performed.
