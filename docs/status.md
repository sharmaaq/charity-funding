# Current status and handoff

Last updated: 2026-11-15 (Claude: S0-003 reviewed and planned; ChatGPT's S1-001 notes preserved).

## Progress

- [S1-002](../project/sprint-1/tickets/S1-002-ai-discovery-brief/ticket.md) specified: editable prefilled discovery brief, local persistence and simulated AI run. S1-001 is in progress per the user (2026-11-15); its final reviewed behaviour may differ from the draft below. Claude should reconcile that work before applying S1-002. No application changes or deployment by this specification task. Separate Sprint 2 work is unaffected.

- [S1-001](../project/sprint-1/tickets/S1-001-discovery-markers/ticket.md) drafted with complete revision 6: compact Upcoming/Due soon markers and a simulated Discover button. User-requested scope recorded; calendar boundaries, rediscovery target and badge lifetime are proposed defaults. No application implementation or deployment. Current complete proposed spec is S1-001; S0-003 remains a separate visual ticket.

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
