# S4-001: Multi-charity platform

- Type: initial requirements (platform)
- Created: 2026-11-20
- Agreement: requirements agreed by the user in chat 2026-11-20; spec decisions D1 to D10, plan and Google Cloud changes G1 to G7 approved by the user 2026-11-20 (admin: the user's own gcloud account; demo stops at draft saved)
- Delivery: approved; Phase 1 built and tested locally; Google Cloud step G5 (OAuth client) waits for the user, so Phase 1 is not yet deployed
- Owner: Claude wrote the spec and the plan at the user's request (role override of DEC-005 for this ticket); implementation delegated per workflow
- Predecessor: [S3-001](../../../sprint-3/tickets/S3-001-automated-submission/ticket.md); extends the draft-only principle of [S3-002](../../../sprint-3/tickets/S3-002-draft-only-guardrails/ticket.md)
- Specification: [spec.md](spec.md); plan: [plan.md](plan.md)

## Context and source

The user asked to turn the single-charity demo into a platform: Google sign-in, users mapped to one or more charities, strictly separate server-side data, real Gemini discovery that combines organisation information with the discovery brief, admin onboarding with a per-charity look and no code changes, and draft-only operation. Answers to Claude's questions, 2026-11-20: rename YOR Plc to Your Place; second charity based on ourtimecharity.org.uk; the user adds a third; the user is the only admin, configured through a deploy; admins can switch charity; anyone may belong to several charities and the last one used is remembered in the browser; clear old data; Your Place keeps its grants and submission demo; everything is draft-only and submission is always manual.

## Requirements and changes

REQ-030 to REQ-037 in [spec.md](spec.md). Supersedes the browser-only storage of DEC-004/REQ-007/REQ-020 and the public, no-login access of earlier sprints.

## Review history

- 2026-11-20 Claude: requirements reviewed, questions answered by the user, spec revision 1 and plan version 1 written.

## Implementation and validation

### Phase 1 (implementing model, 2026-11-20)

Built: server config and IAP JWT auth (dev identity refused when K_SERVICE is set), store interface with memory and Firestore/Cloud Storage implementations, charity-scoped routes (profile, bids, documents and file streaming, opportunities and decisions, discovery settings, applications with revision check, snapshot freeze and attempt lock as store transactions), admin API for charities and members, seed script and seed data, browser remote repositories, charity switcher with last-charity memory, deletion of old browser data, the "not set up" page, and the YOR Plc to Your Place rename.

Tests (run locally on 2026-11-20 with `npm test`, which runs the three suites in order):

- Unit (`npm run test:unit`): 118 tests, 117 pass, 1 skipped (the Firestore contract run, which needs the emulator), 0 fail.
- Integration (`npm run test:integration`): 75 pass, 0 fail, including the isolation suite (two charities, A-only, B-only, both, admin and non-member against every charity-scoped route).
- Playwright (`npx playwright test`): 291 tests listed and 291 passed (phone-360 85, phone-390 85, desktop-1280 121), exit 0. The whole suite takes about 3 minutes.
- An earlier handover reported "202 passed" out of 286 listed with exit 0. The 84 difference could not be reproduced: every listed test now runs and passes, and the full run was repeated twice. Cause of the earlier gap is unknown.

Changes made while getting the suite to run:

- New dev-only endpoint `GET /api/dev/state/:cid/:collection` (read-only, exists only with the dev identity, never on Cloud Run) so tests can check what the server holds, replacing direct IndexedDB reads.
- Bug fixes found by the tests: the browser showed the bare code "source-changed" instead of its message (client now ignores a message equal to the code); ticking "I have checked this PDF" sent the proposal without its file bytes (the server now accepts a metadata-only update that keeps the stored file); storage notice text on the organisation page updated to say files are held on the server.

Tests removed or replaced (reason in each case):

- application-storage: "schema 1 to 2 upgrade" and "second tab holding schema 1 open blocks the upgrade" removed, because the browser IndexedDB schema no longer exists. "Storage failure (abort or over quota)" replaced by a test that makes the server refuse the save (network route) and checks Not saved, kept input, leave warning and Retry. "Revision conflict from another tab" kept, with the other tab simulated by a direct API save.
- package-storage: "schema stays at version 2" removed (IndexedDB schema gone). SHA-256 test rewritten to hash the server copies in Node and compare with the recorded and displayed hashes and the original document. "Quota failure while freezing" replaced by a refused freeze request with retry. Stale source, stale draft and capacity tests kept, using API calls instead of IndexedDB writes.
- submission-storage: "receipt save failure" now refuses the finish request once instead of using the removed test hook. The second-tab attempt-lock check now posts to the acquire route and expects 409 attempt-active.
- organisation-storage: removed "IndexedDB unavailable (throws)" and "(error-event)", "unknown schema" and "an unreadable record shows a message" (browser storage no longer used; the matching server read errors are not reachable from the UI). Replaced: aggregate cap (now fills the charity's real 100 MiB budget through the API instead of a lowered test override), forced-abort bid save (network refusal, plus a new test where the server refuses a bid that does not fit and nothing changes), quota upload failure, "seed runs once" (now: deleted content stays deleted, nothing reseeds), "second browser context starts fresh" (now: a second context for the same user sees the same saved data), network test (every request same-origin; non-GET requests only to this charity's document, bid, decision and settings routes; bytes then found on the server). Kept unchanged in behaviour: byte integrity, limits, staged bid files, delete bid, catalogue.
- discovery: the old-browser-data deletion test already existed and passes; a copy that also covers the localStorage key and IndexedDB database is in the new platform spec.

New tests (tests/e2e/platform.spec.js): charity switcher with separate data and branding for both@; last-charity memory across reload and a new tab, with fallback for an unknown or non-member charity; "not set up" message for nobody@ with no data requests; non-member 404 for the other charity; old browser data deleted.

Not tested: the Firestore and Cloud Storage implementations against a real database (no emulator available; the contract runs against the memory store only); IAP sign-in and JWT verification on the live service (done by the user); anything after the G5 stop below. Phase 1 live behaviour is unverified until deployed.

Google Cloud: G1 (APIs enabled), G2 (Firestore default database, europe-west1, Native), G3 (bucket charity-funding-514818-data, uniform access, public access prevention) and G4 (service account charity-funding-run with datastore.user and aiplatform.user on the project and storage.objectAdmin on the bucket only) done. G5 needs the console (the IAP OAuth Admin API is shut down). G6, G7 and the deploy follow G5.

## Handoff

Plan approved 2026-11-20. Phase 1 handed to the implementing model.

### Phase 1 candidate deployment (implementing model, 2026-11-21)

- Deployed from a clean worktree of 71d4f36 as no-traffic revision charity-funding-00009-sid, tag `phase1` (Cloud Run tags need at least 3 characters, so `p1` was refused; the first attempt failed at validation and created nothing). Tag URL: https://phase1---charity-funding-4zw3jha7va-ew.a.run.app. Service account charity-funding-run, 1 GiB, env vars ADMIN_EMAILS (the user's gcloud account) and DATA_BUCKET=charity-funding-514818-data. GEMINI_MODEL and GEMINI_LOCATION left unset (not read until Phase 3).
- Seeded the real Firestore and bucket with `npm run seed -- --charity all` (Your Place created and seeded; Our Time created). The admin account was added as the only member of both through the store (the admin API needs the IAP identity). No application default credentials were needed; an access token from gcloud was used.
- Unauthenticated check of the tag URL (no IAP header): `/` 401 "Sign in required"; `/api/me`, `/api/charities/your-place/profile`, `/api/admin/charities` 401 `{"code":"UNAUTHENTICATED",...}`; `/js/app.js` 401. No app content or charity data served.
- Traffic: 100 percent still on charity-funding-00007-tof (main URL returns 200, still the old YOR Plc page). Waiting on G5 (OAuth client) and G6 (IAP, invoker changes) before Phase 1 takes traffic. Signed-in behaviour and Firestore/Storage runtime access are not yet verified on the revision.

### Phase 2: draft-only boundary (implementing model, 2026-11-21)

Built per REQ-037: the runner's submit step is now save-draft (portal Save draft control and draft read-back page; the portal's final Submit control stays and is never used); the runner has no submit action and its request filter aborts any request to the portal's /submit; the live adapter's submit() always throws FINAL_SUBMISSION_DISABLED; copy changed; Tracking shows "Draft saved (demo)"; the review screen has "Download application package" (a zip with answers.json, README and the two documents) and "Open the funder's application page" (Garfield Weston how-to-apply page, fixed while G-001 is the only application). Stored attempt state name `demo_completed` and the receipt collection are unchanged; receipts carry `kind: 'draft'`.

Tests (local, `npm test`): unit 120 (119 pass, 1 skipped Firestore emulator run, 0 fail); integration 80 pass; Playwright 294 tests: first full run 291 passed and 3 failed (one stale copy assertion, "originals stay in this browser", at three widths); after fixing the test text the file was re-run alone, 24 of 24 passed. The full Playwright suite was not re-run after that one-line test fix.
New tests: portal submit counter is 0 in every runner case; Enter in the final-submit form is blocked by the request filter; a direct POST to /submit from the runner context is blocked and never reaches the portal; submit() throws for any input even with override environment variables set; action registry has no submit; zip unit tests; e2e for the download and funder link.
