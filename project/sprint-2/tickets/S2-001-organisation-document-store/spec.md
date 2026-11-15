# Sprint 2: Organisation information and document store

Revision: 7 | Updated: 2026-11-15 | Ticket: S2-001 | Status: draft for Claude review; not implemented.

## Authority and scope

User request: create the foundation for planning and submission by gathering historical bids (actual documents, success/failure, feedback), organisation information, Charity Commission submissions, Companies House and financial/accounting documents, and other manager-uploaded files. Access this through the organisation name at top left. Past bids need a managed interface; general documents need a lightweight collection. Future AI should be able to use all these sources.

Feature scope is user-requested. The fields, interactions, storage design, limits and samples below are proposed implementation defaults for Claude review, not separately user-approved decisions. This complete revision carries forward revision 6 below. Sprint 2 sections take precedence over conflicting baseline statements; earlier tickets remain unchanged.

REQ-001 adds the Organisation area. REQ-007 extends browser-local persistence to files via IndexedDB while preserving existing grant localStorage. REQ-008/014 extend visual/accessibility rules; REQ-010 adds verification below. REQ-005/006 remain unchanged: current application preparation/submission and Tracking are still placeholders. Historical bids are independently recorded past applications, not submissions created by this app or generated Tracking records.

Deliver actual upload, persistence and download of original file bytes, not simulated uploads. Future AI access means identifiable source records and a retrieval boundary. No model integration, extraction, OCR, embeddings, automatic registry import or real submission in this ticket. Never claim a model has read these documents.

## REQ-017: Organisation overview and navigation

- Make the existing **YOR Plc** name at top left a keyboard-accessible link to `#/organisation`, with accessible name “YOR Plc organisation information”. Retain the agreed spelling: the user's “Your PLC” means this existing entry.
- Inspected code has a header, not a left sidebar. Use that existing brand position, or the corresponding position in the latest shell when implemented; no separate sidebar redesign. Keep it available on mobile and visibly active on organisation routes.
- Title: **Organisation information**. Show a compact overview at the top: what the charity does, beneficiaries, geography and main activities. Under it provide **Past bids** and **Documents** sections with counts; Past bids is default. Proposed routes: `#/organisation/bids`, `#/organisation/documents`, `#/organisation/bids/<id>`. The overview remains above the two lists. A missing bid shows “Bid not found” and Back to past bids.
- Preserve Discovery as the default landing page, all phase navigation, direct hash links, refresh and browser Back/Forward. Navigation focuses the new heading; dialogs/forms restore focus sensibly when closed.
- **Edit organisation information** supports Save/Cancel. Name stays YOR Plc. Overview is required (max 2,000 chars); beneficiaries, geography and activities are optional (1,000 each). Optional charity number, company number and website: identifiers are text preserving leading zeros; website allows only http(s). No invented identifiers or required legal registration fields.
- Seed the existing demo profile and explicitly illustrative housing/homelessness support text. The existing GBP 7.1m figure is a demo assessment snapshot, not verified current accounts. Profile edits do not recalculate canned suitability assessments; retain their snapshot caveat.
- Validate inline, preserve typed values on error, and warn before discarding dirty forms on navigation. Cancel does not change persisted information.

## REQ-018: Managed past bids

Desktop table/mobile cards show title, funder, submission date or Not recorded, outcome, requested/awarded amount when supplied, attachment count and View/edit. Provide Add past bid, a title/funder search, and outcome filter (All default). Sort by submission date descending, undated last, stable ID tie-break. Show total and matching counts. Empty and no-match states have useful next actions.

| Field | Requirement/default |
| --- | --- |
| ID | Generated stable opaque ID independent of the six grant IDs |
| Title and funder | Required; 200 characters each |
| Programme/round | Optional; 200 characters |
| Submission date | Optional ISO date, not future using Europe/London today |
| Outcome | Required; Unknown default; Successful, Unsuccessful, Awaiting decision, Withdrawn, Unknown |
| Requested amount | Optional non-negative GBP, at most two decimal places; empty means unknown |
| Awarded amount | Same validation, only for Successful; confirm before clearing a recorded amount when changing outcome |
| Bid summary | Optional, 5,000 characters: proposal, beneficiaries, activities and intended results |
| Decision date | Optional; not future or earlier than supplied submission date |
| Funder feedback | Optional, 10,000 characters; distinguish from internal notes |
| Internal learning notes | Optional, 10,000 characters |
| Attachments | Zero or more original files with roles Bid document, Feedback, Supporting document |
| Created/updated | Automatic ISO timestamps rendered readably |

Detail view presents all metadata, grouped attachments, Edit and Delete. Create/edit offers Save/Cancel, validation and clear completion messages. Allow incomplete metadata-only archives but show **Bid document missing** until a file has role Bid document. A summary is not a substitute for the original bid. Missing feedback is Not recorded, not evidence of success/failure.

Support multiple actual bid documents, feedback files and supporting documents, downloading, editing attachment title/description/role, and removal. Main upload defaults to Bid document; feedback upload or explicit role choice clearly identifies feedback. No automatic discovery-grant link, assignments or approval workflow.

