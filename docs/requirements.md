# Requirements

Last updated: 2026-11-15.

This register is an index. The acceptance criteria live in the current specification, [S0-002 spec.md](../project/sprint-0/tickets/S0-002-discovery-suitability/spec.md) (revision 4), and are not duplicated here. The [original draft](../project/sprint-0/tickets/S0-001-initial-requirements/charity-funding-poc-spec.md) is the historical baseline.

Agreement: the user approved spec revision 4 on 2026-11-15 after answering review questions Q1 to Q8; the resolutions are tabled in the spec. Implementation waits for approval of the plan.

## Sprint 0 register

| ID | Behaviour | Change in S0-002 |
| --- | --- | --- |
| REQ-001 | Responsive application with three reachable areas | Clarified |
| REQ-002 | Fixed demo discovery feed | Revised: six grants, three suitable and three unsuitable |
| REQ-003 | Discovery triage actions | Revised: actions depend on effective suitability; Abandon in Planning moves a grant to Passed |
| REQ-004 | One record per stable grant ID | Retained |
| REQ-005 | Planning & submission | Revised: placeholder only. Planning note and demo submission superseded |
| REQ-006 | Tracking | Revised: placeholder only. Awaiting-decision records superseded |
| REQ-007 | Browser-local persistence | Agreed as browser-only (DEC-004); now includes overrides and filter preference |
| REQ-008 | Visual theme and accessibility | Revised: suitability shown with icon, text and reason |
| REQ-009 | Hosting and source | Revised: real Cloud Run deployment and GitHub push in scope |
| REQ-010 | Validation and handoff | Revised to the new flows |
| REQ-011 | Show all / Hide unsuitable filter | Added |
| REQ-012 | Manager override to suitable | Added |
| REQ-013 | Fixtures carry sources and reasons; charity named only as YOR Plc | Added |

## Requirement record format

For each product requirement, record:

- ID: REQ-001 onward; stable across revisions, never reused.
- Title and required behaviour.
- Agreement status: proposed / agreed / superseded, with source and date of user agreement when applicable.
- Testable acceptance criteria: observable conditions and expected outcomes.
- Assumptions and open questions, explicitly separate from agreed behaviour.
- Related decisions, research and implementation/test evidence by reference.

## Pending clarification

Deployment questions D1 to D6 in the S0-002 plan. The full Discovery field list is deferred to a later ticket.
