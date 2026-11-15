# S1-002: Editable AI discovery brief

- Created: 2026-11-15
- Type: Discovery requirements iteration
- Agreement: editable prefilled natural-language brief and AI-style simulated discovery requested by user; exact copy and interaction defaults proposed
- Delivery: reviewed and planned by Claude 2026-11-15 ([plan.md](plan.md)); being built together with S1-001 by the implementing model
- Predecessor: [S1-001](../S1-001-discovery-markers/ticket.md), in progress per user report; final reviewed details may differ from its draft
- Complete specification: [spec.md](spec.md), S1-002 draft 1

## Context and source

User says Claude is reviewing, fixing and implementing the previous ticket, and explicitly asks for a new Discovery ticket. Funding managers should write criteria such as sector and organisation size in a prefilled textarea; Discover should appear to run an AI discovery using it. The future background agent should use the same prompt. No live AI or scheduler was requested.

## Requirements and changes

Expand REQ-016 (discovery brief and simulated run), REQ-007 (persist brief), REQ-008 (panel/accessibility) and REQ-010 (validation). Retain reviewed REQ-015 date markers and all grant decisions. No new global requirement IDs allocated, avoiding collision with parallel Sprint 2 work.

The spec includes the full baseline and verified S0-003 visual values, but its carried-forward S1-001 details are a snapshot, not an instruction to undo Claude's subsequent corrections. Reconcile predecessor changes before implementation. Do not edit predecessor tickets as part of this handoff.

## Evidence and assumptions

Local files inspected 2026-11-15: shared startup docs, S1-001 spec, S0-003 revision 5.1, S0-002 research, public/js/fixtures.js and state.js. The prefilled paragraph uses the existing demo profile (London homelessness housing/support, income about GBP 7.1m) and keeps the YOR Plc name. No new external research or eligibility verification. Added search preferences are proposed guidance.

Default decisions: autosave locally; submit captures the latest brief; brief edits do not alter canned results; about one second of visible simulated processing; retain predecessor result behaviour. Background use is explanatory future scope. No implementation in this task.

## Review and implementation evidence

Claude review, 2026-11-15: S1-001 had not been implemented (the "in progress" note was not reflected in the code), so both tickets are delivered by one build from this spec. Decisions R1 to R5 are tabled at the top of the spec; no requirement changed and no question needed the user. The preview file named below is not in the repository.

### Implementation and validation

Implemented by Claude on 2026-11-15 together with S1-001 (REQ-015 and REQ-016). Deployment results follow the validation notes.

What changed: new modules `public/js/timing.js`, `preview.js`, `discovery.js`; `state.js` gains optional `freshId` and `brief` (storage key and version 1 unchanged, older saved data loads intact), `discoveryCandidate`, `applyDiscovery`, `setBrief`, and `applyAction` clears `freshId` on a real action on that grant; the AI discovery panel is static markup in `index.html` updated in place by `app.js` (the textarea is never recreated), so focus and caret survive list re-renders; markers, preview notice and midnight timer in `app.js`; styles in `styles.css`; README notes; Sprint 1 evidence scenes in `tests/evidence/capture.mjs`.

Behaviour notes: the brief autosaves 400 ms after typing and is also flushed on Discover and when the page is hidden; an emptied brief stays empty after reload; empty submit shows the linked message and changes nothing; double clicks give one run; the busy state is memory only; a replaceable runner (`window.__DEMO_RUN_DISCOVERY__`) and clock (`window.__DEMO_NOW__`) exist for tests. Plan and spec agreed; no conflict found.

Validation run locally: unit 54 of 54 pass; Playwright 126 of 126 pass (63 existing, unchanged, plus 63 new across phone-360, phone-390 and desktop-1280). No existing test was edited. The new tests cover defaults, persistence including line breaks and reload, caret retention, validation, busy state, single run, no-candidate, failure, preference and override survival, no requests leaving the origin, no run on load, keyboard use, overflow and badge bounds, plus the timing and state unit cases listed in the plan.

Evidence: [evidence folder](evidence/) holds brief-idle, brief-edited-busy, discovery-complete, markers-real and markers-preview at 1280, 390 and 360 px (clock fixed at 15 November 2026). Viewed: the panel is compact (two columns at 1280, stacked on phones), badges wrap under long names and sit inside their row at 360 px, and the busy state shows the spinner with the button disabled. Weak points: the desktop textarea shows about six lines of a long default brief and scrolls for the rest; at 360 px the existing Plan application button label wraps to three lines (existing S0-003 behaviour, not changed here).

Shipping: Deployed to Cloud Run (project charity-funding-514818, europe-west1), revision charity-funding-00003-vx7 serving 100 percent of traffic, from commit 066e899. Live checks run against https://charity-funding-36580608208.europe-west1.run.app: / , /js/timing.js, /js/preview.js and /js/discovery.js each returned 200; the full Playwright suite with BASE_URL set to the live URL passed 126 of 126 (phone-360, phone-390 and desktop-1280, 42 each).

Documentation verification: local Markdown links across the seven new/updated documents resolve; git diff --check passed. Verified that the complete spec contains one REQ-016 section and carries Urbanist from the reviewed S0-003 spec. Application tests not run.

## Interactive design preview (2026-11-15)

User requested a mock before asking Claude to implement S1-002. Preview source: discovery-brief-preview.html at repository root; not served application code. Shows editable brief, busy and completed discovery states, sample rows and suitability filtering. Existing row actions are omitted for focus; this does not remove them from the specification. Preview edits are session-only. User design review pending; no approval inferred.

Validation: JavaScript syntax passed; headless installed Chrome via Playwright passed discovery-result highlighting, suitability filtering, 390px overflow and empty-brief validation. Bundled Playwright browser was unavailable, so installed Chrome was used. No application implementation or deployment.