Files selected in a bid form are staged. Save commits record, staged attachments and removals atomically; Cancel leaves existing data unchanged and discards staged files. Confirm removal naming the file. Failed Save retains previous persisted content and inputs for retry. Disable repeated Save activation; edits retain IDs.

Delete bid confirmation names the bid and attachment count. Confirmation atomically deletes only that bid and its owned files. Cancel does nothing. Organisation files and grant workflow state are unaffected.

## REQ-019: Lightweight organisation documents

Documents is a flat file collection, without folders or approval workflow. **Upload documents** allows multiple selection. A valid file alone is sufficient; no mandatory long metadata form. List newest upload first, stable ID tie-break; show title, original filename, type, size, category, optional reporting period/date, upload date and Download/Edit details/Delete actions. Phone cards wrap long names. Empty state explains useful content and offers upload.

Categories: General (default), Charity Commission submission, Companies House filing, Financial/accounts, Governance/policy, Impact/service evidence, Other. Many periods/files can share a category. Upload is manual, never described as registry retrieval/verification.

Title defaults to filename (max 200 characters, shorten initial title if necessary while retaining full original filename). Optional description (2,000), document date, reporting period free text (100; e.g. Year ended 31 March 2026), and up to ten tags of 50 characters. Edit details uses Save/Cancel with validation. Search title, filename, description and tags; explicitly metadata search, not content search. No inline preview required: download is sufficient.

Batch uploads report success/failure per file; successful files remain if another fails. Show processing feedback and prevent overlapping activation. Deliberately uploading the same filename again creates another uniquely identified file; never silently overwrite or deduplicate. Delete confirms filename and atomically removes metadata plus bytes. No replacement/version history: upload new and explicitly delete old.

Bid attachments appear under their bid, not duplicated in this list. Both collections share the organisation store and future source access contract.

## REQ-020: Storage, validation and failures

Use existing HTML/CSS/vanilla JavaScript, native IndexedDB, Node static server, Node test runner and Playwright. IndexedDB is a proposed browser-native extension, not an installed dependency. No framework migration, backend upload API, cloud storage/service or paid dependency. Do not store file payloads as base64 in localStorage. Preserve the existing grant key/schema, workflow decisions, overrides, filters and Sprint 1 freshness fields.

Proposed database: `charity-funding.organisation`, schema 1. Separate stores for profile, bids, document metadata and file Blobs, keyed by stable IDs. Every document has exactly one owner (organisation or existing bid), role/category, original filename, MIME type, byte size, title, optional metadata, uploaded/updated timestamps and synthetic-demo provenance. Lists load metadata without loading every Blob.

Encapsulate operations in a repository module: profile read/update; bid list/get/save/delete; document list/get/upload/update/delete; original Blob retrieval by ID. Transactions span all affected stores, preventing orphaned bytes/metadata and partial bid saves. Seed atomically once, with a completion marker separate from whether lists are empty. Deleting a fixture must not resurrect it after refresh or deployment.

Proposed limits: PDF, DOCX, XLSX, CSV, TXT, PNG, JPEG; case-insensitive extensions; nonempty files; maximum 10 MiB per file inclusive; 100 MiB aggregate stored file bytes. Reject unsupported extensions and known contradictory MIME values; permit empty/generic browser MIME with extension fallback. These are format checks, not malware scanning. Show allowed types and limits near the picker. No archive unpacking, macros, HTML rendering, parsing or OCR. Check batch capacity at each commit and staged bid capacity in one transaction.

Browser quota can be lower. Quota/open/write/transaction failures show an actionable error and preserve previous data; never show Saved before commit. Blocked upgrades offer retry/close-other-tabs guidance. Unknown schema/corrupt records do not trigger wholesale deletion. Do not apply the old grant-state discard-on-version-mismatch rule to uploaded documents.

Same browser profile and exact origin only: refresh/restart retains records; another profile/origin starts independently. Same-origin deployment must not reset edits. Clearing site data removes uploads. UI copy: “Files are stored in this browser only. Keep your originals. AI processing is not connected in this demo.” No claims of cloud backup, private accounts or sync. If IndexedDB is unavailable, show read-only demo content and disable mutations with explanation; do not pretend memory-only uploads are saved. Failure of localStorage and IndexedDB must be handled independently.

Never send uploads to the Node server, add user documents to public assets or commits, or log file contents. Render user text safely through existing DOM text APIs. Download via object URLs and revoke them after use. No automatic active-content previews. Retain unknown/corrupt storage for recovery rather than silently replacing it.

## REQ-021: Future AI access and sample data

Provide a testable internal catalogue operation returning the current profile, all historical bid metadata (including outcome, proposal summary, feedback and learning notes), and all live organisation and bid document metadata. Each original Blob is retrievable by stable ID. Include ownership, role, filename, reporting period and timestamps so future ingestion can distinguish unsuccessful proposals from feedback and historical accounts from current facts. Deleted sources must not remain retrievable. No user-facing export/debug panel required. Status is Stored, never AI ready/indexed/ingested.

