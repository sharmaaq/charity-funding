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

## Handoff

Claude reads spec.md and research.md, reconciles the in-progress document-store implementation, writes ticket-local plan.md and implements the complete controlled demo through the shared workflow. Record demo and live status separately. Real portal discovery requires an authorised applicant session; live submission also requires an actual reviewed application and explicit send authority. These are external prerequisites, not blockers to building the demo.
