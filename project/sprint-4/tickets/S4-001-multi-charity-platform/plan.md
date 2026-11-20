# S4-001 implementation plan: multi-charity platform

Version: 1. Written 2026-11-20 by Claude. Status: awaiting user approval. Authority: [spec.md](spec.md). If they disagree, the spec wins and the implementer reports it.

Built and shipped in four phases. Each phase ends with tests, records, commit, push, deploy and live check (DEC-006). A phase starts only after the previous one has shipped.

## Google Cloud changes (need the user's approval: they change access or cost)

The implementer stops at each of these and reports. They run only after the user has approved this plan, which counts as approval for exactly these changes and nothing broader.

| Step | Change | Phase |
| --- | --- | --- |
| G1 | Enable APIs: `firestore.googleapis.com`, `aiplatform.googleapis.com`, `iap.googleapis.com` | 1 |
| G2 | Create the Firestore `(default)` database, Native mode, `europe-west1` | 1 |
| G3 | Create bucket `charity-funding-514818-data`, `europe-west1`, uniform access, public access prevention on | 1 |
| G4 | Create service account `charity-funding-run`; grant `roles/datastore.user` and `roles/aiplatform.user` on the project, `roles/storage.objectAdmin` on the bucket only; switch Cloud Run to it | 1 |
| G5 | OAuth consent screen (External, app name "Charity funding", in Testing or Published state) and a custom OAuth web client for IAP. If the console requires it, the user does this step and pastes the client ID; the secret goes into IAP settings, never the repo | 1 |
| G6 | Enable IAP on the Cloud Run service with that client; grant `roles/iap.httpsResourceAccessor` to `allAuthenticatedUsers`; remove `allUsers` from `roles/run.invoker`; grant the IAP service agent `roles/run.invoker` | 1 |
| G7 | Set `ADMIN_EMAILS`, `DATA_BUCKET`, `GEMINI_MODEL`, `GEMINI_LOCATION` on the service | 1 and 3 |

If G6 fails (for example "ServiceNotAllowed"), the implementer stops and reports. Claude then switches to spec D2 (in-app Google Sign-In) with the user's agreement.

Expected cost: Firestore and Cloud Storage within free tier or pennies; Gemini tokens and grounded searches billed per use against the credits; Cloud Run unchanged.

## Architecture

- `server/config.js`: reads environment (admins, bucket, model, location, dev identity), refuses the dev identity when `K_SERVICE` is set.
- `server/auth.js`: verifies the IAP JWT with `google-auth-library` (`OAuth2Client.verifySignedJwtWithCertsAsync`, IAP public keys, audience `/projects/36580608208/locations/europe-west1/services/charity-funding`). Returns `{ email, isAdmin }`. In dev, returns `DEV_USER_EMAIL`.
- `server/store/`: one data-access interface with two implementations:
  - `memory.js`: used by unit, integration and Playwright tests and local development;
  - `gcp.js`: Firestore (`@google-cloud/firestore`) and Cloud Storage (`@google-cloud/storage`).
  - Every method takes `cid` as its first argument, from the authorised request context. The contract tests in `tests/unit/store-contract.test.js` run against both (the Firestore run uses the emulator if available locally, otherwise it is skipped and reported).
- `server/routes/`: `me.js`, `charity.js` (profile, bids, documents, files, opportunities, decisions, discovery settings), `applications.js` (applications, snapshots, attempts, receipts), `discovery.js`, `admin.js`. A shared `withCharity(req)` guard does the membership check and returns 404 for non-members.
- `server/ai/gemini.js`: `@google/genai` SDK in Vertex mode (`vertexai: true`, project, location). Exposes `discover(profile, brief)` and `suggestTheme(html, name, url)`. Tests inject a fake.
- `server/ai/prompt.js`: pure prompt builders and the result validator (`validateOpportunities`), unit-tested.
- `server/fetch-site.js`: bounded website fetch for onboarding (HTTPS, DNS-resolved address must be public, 1 MB, 10 s, same-host redirects only).
- `server.js`: the auth middleware runs first on every request, including static files. The "not set up" page is served for authenticated non-members.
- Browser: the IndexedDB and localStorage repositories are replaced by `public/js/remote/` clients with **the same method names and return shapes** as `org/repository.js`, `application/repository.js` and `state.js` load/save, so the views change as little as possible. `public/js/session.js` loads `/api/me`, picks the charity, applies the theme and exposes the current `cid`.
- New dependencies: `google-auth-library`, `@google-cloud/firestore`, `@google-cloud/storage`, `@google/genai`, pinned exact versions.

## Phase 1: sign-in, tenancy, server storage, rename