Seed three synthetic bids: Successful, Unsuccessful with feedback, Awaiting decision. Give each an actual small downloadable TXT bid file and the unsuccessful bid a feedback TXT. Seed four TXT organisation examples: Charity Commission submission, Companies House accounts, service overview and impact evidence. Use fictional funders distinct from sourced Discovery opportunities, plausible clearly illustrative dates/amounts, and useful short content demonstrating each document type. Mark both records and contents **Synthetic demo example — not a real submission or filing**. Do not fetch real filings or invent authentic accounts/legal identifiers. User uploads have user-provided provenance, not automatically synthetic. All sample files support the same edit/delete/download behaviour.

The later AI integration will need extraction, access controls and ingestion design in its own ticket. This ticket preserves sources and metadata; it does not assert that a browser-local file is already accessible to a remote model.

## Acceptance and verification

| Case | Expected outcome |
| --- | --- |
| Navigation | Brand entry, overview, lists/detail, deep links, refresh and Back/Forward work; Discovery remains landing; invalid bid useful error |
| Profile | Edit persists; Cancel/error unchanged; optional identifiers remain empty; canned assessments unchanged |
| Bid lifecycle | Create/edit/search/filter/delete; IDs stable; all outcomes supported; amount/date validation; missing bid flagged |
| Attachments | Multiple roles and feedback preserved; staged Cancel leaves no files; failed Save has no partial record/files |
| Documents | Batch with default metadata works; optional edits persist; duplicate filenames remain distinct; per-file failures visible |
| Byte integrity | After reload, downloaded PDF/DOCX/XLSX bytes or hashes equal originals; parameterise allowed TXT/CSV/image uploads too |
| Limits/failures | Exactly 10 MiB accepted, one byte over rejected; zero-byte/unsupported/aggregate-cap/mixed-batch/quota cases; no false success/orphans |
| Delete/cancel | Confirmation enforced; only correct owner/files removed; deleted source absent from catalogue; deleted fixtures stay deleted |
| Persistence | Seed once; browser restart retains data; separate context isolated; same-origin reload/deployment preserves edits |
| Storage errors | Unavailable/blocked/corrupt/unsupported storage handled honestly without erasure; grant state remains usable |
| Future source access | Catalogue covers profile, bids and both document groups with metadata/bytes; no AI/network calls |
| Accessibility | Keyboard forms and confirmations, focus restoration, labels, inline errors/live announcements; HTML-like filenames render as text |
| Responsive | Screenshots at 1280/390/360 px for overview, bid list/detail/form, documents and upload result; no horizontal overflow |
| Regression | Existing six grants, filters, overrides, freshness/markers if implemented, Planning Abandon and Tracking placeholder preserved |

Use Node tests for pure validation/mapping and Playwright with real browser IndexedDB for Blob persistence, transactions and downloads. Inject failures where necessary. Verify selected file contents are not transmitted over network. Run the existing regression suite and record actual results, screenshots and untested gaps. Application tests are not part of this documentation task.

## Claude handoff

Review against the latest tree: S0-003 and S1-001 may advance independently. Use S0-003 verified/implemented visual tokens and fonts rather than historical estimates below. Preserve unrelated work. Write plan.md in this ticket with modules/routes, transaction boundaries, fixtures, tests and shipping verification; record resolved defaults/discrepancies in ticket.md and docs/status.md. No blocking clarification identified while drafting.

Excluded: AI ingestion/generation, OCR, registry scraping, server storage, authentication/permissions, backup/export, cross-device sync, file versions, actual planning/submission or automatic tracking. Next Sprint 2 tickets can define those workflows. This task writes the specification only; subsequent Claude implementation follows docs/workflow.md.

---

## Carried-forward complete baseline (revision 6)

Historical current-status and handoff statements below describe the prior ticket only. The explicit Sprint 2 scope, navigation and storage overrides above take precedence; all other functional requirements remain.

# Sprint 1: Discovery demo completion specification

Revision: 6 | Updated: 2026-11-15 | Status: S1-001 draft for Claude review. Sprint 1 feature scope requested; detailed defaults proposed. S0-002 remains the implemented baseline.

This complete specification carries forward revision 5, including the still-proposed S0-003 restyle, and adds Sprint 1 below. Sprint 1 explicitly revises the no-discovery-control baseline; no live discovery or background agent is implemented. Earlier scope and acceptance criteria remain in force except those explicitly revised below.

## Sprint 1: timing markers and simulated discovery

Agreement source: user's 2026-11-15 request to start Sprint 1 and complete the Discovery demo. The two features, compact icon markers beside names, no additional filtering, and reuse of an existing grant are agreed scope. Exact boundaries, clock, marker lifetime and rediscovery selection below are proposed defaults for review, not separately user-approved decisions. More marker criteria may follow; do not invent them now.

### REQ-015: Compact timing markers

