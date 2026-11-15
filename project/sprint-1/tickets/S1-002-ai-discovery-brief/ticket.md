# S1-002: Editable AI discovery brief

- Created: 2026-11-15
- Type: Discovery requirements iteration
- Agreement: editable prefilled natural-language brief and AI-style simulated discovery requested by user; exact copy and interaction defaults proposed
- Delivery: specified; Claude review/implementation pending
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

Claude review pending. Application tests not run for this documentation-only change. Record the final predecessor revision used, any spec corrections, implementation, test results and deployment evidence here under docs/workflow.md.

Documentation verification: local Markdown links across the seven new/updated documents resolve; git diff --check passed. Verified that the complete spec contains one REQ-016 section and carries Urbanist from the reviewed S0-003 spec. Application tests not run.
