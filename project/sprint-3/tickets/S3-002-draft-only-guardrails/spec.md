# S3-002: Draft-only testing guardrails

Revision: 9 / S3-002 draft 1. Date: 2026-11-16. User-required non-submission boundary; proposed implementation controls. Not implemented by this specification task.

## Scope and precedence

This is specifically **Garfield Weston Foundation Regular Grants (G-001), one-year operating/core support**. It is not a universal grant application template. The complete S3-001 specification is preserved below with rebased links. This opening section overrides its future live-submit sequence for draft-only testing; it does not undo delivered UI/PDF/controlled-demo behaviour. S3-001 stays frozen as delivered history. REQ-027/028 are extended; new REQ-029 governs draft-only operation.

User instruction, 2026-11-16: test preparation without submitting and provide guardrails. No real submission is authorised. The shared code shipping workflow is not permission to submit a grant application.

## What the existing specification is sufficient for

An agent can use S3-001 to understand the chosen programme, prepare the local questionnaire/proposal/package and investigate the integration. It cannot honestly claim a complete real application from the specification alone. Additional prerequisites are real applicant identity/authority/contact details, current accounts and financial forecasts, truthful project/beneficiary/compliance answers, an authorised portal session, and inspection of all current required/conditional portal fields. Sources/unknowns are explicit; never fill gaps with the worked synthetic example. 'Find an API or another way' permits research, not invention of applicant API access or use of grantmaker credentials.

Prefer a documented applicant API supporting separate draft creation/update only if access and semantics can be verified. Otherwise inspect the normal browser route. A new integration must satisfy the same draft-only enforcement regardless of transport.

## REQ-029: Three clearly separate operations

| Operation | External effect | Completion |
| --- | --- | --- |
| local_draft | None: local answers, proposal and attachment package only | Local draft prepared — not transferred |
| portal_draft | With explicit transfer authority, save a genuine draft to the verified applicant account | Portal draft saved — not submitted |
| demo_run | Existing controlled S3-001 target only | Demo submission completed — nothing sent to the funder |

Default to local_draft. Portal_draft is opt-in for an authorised real account and real organisation. Do not reinterpret the existing API's `mode=demo` as permission to contact a real funder; retain its current network isolation and rejection of live requests. The separate future portal-draft runner does not make the public no-login Cloud Run app a live applicant service. Use an applicant-controlled local session until secure hosted ownership/session isolation is designed.

Report draft readiness separately from final-submission readiness. Existing S3-001 live gates for final-send authority and submitted-receipt evidence must not force a draft test to submit or obtain send authority. Replace those two gates for portal_draft with verified non-submission enforcement and saved-Draft read-back evidence. Retain relevant identity, access, permitted automation, field-mapping and document checks; incomplete substantive answers may produce a partial draft. Final-submission readiness remains false throughout.

Garfield Weston's [official application page](https://garfieldweston.org/for-grant-applicants/how-to-apply/) explicitly supports returning to draft applications. [Current vendor guidance](https://webfiles-sc1.blackbaud.com/files/support/helpfiles/grantsconnect/content/gc-applicants-apply-for-grants.html) says answers autosave and final submission is a separate action. Rechecked 2026-11-16. Exact programme controls/branches remain unverified. Portal-draft is not a sandbox: answers/files are transferred externally, may be visible to the service/funder, and no promise of invisibility or absence of internal notifications is made.

## Enforced non-submission boundary

1. Keep `allowFinalSubmission=false` outside model-controlled input. The draft runner exposes inspect/read, verified draft create/update, upload and save/read-back operations only. Do not register a final submit/sign-submit/send/email tool or expose unrestricted page.evaluate, arbitrary request dispatch or arbitrary click capability to a planning model. Runner code holds the browser and mediates all model suggestions.
2. Typed authority is `{operation:'portal_draft', organisationId, programmeId, snapshotHash, allowedDraftId?, expiresAt}`. It has no submit permission. Never upgrade its operation because a form is complete. Bind operations to the verified domain/account/programme and reject authority mismatch before any write. The user must authorise external transfer before the first autosaved field or uploaded file, not merely before final submission.
3. The adapter's `submit()` and any equivalent final-action method fail immediately with `FINAL_SUBMISSION_DISABLED` in this build. There is no UI toggle or request flag to override it. If a distinct submission-capable product is built later, that is separate work with new explicit approval, not a continuation or retry of this test.
4. Inspect current page controls and record allowed draft actions in the portal map before mutation. Only uniquely mapped non-final actions may run. Block Submit, Sign and Submit, Send application and semantically equivalent final actions, keyboard Enter/implicit form submission and scripts that bypass the action registry. Do not rely only on button wording or visually hiding the button. Do not activate a combined Save and submit control.
5. Add a network interception layer permitting only verified read/auth/draft-save/upload operations on approved origins. Block known final-submit operations, including operation names in GraphQL/RPC/shared endpoints, and unexpected write requests. Do not discover a final endpoint by executing it. If draft-save and submit share an opaque request that cannot be distinguished safely, stop at local preparation/manual handoff. A hostname-only allowlist is not a sufficient submission guard.
6. Eligibility screening, terms acceptance, signatures, declarations or organisation registration that send information or make attestations are not automatically permitted draft actions. If such a step is required before drafting and is not already specifically authorised, pause and explain the exact action. Never bypass authentication/MFA/CAPTCHA or select declarations merely to progress.
7. Never place synthetic YOR Plc identity, fictional accounts/contact numbers or illustrative policy answers into a real portal. Use actual authorised applicant data. Missing required facts remain missing; report partial draft instead of claiming complete. Do not silently change the existing public demo identity to the real charity.
8. On timeout/reload/retry, resume the known draft ID and inspect its state first. Do not create duplicate applications. No fallback email, new registration, alternate submit endpoint, automatic deletion/withdrawal or compensation action. An unexpected submitted/awaiting-review state is an incident: stop, preserve evidence and notify the user; do not attempt withdrawal without authority.

These are engineering controls to implement and verify, not a guarantee already supplied by this document or by an unconstrained browsing agent. Until the current portal mapping and guards are verified, local_draft is the available safe test route.

## Successful portal-draft test and handoff

1. Verify and record real applicant, programme, draft action mapping and non-submission controls before writes.
2. Reuse or create one authorised draft; record external draft ID immediately.
3. Fill known answers and upload approved documents through draft-only operations. Read back values and upload acknowledgements. Record missing/blocked controls instead of guessing.
4. Wait for verified save completion, navigate away safely and reopen the same draft. Confirm persisted values/files and explicit **Draft** status. A spinner disappearing is not proof of save or non-submission.
5. Stop there. No final declarations/signature/submission action. Return resume URL, draft ID, timestamp, completed/missing-field report and redacted proof of Draft status. The status is `portal_draft_saved` or `portal_draft_partial`, never `submitted_confirmed`/Awaiting decision. If status cannot be confirmed, use `draft_save_unconfirmed` and stop.

Local-draft completion returns the proposal/package and a missing-information checklist, with no external reference. Avoid mandatory completion of all substantive fields merely to save a draft. In either mode the user can review the draft without any queued action waiting to submit later. Finishing a test must not leave a scheduler, resume hook or agent instruction that will submit automatically.

## Acceptance and verification

- local_draft performs no funder/API network requests and accepts incomplete answers.
- portal_draft cannot run without scoped authority, verified non-synthetic identity and mapped draft operations.
- Direct calls to final methods fail; changed request flags cannot enable them; generic browser tools cannot bypass runner mediation.
- Controlled tests attempt final submission by button, Enter, direct HTTP, alternative route and shared RPC operation; each is blocked before reaching target state change.
- Unknown writes, combined save/submit, new terms/signature/eligibility gates and ambiguous controls stop with an actionable explanation.
- Positive test proves permitted draft writes/uploads survive reopen while target remains Draft and its submission count stays zero.
- Lost acknowledgement resumes the same draft; no automatic duplicate, resend, withdrawal or email.
- Mock controls passing is not proof of live readiness. The real test requires redacted current mapping and Draft-state read-back evidence; do not execute a live final action to test the block.
- Existing isolated demo still works, remains labelled demo and never contacts a funder.

## Agent handoff instruction

Investigate the current Garfield Weston Regular Grants application route using the linked research and portal-map checklist. Prepare a local draft first. Treat all example data as synthetic. Identify missing genuine facts and every unmapped current required field. Once separately authorised to transfer to the applicant account, use only verified draft-save operations under the guardrails above, reopen and confirm Draft status, and return the resume link and missing-items report. Do not submit, sign, make binding declarations, send an application email or enable final submission. If safe draft-only operation cannot be established, stop with the prepared local package.

---

## Complete carried-forward S3-001 specification

Historical status text below belongs to S3-001. Draft-only guardrails above take precedence for real-portal tests.

# S3-001: Guided application and automated submission

Revision: 8 / S3-001 draft 1, reviewed by Claude 2026-11-15. Reviewed and planned in [plan.md](../S3-001-automated-submission/plan.md); queued for implementation after S2-001.

## Review decisions (Claude, 2026-11-15)

The requested scope and the delivery boundary in section 1 stand. These decisions settle proposals the draft left to review; where one narrows a proposal it says so.