- Show **Upcoming** with a calendar icon when the opening date is tomorrow through seven calendar days ahead, inclusive. An opening today is no longer upcoming.
- Show **Due soon** with a clock icon when the closing date is today through one calendar month ahead, inclusive. Add one calendar month and clamp to the last valid day (31 January -> 28/29 February). Exclude a deadline whose known exact closing time has already passed; a date-only deadline remains due through the end of that London date.
- Evaluate using the current Europe/London date/time, not the fixture snapshot date or a hard-coded build date. Recalculate on rendering, return to the tab and the next London midnight; known closing instants also expire while the page remains open. Tests inject a clock.
- Use explicit optional opening date and closing date/time fields; do not parse the human-readable timing copy. Missing, invalid or rolling dates produce no corresponding badge. Contradictory ranges (opening after closing) produce no timing badges and are flagged during fixture validation. Do not infer dates from absent evidence.
- Both markers may coexist when both conditions hold, including a short window which opens soon and closes within a month. They are informational and do not change suitability or available actions.
- Put small icon-plus-short-text badges immediately alongside the grant name in desktop rows and mobile cards. Wrap beneath the name within the same title block when needed; no extra full-width status column. Colour alone and hover-only explanations are insufficient. Keep names readable and retain the existing suitability treatment.
- Show markers wherever a grant appears within Discovery (New, Watchlist, Passed). No new filtering or sorting controls; preserve the existing Show all / Hide unsuitable control and counts. Do not introduce additional date-status categories yet.

Acceptance examples using 15 November 2026 as the test clock: opening 16 or 22 November -> Upcoming; opening 15 or 23 November -> no Upcoming. Closing 15 November before expiry or 15 December -> Due soon; closing 14 November or 16 December -> no Due soon. Test month-end, leap year, London midnight, both badges, missing/rolling dates and expired exact times.

Fixture evidence: current public/js/fixtures.js contains timing strings and no structured opening dates. Add structured closing dates only for the already documented dated examples G-003, G-004 and G-005; preserve the snapshot caveat. Do not invent a real funder's opening date to force a badge. For review/demo evidence, use a clearly labelled synthetic timing override in a test/preview fixture to demonstrate Upcoming; the real six-grant fixture retains its sourced timing. This preview is not a new user-facing settings feature. Confirm during Claude review if a permanently visible synthetic Upcoming example is desired. As time passes the fixed snapshot may naturally show fewer badges.

### REQ-016: Discover demonstration

- Add a keyboard/touch-operable **Discover** button at the top of Discovery, available in its three workflow views. Nearby concise copy explains that this is simulated discovery and a future background agent will discover grants automatically. No AI calls, external searches, polling jobs or background service in this sprint.
- Each click runs a local simulation using an existing grant, then displays a compact sparkle/plus icon with **New** beside its name and an accessible success message: "Demo discovery: 1 existing grant marked as newly discovered." Keep the six stable IDs and six total records; never clone a record or inflate counts.
- Proposed selection: first suitable/effectively suitable record still in workflow New, using stable fixture order. Show the New view and bring that row/card into view. This makes the result visible under the existing suitability filter without changing the saved preference. Initially this selects G-001.
- If there is no suitable record in New, report "No demo grant available to rediscover. Restore a suitable grant to New to repeat the demo." Do not silently restore Passed records, pull records out of Planning/Watchlist, overwrite overrides or change manager decisions merely to produce a result.
- The **New** badge is discovery freshness metadata, distinct from workflow state `new`: the initial six records are in the New tab but do not all receive freshness badges. Only the result of Discover is marked. It may coexist with either timing marker.
- Proposed lifetime: keep the latest rediscovered grant's badge through reload until the manager takes a workflow action on it, or another grant is selected by a later Discover run. Repeating Discover on the same eligible record refreshes the same marker; no duplicate badges, records or counts. There is no added dismiss/reset control or arbitrary timed expiry.
- Preserve existing workflow, overrides and filter data when introducing optional discovery metadata. Default missing metadata for existing v1 saved state; do not unnecessarily bump the storage version and erase decisions. Existing corrupt/unknown-version recovery remains unchanged. Storage failure continues in memory with the existing notice.
- Prevent overlapping activations while processing; provide accessible completion feedback. Do not add artificial long delays. Do not claim a real search happened or the background agent is already running.

Acceptance: fresh state -> six rows, no freshness badges; Discover -> six rows, one New badge, visible result and announcement; repeat -> still six/one; reload -> badge retained; workflow action -> badge cleared; overrides/filter persist; unavailable eligible result -> explanatory message and no mutation; keyboard/phone use works without overflow.

### Scope changes and verification

REQ-002 now permits the local Discover simulation while retaining six fixed fixtures and no runtime discovery. REQ-007 extends persistence to optional freshness metadata. REQ-008 includes compact markers. REQ-010 adds meaningful date-boundary and discovery-state tests. REQ-004 uniqueness and all manager decisions remain protected. REQ-011 remains the existing suitability filter only. REQ-015 and REQ-016 are agreed feature scope with proposed detailed defaults above.

