# Current status and handoff

## Latest handoff: S3-001 — 2026-11-15 (ChatGPT)

- Specified [S3-001](../project/sprint-3/tickets/S3-001-automated-submission/ticket.md): Garfield Weston Regular Grants core-support questionnaire, attributed prefill and source-store integration, immutable PDF/file package, bounded internal API, real Playwright-controlled demonstration, receipts/Tracking and detailed live adapter readiness/mapping contract.
- Current complete proposed Sprint 2 spec is revision 8. Includes S2-001 and S1-002 baselines with explicit precedence; earlier status entries below remain evidence for their own tickets.
- Live limitation: no verified applicant-facing submission API or authenticated Garfield Weston form; the 2025 portal supersedes old guidance. Controlled demo must work end to end; public live mode stays disabled. No real accounts, funder drafts or submissions created.
- Claude next: reconcile in-progress S2-001 and Discovery work, review proposed defaults, write ticket-local plan.md, implement/test/ship controlled demo under shared workflow. Report UI/package, document integration, demo automation and live readiness separately. Do not replace browser execution with a timer or invent live selectors.
- Documentation task only; application code unchanged, application tests not run. All local Markdown links resolved across ten new/updated documents; REQ-022 through REQ-028 and both expanded baselines checked; git diff --check passed. Other work appeared concurrently in S1-002/S2-001 ticket records and a document-store mockup; preserved untouched. No commit/push/deployment performed by ChatGPT in this task.

- S3-001 Phase A implemented 2026-11-16 (Claude implementing model): G-001 application workspace, prefill with provenance, worked synthetic example, review screen, schema 2 database upgrade. Local tests pass (unit 81, Playwright 234). Phases B and C (PDF and package; API, test portal, runner, receipts) not started. Deployed and verified live: revision charity-funding-00005-4zf, live Playwright suite 234 of 234 pass.
- S3-001 Phase B implemented 2026-11-16 (implementing model, finished by Claude): generated proposal PDF, canonical package hash, frozen submission snapshot with attachment copies, replacement proposal, confirmations, disabled run control. pdf-lib vendored. Local tests pass (unit 91, Playwright 266). Deployed and verified live: revision charity-funding-00006-tlm; live Playwright 263 of 266 on the first run, the remaining test passing after a test-only origin fix. Phase C (API, test portal, runner, receipts, Tracking) not started; the real connector remains unavailable.
- S3-001 Phase C implemented 2026-11-16 (Claude): same-origin demo-run API with streaming validation, loopback test portal, real headless Chromium runner, NDJSON progress, attempt lock, DEMO receipts in Tracking, disabled live connector with readiness report and empty portal-map template. Local tests pass (unit 97, integration 49, Playwright 283). Cloud Run: 1 GiB, candidate deployed without traffic first (see the ticket for the result). The real Garfield Weston connector remains unavailable; nothing contacts the funder.

