# Current status and handoff

Last updated: 2026-11-15 (Claude).

## Progress

- S0-001 holds the original POC draft as the historical baseline.
- [S0-002](../project/sprint-0/tickets/S0-002-discovery-suitability/ticket.md): spec revision 4 and plan version 2 are approved. Sonnet has implemented the app locally. The user is testing it.
- Working rules are in [workflow.md](workflow.md): specs stay with their ticket (DEC-003); tickets follow specify, review, approve, plan, implement and test, user testing, ship (DEC-005).
- Git: docs are committed locally (cff3728). The application, and later edits to workflow.md, the plan, the ticket and this file, are uncommitted. Nothing is pushed.

## Verification and evidence

- Reported by the implementer, not re-run by Claude: `npm test` gave 22 of 22 unit tests and 45 of 45 Playwright tests passing (Chromium at 360, 390 and 1280 px).
- Checked by Claude 2026-11-15: Google Cloud project `charity-funding-514818` is active with billing enabled; Cloud Run, Cloud Build and Artifact Registry APIs are enabled. gcloud's default project is a different one, so the project must be passed explicitly.
- Not tested by anyone: the Dockerfile and deploy command, non-Chromium browsers, a real phone, measured contrast, screen readers. Funder pages were not re-fetched after ChatGPT's research.

## Blockers and pending questions

- None. Waiting for the user's local testing.

## Next action

1. User tests locally: `npm install`, `npm start`, http://localhost:8090.
2. On the user's request, the implementing model commits, pushes and deploys per the [plan](../project/sprint-0/tickets/S0-002-discovery-suitability/plan.md) (region `europe-west1`, service `charity-funding`, public access).
3. User does the phone check; record the URL and results.

ChatGPT: S0-002's spec is approved and implemented. Do not edit it or recreate a sprint-root spec. New requirement changes go into S0-003.