Implementation evidence must cover date evaluation with an injected clock, repeated discovery, persistence compatibility, manager-state protection, and desktop/mobile rendering at 1280/390/360 px including coexisting markers and long names. Run the relevant existing regression checks. Record actual results, screenshots and any discrepancies in ticket.md. The two features are the user's intended endpoint for this Discovery demo, subject to further criteria they may supply; this does not complete Planning or Tracking.

## Review resolutions

The user answered Claude's review questions on 2026-11-15. The answers are folded into the sections below; this table is the record.

| # | Resolution | Source |
| --- | --- | --- |
| Q1 | Planning has an **Abandon** action that moves the grant to Passed. From there it can be restored to New and worked on again. No separate reset control. | User answer |
| Q2 | No separate undo for a manager override. Passing the grant is the equivalent. The override is kept if the grant is later restored. | User answer; "override is kept" is Claude's reading, consistent with revision 2 |
| Q3 | Overrides go one way only (unsuitable to suitable). | Claude recommendation, accepted |
| Q4 | Always show "N unsuitable hidden" with a Show all link when N > 0. Tab counts show totals regardless of the filter. | Claude recommendation, accepted |
| Q5 | A real Cloud Run deployment is in scope. Repository: https://github.com/sharmaaq/charity-funding. Google Cloud project: `charity-funding-514818`, under the user's own account. | User answer |
| Q6 | The demo charity is called **YOR Plc** everywhere in the application. The real charity it is modelled on is not named in the application. | User answer |
| Q7 | Stack is settled in [S0-002 implementation plan](../../../sprint-0/tickets/S0-002-discovery-suitability/plan.md). | Claude recommendation, accepted |
| Q8 | On a storage version mismatch or unreadable data, discard saved state and start from the fixtures. | Claude recommendation, accepted |

## Goal and agreement

Build a usable responsive website for a fundraising manager at YOR Plc, the demo charity, to review grants, understand suitability recommendations, override them and decide what to pursue. The user wants a working Discovery UI to react to before specifying the full field list. Planning & submission and Tracking are navigable template placeholders only.

Agreed source: user instructions of 2026-11-15 approving browser-only state, mixed suitability examples, visible reasons/icons, filtering, overrides, and placeholders, as recorded by ChatGPT and confirmed by the user's review of revision 3. Existing responsive-web, fixed-feed and no-AI constraints carry forward from the original POC. Detailed UI choices below are implementation defaults delegated by the request to build something usable, not separately approved final designs. Interpret the user's reference to the 'delivery phase' as Discovery in this three-phase context.

## Scope

- Functional Discovery; desktop table, responsive phone cards with equivalent details/actions.
- Six fixed demo opportunities: the original three plus three initially unsuitable records listed below. No runtime AI, live grant search or automated discovery.
- Persistent browser-local decisions and filter preferences. No login, backend state database, organisation management or cross-device synchronisation.
- Planning & submission displays selected grants and a clearly labelled future-work template. Tracking is a clearly labelled future-work template. Neither simulates a completed submission or funding outcome.
- Deploy the application to Google Cloud Run in project `charity-funding-514818`, keep the source in the GitHub repository, and document local run, test and deploy steps. Select a simple stack suitable for this otherwise blank application; existing Java IDE metadata is not a stack requirement. Record the choice and actual commands.

## State and meaning

Each grant has one immutable stable ID and one workflow state: `new`, `watchlist`, `passed` or `planning`. Suitability is separate from workflow state.

Keep the original recommendation (`suitable` or `unsuitable`), its reason and source references. A browser-local manager override can set an originally unsuitable grant's effective suitability to suitable. Overrides go one way only and have no undo action; a manager who changes their mind passes the grant. Display 'Suitable - manager override' and retain the original recommendation and reason in details. The override reflects the manager's decision, not a change to the funder's rules. Do not require accounts or an override explanation for this POC.

Persist workflow states, suitability overrides and the hide-unsuitable preference using localStorage, under an app-specific versioned key. A reload restores them. If the saved data is unreadable or has a different version, discard it and start from the fixtures. A fresh browser profile starts independently with the demo fixtures. People sharing the same browser profile and origin share that local demo state; there is no per-person isolation without future authentication. Avoid wording that claims each person has a private account. Gracefully report if storage is unavailable and continue the session in memory.

Future scope: logged-in users, multiple users per organisation, shared backend state, permissions and synchronisation. Do not implement these in Sprint 0 or pre-empt their detailed design.

## Discovery UI and actions

Discovery opens on New. New, Watchlist and Passed are always reachable, including when empty. The initial New view uses 'Show all' and shows all six demo grants. 'All' means all suitability assessments within the selected workflow view, not a mixture of Passed and New.

Provide a conspicuous two-option control: **Show all** / **Hide unsuitable**. Save the preference across reloads and visits. Interpret 'open unsuitable grants' as actionable grants in New/Watchlist, not whether an external application deadline remains open. Filtering never passes or deletes a grant. Whenever the filter hides at least one record in the current view, show "N unsuitable hidden" with a Show all action, including when it hides every record. The counts on New, Watchlist and Passed show the total in that workflow state regardless of the filter. Passed remains accessible and unfiltered so discarded grants can be reviewed/restored. A passed grant does not reappear in New when the filter changes.