| # | Decision | Reason |
| --- | --- | --- |
| R1 | Built and shipped in three phases: A questionnaire, storage and prefill; B proposal PDF and package; C API, test portal, browser runner, receipts and deployment. | The ticket is several times larger than any earlier one; each phase is testable and deployable on its own, and the spec already defines an "automation unavailable" state for the gap. |
| R2 | Runtime dependencies are accepted for this ticket: `playwright` (pinned to the installed test version) and `busboy` for bounded multipart intake. `pdf-lib` is vendored for the browser. | Sections 6 and 8 need a PDF library, a browser runtime and a streaming multipart parser; hand-writing a multipart parser is a needless risk. |
| R3 | The generated proposal uses the PDF standard Helvetica font rather than an embedded font. Characters it cannot encode block generation with a message naming the field. | Narrows section 6's proposal. Embedding a font needs a second library and a TTF file; the standard font meets the 11-point and pound-sign requirements. |
| R4 | The new stores are added to the existing organisation database as schema 2, in an upgrade that touches no existing store. | Section 7 asks for versioned migration, not a second database. |
| R5 | Same-origin enforcement compares the request's Origin host with its Host header, plus localhost for development. | The service has two public addresses; a single configured origin would reject one of them. |
| R6 | Cross-tab refresh by BroadcastChannel is not built. The transactional revision check and attempt lock, which section 7 calls authoritative, are. | Narrows an optional proposal. |
| R7 | Chromium is installed in the image at build time and runs with `--no-sandbox`; it loads only the loopback test portal with every other request blocked. | Required to run a browser as a non-root user in Cloud Run. |
| R8 | Cloud Run settings change in phase C: 1 GiB memory, 1 CPU, 180-second request timeout, still at most one instance. The new revision is deployed without traffic, tested, then given traffic. | Section 8's resource proposal. Docker is not available locally, so the image is proved in Cloud Build without risking the live site. |
| R9 | Section 12 is delivered as the disabled live capability, the readiness report and an empty portal-map template only. Nothing in the build, tests or deployment contacts Garfield Weston or Blackbaud. | Section 12's own boundary; no authorised applicant session exists. |
| R10 | The S2-001 names to integrate with are the repository module's `catalogue()`, `getBlob(id)` and profile operations as implemented. | Section 5 asked for reconciliation with the real exports. |

## 1. Goal, authority and exact delivery boundary

Build a manager-facing application workspace for **G-001: Garfield Weston Foundation Regular Grants**, with one-year operating/core support as the supported path. Collect the information once, prefill what is known, assemble the application documents, and execute a background browser-driven submission demonstration. The manager stays in our application and sees what was transferred and the resulting receipt.

The user's requested scope is agreed by the 2026-11-15 request. Funder choice, example project, exact screens, amounts, schemas and architecture below are proposed implementation defaults. This task asks ChatGPT to specify, not to implement or submit an application. 'Funder' is the grant provider; the charity is the applicant/grantee.

There are two distinct capabilities:

| Capability | Required delivery | Truthful UI/status |
| --- | --- | --- |
| Controlled automation demo | Complete working UI, real package generation, actual Playwright form filling/file uploads/review/submit/receipt against an isolated test portal | Demo submission completed — nothing sent to Garfield Weston |
| Real Garfield Weston connector | Implement adapter boundary, readiness checks and disabled capability; follow section 12 to discover/map/test live portal when access is available | Live submission unavailable until portal verification is complete |

**No public applicant submission API was verified.** Blackbaud's grantmaker API is not a substitute. Exact live selectors cannot honestly be supplied from the public guidance. Do not claim full live automation has been built/tested until section 12 evidence exists. Demo delivery must not depend on obtaining a real funder account. Conversely, a progress animation alone does not satisfy this ticket: the worker must manipulate actual DOM controls, upload bytes, submit and verify a receipt from the controlled target.

No AI model call is required. Use deterministic preparation and explicit manager review, with source suggestions. Do not claim to have read arbitrary uploaded PDFs or to have generated a substantive funding case using AI. The architecture keeps extraction/generation and submission adapters separate so a later model can replace the preparation engine.

## 2. Baseline precedence and requirement changes

This complete revision includes the preserved S2-001 baseline in Appendix A and the S1-002 Discovery extension in Appendix B. Sections 1–15 override conflicting placeholder/no-server-processing statements for this ticket only. Appendices' handoff/status text is historical. Current implementation/review corrections to S0-003/S1-001/S1-002/S2-001 must be reconciled, not reverted.

- REQ-005: G-001 becomes an editable application workflow. G-002/G-003 and any overridden other grants retain their existing planning cards, Abandon and an honest 'Application preparation not yet available for this funder' message.
- REQ-006: Tracking displays actual locally recorded **demo receipts**, never a fabricated real funder outcome. No award/decision-management feature is added.
- REQ-007/020: durable drafts, answer provenance, packages and receipts remain in browser IndexedDB. The selected package may be processed temporarily by our server only after the manager initiates automation. This is an explicit narrow override of S2-001's no-transmission restriction, not an automatic document-store upload.
- REQ-021: source catalogue is reused. No assumption of an implemented parser or remote model access.
- REQ-022: schema-driven manager questionnaire and review.
- REQ-023: attributed prefill, source conflicts, manual source evidence and missing-data handling.
- REQ-024: validated, immutable submission package.
- REQ-025: executable browser automation and specified internal API.
- REQ-026: run state, idempotency, interruptions and receipt/Tracking behaviour.
- REQ-027: live connector readiness, field mapping, human intervention and evidence.
- REQ-028: end-to-end verification and delivery evidence.

Keep YOR Plc, six stable grants, Discovery decisions, markers/brief, existing fonts/tokens, mobile support and document-store integrity. No multi-tenant authentication, live AI, scheduler, email integration, cross-device storage or background processing after the request/browser lifecycle is promised.

## 3. Manager journey and screens — REQ-022

### Entry and resume

Plan application on G-001 retains its current transition to `planning` and opens `#/planning/G-001/application`. Create at most one active draft per grant in this browser. Repeated navigation resumes it. The planning list shows draft stage, last save, missing items and Open application. Deep links to a grant not in Planning show a link back to its actual location; they do not silently change triage state.

Heading: **Prepare your Garfield Weston application**. Persistent small badge: **Demo**. Explain: 'Answer once here. We will prepare the documents and demonstrate transferring them into an application portal. This demo does not send an application to the funder.' Do not present the controlled portal as an official Garfield Weston service or embed its logo.

Use six sections with counts: Organisation; Funding request; Work and evidence; Finances; Documents; Review and submit. Desktop: compact section navigation and main form, source drawer to the right when opened. Phone: section selector above the form, source drawer as a labelled sheet. No chat UI or one-question-per-page wizard. All sections remain reachable; Next validates/highlights the current section but does not prevent saving incomplete work.

Actions: **Save draft**, **Review application**, **Back to planning**. Persist changes after 750 ms inactivity and on blur/Next/Review; show Saving, Saved with time, or Not saved with Retry. Explicit Save flushes. Read-only review and run states prohibit mutation of that snapshot. Keep an editable later draft separate if needed. Storage failure never silently creates a runnable unsaved application.

Status strip counts required fields as Missing, Needs review, Confirmed; counts are based on visible applicable fields, not every hidden branch. Every prefilled answer shows a source chip. Selecting it reveals origin, period, exact manually supplied excerpt if any, source link/document and confidence category. 'Suggested' is not 'verified'. Render text safely, preserve line breaks, and do not display numeric AI confidence scores.

### Review

Review shows the full outgoing answer set, finance totals, attachment names/versions/sizes, package hash and all warnings. Provide downloadable proposal PDF and 'View source notes' separately. Show missing information as linked errors. Show policy/declaration answers separately from narrative so they cannot be buried in prose.

Two deliberately unchecked controls are required: **I have reviewed these demo answers and documents** and **Run the demo transfer using this package**. The adjacent explanation states that selected answers/files are processed temporarily by our server, that nothing is sent to the real funder, and that originals remain in this browser. These controls authorise this run only; they are not real safeguarding/tax/privacy attestations. Edits invalidate both checks.

Primary action: **Run submission demo**, never Submit to Garfield Weston. Secondary: Edit answers / Download proposal. Show a collapsed 'Live submission' explanation with the unmet connector requirements; do not expose an enable-live toggle in the public demo.

### Progress and completion

After activation, show actual milestones emitted by the worker: Checking package → Preparing documents → Opening demo portal → Entering answers → Uploading files → Checking portal review → Submitting demo → Verifying receipt. Show completed/current/failed steps, timestamps and concise field-specific errors, without invented percentages. The app can navigate between its own hash routes while the fetch continues. Closing/reloading can interrupt; explain this before start.

Completion shows DEMO-prefixed reference, funder/programme context, submission time, snapshot revision, document list, and **View in Tracking** / **Download receipt**. Never show 'Awarded', promise an email, or imply that Garfield Weston received anything. A generated receipt is evidence of the controlled test portal only.

### Abandon and subsequent edits

Abandon preserves the baseline move to Passed but retains draft/package history; restoring and planning again resumes it. Do not erase documents or receipts. Disable Abandon during an active run with explanation. A completed receipt is immutable; **Create revised draft** clones answers into a new revision and resets confirmations. No automatic second submission. Historical bids remain separate; do not silently create a Past bid from a demo receipt.