1. Config, auth middleware, dev identity, "not set up" page, `/api/me`, sign-out link.
2. Store interface plus memory and GCP implementations; contract tests.
3. Charity-scoped routes for profile, bids, documents (upload and download streaming), opportunities, decisions and discovery settings. The application routes move the existing IndexedDB transactions server-side (revision check, snapshot freeze, attempt lock) as Firestore transactions.
4. Browser remote repositories; remove IndexedDB and localStorage use; one-time deletion of old browser data (REQ-032).
5. Charity switcher and last-charity memory.
6. Rename YOR Plc → Your Place across code, seed data, fixtures, prefill text, proposal filename, demo portal and tests. Move charity-specific hard-coded text (the default brief, prefill overview) into the charity's seed data so other charities do not inherit Your Place wording.
7. Seed script for Your Place, plus a minimal admin API to create a charity and set members (the admin page UI comes in Phase 4). Our Time is created here with name, website and the default theme so isolation can be tested with two charities; its look and profile come in Phase 4.
8. Cloud steps G1 to G7, deploy, seed Your Place and Our Time, add the user as admin.

Tests:
- Unit: auth (valid, expired, wrong audience, missing; dev identity refused on Cloud Run), membership guard, store contract.
- Integration: **isolation suite**. Two charities, three users (A only, B only, both) plus admin and a non-member. Every charity-scoped route is called as each user, with the expected 200 or 404, including file download and application routes. Concurrent decisions on different grants both survive; a stale application save returns 409.
- Playwright: the existing suites adapted to run against the memory store with a dev identity; new tests for the switcher, last-charity memory, the "not set up" page and old browser data being cleared.

Live check: an unauthenticated `curl` to both service URLs returns a redirect to `accounts.google.com`, not app content. Playwright cannot sign in through IAP, so signed-in checks on the live site are done by the user. The implementer lists exactly what to check (sign in, see Your Place, switch to Our Time, see separate data).

## Phase 2: draft-only boundary

1. Runner: replace the `submit` step with `save-draft`. The demo portal gains a "Save draft" control and a draft read-back page; its "Submit application" control stays. The runner's action registry has no submit action.
2. Live adapter: `submit()` throws `FINAL_SUBMISSION_DISABLED`; no flag or field overrides it.
3. Copy changes per REQ-037; Tracking shows "Draft saved (demo)". Review screen gains "Download application package" and "Open the funder's application page".
4. Tests: the runner never clicks the portal's submit control (the portal counts submissions and the test asserts zero); pressing Enter in a field does not submit; a direct POST to the portal's submit endpoint from the runner context is blocked by the runner's request filter; `submit()` throws for any input.

## Phase 3: AI discovery

1. `prompt.js` and the validator, with unit tests: both the profile and the brief appear in the prompt; malformed, oversize, `http:`, `javascript:` and bad-date items are dropped.
2. `gemini.js`: model and location from config; grounding tool on; one retry on unparseable JSON; 120 s timeout.
3. Discovery route: run lock per charity, daily counter in Firestore, D8 merge into opportunities and decisions, freshly-discovered marker.
4. Discover panel: copy explaining the brief is added to the organisation information, progress, errors, AI labels on cards.
5. Choose and verify `GEMINI_MODEL` with one live call from the implementer's machine (it uses the user's gcloud credentials, not the runtime account) and record the model name in the ticket.
6. Tests use a fake Gemini. One opt-in live test (`npm run test:live-ai`) is run once and recorded.

Live check: an unauthenticated request is still redirected; the implementer runs the live AI test; the user runs Discover on the site.

## Phase 4: admin, themes and onboarding

1. Theme schema, validator (hex, allowlisted fonts, contrast check computed in code) and the CSS custom-property mapping; the current S0-003 values become Your Place's theme, and a test checks that its rendered colours match the current site exactly.
2. Theme applied at load (custom properties, Google Fonts stylesheet for non-bundled fonts, wordmark, title, logo) and in the proposal PDF name.
3. `fetch-site.js` with tests (private addresses, oversize, slow, cross-host redirect all refused).
4. `suggestTheme`: Gemini returns theme tokens and a draft profile; the server validates them and nudges colours that fail contrast.
5. Admin page `#/admin`: charity list, create, suggest from website, live preview, edit theme, members, open charity. Audit records.
6. Onboard Our Time through the admin page using ourtimecharity.org.uk, mark its profile as drafted from the public website (D9), and save screenshots of both charities in `evidence/`.
7. Tests: non-admins get 404 on every admin route; theme validation; Playwright for the admin flow with fake Gemini and fake fetch; Your Place visual regression.

## Shipping (every phase)

- `npm test` (unit, integration, Playwright) passes locally.
- Results are recorded in `ticket.md` and [status.md](../../../../docs/status.md).
- Commit (attribution per the session reminder) and push to `master`.
- `gcloud run deploy charity-funding --source . --region europe-west1 --project charity-funding-514818` with the phase's env vars, first as a no-traffic tagged revision, then given traffic after the live checks.
- The implementer stops instead of working around: a rejected push, a deploy permission failure, any IAM change not listed in G1 to G7, or anything touching another project.

## Not in this ticket

Saving drafts to a real funder portal (S3-002 `portal_draft`); deleting charities; per-charity custom domains; email invitations; roles inside a charity (every member can do everything); billing per charity.