| View and effective suitability | Available actions | Result |
| --- | --- | --- |
| New, suitable | Watch; Plan application; Pass | Move respectively to Watchlist, Planning, or Passed. |
| Watchlist, suitable | Plan application; Pass | Move to Planning or Passed. |
| New, unsuitable | Mark suitable; Pass | Override suitability in place, or move to Passed. An unsuitable grant cannot reach Watchlist without an override. |
| Passed, either suitability | Restore to New | Restore workflow state; keep any existing override. |
| Planning (shown in Planning & submission) | Abandon | Move to Passed. It can be restored to New from there. |

Plan application opens Planning & submission and shows the selected grant in its placeholder list. It creates no duplicate grant. No active Watch/Plan actions for unsuitable records until Mark suitable is used. An override makes the regular suitable actions available immediately and the record remains visible under Hide unsuitable. Passing and restoring does not erase the original assessment. Repeated clicks and reloads must not duplicate records.

## Provisional fields and presentation

The full field list is explicitly deferred to the next iteration. Do not wait for it. For this reviewable version, show:

- Grant name and funder; amount; deadline or rolling/open wording; short purpose; source link.
- A Suitability column/section with icon AND text. Use an obvious warning/cross icon plus 'Unsuitable' for rejected recommendations, a check plus 'Suitable' otherwise, and a distinct manager-override label.
- The unsuitable reason must be readable in the row/card without requiring a hover or opening a modal. Colour alone is insufficient. Details can expand the source evidence and original assessment.
- Clear, labelled action buttons, workflow-view counts and useful empty states. No dead buttons that look functional.

## S0-003 visual design requirements

Match the supplied Your Place homepage's design language substantially more closely. The requirement to restyle is agreed by the user's 2026-11-15 request; the following measurements and approximations are concrete implementation defaults. Sources and verification limits are in [visual research](../../../sprint-0/tickets/S0-003-visual-theme/research.md).

### Typography

Inspect the reference site's CSS/font declarations first and record the font names and weights. Use its distinctive chunky, slightly irregular display face for page headings, prominent section titles and primary button labels; use its rounded geometric sans-serif for body copy and navigation. If the original font cannot be used, the proposed approximation is Lilita One (display) plus Poppins (body); document it as a substitute. Do not leave system-ui as the designed primary font. Bundle permitted font files with notices and use font-display: swap; retain legible fallbacks.

Use display headings in uppercase with moderate tracking (start around 0.04em); approximately 36-44 px desktop and 28-32 px phone. Body is 16 px with 1.5-1.6 line height. Grant titles remain readable sentence-case, 18-20 px in bold body type. Do not use decorative lettering for long suitability explanations. Verify both actual font loading and the computed family after loading.

### Colour and shape

Create shared CSS tokens. Starting screenshot-based estimates: purple #442D80; lime #D7DF23; coral #F46B56; orange #F57500; teal #83BEC9; lavender #9784BA; white surfaces and dark ink. These replace the earlier muted palette, not official brand specifications. Verify against source CSS where available and record the final palette. Purple and lime are the dominant brand pairing; coral/orange and teal/lavender are supporting accents, not six competing row colours.

Use purple text on lime and white text on purple. Test normal text contrast >=4.5:1, large text >=3:1 and controls/focus indicators >=3:1 against adjacent colours. Do not assume white text on orange/coral or lime is accessible. Preserve distinct suitable/unsuitable semantic icon-plus-text badges; they need not use the brand accent colours.

Use mostly rectangular, lightly softened controls (roughly 0-4 px radius), bold display primary labels and optional restrained rough-edge decoration. Add a small original geometric roofline or angular motif to the page-title band, echoing the reference. Decoration must not clip labels, obscure focus outlines, intercept pointer events or enter the accessibility tree. No large photographic hero above the working list.

### Application layout

1. A compact lime demo strip with purple text, preserving the snapshot and assessment caveat. This adapts the reference's top strip to useful application content; no newsletter or donation controls.
2. A white header with more breathing room (roughly 76-88 px desktop), a prominent two-colour YOR Plc wordmark using the chosen type and the three existing navigation destinations. Retain the exact demo name; do not include the real logo or real charity name in served files. Wrap neatly on mobile.
3. A compact purple page-title band with white display lettering ('Discovery', or the current phase) and a restrained geometric accent. Aim for 96-140 px desktop; reduce on phone. It should establish the reference's character without pushing the grant list far below the fold.
4. White workspace with clear spacing between the tabs, suitability filter and grant table/cards. Use purple-and-lime active/selected states with an additional border/shape/text cue. Preserve counts and the hidden-unsuitable message.
5. Keep the four-column desktop table and phone cards. Use a purple header, white rows, quiet separators, consistent 16-20 px cell padding and restrained pale tinted detail panels instead of dominant blue bars. Keep reasons visible and preserve all content/actions. Primary actions use purple/white or lime/purple; secondary actions are quieter outlined controls. No hover-only actions.
6. Apply the same shell, type, tokens and button treatment to Planning & submission and Tracking, including their empty/template states. Do not add functionality to either placeholder.

