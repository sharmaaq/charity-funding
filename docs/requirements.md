# Requirements

## S3-002 draft-only clarification — 2026-11-16

Current proposed extension: [S3-002](../project/sprint-3/tickets/S3-002-draft-only-guardrails/spec.md), with complete delivered S3-001 baseline. User requires testing without submission. REQ-029 defines local versus portal drafts, scoped transfer authority, no final-submit capability, operation/network controls, Draft-status read-back and no automatic retry/fallback submission. REQ-027/028 extend live readiness/testing accordingly. Technical controls are proposed and not yet implemented. Current app's controlled demo remains separate and live connector disabled.

Last updated: 2026-11-15.

This register is an index. Acceptance criteria live in the complete proposed current specification, [S1-001 spec.md](../project/sprint-1/tickets/S1-001-discovery-markers/spec.md) (revision 6), carrying forward S0-003 visual requirements. S0-002 revision 4 remains the implemented baseline. The [original draft](../project/sprint-0/tickets/S0-001-initial-requirements/charity-funding-poc-spec.md) is historical.

Agreement: the user approved spec revision 4 on 2026-11-15 after answering review questions Q1 to Q8; S0-002 has since been implemented and deployed. The user now requests closer visual alignment with the Your Place website. [S0-003 spec.md](../project/sprint-0/tickets/S0-003-visual-theme/spec.md), revision 5, records that visual change. Sprint 1 now adds the user-requested date markers and simulated discovery in revision 6. Its concrete visual defaults await Claude review; the deployed baseline remains S0-002.

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
| REQ-014 | Reference-style visual evidence, font loading, colour tokens and responsive/contrast validation | Added in S0-003; REQ-008 revised by the same ticket |

## Requirement record format

For each product requirement, record:

- ID: REQ-001 onward; stable across revisions, never reused.
- Title and required behaviour.
- Agreement status: proposed / agreed / superseded, with source and date of user agreement when applicable.
- Testable acceptance criteria: observable conditions and expected outcomes.
- Assumptions and open questions, explicitly separate from agreed behaviour.
- Related decisions, research and implementation/test evidence by reference.

## Pending clarification

Exact reference font families/tokens could not be extracted during S0-003 specification work; screenshot-based defaults and verification instructions are recorded in that ticket. The full Discovery field list remains deferred and is not part of the visual change.

## Sprint 1 register

Source: user's 2026-11-15 Sprint 1 request. Agreed feature scope; detailed defaults remain proposed in the complete S1-001 spec.

| ID | Behaviour | Status |
| --- | --- | --- |
| REQ-015 | Compact Upcoming (opening within a week) and Due soon (closing within a month) icon/text markers beside names; no new filters | Requested; date boundaries/clock detailed as defaults |
| REQ-016 | Top-level Discover button simulates discovery by marking one existing grant New; future background agent remains out of scope | Requested; target/lifetime detailed as defaults |
| REQ-002 | Allow simulated discovery while keeping six fixed grant IDs and no real discovery integration | Revised by S1-001 |
| REQ-007 | Persist optional freshness metadata while retaining existing saved decisions | Extended by S1-001 |
| REQ-008 | Include compact accessible markers within the existing design | Extended by S1-001 |
| REQ-010 | Validate date boundaries, rediscovery, state preservation and responsive markers | Extended by S1-001 |

Review note: fixture data has no verified opening dates. S1-001 uses a labelled synthetic preview for Upcoming demonstration, without inventing published funder dates. Additional marker criteria await the user.

## Sprint 2 register

Current complete proposed specification: [S2-001 spec.md](../project/sprint-2/tickets/S2-001-organisation-document-store/spec.md), revision 7. Supersedes the current-spec pointer above, retaining the revision 6 baseline with explicit overrides. Source: user request 2026-11-15; feature scope requested, detailed defaults proposed for Claude review.

