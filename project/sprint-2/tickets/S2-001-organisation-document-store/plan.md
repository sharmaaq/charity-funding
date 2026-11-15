# S2-001 implementation plan: organisation information and document store

Version: 1 | Written: 2026-11-15 by Claude | Status: ready for the implementing model once Sprint 1 has shipped. Runs through to commit, push and deploy (DEC-006).

Authority: [spec.md](spec.md) lines "Authority and scope" through "Claude handoff" (REQ-017 to REQ-021 and the acceptance table), plus the "Review decisions" section at its top. The "carried-forward baseline" below those sections is history: the real baseline is the application as deployed after Sprint 1 (Discovery with timing markers and the AI discovery panel). If this plan and the spec disagree, the spec wins and the implementer reports it.

Layout reference: [mockups.html](mockups.html) shows the intended screens (overview, bid list and detail, documents, upload, forms). Follow its layout and density where it does not conflict with the spec. Its data and interactions are illustrative only.

Stack unchanged: static HTML/CSS/ES modules, native IndexedDB, zero runtime dependencies, `node --test` and Playwright. No server change: files never leave the browser.

## Architecture

New modules under `public/js/org/`. Keep `app.js` as the router and shell; do not grow it with organisation logic.

| Module | Responsibility | DOM? |
| --- | --- | --- |
| `validation.js` | Pure rules: profile, bid and document fields; amounts; dates against a supplied London "today"; file type, size and MIME checks; limits as exported constants | No |
| `db.js` | Opens `charity-funding.organisation` (schema 1), creates stores, maps IndexedDB failures to typed errors (`unavailable`, `blocked`, `quota`, `aborted`, `unknown-schema`) | No |
| `repository.js` | The only code that touches the stores. Profile read/update; bid list/get/save/delete; document list/get/upload/update/delete; `getBlob(id)`; `catalogue()`; `seedOnce()`; `usage()` | No |
| `seed.js` | Synthetic profile text, three bids, their TXT attachments and four organisation TXT documents, as constants | No |
| `views/*.js` | Overview, profile form, bid list, bid detail, bid form, documents list, upload results, document edit, confirm dialog | Yes |

Stores (all keyed by a generated opaque ID from `crypto.randomUUID()`):

| Store | Contents | Indexes |
| --- | --- | --- |
| `meta` | `seed` completion marker; `profile` record | none |
| `bids` | Bid metadata | none (lists are small; sort in memory) |
| `documents` | Document metadata: `ownerType` (`organisation` or `bid`), `ownerId`, role or category, filename, MIME, size, title, optional fields, timestamps, `synthetic` | `owner` on `[ownerType, ownerId]` |
| `files` | `{ id, blob }`, same ID as the document | none |

