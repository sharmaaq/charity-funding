# S1-001: Discovery timing markers and Discover demo

- Type: requirements iteration
- Created: 2026-11-15
- Agreement: feature scope requested by user; detailed defaults proposed for review
- Delivery: spec draft; not implemented
- Owner: ChatGPT specifications; Claude review and implementation planning under shared workflow
- Predecessor: [S0-003](../../../sprint-0/tickets/S0-003-visual-theme/ticket.md), proposed visual restyle; S0-002 is the deployed baseline
- Complete specification: [spec.md](spec.md), revision 6

## Context and source

User requested Sprint 1 to finish the Discovery demo: small Upcoming and Due soon icon markers beside grant names, no additional filters, and a top-level Discover button which reuses an existing grant to demonstrate newly discovered results. A future background agent is explanatory context only. More marker criteria may be supplied later.

## Requirements and changes

Add REQ-015 and REQ-016; revise REQ-002, REQ-007, REQ-008 and REQ-010 as specified. Carry forward all baseline requirements and the S0-003 proposed visual treatment. The complete spec separates requested scope from assumptions about date boundaries, the discovery target and badge lifetime.

## Review history

Drafted by ChatGPT 2026-11-15. Claude review and implementation planning pending. The supplied request does not independently approve the detailed defaults.

## Implementation and validation

Local evidence inspected 2026-11-15: startup documents, requirements/decisions, sprint index, S0-003 complete spec, public/js/fixtures.js, public/js/state.js and rendering entry points in public/js/app.js. Fixtures currently have human-readable timing only; state already enforces one entry per stable ID. No live grant facts were researched or updated.

Documentation only. Application code unchanged; application tests not run. Existing uncommitted Sprint 0 changes preserved.

## Handoff

Claude: review the date semantics, existing-state protection, freshness lifetime and the explicitly synthetic Upcoming preview. No verified opening dates exist in the current fixture, so do not misrepresent an invented date as funder guidance. Then plan and implement under the current shared workflow. Record checks and discrepancies here and in docs/status.md.
