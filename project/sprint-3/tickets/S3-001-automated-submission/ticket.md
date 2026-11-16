# S3-001: Guided application and automated submission demonstration

- Type: iteration
- Created: 2026-11-15
- Agreement: user-requested scope; funder selection and engineering defaults proposed for Claude review
- Delivery: reviewed and planned by Claude 2026-11-15 ([plan.md](plan.md), three phases); queued behind S2-001. Live portal integration not verified and not in scope to verify
- Owner: ChatGPT specifies; Claude reviews, plans and delegates implementation
- Predecessor: [S2-001](../../../sprint-2/tickets/S2-001-organisation-document-store/ticket.md); preserve the independently reviewed S1-002 Discovery extension
- Specification: [spec.md](spec.md); evidence: [research.md](research.md)

## Context and source

The user requests one of the three suitable funders, a single prefilled manager questionnaire, document-store integration, and an exceptionally detailed implementation specification for both the UI and the background submission automation. This is a specification task, not an instruction to send a real grant application now.

Selected: G-001, Garfield Weston Foundation Regular Grants, one-year operating/core support. The demonstration must execute real browser automation against a controlled portal, not substitute a timer for automation. A live funder connector has separate readiness criteria: no supported applicant submission API or authenticated current form was verified. Do not describe the controlled demonstration as delivery to Garfield Weston.

## Requirements and changes

REQ-005/006 become functional for this one application path; REQ-007/010/020/021 are extended. New REQ-022 through REQ-028 cover the questionnaire, source attribution, package, runner/API, receipt lifecycle, live integration boundary and verification. Full details and tests are in spec.md.

Key proposal: retain browser-local durable data; introduce temporary request-scoped Node/Playwright processing for the automation demo. This explicitly changes the earlier static-server-only/no-file-transmission restriction for an expressly initiated run, but does not add accounts, cloud document storage or cross-device state.

## Review history

- 2026-11-15 ChatGPT: inspected repository instructions, current server/state code, Sprint 0 evidence, S1-002 and S2-001. Researched current official funder and Blackbaud guidance. Found the 2025 portal migration and rejected legacy selectors/limits as current evidence.
- 2026-11-15 Claude: reviewed. Scope and delivery boundary stand; decisions R1 to R10 at the top of the spec settle the proposed defaults (three phases, accepted dependencies, standard PDF font, schema 2 migration, deployment settings, live connector limited to a disabled capability). [plan.md](plan.md) written. The executable automation is kept; nothing is replaced by a simulated success screen. No question needed the user.
- Things the user should know, raised in Claude's report: phase C makes the public service launch a headless browser on request (one run at a time, 90-second limit, no login) and raises its memory to 1 GiB.

## Implementation and validation

Documentation only. No application implementation, accounts, authenticated funder drafts, real submissions, emails, commits, pushes or deployments performed in this task. Document validation recorded in docs/status.md after writing. Application tests not run.

### Phase A: questionnaire, storage and prefill (2026-11-16, Claude implementing model)

Browser-only. G-001 Plan application now opens `#/planning/G-001/application`: six sections, per-field source chips and a source drawer, autosave (750 ms, Saving / Saved / Not saved), status strip, one draft per grant, planning card, Refresh suggestions, Use information from a document, the worked synthetic example, and a review screen (answers, finance totals and gaps, warnings, missing information as links). The package, PDF and run controls are not built; Review shows "Document preparation and the submission demo arrive in the next update." Tracking is unchanged. The organisation database moved from schema 1 to 2 by adding `applications`, `submissionSnapshots`, `submissionFiles`, `submissionAttempts` and `submissionReceipts`; existing stores are untouched.

- Local results: unit 81 of 81 (66 existing plus 15 new); Playwright 234 of 234 (phone-360 73, phone-390 73, desktop-1280 88). No existing test was edited.
- Evidence: `evidence/S3-001-A-*.png` at 1280, 390 and 360 px (source drawer, prefilled form, finance check, review with missing information, review of the worked example).
- Not done in this phase, by design: proposal PDF, package, synthetic accounts PDF, server API, test portal, browser runner, receipts, Tracking. The worked example leaves the accounts document unselected because its PDF is a Phase B file.
- Deployed 2026-11-16 to Cloud Run: revision charity-funding-00005-4zf, 100 percent of traffic, https://charity-funding-36580608208.europe-west1.run.app. Live checks: `/`, `/js/application/schema.js` and `/application.css` return 200; full Playwright suite against the live URL 234 of 234 pass. Commit 6ca9eb4.

## Handoff

Claude reads spec.md and research.md, reconciles the in-progress document-store implementation, writes ticket-local plan.md and implements the complete controlled demo through the shared workflow. Record demo and live status separately. Real portal discovery requires an authorised applicant session; live submission also requires an actual reviewed application and explicit send authority. These are external prerequisites, not blockers to building the demo.