| ID | Behaviour | Status |
| --- | --- | --- |
| REQ-017 | YOR Plc organisation entry and editable overview, Past bids and Documents | Requested; UI/field defaults proposed |
| REQ-018 | Managed historical bids with outcome, actual files and feedback | Requested; CRUD/schema defaults proposed |
| REQ-019 | Lightweight batch-upload organisation document collection with optional metadata | Requested; limits/actions proposed |
| REQ-020 | Original files persisted locally with transactional integrity and honest failure handling | Proposed implementation within browser-only POC |
| REQ-021 | Source catalogue and original bytes available for future AI integration; labelled synthetic samples | Future-use requirement requested; contract/seeds proposed |

REQ-001/007/008/010/014 extended. Planning/submission and Tracking remain placeholders; historical bids do not populate Tracking. No AI calls or server storage. All acceptance cases are in the complete specification.

## S1-002: AI discovery brief extension

Current Discovery extension: [S1-002 complete spec](../project/sprint-1/tickets/S1-002-ai-discovery-brief/spec.md). User requested 2026-11-15; S1-001 is in progress and its reviewed details take precedence over copied historical defaults where this ticket does not change them. Separate Sprint 2 specifications are unaffected.

- REQ-016: expanded to an editable prefilled natural-language brief and Discover with AI simulated loading/results flow. Future manual/background runs use the same saved brief; no real agent yet.
- REQ-007: retain the brief locally and preserve existing state; default only when no brief has been saved.
- REQ-008/REQ-010: accessible responsive panel, submission validation, run snapshot, busy/completion/error behaviour and regression checks.
- Exact prompt/copy, autosave and short simulated delay are proposed defaults. Existing canned results do not change semantically with prompt edits. Source profile stays YOR Plc in the app.

## S3-001: Guided application and automated submission demonstration

Current complete proposed Sprint 2 spec: [S3-001 revision 8](../project/sprint-3/tickets/S3-001-automated-submission/spec.md). Source: user request 2026-11-15. Requested product scope; funder choice/controlled-target architecture and detailed defaults are proposed. This replaces earlier Planning/Tracking placeholder exclusions for G-001 only and preserves the S1-002 Discovery extension.

| ID | Behaviour | Status |
| --- | --- | --- |
| REQ-005/006 | G-001 preparation and demo receipts in Tracking; no fabricated real submitted/award status | Revised by requested scope |
| REQ-007/020/021 | Local draft/package/receipt storage, catalogue integration and expressly initiated temporary server processing | Proposed extension |
| REQ-022 | Central schema-driven questionnaire, prefill, missing items and full manager review | Requested; fields/defaults proposed |
| REQ-023 | Source attribution, conflicts, manual document evidence and synthetic/example separation | Proposed fulfilment of requested document reuse |
| REQ-024 | Immutable reviewed package, actual proposal PDF, attachment integrity and validation | Requested automation prerequisite; contract proposed |
| REQ-025 | Our bounded API and actual Playwright transfer to controlled portal | Requested demonstration; architecture proposed |
| REQ-026 | Duplicate protection, interruption handling, verified demo receipt and local Tracking | Proposed lifecycle requirements |
| REQ-027 | Live portal mapping/readiness, human intervention, authority and reconciliation | Live feasibility unverified; detailed contract specified |
| REQ-028 | UI/package/API/runner/failure/deployment evidence and preserved regression behaviour | Required validation; cases specified |

No verified public applicant submission API was found. The selected current route is Blackbaud browser portal automation, conditional on authenticated mapping for real operation. All REST routes in S3-001 are ours, not alleged funder endpoints. Source evidence is ticket-local research.md.

## S5-001: features matched with Research — 2026-11-25

Current specification: [S5-001 spec](../project/sprint-5/tickets/S5-001-research-parity/spec.md). Source: user request in chat 2026-11-25. Agreed.

| ID | Behaviour | Status |
| --- | --- | --- |
| REQ-038 | Word search over grant cards in Discovery and Planning | Agreed |
| REQ-039 | One shared, autosaved note per grant | Agreed |
| REQ-040 | Real AI discovery with fit scores, barriers and sources; replaces the demo run; extends REQ-034 | Agreed |
| REQ-041 | AI assessment of one grant, saved and shown again | Agreed |
| REQ-042 | Discussion threads about a grant or about funding in general | Agreed |
| REQ-043 | AI model choice; the charity's own AI keys, encrypted with Cloud KMS | Agreed; Google Cloud step G8 needs approval |