## 4. Questionnaire schema and validation

These are our preparation questions, not a verbatim or exhaustive current portal schema. P = proposal input; C = candidate portal field requiring current mapping; I = internal preparation only. Values are stored by stable IDs, never by label text. 'Required' below means our supported demo path; do not attribute our stricter defaults to the funder.

General limits: short text 200 Unicode characters, address 500, narrative 4,000 per field unless specified. Trim outer whitespace for validation, preserve original formatting for editing. Count code points for UI limits; do not silently truncate. Money uses integer pence, nonnegative and no more than GBP 999,999,999.99; user input accepts comma grouping/GBP symbol but rejects ambiguous exponent strings and >2 decimals. Dates stored ISO calendar dates; timestamps ISO UTC, displayed Europe/London. Unknown is null, never 0 or No. App limits are not current portal limits.

| ID / question in our UI | Type and rule | Initial value/source | Destination |
| --- | --- | --- | --- |
| org.name — Organisation name | Required, read-only demo brand | YOR Plc; profile | C + proposal title |
| org.type — Legal status | Required enum registered charity / exempt / excepted / unknown | Unknown; manager chooses, with separate synthetic example option | C |
| org.charityNumber — Registration number | Conditional for real registered-charity preparation; text max 30 | Empty; never insert actual source charity number | C |
| org.companyNumber | Optional text max 30 | Current profile if manager entered | I; map only if live form asks |
| org.address / org.postcode | Required preparation address and postcode | Empty unless supplied by manager; synthetic fixture has demo address | C |
| org.website | Optional http(s) URL max 2,000 | Profile if present; do not invent real URL | C |
| org.overview — What does the organisation do? | Required 30–500 words | Profile overview, else seed paragraph below | P |
| org.geography — Where do you work? | Required text max 1,000 | London; Newham/East London only as a suggested scope for review | P / C |
| contact.firstName / lastName | Required short text | Empty; synthetic demo contact available | C |
| contact.role / employment | Required role; enum staff / volunteer | Empty | C |
| contact.email / phone | Required email and telephone, max 254/50 | Empty; synthetic contact uses example.org | C |
| request.type | Fixed supported value core | Operating/core costs | C / P |
| request.title | Required short text | Suggested: Housing stability and support — core services | I / P; C if present |
| request.amountMode | specified / funder discretion | specified, editable | I / C if supported |
| request.amountPence | Positive and <10,000,000 pence when specified | 5,000,000 pence = GBP 50,000; illustrative | C / P |
| request.start / end | Required funding period; end after start, max 366 days for supported one-year path | Suggested 2027-06-01 to 2028-05-31; not funder deadline or assurance | P / C if asked |
| request.reason | Required 50–350 words | Suggested paragraph below | P |
| work.need | Required 50–500 words | Suggested paragraph below; evidence still missing | P |
| work.activities | Required 50–500 words | Source profile plus proposed support activities; confirm | P |
| work.beneficiaries | Required 30–300 words | People experiencing homelessness or housing insecurity in London; review | P / C |
| work.annualPeople / request.people | Required positive whole numbers and period/method notes | Empty in source-based draft; synthetic example uses 250 for both | C / P |
| work.outcomes | Required 50–500 words | Suggested housing stability/engagement measures; no claimed past results | P |
| work.inclusion | Required 30–300 words | Empty until manager supplies practice or selects synthetic example | P |
| work.partnerships | Required 0–300 words or explicit None recorded | No named partners invented | P |
| work.leadership | Required 30–300 words | Empty; source documents/manual confirmation needed | P |
| work.caseStudy | Optional max 250 words | Empty; anonymised only, no identifiable resident data | P |
| work.videoUrl | Optional http(s) URL | Empty | C if supported; otherwise omit |
| finance.reportingEnd / historicalIncomePence | Required period and income for latest accounts | Empty; show old GBP 7.1m assessment snapshot as reference only | C / P |
| finance.incomeRows | At least one row: label, targetPence, securedPence, note | Empty or clearly synthetic budget below | P |
| finance.expenseRows | At least one row: label, amountPence, note | Empty or synthetic budget | P |
| finance.forecastStart / forecastEnd | Required one-year planning period | Same proposed period as request; manager confirms | P |
| finance.fundraising | Required 50–400 words, explain securing remaining funds | Suggested plan, not assertions of committed funding | P |
| finance.reserves | Required text 0–250 words or explicit None to explain | Empty; no unsupported reserves balance | P |
| finance.fallback | Required 30–300 words | Suggested phasing/service-priority plan; review | P |
| eligibility.previousApplication | yes / no / unknown; known answer required | Unknown; do not infer No from an empty local archive | C / I |
| eligibility.previousOutcomeDate | Required date if previously considered; allow pending/unknown branch | Empty; pending/unknown blocks live readiness | I |
| compliance.ukTaxResident | yes / no / unknown | Unknown; never infer solely from postcode | C |
| compliance.safeguarding | yes / no / unknown; explanation required if No | Unknown | C |
| compliance.safeguardingReviewed | Optional date, required for manager's policy confirmation | Empty; document date alone is not policy approval | I / C if asked |
| compliance.demographics | Structured manual facts plus unknown/not-collected explanations | Empty; actual live category mapping deferred | C |
| compliance.contactPermission | yes / no / unanswered | Unanswered; no automatic marketing consent | C if asked |
| evidence.accountsId | Required selected original PDF/DOCX + period and document kind | Matching store documents suggested, never silently selected | Upload |
| evidence.proposalId | Generated immutable PDF or selected replacement PDF | Generated from confirmed answers | Upload |
| review.demoReviewed / demoTransfer | Booleans, false until explicit action | False | I only |

Supported automation path is one-year core support. Project/capital/multi-year are visible as explanatory alternatives with a message that they need another template; changing to them must not run this adapter. Amount >= GBP 100,000 points to Major Grants and blocks this path. Funder-discretion mode permits null request amount and describes the financial gap in the proposal; the demo has a corresponding radio control. Live use of this mode requires a verified portal mapping; never enter 0 as a proxy.

Demo legal identifiers: do not generate plausible registration numbers. In the controlled portal a separate `syntheticApplicant=true` flag bypasses the numeric-registration rule, renders 'Demo organisation — registration not verified', and is never supported by live adapter. A source-based draft without genuine identifiers can therefore complete a demo with an explicit demo identity. Never select a real portal organisation named similarly to YOR Plc.

Finance validation: each secured amount <= its target; sum expense rows to E, target rows to T, secured rows to S; gap = max(0,E-S). Display both target surplus/shortfall (T-E) and current unsecured gap (E-S). Do not add the requested grant to secured income. Requested amount > gap is a blocking mismatch in this demo unless the manager corrects the forecast; this is our consistency rule, not a funder rule. Allow budget surplus with an explanatory note and funder-discretion mode; no negative expenditure. Revenue snapshot cannot be used as a proxy for forecast spend. Unknown prior decision dates/eligibility answers produce Needs review; a synthetic example can supply synthetic values only for the demo.

## 5. Prefill and example content — REQ-023

### Source precedence and immutable provenance

For each answer persist `{value, origin, sourceRefs, confirmedAt, editedAt}`. Origins: `profile`, `manager`, `manual-document-excerpt`, `historical-bid`, `suggested-draft`, `synthetic-demo`. Sources contain `{kind, recordId, documentId?, title, updatedAt, reportingPeriod?, locator?, excerpt?, synthetic}`. A URL/reference alone is not proof that its contents were extracted.

Precedence: current explicit manager edit > manager-confirmed imported fact > current organisation profile > unconfirmed source suggestion > demo default. Never overwrite an edited answer on render or after a new upload. **Refresh suggestions** computes differences and asks which individual changes to apply. If equally relevant sources disagree, show both with periods and require choice. Latest upload time does not establish latest accounting period. Successful past bids can inform structure; they do not establish current facts or consent. Unsuccessful bid text is not barred, but show outcome and feedback next to any suggestion.

Use S2-001 catalogue/Blob operations through a thin adapter; reconcile real exported names during Claude review. If S2-001 is not merged, implement a replaceable adapter returning the same shape plus explicit store-unavailable state. Do not fork a second organisation/document database or seed competing real records. Complete integration against actual S2-001 is required before calling the combined workflow finished.

Structured profile fields can be read directly. For arbitrary stored documents provide **Use information from a document**: choose source, download/view it using existing supported behaviour, paste the relevant excerpt, enter page/section and map it to an answer. Label **Manager supplied from document**. No automatic OCR/PDF parsing is in this ticket. Seed templates can have known structured demo facts bound to synthetic fixture IDs; expose their synthetic origin. Unknown uploads must never be 'understood' from filename alone.

Deleting/updating a source makes dependent unconfirmed suggestions stale; retain copied answer text and provenance but flag 'Source changed/removed'. Confirmation must be renewed before building a new package. Already completed package/receipt history retains its own copies; source deletion must not corrupt evidence of what was sent to the demo target.

### Default source-based prefill

Organisation overview:

> YOR Plc is a London-based charity providing housing and support for people experiencing homelessness. Its work focuses on helping people achieve greater housing stability and move towards independent living. This description is a starting point based on the demonstration profile; the funding manager should confirm the current services, locations and scale of delivery before using it in an application.

