# S2-001: Organisation information and document store

- Type: requirements iteration
- Created: 2026-11-15
- Agreement: user-requested feature scope; detailed defaults proposed for Claude review
- Delivery: reviewed and planned by Claude 2026-11-15 ([plan.md](plan.md)); queued behind Sprint 1
- Owner: ChatGPT specifications; Claude review, planning and delegated implementation
- Predecessor: [S1-001](../../../sprint-1/tickets/S1-001-discovery-markers/ticket.md)
- Complete specification: [spec.md](spec.md), revision 7

## Context and source

The user requested Sprint 2 Ticket 1: foundation for planning and submission, gathering historical bids (actual files, success/failure and feedback), organisational/regulatory/financial files and general charity information behind the top-left organisation name. Past bids must feel managed; general documents should remain a lightweight file collection. Future AI should be able to use all these sources.

## Requirements and changes

Adds REQ-017 to REQ-021. Extends navigation, browser-local persistence and validation (REQ-001/007/008/010/014). Carries forward the complete revision 6 baseline. Planning/submission and Tracking remain placeholders. Proposed defaults include native IndexedDB, editable profile, structured bid CRUD, batch uploads, file types/limits, synthetic samples and an internal future-source catalogue. No model integration or server storage is proposed.

## Review history

Drafted by ChatGPT on 2026-11-15. Claude reviewed it on 2026-11-15: the spec stands as drafted; decisions R1 to R7 at the top of the spec settle the points left to review, and [plan.md](plan.md) is written. Interpreted “Your PLC” as the agreed YOR Plc name. Repository currently uses a header, not a left sidebar: make that existing top-left brand the entry point, adapting to the latest shell at implementation time.

## Implementation and validation

Inspected startup instructions, requirements/decisions, sprint conventions, revision 6, package.json, public/index.html, public/js/app.js, state.js, fixtures.js and server.js. Existing stack is vanilla JS and Node with node:test/Playwright; no file store or AI service currently exists. No external research needed for this product specification.

Documentation only; no application implementation or application tests. Local links, requirement coverage and whitespace checked during drafting. Existing uncommitted work preserved.

### Implementation results (Claude implementing model, 2026-11-15)

Built to [plan.md](plan.md): organisation area under `public/js/org/` (validation.js, db.js, repository.js, seed.js, routes.js, dom.js, index.js, views/), the YOR Plc wordmark is a link (`#/organisation`), app.js only routes and delegates. Storage is native IndexedDB (`charity-funding.organisation`, schema 1; stores meta, bids, documents, files). No server change, no dependency, nothing leaves the browser.

- Local `npm test`: unit 66 of 66 (54 existing + 12 new in tests/unit/org-validation.test.js); Playwright 183 of 183 (126 existing + 57 new: 14 organisation tests at each of phone-360, phone-390 and desktop-1280, and 15 storage tests in the desktop project only). Run by the implementer.
- Abort-injection check: the "forced to abort" test was also run against a deliberately split save (bid record in its own transaction) and failed as intended, then the code was restored.
- Evidence screenshots (overview-bids, bid-detail, bid-form, documents, upload-result at 1280, 390 and 360 px) are in [evidence/](evidence/). Layout bugs found by looking at them and fixed: a stray "null" above the document search, the Download link wrapping letter by letter at 390 px, a truncated search placeholder at 360 px.
- Choices: bid and document edits are in-page states (no extra routes beyond the plan); a "stay" answer to the leave-without-saving dialog restores the previous hash with replaceState (so it can leave a duplicate history entry); upload panel and edit forms count as dirty; amounts are stored as numbers of pounds; identifiers capped at 50 characters and website at 300 (spec silent); `window.__ORG_TEST_HOOKS__` ({ limits, abortNext, code }) is the repository test hook.
- Not tested: blocked-upgrade path (only schema 1 exists, so it cannot occur), real quota exhaustion (injected quota error only), non-Chromium browsers, real phone, screen readers.

## Handoff

Claude: review and resolve defaults, then write plan.md and continue under docs/workflow.md. Coordinate with the latest S0-003/S1-001 work; use verified visual tokens. Validate original-byte persistence and transaction failures, not just upload UI. Record implementation/test/deployment evidence here and in docs/status.md. No blocking clarification identified during drafting.

## Visual review mockups — 2026-11-15

User requested mockups before asking Claude to implement. [mockups.html](mockups.html) preserves the interactive design preview: organisation overview, bid list/detail, Documents, upload, bid form and profile/document editing. Uses current Lilita One/Urbanist styling and purple/lime palette. All data is illustrative; actions are local preview interactions, not persistence or uploads. Detailed forms are representative visual layouts, not replacements for the full specification.

JavaScript syntax checked. Browser-render verification attempted but unavailable: bundled Chromium missing; installed Edge exited during sandbox launch. No screenshot or successful responsive browser-test claim. User visual review pending; this preview is not design approval or an implementation.