Last updated: 2026-11-15 (Claude: S0-003 reviewed and planned; ChatGPT's S1-001 notes preserved).

## Progress

- S1-002 design preview created at repository-root discovery-brief-preview.html at the user's request before implementation handoff. User visual review pending. Preview interaction checks passed in installed headless Chrome; no served application changes. See S1-002 ticket for scope and evidence.

- [S1-002](../project/sprint-1/tickets/S1-002-ai-discovery-brief/ticket.md) implemented with S1-001 on 2026-11-15 (Claude): editable prefilled brief, local persistence, simulated Discover run. Local tests pass (unit 54, Playwright 126); evidence screenshots in the ticket. Deployed and verified live: revision charity-funding-00003-vx7, live Playwright suite 126 of 126 pass.

- [S1-001](../project/sprint-1/tickets/S1-001-discovery-markers/ticket.md) implemented with S1-002 on 2026-11-15 (Claude): Upcoming and Due soon markers with a labelled ?preview=timing overlay; its own Discover button was superseded by the S1-002 panel. Local tests pass. Deployed and verified live: revision charity-funding-00003-vx7, live Playwright suite 126 of 126 pass.

- [S0-003](../project/sprint-0/tickets/S0-003-visual-theme/ticket.md): visual restyle implemented (Lilita One and Urbanist bundled, purple and lime theme, title band with roofline motif). Committed and pushed. Deployed to Cloud Run as revision charity-funding-00002-82t (100 percent of traffic).

- S0-001 holds the original POC draft as the historical baseline.
- [S0-002](../project/sprint-0/tickets/S0-002-discovery-suitability/ticket.md): implemented by Sonnet, tested locally by the user, pushed to GitHub (e958f8d) and deployed to Cloud Run: https://charity-funding-36580608208.europe-west1.run.app
- Working rules are in [workflow.md](workflow.md): specs stay with their ticket (DEC-003); a ticket runs from review through plan, build, test, commit, push and deploy without separate approvals (DEC-006).
- Git: the deployment notes in the ticket, the sprint index and this file are uncommitted.

## Verification and evidence

- S1-001 documentation validation: local Markdown links in all seven new/updated documents resolve; complete spec contains REQ-001 through REQ-016; git diff --check passed. No application files changed; application tests not run.

- S0-003 implementation: `npm test` run by the implementer passed locally, 28 of 28 unit and 63 of 63 Playwright tests (Chromium at 360, 390 and 1280 px). Contrast, font loading and evidence screenshots are in the ticket. Live checks: `/` 200, font served as font/woff2, styles.css has #442C86, full Playwright suite against the live URL 63 of 63.

- Reported by the implementer, not re-run by Claude: `npm test` gave 22 of 22 unit tests and 45 of 45 Playwright tests passing (Chromium at 360, 390 and 1280 px), before the local default port moved to 8090.
- Checked by Claude on the live URL 2026-11-15: page, scripts and stylesheet return 200; unknown paths return 404.
- Known discrepancy: `/healthz` is intercepted by Cloud Run and returns Google's 404; see the ticket.
- Not tested: the Playwright suite against the deployed URL, non-Chromium browsers, a real phone, measured contrast, screen readers.

## Blockers and pending questions

- S1-001 review: confirm proposed defaults; existing fixture has no verified opening date, so Upcoming demonstration uses labelled synthetic preview data. Further marker criteria may follow.

## Cloud project notes

- Project `charity-funding-514818`, region `europe-west1`, service `charity-funding`. gcloud's default project on this machine is a different one; always pass `--project`.
- The default compute service account holds `roles/run.builder` (granted 2026-11-15 with the user's approval) so source deploys can build.
- Local default port is 8090 because another project uses 8080 on this machine.

## Next action

- After the current S1-001 work, Claude reviews S1-002 and implements the brief-driven mock flow under the shared workflow. Preserve predecessor corrections and the verified S0-003 styling. Older S1-001 draft-status statements below are historical.

0. Claude reviews S1-001 and plans Sprint 1, coordinating with S0-003. Preserve saved manager decisions and six stable grant records. See ticket for assumptions and verification cases.

1. S1-001's draft carried forward the estimated fonts and colours; it needs the verified S0-003 values when reviewed.
2. The full Discovery field list remains deferred to a later ticket. Do not include it in this visual change.

S0-002 remains the implemented baseline and its spec is unchanged. S1-001 revision 6 is the current complete proposed revision, carrying forward S0-003. Specs remain with tickets; no sprint-root spec was recreated. The deployed application is at https://charity-funding-36580608208.europe-west1.run.app; `charity-funding.cloud.run` is not a real address.

## S2-001 handoff — 2026-11-15 (ChatGPT)

- Drafted [Sprint 2 Ticket 1](../project/sprint-2/tickets/S2-001-organisation-document-store/ticket.md) and its complete revision 7 specification. Adds organisation information, managed historical bids, lightweight document uploads and future source access.
- User-requested scope is separated from proposed fields, IndexedDB storage, limits and synthetic samples. No blocking clarification identified. No AI integration, backend storage or full planning/submission workflow in this ticket.
- Claude next: review latest tree and defaults, write ticket-local plan.md, then follow shared implementation/shipping workflow. Coordinate with S0-003/S1-001; do not infer they have shipped from this newer spec.
- Documentation-only work; application files unchanged and application tests not run. Existing unrelated changes preserved. Revision 7 is now the current complete proposed spec; delivery evidence above remains historical/current as independently recorded.
- Verification: local Markdown links resolve across all eight new/updated documents; revision 7 contains REQ-001 through REQ-021. Scoped tracked-document diff check passed. Repository-wide diff check reports an unrelated trailing blank line in docs/workflow.md; left untouched. Other application/test files changed concurrently during this task; no such files were edited by ChatGPT.

- S2-001 visual follow-up: interactive mockups saved in its ticket folder for user review before Claude implementation. Includes overview, past bids/detail, document list/upload and editing layouts. JavaScript syntax checked; browser rendering could not be verified (Chromium missing; Edge launch failed). No app code changed or deployment performed.
- [S2-001](../project/sprint-2/tickets/S2-001-organisation-document-store/ticket.md) implemented 2026-11-15 (Claude implementing model): organisation overview, past bids and document store in browser IndexedDB. Local tests pass (unit 66, Playwright 183); evidence screenshots in the ticket. Deployed and verified live: revision charity-funding-00004-qhx, live Playwright suite 183 of 183 pass.
