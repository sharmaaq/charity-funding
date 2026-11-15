# S3-001 implementation plan: guided application and automated submission demo

Version: 1 | Written: 2026-11-15 by Claude | Status: ready for the implementing model once S2-001 has shipped. Built and shipped in three phases (DEC-006 applies to each).

Authority: [spec.md](spec.md) sections 1 to 15, plus the "Review decisions" section at its top, with [research.md](research.md) as evidence. The appendices are history. The real baseline is the application as deployed after S2-001. If this plan and the spec disagree, the spec wins and the implementer reports it.

This plan does not restate the spec's field tables, copy, API shapes or runner steps. The implementer works from the spec for those and from this plan for structure, order, decisions and verification.

## What is and is not being built

Built: the G-001 application workspace, attributed prefill, a generated proposal PDF, an immutable submission package, and a real headless-browser run that fills, uploads to, submits and reads a receipt from a test portal that this project owns and runs on loopback for the duration of one request.

Not built, and never to be implied: any contact with Garfield Weston, Blackbaud or any real funder system. The live connector is delivered as a disabled capability with a readiness report only (spec section 12). No test, script or deploy step may open a real funder or Blackbaud URL.

## Phases

Each phase is a separate hand-off to the implementing model and ends with tests, recording, commit, push, deploy and live verification. A later phase starts only after the earlier one has shipped.

### Phase A: questionnaire, storage and prefill (browser only)

Spec sections 3 (entry, resume, the six sections, save behaviour, status strip, abandon), 4, 5, 7 (storage and state), 10 (the rows that do not involve the runner).

- `public/js/application/schema.js`: the field table from section 4 as data (ID, type, limits, required rule, destination), plus pure validation and finance arithmetic in integer pence. No DOM.
- `public/js/application/repository.js`: extends the existing organisation database from schema 1 to schema 2 by adding the stores `applications`, `submissionSnapshots`, `submissionFiles`, `submissionAttempts`, `submissionReceipts` in an upgrade that touches no existing store. Optimistic `draftRevision` check on every save.
- `public/js/application/prefill.js`: reads the S2-001 repository's `catalogue()` and profile through a thin adapter; origins, source references, precedence, stale-source flags, Refresh suggestions, and "Use information from a document" (manager pastes an excerpt and locator).
- `public/js/application/example.js`: the worked synthetic example from section 5.
- Views: application workspace at `#/planning/G-001/application` with section navigation, source drawer, save indicator, status strip; planning list card for G-001 with stage, last save, missing count and Open application. Other planned grants keep their card, Abandon, and "Application preparation not yet available for this funder".
- Review screen in this phase: the full answer set, finance totals, missing-information links and warnings. The package, PDF and Run controls are not present yet; in their place: "Document preparation and the submission demo arrive in the next update."
- Tracking is unchanged in this phase.

### Phase B: proposal PDF and submission package (browser only)

Spec sections 3 (Review), 6, and the package rows of 7 and 13.

- Vendor `pdf-lib` (MIT) as a pinned single file under `public/vendor/` with its licence. No CDN at run time.
- `public/js/application/proposal.js`: deterministic A4 PDF from confirmed answers, 11-point body, explicit wrapping and pagination, page numbers and demo footer, returns bytes and page count; more than ten pages blocks with a message naming the longest sections.
- `public/js/application/package.js`: canonical JSON, SHA-256, `SubmissionSnapshot` frozen in one transaction with copies of the outgoing attachments, source-version recheck at commit, capacity counted against the 100 MiB budget.
- Synthetic accounts PDF for the worked example, generated with the same library and watermarked as in the spec.
- Manager-supplied replacement proposal PDF: page count read with `pdf-lib`; marked "manager checked" only after the manager confirms.
- Review screen completed: attachments, package hash, Download proposal, View source notes, the two confirmation checkboxes, and the Run submission demo button. Until Phase C ships, the button is disabled with the spec's "automation unavailable" state, driven by a failed capabilities request.

### Phase C: API, test portal, browser runner, receipts and deployment

Spec sections 3 (progress and completion), 7 (attempts and receipts), 8, 9, 10, 11, 12 (readiness only), 13.

- `server/` directory; `server.js` stays the entry point and static server, and delegates `/api/*` to `server/api.js`. Static path checks, headers, `PORT` and `0.0.0.0` are unchanged.
- `server/manifest.js`: strict validation of the manifest (exact keys, types, limits, hashes), shared rules imported from `public/js/application/schema.js` so the two validators cannot drift.
- `server/multipart.js`: bounded streaming intake using the `busboy` package; rejects over-size, extra files and duplicate fields while streaming.
- `server/demo-portal.js`: the loopback test portal from section 9 (per-run token, session cookie and CSRF, pages, independent validation, hashes received bytes, issues one receipt).
- `server/demo-runner.js` and `server/adapters/gwf-demo.js`: Playwright Chromium, request blocking to the loopback origin only, the mapping manifest, read-back checks, upload, review comparison, single submit, receipt verification, abort and deadline handling, cleanup in `finally`.
- `server/adapters/gwf-live-readiness.js`: reports the unmet gates; any call to prepare or submit returns `LIVE_NOT_CONFIGURED` before doing anything. Add `portal-map.md` in the ticket folder as an empty template listing what must be recorded.
- `public/js/application/submission-client.js`: starts the run, parses NDJSON across arbitrary chunk boundaries, attempt lock, interrupted and unknown states, atomic receipt save, retry-save and receipt download.
- Views: progress milestones, completion, Tracking list of demo receipts with attempt history, "Create revised draft".