Request rationale:

> We propose requesting a contribution towards the general operating costs of YOR Plc's housing and support services for a twelve-month period. The contribution would support the shared resources needed to deliver consistent help to people experiencing homelessness, rather than fund one named post. The requested amount, funded period and expenditure allocation are illustrative until the funding manager confirms the budget and the organisation's priorities.

Need suggestion:

> People experiencing homelessness can need sustained support alongside accommodation to establish a stable home and access appropriate services. This draft proposes supporting that ongoing work in London. The application still needs current local evidence, an explanation of the particular barriers faced by the people YOR Plc supports, and a clear account of where existing provision falls short. The funding manager should replace this draft with evidence from the organisation's service records and verified local information.

These are editable suggestions, not submission-ready assertions. Do not send the instruction-like caveats as if they were a polished funding case; Review flags `suggested-draft` answers until the manager replaces/confirms them. A confirmation acknowledges the content, not external verification.

### One-click complete synthetic example

Provide **Load worked demo example** with a confirmation if any edited answers would change. Seed into the application draft only; never overwrite organisation profile or source documents. Repeating it is explicit and creates no duplicate records. All generated sample files and the proposal carry 'Synthetic demo example — not a real application or financial filing'. This gives a demonstrable complete route without manufacturing real charity facts.

Example values: YOR Plc; synthetic registered-charity status with no real registration number; Alex Morgan, Fundraising Manager, paid staff, `alex.morgan@example.org`, telephone `00000000000` accepted only by demo fixture; address 'Demo office, London', postcode E16 1AA marked illustrative; work region London; GBP 50,000 core request; 1 June 2027–31 May 2028; 250 annual beneficiaries and 250 planned reach, explicitly fictional. No website, real resident case study or real trustee names.

Use these synthetic forecast rows (GBP):

| Income source | Target | Secured |
| --- | ---: | ---: |
| Service contracts | 5,800,000 | 5,650,000 |
| Trusts and foundations | 700,000 | 500,000 |
| Donations | 300,000 | 200,000 |
| Other earned income | 200,000 | 150,000 |
| Total | 7,000,000 | 6,500,000 |

| Expenditure | Amount |
| --- | ---: |
| Overall staffing | 4,200,000 |
| Accommodation and utilities | 1,800,000 |
| Service delivery | 550,000 |
| Administration and governance | 250,000 |
| Training and evaluation | 100,000 |
| Total | 6,900,000 |

Current unsecured gap GBP 400,000; target surplus GBP 100,000; GBP 50,000 is not secured. Synthetic historical income GBP 7,000,000 for year ended 31 March 2026, distinct from the sourced earlier GBP 7.1m snapshot. Generate a short clearly watermarked PDF containing that historical example, not a purported audited document. Record `documentKind=synthetic-accounts-example`, `independentExamination=not-real`; live readiness must reject it.

For a complete example, author short original paragraphs using only these fictional assumptions: accommodation plus practical tenancy/budgeting/referral support; individual action plans and quarterly reviews; monitoring engagement and housing stability without invented success percentages; accessible appointments and resident feedback; referral relationships described generically, no real partner names; fictional management/governance experience described as illustrative; further fundraising to close the remaining gap; no planned reserves contribution; prioritising essential services if income is lower. Meet the questionnaire minimums without padding. Synthetic safeguarding, tax residence, no-prior-application and demographic answers must each be labelled illustrative and require manager demo review. Use 'not collected in example' where no demographic percentages exist. No assertion that this passes real portal eligibility.

## 6. Submission package — REQ-024

Separate editable draft from `SubmissionSnapshot`. On Review, flush saves, validate, freeze revision and copy selected evidence bytes in one IndexedDB transaction. Hash with SHA-256 before the transaction so it contains no awaited crypto/network work. Check source versions again at commit; if changed, abort and offer rebuild. Store the complete source/provenance manifest separately from outgoing fields. Package IDs are UUIDs; schema is `submission.v1`, adapter `garfield-weston-regular-core-demo.v1`.

Snapshot includes applicationId, grantId, revision, mode=demo, schema/adapter versions, capturedAt, normalised answers, origin flags, attachment manifest (role, filename, MIME, byte length, hash, source ID/version, synthetic), source notes, and review hash. Outgoing payload excludes internal fundraising notes, historical unsuccessful bid feedback, unselected sources and unnecessary contact data. Whitelist fields; never serialise the whole organisation catalogue.

Generate the proposal as A4 PDF, at least 11-point body, maximum ten pages including title/financial tables, no appendix. Proposed target 5–8 pages; no tiny fonts to make overflow fit. Sections: request overview; need and services; beneficiaries/impact measurement; inclusion/partnerships; team; income/expenditure tables; funding gap/fundraising; contingency. All content comes from confirmed answers. Footers carry demo marking and page numbers; provenance notes are a separate local view, not a proposal appendix. Do not insert raw HTML from answers. Escape content and disable remote image/font/URL fetching in rendering.

Proposed implementation: vendored browser PDF library such as pdf-lib for deterministic PDF generation with embedded permitted font, explicit wrapping/pagination and returned page count. Claude verifies compatibility/licensing and pins the dependency; record any replacement. Browser-native Print alone is insufficient because the runner needs deterministic PDF bytes. No external conversion service. Word generation is not required. A manually supplied proposal PDF can replace the generated one after manager confirmation of page count/font/layout, with a visible 'manager checked' attribute; inspect metadata/page count with an appropriate parser where available. Do not pretend an unchecked file is format-verified.

For demo transfer accept exactly one proposal PDF and one accounts PDF/DOCX, each <=10 MiB, aggregate <=20 MiB. These are POC limits, not asserted portal limits. Check extension/MIME/header coherence, nonempty bytes, expected hashes and totals; no archive expansion. S2-001 TXT samples are not valid accounts for this adapter: offer the separate synthetic PDF fixture or upload/select a real compatible file. Never rename TXT to PDF. Synthetic original document-store fixtures remain untouched.

The immutable snapshot owns copies of outgoing attachments, separate from source records. Count copies/generated PDFs against the existing 100 MiB aggregate local file budget. Delete unused superseded packages explicitly; never remove original sources. On quota failure preserve the draft, show required/free size when available, and do not start a run. The hash covers a documented canonical JSON of normalised outgoing answers plus ordered role/filename/MIME/size/hash attachment metadata and adapter version (UTF-8, recursively sorted keys, preserve array order, no timestamps/volatile run ID). Hash does not include itself. Server recomputes and rejects mismatch. Review confirmations bind this hash; any changed value/attachment requires a new review.

## 7. Data model, storage and integration — REQ-007/020/026

Extend the actual S2-001 IndexedDB with versioned migrations, not a destructive reinitialisation. Proposed new stores: `applications`, `submissionSnapshots`, `submissionFiles`, `submissionAttempts`, `submissionReceipts`. A unique application index covers grantId for the one-active-draft rule. Reconcile naming with implemented schema in plan.md.

Application: `{id, grantId, schemaVersion, draftRevision, answers, createdAt, updatedAt, lastSnapshotId}`. Attempt: `{id, applicationId, snapshotId, payloadHash, mode, state, step, events[], startedAt, endedAt, error?, receiptId?}`. Receipt: `{id, attemptId, applicationId, snapshotId, mode:'demo', reference:'DEMO-...', confirmedAt, adapterVersion, payloadHash, target:'controlled-test-portal', evidenceSummary}`. Events use monotonic per-run sequence and server timestamp; no document contents or passwords.

Use optimistic draft revision checks for concurrent tabs. BroadcastChannel can refresh other tabs, but transaction version checks are authoritative. Acquire an attempt lock transactionally; second tab cannot start another run for the same snapshot. A stale lock after reload becomes Interrupted/Unknown, never automatic retry. Duplicate final events upsert by attempt ID; no extra receipts. Browser-only receipt persistence remains the authoritative user-visible history, not server RAM.

Keep grant workflow `planning` after a demo receipt. Show Completed demo next to its planning card; Tracking reads submission receipts, not a new `submitted` value in the old grant-state enum. This avoids breaking existing v1 loaders. Abandon affects triage only. Tracking groups by application and shows individual attempt history without adding grant records. No real Awaiting decision status from a demo.

Attempts: `validating -> running -> demo_completed`; alternatively `failed`, `cancelled`, `interrupted_unknown`. `running.step` supplies milestones. A local draft can be `incomplete`, `needs_review`, `ready` derived from validation, not stored as a competing workflow enum. Live-specific states `awaiting_auth`, `awaiting_human`, `ready_to_submit`, `submitted_confirmed`, `submission_unknown` belong to the future live adapter and must never be reported by a demo as real outcomes.

Save final receipt/attempt state atomically. If that transaction fails, keep the result visible in memory, offer receipt download and Retry save; say 'Demo completed; receipt not saved in this browser'. Never rerun external submission merely to repair local persistence.

## 8. Internal API — REQ-025

These are proposed endpoints on **our Node service**, not Blackbaud endpoints. Current server accepts GET/HEAD only; extend routing deliberately while preserving static path checks, cache behaviour and PORT/0.0.0.0. No arbitrary URL or filesystem-path inputs. No durable server database or Cloud Tasks/PubSub is required for the controlled demo.

### GET /api/submission-capabilities

