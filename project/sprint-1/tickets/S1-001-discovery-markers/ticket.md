# S1-001: Discovery timing markers and Discover demo

- Type: requirements iteration
- Created: 2026-11-15
- Agreement: feature scope requested by user; detailed defaults proposed for review
- Delivery: reviewed by Claude 2026-11-15; being built together with S1-002 under [the Sprint 1 plan](../S1-002-ai-discovery-brief/plan.md)
- Owner: ChatGPT specifications; Claude review and implementation planning under shared workflow
- Predecessor: [S0-003](../../../sprint-0/tickets/S0-003-visual-theme/ticket.md), proposed visual restyle; S0-002 is the deployed baseline
- Complete specification: [spec.md](spec.md), revision 6

## Context and source

User requested Sprint 1 to finish the Discovery demo: small Upcoming and Due soon icon markers beside grant names, no additional filters, and a top-level Discover button which reuses an existing grant to demonstrate newly discovered results. A future background agent is explanatory context only. More marker criteria may be supplied later.

## Requirements and changes

Add REQ-015 and REQ-016; revise REQ-002, REQ-007, REQ-008 and REQ-010 as specified. Carry forward all baseline requirements and the S0-003 proposed visual treatment. The complete spec separates requested scope from assumptions about date boundaries, the discovery target and badge lifetime.

## Review history

Drafted by ChatGPT 2026-11-15.

Claude review, 2026-11-15: REQ-015 (timing markers) stands as drafted. REQ-016's Discover button is superseded by S1-002's AI discovery panel before being built; its result behaviour (which grant, the New badge and its lifetime, the no-result message) is kept. The visual section of this ticket's spec still holds the estimated fonts and colours; the implemented S0-003 values apply. The open point about demonstrating Upcoming is settled as a labelled timing preview (decision R1 in the S1-002 spec). The current spec for both tickets is [S1-002 spec.md](../S1-002-ai-discovery-brief/spec.md).

### Implementation results

### Implementation results (Claude, 2026-11-15)

Built in one pass with S1-002 under [plan.md](../S1-002-ai-discovery-brief/plan.md); full detail is in the [S1-002 ticket](../S1-002-ai-discovery-brief/ticket.md). REQ-015 delivered: `public/js/timing.js` (pure, `now` is a parameter, Europe/London dates, month clamp, `nextChangeAt`), the three sourced `closesAt` values in fixtures (no real grant has an opening date), Upcoming and Due soon badges beside grant names in New, Watchlist and Passed, and the labelled `?preview=timing` overlay. This ticket's own Discover button was superseded by the S1-002 panel before being built.

Validation actually run locally: unit tests 54 of 54 pass (28 existing plus 26 new, 18 of them timing and fixtures); Playwright 126 of 126 pass (63 existing unchanged plus 63 new, 21 per viewport project). Boundary cases from the plan (16/22 and 15/23 November; 15 and 16 December; 31 January clamp in 2027 and 2028; 23:30 UTC in summer; both sides of each clock change) all pass. Badge contrast measured: white on purple, navy on light teal and navy on lime are each above 4.5:1 (exact values printed by the timing unit test). Screenshots at 1280, 390 and 360 px (markers-real, markers-preview) were viewed; badges wrap under long names without clipping or overflow.

## Implementation and validation

Local evidence inspected 2026-11-15: startup documents, requirements/decisions, sprint index, S0-003 complete spec, public/js/fixtures.js, public/js/state.js and rendering entry points in public/js/app.js. Fixtures currently have human-readable timing only; state already enforces one entry per stable ID. No live grant facts were researched or updated.

Documentation only. Application code unchanged; application tests not run. Existing uncommitted Sprint 0 changes preserved.

## Handoff

Claude: review the date semantics, existing-state protection, freshness lifetime and the explicitly synthetic Upcoming preview. No verified opening dates exist in the current fixture, so do not misrepresent an invented date as funder guidance. Then plan and implement under the current shared workflow. Record checks and discrepancies here and in docs/status.md.
