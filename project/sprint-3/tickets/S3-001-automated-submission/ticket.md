# S3-001: Guided application and automated submission demonstration

- Type: iteration
- Created: 2026-11-15
- Agreement: user-requested scope; funder selection and engineering defaults proposed for Claude review
- Delivery: phases A, B and C built 2026-11-16; the controlled demo runs end to end. The real connector is a disabled capability. Live portal integration not verified and not in scope to verify
- Owner: ChatGPT specifies; Claude reviews, plans and delegates implementation
- Predecessor: [S2-001](../../../sprint-2/tickets/S2-001-organisation-document-store/ticket.md); preserve the independently reviewed S1-002 Discovery extension
- Specification: [spec.md](spec.md); evidence: [research.md](research.md)

## Context and source

The user requests one of the three suitable funders, a single prefilled manager questionnaire, document-store integration, and an exceptionally detailed implementation specification for both the UI and the background submission automation. This is a specification task, not an instruction to send a real grant application now.

Selected: G-001, Garfield Weston Foundation Regular Grants, one-year operating/core support. The demonstration must execute real browser automation against a controlled portal, not substitute a timer for automation. A live funder connector has separate readiness criteria: no supported applicant submission API or authenticated current form was verified. Do not describe the controlled demonstration as delivery to Garfield Weston.

## Requirements and changes

REQ-005/006 become functional for this one application path; REQ-007/010/020/021 are extended. New REQ-022 through REQ-028 cover the questionnaire, source attribution, package, runner/API, receipt lifecycle, live integration boundary and verification. Full details and tests are in spec.md.

Key proposal: retain browser-local durable data; introduce temporary request-scoped Node/Playwright processing for the automation demo. This explicitly changes the earlier static-server-only/no-file-transmission restriction for an expressly initiated run, but does not add accounts, cloud document storage or cross-device state.

## Review history

- 2026-11-15 ChatGPT: inspected repository instructions, current server/state code, Sprint 0 evidence, S1-002 and S2-001. Researched current official funder and Blackbaud guidance. Found the 2025 portal migration and rejected legacy selectors/limits as current evidence.
- 2026-11-15 Claude: reviewed. Scope and delivery boundary stand; decisions R1 to R10 at the top of the spec settle the proposed defaults (three phases, accepted dependencies, standard PDF font, schema 2 migration, deployment settings, live connector limited to a disabled capability). [plan.md](plan.md) written. The executable automation is kept; nothing is replaced by a simulated success screen. No question needed the user.
- Things the user should know, raised in Claude's report: phase C makes the public service launch a headless browser on request (one run at a time, 90-second limit, no login) and raises its memory to 1 GiB.

## Implementation and validation

Documentation only. No application implementation, accounts, authenticated funder drafts, real submissions, emails, commits, pushes or deployments performed in this task. Document validation recorded in docs/status.md after writing. Application tests not run.

### Phase A: questionnaire, storage and prefill (2026-11-16, Claude implementing model)

Browser-only. G-001 Plan application now opens `#/planning/G-001/application`: six sections, per-field source chips and a source drawer, autosave (750 ms, Saving / Saved / Not saved), status strip, one draft per grant, planning card, Refresh suggestions, Use information from a document, the worked synthetic example, and a review screen (answers, finance totals and gaps, warnings, missing information as links). The package, PDF and run controls are not built; Review shows "Document preparation and the submission demo arrive in the next update." Tracking is unchanged. The organisation database moved from schema 1 to 2 by adding `applications`, `submissionSnapshots`, `submissionFiles`, `submissionAttempts` and `submissionReceipts`; existing stores are untouched.

- Local results: unit 81 of 81 (66 existing plus 15 new); Playwright 234 of 234 (phone-360 73, phone-390 73, desktop-1280 88). No existing test was edited.
- Evidence: `evidence/S3-001-A-*.png` at 1280, 390 and 360 px (source drawer, prefilled form, finance check, review with missing information, review of the worked example).
- Not done in this phase, by design: proposal PDF, package, synthetic accounts PDF, server API, test portal, browser runner, receipts, Tracking. The worked example leaves the accounts document unselected because its PDF is a Phase B file.
- Deployed 2026-11-16 to Cloud Run: revision charity-funding-00005-4zf, 100 percent of traffic, https://charity-funding-36580608208.europe-west1.run.app. Live checks: `/`, `/js/application/schema.js` and `/application.css` return 200; full Playwright suite against the live URL 234 of 234 pass. Commit 6ca9eb4.