Transaction rules (each is one `readwrite` transaction across every store it touches, and the UI reports success only on the transaction's `complete` event):

- Save bid: bid record, staged new documents and their blobs, edits to existing attachment metadata, and removals. Capacity for the staged files is checked inside the same transaction.
- Delete bid: the bid, all documents owned by it, and their blobs.
- Upload organisation documents: one transaction per file, so one failure does not undo the others. Capacity is checked per file at commit.
- Delete document: metadata and blob together.
- Seed: profile, bids, documents, blobs and the seed marker together. Seeding runs only when the marker is absent, never because a list is empty.

Any work that must be awaited outside IndexedDB (reading a `File`, hashing) happens before the transaction opens, because an IndexedDB transaction closes when control returns to the event loop.

Failure behaviour: no path deletes or recreates the database. Unknown schema version or unreadable records show an explanatory message and leave the data alone. If IndexedDB cannot be opened, the views render the seed content from memory as read-only, every mutating control is disabled with the explanation from the spec, and grant triage (localStorage) keeps working. A blocked upgrade shows the close-other-tabs guidance with Retry.

Limits live in `validation.js` as exported constants (10 MiB per file, 100 MiB aggregate, allowed extensions). The repository takes them from there but accepts an override object, which the tests use to exercise the aggregate cap without writing 100 MiB.

## Routes and shell

| Route | View |
| --- | --- |
| `#/organisation` and `#/organisation/bids` | Overview plus Past bids list |
| `#/organisation/bids/new` | Overview collapsed to its heading, bid form |
| `#/organisation/bids/<id>` | Bid detail; unknown ID shows "Bid not found" and Back to past bids |
| `#/organisation/bids/<id>/edit` | Bid form |
| `#/organisation/documents` | Overview plus Documents list |

- The header wordmark becomes a link to `#/organisation` with accessible name "YOR Plc organisation information", and shows the active state on organisation routes. Discovery stays the default landing route. The title band `h1` reads "Organisation information".
- Past bids and Documents are two tabs under the overview, each with a count, using the existing tab style.
- A dirty form intercepts navigation (hash change and in-app links) with a confirm dialog; choosing to stay restores the previous hash without losing input. Use the native `<dialog>` element for all confirmations, with focus returned to the triggering control on close.
- Downloads use an object URL on a temporary `<a download>` and revoke it afterwards. File names and all user text are rendered with `textContent`.
- Storage notice on every organisation view, verbatim from the spec: "Files are stored in this browser only. Keep your originals. AI processing is not connected in this demo."

## Review decisions the implementer needs

See the table at the top of the spec. In short: the brand link is the header wordmark; `new` and `edit` routes are added for the bid form; per-file transactions for organisation uploads; limits are overridable for tests; heavy storage tests run in the desktop project only.

## Files

| File | Change |
| --- | --- |
| `public/js/org/**` | New, as above |
| `public/js/app.js` | Router handles `#/organisation...`; navigation guard hook; wordmark active state. No change to Discovery, Planning or Tracking behaviour |
| `public/index.html` | Wordmark becomes a link |
| `public/styles.css` | Organisation views, forms, dialog, upload results, using existing tokens |
| `tests/unit/org-validation.test.js` | New |
| `tests/e2e/organisation.spec.js` | New: navigation, profile, bids, documents, accessibility, layout (all three viewports) |
| `tests/e2e/organisation-storage.spec.js` | New: byte integrity, limits, transactions, failures, persistence, catalogue (desktop project only) |
| `playwright.config.js` | Restrict the storage spec to the desktop project |
| `tests/evidence/capture.mjs` | Add organisation scenes |
| `README.md` | Short section on the browser-only document store and its limits |

## Tests

Unit (`org-validation.test.js`), pure functions with an injected "today":

- Profile: overview required and length limits; website accepts only http and https; identifiers keep leading zeros.
- Bid: required title and funder; outcome enum with Unknown default; amounts non-negative with at most two decimals and empty meaning unknown; awarded amount only when Successful; submission date not in the future (London date); decision date not future and not before submission.
- Files: each allowed extension in mixed case accepted; unsupported extension rejected; zero bytes rejected; exactly 10 MiB accepted and one byte more rejected (sizes as numbers, no buffers); contradictory MIME rejected, empty or generic MIME accepted.
- Document: title default from filename and shortening to 200; tags at most ten of at most 50 characters.
- Sorting: bids by submission date descending with undated last and stable ID tie-break; documents newest first.

Browser, all three viewports (`organisation.spec.js`):

- Wordmark link reaches Organisation information; deep links, reload and Back/Forward work for every route; Discovery is still the landing page; unknown bid shows the not-found state.
- Seed: three bids (Successful, Unsuccessful with feedback, Awaiting decision) and four documents, all marked synthetic; counts shown on the tabs.
- Profile edit persists across reload; Cancel and validation errors change nothing; canned suitability text in Discovery is unchanged after a profile edit.
- Bid create, edit, search, outcome filter, delete with confirmation; "Bid document missing" shown until a file has the Bid document role; changing outcome away from Successful asks before clearing an awarded amount.
- Documents: batch upload with default metadata; edit details; metadata search; same filename twice gives two entries; delete with confirmation.
- A filename containing HTML characters renders as text.
- Dirty-form guard: staying keeps input; leaving discards.
- Keyboard: forms and dialogs operable, focus restored on close, errors linked with `aria-describedby`.
- No horizontal overflow on every organisation view; controls at least 44 px.
- Regression: existing Discovery, Planning and Tracking suites still pass unchanged.

Browser, desktop only (`organisation-storage.spec.js`). Test files are generated in the test at run time (small buffers with correct PDF, DOCX/XLSX zip, PNG and JPEG signatures); no real documents are committed:

- Byte integrity: upload PDF, DOCX, XLSX, CSV, TXT, PNG and JPEG; reload; download each and compare SHA-256 with the original.
- 10 MiB exactly accepted; one byte over rejected; zero-byte and unsupported rejected; mixed batch reports per file and keeps the good ones.
- Aggregate cap enforced, using a lowered override limit.
- Staged bid files: Cancel leaves no documents or blobs; a Save whose transaction is forced to abort leaves the previous bid and no new files (inject the failure through the repository's test hook, not by weakening the code path).
- Delete bid removes only its own documents and blobs; organisation documents and grant state untouched.
- Deleted seed items stay deleted after reload; the seed runs once.
- A second browser context starts with fresh seed data; the first context keeps its edits.
- IndexedDB unavailable (stubbed `indexedDB.open` failing before app start): read-only content, mutations disabled with the explanation, grant triage still works.
- `catalogue()` returns the profile, all bids with outcome, summary, feedback and notes, and every live document with owner, role or category, filename, period and timestamps; each blob is retrievable by ID; a deleted source is absent.
- No request carries file content: every network request during uploads is a same-origin GET for a static asset.

## Evidence

Save to `project/sprint-2/tickets/S2-001-organisation-document-store/evidence/` at 1280, 390 and 360 px: `overview-bids`, `bid-detail`, `bid-form`, `documents`, `upload-result` (one success and one rejected file). Look at them against `mockups.html` and fix what looks wrong before shipping.

## Recording and shipping

Record results in the "Implementation and validation" part of this ticket's `ticket.md`, the S2-001 line of `docs/status.md` and the delivery column of `project/sprint-2/README.md`. Leave other documentation alone; specification work continues in parallel and other files may change on disk.

Ship exactly as in the Sprint 1 plan: commit on `master` with the attribution lines, push, deploy with the same `gcloud run deploy` command and flags, verify the live site (`/` and `/js/org/repository.js` return 200; full Playwright suite with `BASE_URL`), record the revision, commit and push. Stop and report on a rejected push, a permission failure, any IAM change or anything touching another Google Cloud project.

## Out of scope

AI ingestion or extraction, OCR, registry import, server storage or upload, authentication, backup or export, versions, any Planning, submission or Tracking behaviour (that is S3-001), and anything in Sprint 3.