Use a centred workspace around 1200-1320 px wide, with 24-32 px desktop gutters and 16 px phone gutters. Preserve at least 44 px touch targets. At 360, 390 and 1280 px, labels, navigation, filters and action groups must fit without page-level horizontal scrolling; long grant names wrap naturally. Keep keyboard focus clearly visible on every surface.

### Visual acceptance and evidence

- REQ-008 (revised): reference-style display/body typography, stronger purple/lime palette, white header and compact title band are visibly present across all phases; suitability icons, text and reasons remain accessible. The restyle cannot be satisfied by changing only two hex values.
- REQ-014 (new): provide before/after screenshots at 1280 px and after screenshots at 390 and 360 px; include initial Discovery, an unsuitable record, a manager override, expanded details and Planning/Tracking. Compare them with the supplied reference and explicitly assess typography, palette, header, buttons and geometric detail. Record chosen font sources/licences, actual font-loading result, final CSS tokens and measured contrast pairs.
- Preserve REQ-001 through REQ-013 except the explicit REQ-008 presentation revision. Keep storage keys/schema and existing saved decisions intact. Keep YOR Plc naming, source links, grant data, all transitions (including Abandon), filtering/counts and placeholders unchanged.
- Run the existing unit/Playwright regression suite after implementation and record actual results. Add or adapt only checks needed for font loading, overflow or affected layout; do not rewrite functional expectations to hide regressions. Visual comparison is required in addition to passing tests.

## Demo dataset

Display 'Demo discovery - 15 November 2026 snapshot' and make clear assessments are demo recommendations. Dates remain fixed and records stay usable after deadlines. 'Suitable' means a candidate to assess, not verified eligibility or a funding promise. Keep all six in one fixture file with source URLs and assessment reasons; do not create live integrations.

YOR Plc profile for assessment: a London homelessness housing and support charity with reported annual income of about GBP 7.1m. YOR Plc is a demo name. The profile is modelled on a real charity whose name and registration number are recorded only in the research file and must not appear in the application. Source evidence and limitations: [grant research](../../../sprint-0/tickets/S0-002-discovery-suitability/research.md).