Return `200 application/json`, `Cache-Control: no-store`:

```json
{
  "schemaVersion": "submission.v1",
  "adapters": [{
    "grantId": "G-001",
    "adapterId": "garfield-weston-regular-core-demo.v1",
    "demoAvailable": true,
    "liveAvailable": false,
    "liveBlockers": ["Authenticated current form mapping not verified"],
    "maxFiles": 2,
    "maxFileBytes": 10485760,
    "maxAggregateFileBytes": 20971520
  }]
}
```

If Chromium/adapter cannot start, report demoAvailable=false with a reason; do not fall back to a fake successful run. Do not return environment secrets or filesystem paths.

### POST /api/submission-demo-runs

Same-origin only, multipart/form-data with bounded streaming parser. Parts: `manifest` (UTF-8 JSON <=256 KiB), `proposal` binary, `accounts` binary. Manifest includes only the snapshot's outgoing field whitelist, identity/version/hash, run ID, confirmed demo-review booleans, and attachment metadata. File content comes from IndexedDB when the user initiates this call. No source catalogue, user-provided destination URL, credentials, or live mode.

Request headers: `Idempotency-Key: <attempt UUID>`, `X-Submission-Schema: submission.v1`. Require browser Origin matching configured application origin (and explicitly configured localhost origin for development); no wildcard CORS. Use a custom header to force cross-origin preflight rejection. Limits: 21 MiB total body including metadata/overhead, 10 MiB each binary, <=2 files, <=90 seconds execution, bounded text lengths and <=100 finance rows. Reject excess while streaming, before full buffering. Restrict concurrent workers initially to one per instance; return 429/Retry-After when busy. Never enqueue unlimited runs. Document that no-login POC is not ready for confidential production applications.

The JSON manifest has exactly these top-level keys: `schemaVersion`, `adapterId`, `applicationId`, `snapshotId`, `draftRevision`, `attemptId`, `mode`, `syntheticApplicant`, `answers`, `attachments`, `payloadHash`, `review`. IDs are UUID strings; draftRevision is a positive integer; mode is the literal `demo`; syntheticApplicant is true for YOR Plc. `answers` is a nested object following section 4's dotted keys, with no provenance/excerpts/history. `attachments` is an ordered array (proposal then accounts) of `{role, filename, mimeType, sizeBytes, sha256, synthetic}`; each role appears exactly once and maps to its same-named multipart part. `review` is `{demoReviewed:true, demoTransfer:true, reviewedPayloadHash:<same hash>}`. Reject unknown keys, duplicate multipart fields, extra files, wrong ID/header equality and missing role bytes. Canonical form omits absent optional fields and retains intentional nulls. Do not stringify money or booleans in JSON. All SHA-256 hashes are 64-character lowercase hexadecimal strings without a prefix; `uuid` and `sha256-hex` in the event example below are explanatory placeholders, not valid literal inputs. The review hash also binds mode, syntheticApplicant and each attachment's synthetic flag.

Preparation-only budget inputs remain in the explicit API schema for validation but are omitted from portal mapping unless the target needs them; proposal PDF contains their financial tables. `review.*` never becomes a real-funder declaration. `compliance.demographics` has `{collectionStatus:'collected'|'not_collected'|'unknown', description:string}` in this demo, not guessed live equality-monitoring options. Include `compliance.safeguardingExplanation` (max 1,000 chars, required for No) and beneficiary-period/method notes as explicit schema properties in both validators. Do not depend on permissive object spreading. Live schema/mapping requires the actual programme's controls.

Validate headers, body schema, allowed adapter/grant/mode, answer constraints, file signatures/length/hashes and review hash before spawning Chromium. Only `mode=demo` is accepted; reject `live`, unknown adapter or target fields. Render all answer text as text, never executable HTML/JS. Our API is not an open browser proxy.

Errors before streaming: 400 malformed; 409 duplicate in-flight attempt/hash conflict; 413 size; 415 unsupported file/media; 422 field validation; 429 worker busy; 503 runner unavailable. Shape:

```json
{"code":"VALIDATION_FAILED","message":"Review the highlighted fields.","fieldErrors":[{"path":"request.amountPence","code":"REGULAR_LIMIT","message":"Use a request below GBP 100,000."}],"retryable":false}
```

On acceptance return `200 application/x-ndjson`, no-store, flush headers. The open HTTP response is the request-scoped job; 200 means stream accepted, **not submission success**. No job-ID polling endpoint or cross-instance routing dependency. Each newline is a JSON event, with UTF-8 streaming decoder supporting arbitrary chunk boundaries:

```json
{"seq":1,"type":"step","attemptId":"uuid","step":"validate","status":"complete","at":"2026-11-15T20:00:00.000Z"}
{"seq":2,"type":"step","attemptId":"uuid","step":"fill","status":"started","at":"2026-11-15T20:00:01.000Z"}
{"seq":9,"type":"completed","attemptId":"uuid","mode":"demo","receipt":{"reference":"DEMO-uuid","payloadHash":"sha256-hex","target":"controlled-test-portal","confirmedAt":"2026-11-15T20:00:03.000Z"}}
```

Every accepted stream ends with exactly one `completed` or `failed` terminal event then closes. Failure event includes code/step/fieldPath?/retryable/safeMessage; never stack traces/file content. After headers are sent use failure events, not fictitious changed HTTP status codes. Heartbeat at most every 10 seconds during long work, with no fake milestone advancement. Client treats EOF without terminal, malformed sequence/hash/attempt mismatch, network loss or request timeout as `interrupted_unknown`. Preserve snapshot and events.

Server holds a short-lived per-instance map of active attempt IDs/hash only, deletes within five minutes of completion and stores no durable private documents. It is not a global idempotency guarantee. Client lock plus deterministic DEMO reference avoids duplicate visible history. If an interrupted demo is deliberately retried, reuse the same attempt ID/hash, returning/upserting the same synthetic reference; another execution is harmless to the isolated target. Explain that this pattern cannot provide real-funder exactly-once submission.

Disconnect/Cancel aborts request-scoped browser tasks, closes context and temporary target. User Cancel before sending starts is cancelled; after sending may have begun, call it interrupted/unknown unless the worker confirms no submission. Never automatically retry a final live action under this design.

### Deployment and resources

Use a pinned Playwright runtime/Chromium combination in the image; the existing @playwright/test dev dependency is not proof browser binaries exist in Cloud Run. Add a runtime dependency as needed and install compatible system libraries/browser at build time, never download browsers on every request. Use the existing Node >=24 stack and document Docker/build changes. Proposed 1 GiB memory/1 CPU minimum and >=120-second Cloud Run request timeout, adjusted after measurement. Maintain explicit Google project/region/service and follow workflow IAM limits. A long asynchronous job after response would require a different durable worker architecture; do not implement it by fire-and-forget in Cloud Run.

Use memory or a request-specific directory under the OS temp root, opaque names, finally-cleanup on success/failure/disconnect/timeout, and startup stale-temp cleanup scoped to this service's prefix. No writes under public/, no user filenames as paths, no secrets/docs in application logs, no persisted browser profile. Bytes are temporarily processed by our service; do not call that browser-only processing. Nothing is uploaded to Blackbaud by the demo.

## 9. Executable controlled portal and adapter

Create an isolated **test portal**, explicitly a simplified model of the researched workflow, not a pixel clone or a claimed exact reproduction. It runs on a request-specific loopback HTTP listener bound to 127.0.0.1 with an unguessable token, accessible only to the worker. It is not an unauthenticated public route. In developer tests a visible version may be run locally; it must retain the DEMO heading.

Suggested controlled routes (owned by this project): GET `/portal/:token/start`; GET/POST `/portal/:token/organisation`; GET/POST `/portal/:token/request`; GET/POST `/portal/:token/compliance`; GET/POST `/portal/:token/documents`; GET `/portal/:token/review`; POST `/portal/:token/submit`; GET `/portal/:token/receipt`. Store state only inside this run. Add CSRF/session cookie handling to the fixture so tests exercise normal browser form submission, not a shortcut writing into its state.

Every control has an accessible label and an app-owned stable `data-field` equal to the canonical field ID. Exact selectors below apply **only to our controlled portal**. Prefix each page with `data-portal-version="gwf-demo-v1"`; validate heading/token/version before interaction. Financial/narrative detail is in the uploaded proposal; portal fields are the mapped summary/contact/compliance values. Field mappings are a versioned manifest separate from runner code:

| Page | Canonical keys transferred | Controlled DOM strategy |
| --- | --- | --- |
| Organisation | org.name/type/charityNumber/address/postcode/website; contact names/role/employment/email/phone; syntheticApplicant | `[data-field="<key>"]`; fill text, selectOption by stable enum, checkbox by explicit bool |
| Request | request.type/amountMode/amountPence/start/end/title; org.geography; work.annualPeople/request.people; finance.historicalIncomePence/reportingEnd | Text/date/number/select controls with same key; currency formatted as pounds without separators, not pence |
| Compliance | previousApplication/outcomeDate; tax residence; safeguarding/reviewed/explanation; demographics; contact permission | Explicit yes/no/unknown controls; hidden conditional fields only when applicable |
| Documents | proposal, accounts | `input[type=file][data-role=proposal]` and `[data-role=accounts]` |
| Review | all transferred fields and filenames/hash/size | Read-only text elements `[data-review="<key>"]`; file manifest rows keyed by role |
| Submission | demo transfer confirmation and submit | checkbox `data-field=demoTransfer`; button `data-action=submit-demo` |
| Receipt | reference, payload hash, receipt time, target, status | `[data-receipt=reference]` etc.; expected state `received-demo` |