## Review decisions the implementer needs

Tabled at the top of the spec (R1 to R10). The ones that shape code:

- Runtime dependencies are now allowed for this ticket: `playwright` (exact version equal to the installed `@playwright/test`) and `busboy`. `pdf-lib` is vendored for the browser. Nothing else without reporting it.
- The proposal uses the PDF standard Helvetica font, not an embedded font. Text is checked before generation: any character the font cannot encode blocks the build with a message naming the field and character. The pound sign and ordinary punctuation are supported.
- Same-origin enforcement compares the request's `Origin` host with its `Host` header (the service has two public addresses), plus `localhost` and `127.0.0.1` for development. No wildcard CORS.
- Cross-tab refresh by BroadcastChannel is not built; the transactional revision check and attempt lock are.
- Chromium runs with `--no-sandbox` inside the container, and only ever loads the loopback portal with all other requests blocked.

## Tests

Map of spec section 13 to test files. Every row there must be covered or reported as not covered with the reason.

| Phase | File | Covers |
| --- | --- | --- |
| A | `tests/unit/application-schema.test.js` | Field rules, amount modes, finance arithmetic, word and code-point limits, unknown is null |
| A | `tests/e2e/application.spec.js` (three viewports) | Entry and resume, one draft per grant, other grants unchanged, prefill and source chips, edits win over suggestions, worked example, incomplete draft, missing-information links, keyboard and layout |
| A | `tests/e2e/application-storage.spec.js` (desktop) | Schema 1 to 2 upgrade keeps profile, bids, documents and grant state; stale and deleted sources; revision conflict keeps edits; quota and aborted transaction |
| B | `tests/unit/package.test.js` | Canonical JSON, hash stability, hash changes on any answer or attachment change |
| B | `tests/e2e/package.spec.js` (desktop) | Real PDF parses, A4, at most ten pages, overflow blocks, pound sign renders, unsupported character blocks; attachment hashes survive copy and reload; edit clears review; TXT accounts refused |
| C | `tests/integration/portal.test.js` (`node --test`) | Portal validates independently, CSRF, one receipt per attempt, hash conflict |
| C | `tests/integration/runner.test.js` (`node --test`, real Chromium) | Fill, upload real bytes, review, submit, receipt; missing or duplicate locator, new required field, upload rejection, receipt mismatch, crash, timeout and abort never report completed; cleanup of browser, listener and temp files; parallel attempts isolated; no request leaves loopback |
| C | `tests/integration/api.test.js` | Capabilities; malformed, unknown keys, over-size while streaming, wrong origin, `mode=live`, hash mismatch rejected before any browser starts; 429 when busy; NDJSON framing and single terminal event |
| C | `tests/e2e/submission.spec.js` (desktop, plus layout checks at all three) | Full walk-through with the worked example to a DEMO receipt in Tracking; double click and second tab give one attempt; interrupted stream gives "not confirmed"; receipt save failure offers download and retry without re-running; revised draft keeps the old receipt |

`npm test` runs unit, integration and browser suites. Existing tests keep their meaning; the Planning and Tracking placeholder assertions change only where this ticket replaces the placeholder, and each such edit is listed.

## Deployment (Phase C)

Phases A and B deploy with the existing command and flags.

Phase C changes the image and the service settings:

- `Dockerfile`: install production dependencies and the Chromium headless shell with its system libraries at build time (`npx playwright install --with-deps --only-shell chromium`, run before dropping to the non-root user, with the browser path readable by that user). Verify from the Playwright version actually installed how the browser path and the install flags work; do not assume.
- No Docker is installed locally, so the image can only be proved in Cloud Build. Deploy the new revision without traffic first, test it, then move traffic:
  1. `gcloud run deploy charity-funding --source . --region europe-west1 --project charity-funding-514818 --allow-unauthenticated --max-instances 1 --memory 1Gi --cpu 1 --timeout 180 --no-traffic --tag candidate --quiet`
  2. Against the tagged candidate address printed by that command: capabilities reports `demoAvailable: true`; the full walk-through with the synthetic example reaches a DEMO receipt; the existing suites pass with `BASE_URL` set to it.
  3. Only then: `gcloud run services update-traffic charity-funding --to-latest --region europe-west1 --project charity-funding-514818`, and repeat the walk-through on the main address.
  4. If the candidate fails, leave traffic where it is and report. The live site keeps serving the previous revision.
- Record peak memory and run duration from the candidate walk-through. If 1 GiB is not enough, report rather than raising it further.

## Evidence, recording and shipping

Evidence per the spec's section 13 list, saved under this ticket's `evidence/` folder, synthetic data only. Each phase records its results in this ticket's `ticket.md` under a heading for that phase, the S3-001 line of `docs/status.md` and the delivery column of `project/sprint-2/README.md`, keeping the four-way distinction the spec requires: UI and package, controlled automation, source-store integration, real connector (unavailable). Leave other documentation alone.

Commit, push and deploy rules are the same as earlier tickets, including the two attribution lines, always passing `--project`, and stopping on a rejected push, a permission failure, any IAM change or anything touching another Google Cloud project.

## Out of scope

Any real funder contact; accounts or authentication; AI extraction or drafting; email; a durable server-side job queue; other funders' templates; project, capital or multi-year paths; anything in Sprint 3.