| Stable ID | Opportunity / funder | Amount and timing for demo | Initial assessment and reason | Guidance |
| --- | --- | --- | --- | --- |
| G-001 | Regular Grants / Garfield Weston Foundation | Under GBP 100,000; rolling (original snapshot) | Suitable candidate: core, project or capital support can fit the charity's work; application/project eligibility still requires review. | [Apply](https://garfieldweston.org/for-grant-applicants/how-to-apply/) |
| G-002 | Reaching Communities England / The National Lottery Community Fund | From GBP 20,001; open at snapshot | Suitable candidate: community support in England and tackling disadvantage align with the demo profile; a qualifying project must be developed. | [Programme](https://www.tnlcommunityfund.org.uk/funding/funding-programmes/reaching-communities-england) |
| G-003 | DPS Social Commitment Programme - Scale / School for Social Entrepreneurs | Up to GBP 10,000 plus learning; original snapshot extension to noon UK time 17 November 2026 | Suitable candidate: housing insecurity/homelessness theme aligns; growth, trading and participant requirements need checking. | [Programme](https://www.the-sse.org/programme/the-dps-social-commitment-programme-scale/) |
| G-004 | Capital grants / Help the Homeless | Up to GBP 5,000; next quarterly deadline 20 December 2026, 17:00 | Unsuitable: restricted to charities with turnover below GBP 500,000; YOR Plc's GBP 7.1m reported income exceeds this size limit. Capital-only; no core costs/salaries. | [Criteria](https://www.help-the-homeless.org.uk/applying-for-funding) |
| G-005 | Sustaining Accommodation Fund / St Martin-in-the-Fields Charity | Up to GBP 5,000 block grant, up to GBP 500 per person; published closing date 27 November 2026, 17:00 | Unsuitable: applicants need annual income below GBP 2m; YOR Plc reported GBP 7.1m. The homelessness theme fits, but organisational size does not. | [Fund](https://smitfc.org/sustaining-accommodation-fund/) |
| G-006 | National Lottery Awards for All Scotland / The National Lottery Community Fund | GBP 300-20,000 for community-led projects; open at snapshot | Unsuitable for this London service scenario: funds projects in Scotland. This is a project-location mismatch, not a blanket claim that a London-registered charity could never run a Scottish project. | [Programme](https://www.tnlcommunityfund.org.uk/funding/funding-programmes/national-lottery-awards-for-all-scotland) |

G-004 and G-005 were recovered from previous research and rechecked. G-006 is newly researched for this iteration. Do not mark the previously discussed GLA/Housing Justice opportunity ineligible merely because example applications or portal evidence were unavailable; missing evidence is not a failed funding criterion.

## Planning & submission and Tracking placeholders

Planning & submission must be a polished navigable page titled as such with a visible 'Placeholder - future iteration' notice. Show the grants moved from Discovery (name, funder, source, suitability) and template sections such as Application preparation and Submission. These sections can contain descriptive placeholder text, not fake editable application forms or functional submission controls. The one working control is **Abandon** on each grant, which moves it to Passed and tells the manager where it went. Empty state: select a suitable grant from Discovery. Grant details remain accessible.

Tracking must be navigable with 'Placeholder - future iteration' and clearly unpopulated template sections for application status and outcomes. Do not create fake applications, dates, Awaiting decision records or a Record demo submission button. The original proposed planning-note/submission/tracking flow is superseded.

## Acceptance criteria and verification

| ID | Current acceptance criteria | Status/source |
| --- | --- | --- |
| REQ-001 | All three areas reachable on desktop/phone; no horizontal page overflow at 360/390 px. | Agreed scope; viewport sizes carried-forward implementation defaults. |
| REQ-002 | Fresh browser shows six New records, three suitable and three unsuitable; fixed snapshot banner; no AI/live discovery. | Agreed S0-002; six selected as implementation default for 'a few'. |
| REQ-003 | Actions in the transition table update the correct view immediately; Passed is recoverable; empty views remain accessible. Abandon in Planning moves the grant to Passed. | Agreed Discovery scope; Abandon agreed 2026-11-15 (Q1). |
| REQ-004 | One record per stable grant ID; details remain accessible across views; repeated actions cannot duplicate it. | Retained implementation constraint. |
| REQ-005 | Plan application moves a suitable grant to the Planning placeholder and opens it; Abandon is its only working control; no submission functionality. | Agreed S0-002; replaces earlier proposal. |
| REQ-006 | Tracking is a labelled template with no fabricated submitted applications or outcomes. | Agreed S0-002; replaces earlier proposal. |
| REQ-007 | Reload preserves actions, overrides and filter preference; a separate browser starts fresh; no login/shared state. | Explicitly agreed S0-002. |
| REQ-008 | Meet S0-003 visual design requirements above while retaining readable suitability icons, text, reasons and accessible controls. | User requested closer visual alignment; implementation defaults specified above. |
| REQ-009 | Document fresh-checkout run/test/deploy; service honours PORT and listens on 0.0.0.0; deployed to Cloud Run in `charity-funding-514818` and the HTTPS URL checked on a phone; source pushed to GitHub. | Deployment agreed 2026-11-15 (Q5). |
| REQ-010 | Automated state/filter tests and desktop/phone smoke tests below pass, or actual gaps are recorded. | Validation required by shared workflow. |
| REQ-011 | Show all initially includes six; Hide unsuitable leaves three and shows "3 unsuitable hidden"; tab counts unchanged by the filter; filter persists and does not pass/delete records; Passed remains reviewable. | Agreed filter; defaults/semantics specified here. |
| REQ-012 | Mark suitable on G-004 enables Watch/Plan, shows manager override, preserves original rejection reason, survives reload and appears under Hide unsuitable. | Explicitly agreed S0-002. |
| REQ-013 | All six fixtures include sources/reasons; unsuitable reasons identify concrete size/location mismatches; the application names the charity only as YOR Plc. | Agreed mixed suitability dataset; naming agreed 2026-11-15 (Q6). |

| REQ-014 | Supply visual comparison evidence, loaded fonts, final tokens, measured contrast and responsive checks specified above. | New S0-003 validation criteria. |

Automated checks: fresh six/three counts; filtering without mutation; unsuitable Pass then Restore; unsuitable override then Watch then Plan; original reason retained; uniqueness after repeated actions; Plan then Abandon then Restore; hidden count and tab counts under the filter; storage round-trip, discard on version mismatch, and fresh-context isolation; no occurrence of the real charity's name or number in served files. Smoke-test navigation, immediate feedback, empty states, readable reasons and keyboard/phone use at the stated widths. Verify that no submission controls or generated tracking records exist. Do not report deployment as tested unless the actual URL was checked.

## Historical S0-003 delivery notes (carried forward)

S0-002 is deployed. This ticket requests a visual change, not a new build of its functionality. Claude reviews S0-003 and follows the current shared workflow for planning, implementation and shipping. Do not treat the historical S0-002 plan as a plan for this restyle. Preserve unrelated changes and saved browser state. Record implementation and actual validation in this ticket and docs/status.md. Provide a local preview for UI review and distinguish it from any later deployment. The full Discovery field list remains deferred.

## Current Sprint 1 handoff

Claude reviews S1-001 and its proposed defaults, then plans implementation under docs/workflow.md. S0-003 is a separate, still-unimplemented visual ticket; preserve its intended styling and coordinate the sequence. Do not treat the old implementation plan as a Sprint 1 plan. Record actual build/test/deployment status separately. No application implementation or deployment was performed while drafting this specification.