Runner operations:

1. Validate payload; create immutable in-memory run context and token; start target; create clean Chromium BrowserContext, viewport 1280x900, locale en-GB, timezone Europe/London. No existing user profile.
2. Block every browser request except the exact loopback target origin. Disable service workers; deny popups/downloads except documented fixture behaviour. Do not allow user HTML, file://, external scripts, remote fonts or arbitrary redirects.
3. Navigate Start; assert DEMO identity/version. For each mapped field assert exactly one visible enabled control, apply type-specific action, then read inputValue/isChecked/selected option and compare normalised expected value. Zero/multiple matches = `PORTAL_SCHEMA_CHANGED`, never choose nth arbitrarily.
4. Click actual Next controls, wait for the expected next page heading and validation completion. Do not use fixed sleeps as success criteria. Retry a failed read/navigation at most twice before submission with bounded delay; never blindly replay a Next that may have created a record.
5. Upload using `locator.setInputFiles({name,mimeType,buffer})`. Wait for fixture's uploaded acknowledgement. The target computes actual SHA-256/byte length of received files; compare its review manifest to the original. Merely selecting a filename is insufficient. Keep file upload failure visible and do not proceed with missing documents.
6. Compare all portal review values, amount conversion, period, explicit booleans and both attachment hashes. Target must independently reject invalid/missing fields and a review hash mismatch. Extra required field, changed enum or DOM version causes a stop. Known source provenance is checked on our side, not typed into unrelated portal fields.
7. Emit `review complete`. Assert demoTransfer authorised for this exact hash and target is controlled; mark `submit started` before clicking once. Use normal form POST; do not call the target's internal storage methods or fabricate a receipt in worker code.
8. Fixture submit endpoint validates again, writes exactly one receipt for the attemptId/hash in its isolated state and redirects to Receipt. A conflicting hash for an existing attempt returns conflict. Reference is `DEMO-<attemptId>`.
9. Runner reads receipt DOM and verifies reference, state, target and payload hash. Only then emit completed. Request HTTP 200 alone, disappearance of a spinner or a dashboard redirect alone is insufficient.
10. Close context/browser and loopback listener and clear temporary files in finally. Record only safe metrics (duration, step, result code). Do not persist full-page screenshots containing uploaded real data by default. Test evidence uses synthetic fixtures.

Use `AbortSignal` checks between actions and a 90-second total deadline. Proposed per action timeout 10 seconds, upload timeout 20 seconds bounded by total. Browser crashes, target errors and validation mismatch produce distinct codes. Max two read/navigation retries, no final submit retry without receipt reconciliation. Tests inject missing labels, upload rejection, final-response loss and receipt mismatch.

Do not start an LLM-driven browsing loop. Deterministic mapping is reproducible and testable; a later model may suggest mappings, but an unverified guess must not become a live final submission.

## 10. UI errors, recovery and accessibility

| Condition | Manager sees / next action | Data effect |
| --- | --- | --- |
| Missing current facts | Linked Missing/Needs review list | Incomplete draft saved; no package/run |
| Source changed/deleted | Source warning; confirm or replace | Existing answer text retained |
| Document store unavailable | Store not ready; retry or use explicit synthetic example | No false claim of reading uploads |
| Quota/save failure | Not saved; retain inputs; free space/retry | No run from unsaved snapshot |
| Runner unavailable/429 | Automation unavailable/busy; Retry | Same snapshot retained; no success |
| Field/upload rejection | Failed at named step/field; Edit or retry where safe | Receipt absent |
| Schema drift | Portal mapping needs update | Stop before submit; no guessed mapping |
| Stream disconnect/reload | Demo result not confirmed; deliberate retry available | No real submitted/awaiting-decision state |
| Receipt mismatch | Verification failed, outcome unknown | Preserve evidence; no completion receipt |
| Completed but local save failed | Download receipt, Retry save | Do not rerun |

Keep focus at error summary then links to controls; native labels, fieldsets for grouped radios, aria-describedby for source/help/error, polite live announcements for meaningful steps only. Keyboard-operable drawer/dialog with focus return. Readonly states remain readable. At 360/390/1280 px, narrative/budget tables adapt to cards/stacked rows with no page overflow. Confirmations and targets at least 44 px. Preserve verified Urbanist/Lilita One and purple/lime styling. Respect reduced motion. Application readiness cannot be conveyed by colour alone.

## 11. Adapter interface and future agent integration

Implement modules with responsibilities separable in tests (names illustrative): `application-schema`, `application-repository`, `source-prefill`, `proposal-builder`, `submission-client`, server `demo-runner`, `demo-portal`, `adapters/gwf-demo`, `adapters/gwf-live-readiness`. Use current vanilla JS/Node modules; no framework rewrite.

Adapter contract:

```ts
interface SubmissionAdapter {
  describe(): { id: string; version: string; mode: 'demo'|'live'; readiness: string };
  validate(snapshot: SubmissionSnapshot): ValidationResult;
  inspect(context: BrowserContext): Promise<PortalFingerprint>;
  prepare(snapshot: SubmissionSnapshot, context: BrowserContext,
          emit: (event: RunEvent) => void, signal: AbortSignal): Promise<PreparedReview>;
  compare(review: PreparedReview, snapshot: SubmissionSnapshot): ComparisonResult;
  submit(review: PreparedReview, authority: SubmissionAuthority,
         signal: AbortSignal): Promise<SubmissionOutcome>;
  reconcile(identity: ExternalApplicationIdentity): Promise<SubmissionOutcome>;
}
```

`SubmissionAuthority` binds mode, adapter version, application identity, snapshot hash and explicit current review action. `SubmissionOutcome` is confirmed / rejected / needs-human / unknown, never just boolean success. Demo implements the full contract; live-readiness responds unavailable until section 12 is fulfilled. Calling live prepare/submit while unavailable returns a typed `LIVE_NOT_CONFIGURED` error before navigation or network mutation, not a fake receipt.

Future AI receives a source catalogue and answer schema through separate preparation interfaces. Its proposed answers must include citations/unknowns and remain unconfirmed. Document instructions are data, not authority to change destinations, execute commands, supply credentials or submit. Browser transport consumes only the approved typed snapshot. A different funder adds a distinct question schema/mapping/adapter; it must not reuse Garfield Weston's selectors or validation blindly.

## 12. Real portal integration: precise discovery and activation contract — REQ-027

This section is a concrete implementation handoff for a subsequent authorised live session, not a claim the authenticated portal was researched. The public demo stays live-disabled. Implement the readiness report and mapping validator now; completing the real adapter needs the following evidence. If unavailable, record the exact missing items and ship the controlled demonstration with honest status.

### Access and deployment distinction

Start live discovery using a local headed Playwright session controlled by the authorised applicant. Use the current programme link from the funder's official site, not a search-result advert. Let the user authenticate directly; do not ask them to paste passwords, cookies or MFA codes into our questionnaire. Session state remains in local process memory by default, never in the repo or public site. Do not attempt CAPTCHA/MFA bypass. If a persistent session is later needed, design encrypted credentials/session retention separately.

The current public unauthenticated Cloud Run app must not gain a live submission endpoint merely because a local adapter works. Hosting live runs needs authenticated organisation ownership, secret/session isolation, durable attempt ledger/queue, retention and access controls in a separate implementation plan. A local authorised proof can be delivered first. Do not claim cross-device unattended operation from local session success.

### Portal-map evidence file

Create ticket-local `portal-map.md` (redacted) and machine-readable private/runtime mapping as appropriate. For every visible/current field record: exact page/section, canonical ID, label and accessible role, input type, required condition, allowed values and actual option values, max length, format, attachment cardinality/types/limit, locator, stable parent scope, and evidence date. Include eligibility branches, demographic branches, declarations, terms version, organisation lookup and signature requirement. Record missing fields as UNMAPPED; do not populate guesses from the 2024 form.

Also capture: current programme name and ID, funder/tenant identity, accepting-applications indicator, login redirects/domains, organisation search/selection behaviour, save/auto-save triggers, draft external ID/resume URL, review behaviour, final submit label and confirmation prompt, receipt/status evidence, cookie/CSRF handled by browser, session timeout and known anti-automation restrictions. Screenshots/traces for actual organisation data stay private and redacted from repository; credentials are never captured. Record whether website terms/funder permission allow the intended automation; lack of verification is a readiness blocker, not a licence to bypass controls.

Map confidence is binary for execution: verified from current screen or unavailable. Locator preference: unique getByRole/getByLabel scoped to the correct section; stable documented attributes next; reviewed CSS only when necessary. No placeholder real selector strings that look executable. Changes in field count/labels/required conditions/enum options/funder identity invalidate the approved fingerprint and stop before mutation.

### Exact real-run sequence after readiness

