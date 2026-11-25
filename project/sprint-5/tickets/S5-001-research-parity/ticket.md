# S5-001: Features matched with Research

- Type: iteration
- Created: 2026-11-25
- Agreement: agreed by the user in chat 2026-11-25 (word search, notes, AI assessment and chat, real discovery; "ticket, then build")
- Delivery: planned; Phase A handed to the implementing model
- Owner: Claude wrote the spec and plan (role override of DEC-005, as for S4-001); implementation delegated per workflow
- Predecessor: [S4-001](../../../sprint-4/tickets/S4-001-multi-charity-platform/ticket.md). Its Phase 3 (AI discovery) is delivered by this ticket's Phase B instead; its Phase 4 (admin and themes) is unaffected.
- Specification: [spec.md](spec.md); plan: [plan.md](plan.md)

## Context and source

The user asked to match features between Charity Funding and Research, which share a workflow in the Aifin suite. Research received Charity Funding's review views and Preparing and Tracking split on 2026-11-25 (in `local-govt-bids/apps/research`). This ticket brings Research's search, notes, AI assessment and discussion, and real discovery to Charity Funding. The workspace rule in `C:\aks-code\aifin\CLAUDE.md` now says every new feature in one app is checked for the other. Decisions DEC-009 (free service, charities' own AI credits) and DEC-010 (staging first) apply.

## Requirements and changes

REQ-038 to REQ-043 in [spec.md](spec.md). REQ-040 replaces the demo Discover run and extends REQ-034.

## Review history

- 2026-11-25, Claude: spec and plan written; open points settled with the user in chat.

## Implementation and validation

Built by the implementing model, phase by phase (plan.md). Test counts are as reported by the implementer.

### Phase A: word search and notes (REQ-038, REQ-039) - 2026-11-25

- Built: `public/js/search.js` (pure matching), `public/js/notes.js` (limit and validation, shared with the server), `notes` collection, `workspace.setNote` and `PUT /api/charities/{cid}/notes/{grantId}`, notes in the workspace load, the search box (Discovery tabs and Planning), "N of M" tab counts, the no-match message with Clear search, the Notes control in each card's details (autosave after about 1 s and on blur, "Saved" / "Not saved, will retry" with a retry every 5 s) and the "Has notes" marker.
- Tests: unit 132 pass (1 skipped, as before), integration 87 pass, Playwright 321 pass (15 new, three viewports). New: `tests/unit/search-notes.test.js`, `tests/integration/notes.test.js`, `tests/e2e/search-notes.spec.js`; the isolation suite gained the notes route (non-members get 404 and change nothing).
- Search matches name, funder, summary, reason and note; an empty search shows the lists as before.

## Handoff

Phase D needs Google Cloud step G8 (KMS key and one role grant), which needs the user's approval before it runs.