### Phase B: proposal PDF and submission package (2026-11-16, Claude)

Browser-only. Built by the implementing model until it stopped on an API overload error; Claude took over at the user's instruction, fixed one test and shipped. The Review screen now prepares the package once every applicable answer is present and confirmed: a generated A4 proposal PDF (standard Helvetica, 11-point body, page numbers and demo footer, at most ten pages), the selected accounts file copied exactly as stored, per-file SHA-256 and a package hash over canonical JSON, Download proposal, View source notes, the manager's own replacement proposal PDF (page count read; "manager checked" only after confirmation), and the two confirmation checkboxes. Ticking both freezes a `SubmissionSnapshot` and copies of the attachments in one transaction, with a recheck of the draft revision and source versions and the 100 MiB budget. The Run submission demo button is present but disabled with the "automation unavailable" state, because the capabilities request has no server behind it until Phase C. `pdf-lib` (MIT) is vendored at `public/vendor/` with its licence; nothing is loaded from a CDN. The worked example now includes a generated, watermarked synthetic accounts PDF.

- New modules: `canonical.js` and `transfer.js` (pure, for the server to import in Phase C), `proposal.js`, `package.js`, `package-panel.js`, `accounts-example.js`.
- Local results: unit 91 of 91 (10 new); Playwright 266 of 266 across the three viewports (package storage tests desktop only).
- Existing test edited: `tests/e2e/application.spec.js`, three assertions that described the Phase A placeholder and the then-unselected accounts document (the placeholder text, "Missing information (1)", "No accounts document selected") now assert the Phase B state.
- Test fix during takeover: the "editing an answer" package test chose the section before the workspace had rendered at phone widths; it now waits for the section title. No application code changed for it.
- Evidence: `evidence/S3-001-B-*.png` (package panel, confirmed package, overflow blocked, review with package at 1280, 390 and 360 px; proposal pages 1 to 3; synthetic accounts example).
- Not done in this phase, by design: server API, test portal, browser runner, receipts, Tracking. No request leaves the browser; nothing contacts a funder.
- Deployed 2026-11-16 to Cloud Run: revision charity-funding-00006-tlm, 100 percent of traffic, https://charity-funding-36580608208.europe-west1.run.app. Live checks: `/`, `/js/application/package.js` and `/vendor/pdf-lib.esm.min.js` return 200. Full Playwright suite against the live URL: 263 of 266 on the first run; the three failures were one test at three widths whose "no external requests" check treated only localhost as the app's own origin. The check now compares against the app's origin; that test then passed 3 of 3 live and locally. The full live suite was not re-run after that test-only change. Commit 90dc886.

### Phase C: API, test portal, browser runner, receipts and Tracking (2026-11-16, Claude)

Built by Claude directly at the user's instruction. **Run submission demo** now sends the frozen package (manifest plus the stored copies of both PDFs) to `POST /api/submission-demo-runs` on this app's own server. The server validates everything before a browser starts: same origin, the exact manifest keys, mode `demo` only, the adapter, the answer rules (imported from `schema.js`), file types and signatures, and the package hash, which it recomputes from the bytes that arrived. Then a headless Chromium drives a **controlled test portal** that this project runs on `127.0.0.1` for that one request. It goes through session cookie and CSRF, three form pages with read-back of every value, a multipart upload, and the portal's own review page, which shows the SHA-256 of the received bytes and is compared field by field. It clicks submit once and verifies the receipt (`DEMO-<attemptId>`, state, target and payload hash). Progress streams back as NDJSON; the browser saves the attempt and the receipt in one transaction and lists them in Tracking. Nothing contacts Garfield Weston or Blackbaud: the run browser's routing aborts every request that is not the portal's loopback origin.

Delivery, in the four parts the spec asks to keep apart:

| Part | Status |
| --- | --- |
| UI and package | Done (phases A and B, plus the run, progress, completion, failure, retry and Tracking views in this phase) |
| Controlled automation | Verified locally: real Chromium fills, uploads, reviews, submits and verifies a receipt; negative paths never report completion. Cloud Run verification is recorded under Deployment below |
| Source-store integration | Verified against the real S2-001 repository (phases A and B) |
| Real Garfield Weston connector | **Unavailable.** Delivered as a disabled capability (`server/adapters/gwf-live-readiness.js`) that reports eleven unmet gates as `liveBlockers`, plus an empty [portal-map.md](portal-map.md) template. No live mode, no switch, no funder traffic |