1. Revalidate current guidance and eligibility; confirm real legal organisation identity, current accounts, funding request, prior-application timing and truthful compliance answers. Demo brand/synthetic flags/files prohibit live mode. Preparation may be exported to a separate real applicant profile; do not change YOR Plc branding silently.
2. Authenticate in applicant-controlled session. Verify account and current programme/funder identity. If login/MFA/consent/organisation vetting is needed, pause and resume only after the user completes it.
3. Search/select organisation using verified registration identity and legal name, comparing both with approved snapshot. Multiple/missing matches pause; never register an organisation or select closest name automatically.
4. Inspect My Applications/existing drafts before creating anything. Match saved external draft ID first; otherwise present candidate matches for human choice. Record external ID/resume URL immediately after creation. Creating a draft or filling an autosaving field writes to the real funder; require authorisation to transfer before the first such operation, not merely before final submit.
5. Complete current eligibility branch from confirmed answers. Any unknown or disqualifying answer stops. Never answer Yes solely to reach the main form.
6. Use verified field manifest to populate all applicable controls and upload only the approved files, verifying saved values/filenames/status and actual limits. Required unmapped controls produce needs-human with a question in our preparation UI. Do not fill sensitive demographic or policy answers using inference.
7. Reopen/read back the saved draft and compare all fields and attachment evidence. When server exposes no file hash, record the weaker evidence (filename/size/upload acknowledgement) rather than claiming hash verification. If signature or final declarations are required, collect human action; do not fabricate a signature.
8. Display final portal-derived review in our UI with the actual target and final payload version. Require specific authority to send that reviewed real application. Authorisation expires on any payload/terms/account/programme change. User's request for this spec is not real-send authority.
9. Before final click, persist durable `submit_intent` including applicant/programme/external draft ID/hash/time and take a transactionally unique attempt lock. For a local prototype use an access-restricted local durable ledger; for hosted production use transactional backend storage. This is deliberately more stringent than the stateless demo API.
10. Click the verified final submit action once. Confirm the correct external application transitioned from draft to submitted/awaiting review with matching ID and a receipt/reference on the portal. A confirmation email is supporting evidence if explicitly connected later, not an automatic reason to read/send email in this ticket.
11. On timeout or lost response after click, set `submission_unknown`. Reopen the same draft/application read-only and reconcile status/reference before offering any retry. A draft may still have been submitted; never create a replacement to escape uncertainty. If still ambiguous, require funder/user reconciliation. No guarantee of exactly-once external effect without funder cooperation.
12. Store final real reference/time/evidence and immutable package locally or in the subsequently approved secure backend. Only then show submitted confirmed. Receipt is not eligibility confirmation, an award or a funding decision.

Stop on unexpected domains, changed questions, additional required documents, application closure, CAPTCHA, policy restrictions, uncertain identity, unavailable current accounts, unknown compliance answers, signature requirements or uncertain outcome. Preserve safe draft progress and report the exact condition. No private HTTP endpoint replay, reverse-engineered CSRF submission API, email fallback or hidden-site bypass.

### Live readiness checklist and honest completion criteria

Required gates: applicant authority; permitted automation; current authenticated mapping; verified eligibility; non-synthetic identity/content; reviewed documents; verified organisation/programme; credential/session isolation; durable duplicate-prevention ledger; final review authority; receipt/reconciliation test evidence. `liveAvailable` remains false while any gate is absent. A mock cannot satisfy a live mapping gate. Dry-run evidence must state whether it merely inspected, filled an autosaved real draft, or reached review; never call those 'no external changes' if autosave happened.

## 13. Test matrix — REQ-028

Claude supplies plan.md mapping each row to actual test files/evidence. Run meaningful tests against the implemented behaviour, not assertions that mirror static config. Keep existing regression coverage and update placeholder assertions only where this ticket explicitly replaces them.

| Case | Required evidence/result |
| --- | --- |
| G-001 entry/resume | One application, stable IDs, saved answers survive reload; other grants unchanged |
| Profile suggestions | Seed profile used; current manager edits win; no real charity identity in shipped defaults |
| Document integration | Real catalogue/Blob retrieval; manual excerpt attribution; missing/deleted/updated/conflicting sources handled |
| Incomplete draft | Save allowed; required/unknown fields block review readiness; no invented compliance answers |
| Worked example | All values explicitly synthetic; complete demo without real credentials/identifiers; budgets total correctly |
| Amount modes | Zero/negative/100000 rejected when specified; 99999.99 accepted if within gap; discretion not converted to zero |
| Finance | Integer pence; S<=T by row; correct totals/gaps; request not secured; period mismatch surfaced |
| Package | Actual PDF parses, A4, >=11-point body, <=10 pages; long text/budget overflow blocks; unicode/pound signs render |
| Source/byte integrity | Attachments retain exact hashes after copying/reload/transfer; unsupported TXT not renamed |
| Snapshot authority | Answer/file edit changes hash and clears review; stale source revision aborts commit |
| Storage migration | Prior grants/profile/bids/documents unchanged; quota/transaction rollback; blocked upgrades safe |
| Concurrency | Double click/two tabs one attempt; version conflict preserves edits; duplicated event one receipt |
| API schema/limits | Malformed/missing/unexpected fields, oversized streams, mismatched hashes, wrong origin/mode/adapter rejected before worker |
| Browser proof | Real Chromium fills forms, uploads actual bytes, navigates/reviews/clicks; fixture receives correct payload and returns receipt |
| Negative automation | Missing/duplicate locator, new required field, upload failure, wrong receipt hash cannot report completed |
| Transport | Fragmented NDJSON/UTF-8, timeout, cancellation, browser crash, interrupted terminal and 429 handled honestly |
| Cleanup/isolation | Parallel attempts cannot see each other's state/files; temporary target/temp directory/browser closed after every exit |
| Network boundary | Demo browser cannot contact external hosts/file URLs; payload cannot set target or execute code |
| Receipt persistence | Save failure offers download/retry-save; reload never silently resubmits; revised draft keeps old receipt immutable |
| Tracking | Clearly labelled demo records only; no awards/real awaiting-decision/past-bid mutation |
| Accessibility/layout | Keyboard flow, focus/error links, source drawer, responsive budgets and progress at 360/390/1280 px |
| Deployment | Browser binary works in built container and Cloud Run; capability endpoint/stream/PDF upload/receipt verified against live app using synthetic data |
| Live boundary | Public endpoint rejects live; readiness lists missing map/session gates; no funder traffic or real portal mutations |

Use Node unit tests for pure validation/hash/mapping/state, Playwright for actual IndexedDB, manager UI and runner integration. Controlled portal test harness must support fault injection only in test configuration, not request-supplied arbitrary production scripts. Include network assertions that no real funder/Blackbaud domain is contacted by the demo. Record duration/peak memory for representative package and upper-bound file sizes; tune limits based on measurements.

Evidence set: 1280/390/360 screenshots of prefilled form/source chip, missing-info summary, finance table, review, in-progress and completed Tracking; generated synthetic PDF checked page-by-page; test report; safe runner event log and controlled receipt showing matching hash; deployed synthetic walkthrough. Redact real user documents from evidence. Do not run any live final-submit test as part of automated CI.

## 14. Implementation order and handoff

1. Reconcile latest document-store exports/schema and Discovery changes; write ticket-local plan, record proposed defaults accepted/adjusted. Preserve all unrelated work.
2. Build answer schema, IndexedDB repository, source adapter and manager screens; test incomplete/edited/conflicting data.
3. Build deterministic proposal/package and worked example; verify PDF and byte integrity.
4. Build controlled portal and real Playwright adapter; prove transfer/receipt and negative paths before connecting the UI.
5. Add bounded API/stream, client progress and receipt/Tracking integration; handle loss/cancellation/storage/concurrency.
6. Add live-readiness boundary and documented portal-map validation; keep actual live disabled absent authenticated evidence.
7. Run full appropriate regression/integration/UI checks, record actual results, commit/push/deploy under docs/workflow.md and check the deployed controlled demo. No external funder submission in shipping steps.

Delivery report must distinguish UI/package completed, controlled automation verified, source-store integration verified, and real connector unavailable/verified. Do not use a single 'automation done' claim for all four. Explain any dependency blocker explicitly, with existing working portions retained.

## 15. Decisions, assumptions and unresolved external facts

Requested: one selected funder, central questions, known-data prefill, source-store reuse, automated background submission demonstration and detailed implementer handoff. Proposed: G-001/core/one year, controlled target, temporary server processing, schemas/limits and illustrative budget. The existing demo identity and no-live-AI rules are preserved.

External unresolved facts: current authenticated portal questions/branches/locators; exact upload constraints; live applicant identity/authority/session; permission for intended automation; final submission/receipt behaviour for this programme. Research does not establish these. They prevent a verified real submission connector, not the specified demonstrable build. No clarification is needed to write this spec or implement the controlled demo. Do not recast a request for a thorough specification as authority to register accounts or send applications.

## Appendix A — Complete S2-001 baseline

The following preserved baseline is historical where sections 1–15 explicitly override it. In particular G-001 preparation/demo submission, demo Tracking and temporary processing now replace its placeholder/no-transmission exclusions.

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



## Appendix B — Complete S1-002 Discovery extension

Preserve this independently requested extension and the latest reviewed predecessor fixes; it is not superseded by the submission feature. Historical status statements inside this appendix do not establish current delivery.

# Sprint 1: Discovery demo completion specification

