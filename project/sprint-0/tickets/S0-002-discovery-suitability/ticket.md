# S0-002: Usable Discovery, suitability and placeholders

- Date: 2026-11-15
- Type: requirements iteration
- Agreement: spec revision 4 approved by the user on 2026-11-15, after answering Claude's review questions (resolutions table in the spec).
- Delivery: planned; plan awaiting user approval. Not implemented.
- Owner: ChatGPT drafted the spec; Claude reviews, plans and delegates implementation (DEC-005).
- Predecessor: [S0-001](../S0-001-initial-requirements/ticket.md).
- Specification: [spec.md](spec.md), revision 4. Plan: [plan.md](plan.md), version 1. Evidence: [research.md](research.md).

## Changes and scope

- Confirm browser-only persistence; no shared phone/desktop state. Accounts, organisations and shared persistence deferred.
- Extend fixtures to six, including unsuitable grants with prominent icon, reason and source.
- Add persistent Show all / Hide unsuitable and manager override to Suitable, retaining the original assessment; allow Pass and usual suitable workflow after override.
- Build usable Discovery now with provisional fields; full field list comes in a subsequent iteration.
- Replace proposed submission simulation and functional tracking with labelled placeholders. Keep Plan application as a move into the Planning placeholder.

Affected: REQ-001 through REQ-010 revised or clarified; REQ-011 through REQ-013 added. See the spec for criteria, defaults, sources and future scope. DEC-004 records browser-state and phase scope.

## Evidence and assumptions

[Research](research.md) records official sources and suitability inferences. Two unsuitable examples recovered from prior research; one new geography example. UI defaults (six fixtures, initial Show all, table/cards, filter behaviour and minimal placeholder handoff) implement the user's delegated UI request. 'Delivery phase' interpreted as Discovery; no fourth phase added.

## Review history

- ChatGPT drafted spec revision 2 at the sprint root and stopped at a usage limit before updating the sprint index, requirements register, decisions and status.
- 2026-11-15, Claude: took over at the user's request. Moved spec.md and research.md into this ticket folder (DEC-003). Set the spec to "under review", replaced its implement-now handoff with delivery notes, and added eight open questions (Q1 to Q8) with recommendations. No requirement was changed. Completed the shared-document updates ChatGPT had not reached. Weekdays for the fixture dates (17 and 27 November 2026) were checked against the calendar; funder pages were not re-fetched.
- 2026-11-15, user: answered Q1, Q2, Q5 and Q6 in the spec and accepted Claude's recommendations for Q3, Q4, Q7 and Q8.
- 2026-11-15, Claude: folded the answers into spec revision 4 (Abandon in Planning, no override undo, hidden count, Cloud Run deployment in scope, demo charity renamed YOR Plc, discard stale storage). Wrote plan.md version 1. Checked locally: origin is the GitHub repository with one commit on master; gcloud is signed in but defaults to a different project, so the plan passes the project explicitly; Docker is not installed, so the plan uses a source deploy.

## Implementation and validation

Not started. No application code or tests exist. When implementation happens, record the chosen stack, changed files, run and preview commands, actual automated and browser checks, deployment status, discrepancies and untested items here.

## Next action

1. User approves [plan.md](plan.md) and answers its deployment questions D1 to D6.
2. Claude hands the spec and plan to an implementing model (typically Sonnet), then verifies the result and records it here and in docs/status.md.
3. Claude and the user commit, push and deploy to Cloud Run, then the user does the phone check.