- New server code: `server/api.js`, `server/manifest.js`, `server/multipart.js` (busboy, rejects while streaming), `server/demo-portal.js`, `server/demo-runner.js`, `server/adapters/gwf-demo.js`, `server/adapters/gwf-demo-map.js` (versioned mapping kept apart from the runner), `server/adapters/gwf-live-readiness.js`. `server.js` delegates `/api/*` and is otherwise unchanged.
- New browser code: `run-protocol.js` (manifest builder and NDJSON reader, shared with the Node tests), `submission-client.js` (attempt lock, Web Lock for live-run detection, stream handling, atomic save, retry-save), `tracking.js`. Changed: `package-panel.js`, `repository.js` (attempts and receipts), `index.js`, `app.js` (Tracking view; Abandon disabled during a run), `application.css`.
- Dependencies: `playwright` 1.65.1 (equal to `@playwright/test`) and `busboy` 1.6.0 as runtime dependencies. The `Dockerfile` installs the Chromium headless shell and its system libraries at build time (`npx playwright install --with-deps --only-shell chromium`).
- Found and fixed during testing: when the portal dropped the connection after the final submit, Chromium silently re-sent the POST on a fresh connection (its retry for a reset keep-alive socket), so the portal saw two submissions. The portal now closes every connection (`Connection: close`), so the runner's single click results in a single request. The test for this case asserts exactly one submission.
- Behaviour choices: after a failed, stopped or unconfirmed run, only **Retry demo run** is offered, and it reuses the same attempt ID (the same DEMO reference). A package that already has a receipt cannot be run again. **Create revised draft** makes a new revision; a new run needs a changed package. Another tab sees a live run through the Web Lock and cannot start a second one, and the transactional attempt lock refuses it anyway.
- Deviations from the spec text, reported: `compliance.demographics` stays a text answer (as built in phase A), not the `{collectionStatus, description}` object in section 8. The package hash binds `mode` and the answers but not `syntheticApplicant` or each attachment's `synthetic` flag (the phase B canonical form). The server requires `syntheticApplicant: true` and the demo portal enforces it. The NDJSON step IDs are short names (`check`, `prepare`, `open`, `fill`, `upload`, `review`, `submit`, `verify`) mapped to the eight milestone labels. The real connector's portal-map validator is not built, because there is no map to validate.
- Local results: unit 97 of 97 (6 new); integration 49 of 49 (new: API 32 including one real-stack run, portal 5, runner 12, all with real Chromium where a browser is involved); Playwright 283 of 283 (new `submission.spec.js` at all three widths and `submission-storage.spec.js` at desktop only).
- Existing tests edited: `tests/e2e/discovery.spec.js` ("Tracking has the placeholder notice…") and `tests/e2e/application.spec.js` (end of the "Plan application on G-001…" test) asserted the Tracking placeholder this ticket replaces; they now assert the demo notice and the empty state. `tests/e2e/package.spec.js`: the worked-example test asserted the phase B "Automation unavailable" text and a disabled run button after confirmation; it now asserts the run explanation and an enabled button.
- Evidence: `evidence/S3-001-C-*.png` at 1280, 390 and 360 px (completed run with receipt, not-confirmed run with mixed progress, Tracking).
- Commit 654ea66.
- Deployment, 2026-11-16: image built in Cloud Build with Chromium installed at build time. Candidate revision charity-funding-00007-tof deployed with no traffic (1 GiB, 1 CPU, 180-second timeout, at most one instance). On the candidate address, capabilities reported `demoAvailable: true` and `liveAvailable: false` with eleven blockers, and the full Playwright suite passed 283 of 283, including real demo runs in Cloud Run. Traffic was then moved to it (100 percent). On https://charity-funding-36580608208.europe-west1.run.app the submission, submission-storage and theme suites passed 35 of 35. Measured from the service logs over ten real runs on the candidate: 3.1 to 4.3 seconds per run; peak Node process memory 186 to 191 MB. That figure leaves out Chromium's own processes, so total container memory was not measured, but no run failed or ran out of memory in 1 GiB.

## Handoff

Claude reads spec.md and research.md, reconciles the in-progress document-store implementation, writes ticket-local plan.md and implements the complete controlled demo through the shared workflow. Record demo and live status separately. Real portal discovery requires an authorised applicant session; live submission also requires an actual reviewed application and explicit send authority. These are external prerequisites, not blockers to building the demo.