Revision: S1-002 draft 1 | Updated: 2026-11-15 | Status: specified for Claude review. S1-001 is in progress per user report; its final reviewed implementation must be reconciled before building this extension.

This complete specification carries forward the on-disk S1-001 baseline, replaces REQ-016 with the editable AI-discovery brief, and incorporates the verified visual section from S0-003 revision 5.1. S1-001 and other parallel tickets remain independently owned; inspect their latest reviewed specs/code before implementation and record reconciliation rather than reverting their corrections. This ticket does not replace separate Sprint 2 work. Sprint 1 explicitly revises the no-discovery-control baseline; no live discovery or background agent is implemented. Earlier scope and acceptance criteria remain in force except those explicitly revised below.

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

### REQ-016: AI-style discovery driven by an editable brief (S1-002)

Agreement: user requested a new ticket on 2026-11-15 to evolve Discover into an AI-style flow, with a natural-language criteria textbox prefilled from the existing charity profile. Manual and future background discovery use the same brief. The user confirms Claude is reviewing/fixing/implementing S1-001, so its final reviewed behaviour may differ from the earlier draft. This ticket extends that work, not a request to revert it. Detailed copy, persistence and loading choices below are proposed implementation defaults.

#### Editable discovery brief

At the top of Discovery, show one compact panel headed **AI discovery**, containing a visible label **What funding are you looking for?**, an editable multiline textarea and a primary **Discover with AI** button with a small sparkle icon. Replace the existing Discover control; do not add a second discovery button or a chat conversation UI. Keep the panel available across New, Watchlist and Passed. Use existing styling, legible body text, responsive width and a roughly 5-7 line textarea on desktop, naturally wrapping/scrolling on phone. This is the main way to guide discovery, not a new table filter.

Pre-populate the actual textarea value (not placeholder text) with this proposed paragraph:

> Find grants for YOR Plc, a London-based charity providing housing and support for people experiencing homelessness, with annual income of approximately GBP 7.1 million. Look for funding for homelessness prevention, accommodation, support services and projects that help people move towards independent living. Include core and running costs, project funding and capital improvements where the fund permits them. Focus on programmes that support work in London or across England and accept charities of our size. Flag funds whose income limits or project-location requirements make us unsuitable, and explain why. Include rolling programmes and opportunities that are open or opening soon. For each opportunity, show the funder, available amount, opening and closing dates where known, a source link and a short explanation of fit; distinguish confirmed eligibility conditions from points that need checking.

The London housing/support profile and approximately GBP 7.1m income come from the existing demo evidence, not a new verification of current accounts. The wider wording is proposed search guidance, not a claim that every listed activity or funding category is a verified organisational fact. Do not invent a target award minimum, maximum, staff count or other organisational constraint. Use YOR Plc in shipped defaults as required by the existing demo-identity decision; the user's reference to Your Place identifies the source profile. User-entered wording is not forcibly renamed.

Helper copy: **Describe your sector, location, organisation size and funding priorities.** Add a restrained **Demo** label and: **This demo uses sample grants. In the full service, AI discovery will use this brief for both manual searches and automatic background searches.** Do not suggest automatic discovery is active now.

#### Saving and using the brief

- Save edits locally as the manager types (a short debounce is acceptable). On Discover, capture and save the latest text even if a debounce has not fired. Navigation/reload retains it; ordinary rendering must not overwrite it with the default.
- Apply the prefilled paragraph only when no brief has ever been saved. Preserve intentional empty edits, then show a linked inline validation message on an empty/whitespace-only submission: **Enter your discovery criteria first.** No run or grant mutation occurs for invalid input. No extra Save/Reset button is required.
- Store the brief as an optional addition to current browser-local data or a compatible separate key; preserve grant decisions, overrides, existing filters and discovery freshness. Missing brief data must not trigger a whole-state reset. Existing unavailable-storage notice/in-memory fallback applies; do not claim durable saving if it fails.
- At activation, capture an immutable run snapshot of the entered brief. The mock discovery function receives it as input. The future manual/background implementation should read the same saved criteria, with each run capturing its own snapshot; do not create a separate background prompt or implement a scheduler/API now.
- During a run, disable the submit button and make the textarea temporarily read-only so the submitted criteria are unambiguous. Re-enable on completion or error. Prevent duplicate runs. Do not insert user text as HTML.

#### Simulated AI run and results

- Clicking the button visibly enters a short **Discovering grants...** state with a spinner and an accessible status announcement. Suggested duration is about 1 second, bounded around 0.8-1.5 seconds for the demonstration; respect reduced motion and avoid fake progress percentages or claims about websites/models actually contacted. This deliberately supersedes S1-001's instant-only presentation if implemented.
- Pass the captured brief to a local mock operation, then use S1-001's reviewed discovery-result behaviour: reuse existing grants, mark the discovered result **New**, reveal the relevant result and retain stable IDs, counts, workflow decisions and overrides. Do not duplicate six grants, move all records back to New, or clear the board before the run.
- The complete existing grant collection remains available through its workflow tabs and existing suitability filter. The request to show grants is not a new instruction to override the user's filter, remove previously rejected grants, or reset Planning. No extra criteria filtering, ranking, prompt parsing or regenerated suitability assessments is implemented in this POC.
- Completion copy should explain the result in demo terms, for example **Demo discovery complete - 1 grant marked as new.** Beside the panel keep **Sample results are fixed in this demo; editing the brief does not change the grant selection.** This makes the brief-driven future workflow clear without pretending the mock understands arbitrary text.
- Retain S1-001's reviewed handling if no grant is eligible for demo rediscovery; report the actual no-result condition without claiming a grant was found. A failed mock run reports a concise retry message, keeps the brief and existing grants, and returns controls to idle. The loading state is transient: a reload preserves the brief and completed state but must not leave the UI stuck busy or restart a run automatically.
- No external AI integration, credentials, live search, network submission of the brief, periodic polling, scheduler, background worker, accounts or shared storage is added. No automatic run on initial load or on every edit.

#### Acceptance and verification

1. A fresh browser displays the editable default paragraph, label, helper and one Discover with AI control; existing grant views and timing markers still work.
2. Editing, navigating and reloading retain the exact brief (including line breaks); a saved empty brief stays empty and is rejected on submit without changing grants.
3. Discover passes the latest non-empty brief to the mock exactly once, even if clicked repeatedly or before persistence debounce fires; a visible busy state announces progress and ends cleanly.
4. Successful runs retain S1-001's reviewed uniqueness, discovery marker and decision-preservation behaviour; no-result and error paths announce truthful outcomes and re-enable controls. Arbitrary edits do not silently change canned grant selection or suitability.
5. Existing saved state lacking brief fields loads without losing triage/overrides/filter/freshness. Unavailable storage still permits editing and discovery in memory with the existing notice.
6. No brief is sent to an external service, and no run occurs on load, edit or reload. The manual mock consumes the saved-brief snapshot; background use is explained as future functionality.
7. Check keyboard use, visible labels/focus, status announcements, reduced motion, long text and no horizontal overflow at 360/390/1280 px. Provide screenshots of populated idle, edited busy and completed results. Run relevant state/DOM regression tests and record actual results, not planned outcomes.

This expands REQ-016 and REQ-007 rather than allocating new IDs; REQ-008 and REQ-010 cover its accessible presentation and validation. REQ-015 and earlier reviewed functional behaviour remain unchanged.
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

Verified from the reference stylesheet (see research): headings use a custom font with Lilita One as the declared fallback; body text uses Urbanist at weight 600. The custom heading font belongs to the charity and must not be copied. Use **Lilita One** for page headings, prominent section titles, the wordmark and primary button labels, and **Urbanist** (600 normal, 800 bold) for body copy, navigation and table text. Do not leave system-ui as the designed primary font. Bundle the font files with their Open Font License texts, make no external font requests, use font-display: swap and retain legible fallbacks.

Use display headings in uppercase with 0.05em tracking (the reference value); approximately 36-44 px desktop and 28-32 px phone. Body is 16 px with 1.5-1.6 line height. Grant titles remain readable sentence-case, 18-20 px in bold body type. Do not use decorative lettering for long suitability explanations. Verify both actual font loading and the computed family after loading.

### Colour and shape

Create shared CSS tokens using the values verified from the reference stylesheet: purple #442C86; lime #D7DB2D; navy #232551 (text on lime); coral #ED6A53; orange #EA720D; teal #00959A; light teal #87C0CA; light lilac #F5F3F8 for panels; body ink #262626; white surfaces. These replace the earlier muted palette. Purple and lime are the dominant brand pairing; coral/orange and teal/lavender are supporting accents, not six competing row colours.

Use navy or purple text on lime and white text on purple. Test normal text contrast >=4.5:1, large text >=3:1 and controls/focus indicators >=3:1 against adjacent colours. Do not assume white text on orange/coral or lime is accessible. Preserve distinct suitable/unsuitable semantic icon-plus-text badges; they need not use the brand accent colours.

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

## Current S1-002 handoff

Claude reviews this ticket against the latest S1-001 implementation and records any reconciliation in ticket.md. Implement using the current static frontend and existing state/test tools under docs/workflow.md; no new model SDK or backend required. The specification task changes documentation only. Earlier S0-003 delivery notes are historical, not this ticket''s shipping instructions.


