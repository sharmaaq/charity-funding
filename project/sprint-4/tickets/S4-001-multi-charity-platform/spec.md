# S4-001: Multi-charity platform

Revision: 1. Date: 2026-11-20. Written by Claude from the user's requirements given in chat on 2026-11-20 (the user asked Claude to review, ask questions and plan; ChatGPT did not draft this spec). Status: awaiting user approval of the plan.

This ticket carries forward the delivered application (S0-002 to S3-001 Phase C) unchanged except where a section below says otherwise. Where this spec and an earlier spec disagree, this spec wins.

## 1. What the user asked for (agreed, 2026-11-20)

1. The app becomes a platform hosting several charities. Everyone uses the same site and the same workflow; content and look are per charity.
2. **Sign-in is required.** The site stops being public. A Google account is needed to reach it, and that Google account decides which charities the person sees.
3. **Membership.** A charity has any number of members. A person may belong to several charities and can switch between them. The browser remembers the last charity used and opens on it next time.
4. **Strict separation.** A signed-in user only ever sees data for charities they belong to. All data is stored separately per charity.
5. **Server-side state.** All state moves from the browser to the server. Old browser data is cleared, not migrated.
6. **Demo charities.** Two are seeded: **Your Place** (the current demo charity, renamed from "YOR Plc" everywhere) and **Our Time**, based on https://ourtimecharity.org.uk. The user will onboard a third charity themselves through the admin page.
7. **Admin.** The user is the only admin at first. Admin accounts are configured in code/configuration and change only through a deploy. The admin can open any charity, onboard new charities and manage their members.
8. **Onboarding without code.** Adding a charity needs only its name and website address. The platform proposes a look for it (colours, fonts, wordmark, logo) and the admin can adjust it. No code change or deploy is needed to add a charity or change its look.
9. **Real AI discovery.** Discover calls a Gemini model on Google Cloud (using the project's Gemini credits). The model receives the charity's organisation information **plus** the text in the discovery box, which adds to it rather than repeating it. Results appear as the current opportunity cards and the rest of the workflow is unchanged.
10. **Draft only.** Nothing is ever submitted automatically to any funder. Submission is only ever done manually by a person. This extends S3-002's draft-only principle to the whole platform.
11. **Your Place keeps** its six seeded grants and the Garfield Weston (G-001) application workflow and demo.

## 2. Decisions taken by Claude (proposed; the user approves them with the plan)

| # | Decision | Reason |
| --- | --- | --- |
| D1 | Sign-in through **Identity-Aware Proxy (IAP) on Cloud Run** with a custom OAuth client, access granted to all signed-in Google accounts. The app then admits only accounts that are members of a charity or admins; anyone else sees "Your account is not set up for any charity". | Unauthenticated requests never reach the app, so even static files are protected. Granting all authenticated accounts at the IAP layer means adding a member is an in-app admin action with no IAM change. A custom OAuth client is required because the Google-managed client only admits users inside the Cloud organisation and the user's account is a Gmail account. |
| D2 | Fallback if IAP cannot be enabled for this project: in-app Google Sign-In (Google Identity Services) with server-verified ID tokens and an HTTP-only session cookie. Cloud Run stays publicly invocable but the server rejects every request without a valid session. | Same user-visible result; used only if D1 fails during setup. |
| D3 | **Firestore (Native mode)** for records; **one private Cloud Storage bucket** for file bytes. | No idle cost, the demo stays within Firestore's free tier, transactions support the existing revision checks. Cloud SQL costs about £8 to £10 a month even when idle. Plain files are unsafe because a Cloud Run container's disk is wiped on restart, and a mounted bucket has no locking. |
| D4 | Gemini through **Vertex AI** from the server using the Cloud Run service account (no API key), with **Grounding with Google Search** so results are current, real and cite their sources. The model name is configuration (`GEMINI_MODEL`); the implementer chooses the current Flash model that supports grounding, verified by a live call. | Uses the project's credits, no secret to manage, grounded results with sources. |
| D5 | Admin accounts are listed in the Cloud Run environment variable `ADMIN_EMAILS`, set by the deploy command, not committed to the repository. | Meets "only changes through a deploy" without publishing an email address in source. If the user prefers it in code, it becomes a constant in `server/config.js`. |
| D6 | A dedicated runtime service account replaces the default compute account, with only: Firestore user, Vertex AI user and object admin on the one data bucket. | Least privilege. The default compute account is typically a project Editor. |
| D7 | The Garfield Weston demo runner is changed to **stop at a saved draft** on the controlled test portal. It no longer presses a final submit control on anything. The live connector's final-submit method fails with `FINAL_SUBMISSION_DISABLED`, and no flag or UI can enable it. | User requirement 10. The existing demo pressed Submit on our own test portal; under the new rule even the demonstration must not show automatic submission. |
| D8 | A new discovery run **adds** results to the charity's list. Results matching an existing opportunity (same funder and programme, normalised) update that card's details but keep the manager's decision. Nothing is deleted by discovery. | Never loses a saved decision. |
| D9 | Our Time's organisation profile is drafted from its public website through the same onboarding flow and marked "Drafted from public website — check before use". It starts with no past bids, no documents and no opportunities until Discover is run. No synthetic bids or financial figures are invented for a real charity. | Our Time is a real organisation. |
| D10 | Out of scope: S3-002 `portal_draft` (saving a real draft to a funder portal). It needs an authorised applicant account and a verified portal map, which do not exist. `local_draft` (prepare locally, no transfer) is the only real-funder route. | Cannot be built or verified honestly now. |

## 3. Requirements

### REQ-030: Authentication

- Every request to the service, including static files, requires a signed-in Google account (D1, or D2 if D1 fails).
- The server reads identity only from the verified IAP JWT (`x-goog-iap-jwt-assertion`, checked for signature, issuer and audience). It never trusts the unsigned email header or anything supplied by the browser.
- Email addresses are compared lower-cased.
- A signed-in account that is neither a member of a charity nor an admin gets a plain page: "Your Google account (<email>) is not set up for any charity. Ask your administrator to add you." No charity data is sent.
- The header shows the signed-in email and a "Sign out" link (IAP's `?gcp-iap-mode=CLEAR_LOGIN_COOKIE`, or the D2 equivalent).
- Local development and automated tests use a development identity (`DEV_USER_EMAIL`), which the server refuses to honour when running on Cloud Run (`K_SERVICE` set).

### REQ-031: Charities, membership and switching

- A charity record has: `id` (URL-safe slug, immutable), `name`, `website`, `theme` (REQ-035), `createdAt`, `createdBy`.
- Membership is a list of lower-cased Google account emails per charity. An email may belong to any number of charities.
- `GET /api/me` returns the email, `isAdmin`, and the charities the user may open (members' own; admins see all).
- Every charity-scoped API call names the charity in the path (`/api/charities/{id}/...`). The server checks membership (or admin) on every call before touching data. A non-member gets 404 (not 403), so charity IDs cannot be probed.
- A charity switcher in the header lists the user's charities when there is more than one. Switching reloads that charity's data and look.
- The last charity used is stored in browser `localStorage` (`charity-funding.lastCharity`). On load it is used if it is still in the user's list, otherwise the first charity alphabetically. This is the only remaining browser-stored item besides UI conveniences.

### REQ-032: Separate server-side storage

- Firestore layout, every path under the charity:
  - `charities/{cid}`: charity record, members, theme.
  - `charities/{cid}/meta/profile`, `charities/{cid}/meta/discovery` (brief, hideUnsuitable, last run).
  - `charities/{cid}/opportunities/{oid}`: grant cards (seeded fixtures for Your Place, AI results for all).
  - `charities/{cid}/decisions/{oid}`: workflow state and override per opportunity (separate documents so two people deciding on different grants never overwrite each other).
  - `charities/{cid}/bids/{id}`, `charities/{cid}/documents/{id}`.
  - `charities/{cid}/applications/{id}`, `submissionSnapshots/{id}`, `submissionAttempts/{id}`, `submissionReceipts/{id}`.
  - `discoveryRuns/{cid}_{date}` counters for the daily limit (REQ-034).
- Cloud Storage: `gs://<bucket>/charities/{cid}/files/{fileId}` and `.../submission-files/{fileId}`. The bucket is private, uniform access, no public URLs; downloads stream through the API after the membership check.
- All server data access goes through one module that takes the charity ID from the authorised request context. No route builds a Firestore path or object name from a client-supplied string other than the validated charity ID and server-generated record IDs.
- The existing behaviour of each store is preserved: profile/bid/document validation, 10 MiB per file and 100 MiB per charity limits, the application `draftRevision` optimistic check (now a Firestore transaction; a stale save returns 409 and the existing conflict message), immutable snapshots and the attempt lock.
- On first load after this release the browser deletes the old IndexedDB database `charity-funding.organisation` and the localStorage key `charity-funding.demo.v1`. No data is migrated.

### REQ-033: Seeding

- Your Place: all current seed content (profile, synthetic past bids and documents, the six grants, the G-001 application workflow, worked example and synthetic accounts) with "YOR Plc" replaced by "Your Place" in every user-visible string, filename (for example `your-place-proposal.pdf`) and generated document. Its default discovery brief is the current brief, renamed.
- Our Time: created through the onboarding flow (D9).
- Seeding is idempotent and run by an admin command (`npm run seed -- --charity your-place`) or the admin page, never automatically on a user request.
- Members for the two demo charities are set by the admin in the admin page after deployment.

### REQ-034: AI discovery

- `POST /api/charities/{cid}/discovery-runs` with `{ brief }`. The server reads the charity's organisation profile itself. It does not trust profile text sent from the browser.
- The prompt has three parts: fixed instructions (role, UK charity funding, what to return, be truthful, say when unsure); the charity's organisation information (name, website, mission, beneficiaries, area of operation, income band and the profile's other fields); and the discovery box text as "Additional focus for this search".
- The Discover panel states plainly that the brief is added to the organisation information, and links to the organisation page where that information is edited.
- The model uses Grounding with Google Search. It must return JSON: an array of at most 10 opportunities with `name`, `funder`, `amount`, `timing`, optional `opensOn`/`closesOn` (YYYY-MM-DD), `summary`, `guidanceUrl`, `assessment` (`suitable` | `unsuitable`), `reason` (separating confirmed eligibility from points to check), and `sources` (label + URL).
- The server validates every item strictly (types, lengths, dates, `https:` URLs only) and drops invalid items, saying how many were dropped. If the JSON cannot be parsed it retries once, then reports failure. Grounding source links from the response metadata are attached to the cards.
- Each AI card is labelled "Found by AI on <date> — check details on the funder's site before relying on them". The existing "demo recommendations" notice changes accordingly for AI results.
- Merging follows D8. New results enter the New workflow; the newest is highlighted as the current "freshly discovered" marker does.
- Limits: one run at a time per charity (409 while running), a 120-second timeout, and 20 runs per charity per London day (429 with a clear message). The panel shows progress and an honest error on failure; the existing list is untouched by a failed run.
- Logs record charity ID, duration, token counts and item counts, never the prompt or profile text.

### REQ-035: Per-charity look

- A theme is data: a fixed set of tokens mapped onto the existing CSS custom properties (primary, primary-dark, accent, accent-dark, ink, background tint, line, highlight colours), a heading font and a body font from an allowlist (the two bundled fonts plus a short curated list of Google Fonts), a two-part wordmark (text and colours), a descriptor line, and an optional logo image (PNG, JPEG or SVG up to 512 KB, stored in the bucket).
- The server validates every token: colours are 6-digit hex, fonts come from the allowlist, and SVG logos are rejected unless they contain no scripts or external references (or SVG is not accepted at all if sanitising is not reliable). Text and normal-size controls must keep WCAG AA contrast (4.5:1). A theme that fails is rejected with the failing pair named.
- The page title, wordmark, demo notice and generated proposal PDF use the charity's name.
- Your Place keeps the current S0-003 look exactly. Our Time gets a look derived from its website.

### REQ-036: Admin and onboarding

- Admins are the emails in `ADMIN_EMAILS` (D5). Admin routes are under `/api/admin/*` and `#/admin`, and return 404 for non-admins.
- The admin page lists charities and lets the admin:
  - create a charity from a name and website address;
  - press "Suggest from website": the server fetches the site's home page (HTTPS only, public addresses only, at most 1 MB and 10 seconds, no redirects to other hosts) and asks Gemini for a theme and a draft organisation profile. The admin sees a live preview and can edit every value before saving;
  - edit the theme of an existing charity;
  - add and remove member emails;
  - open any charity.
- Deleting a charity is not offered in this ticket.
- Every admin change is recorded in `charities/{cid}/audit/{id}` with who, when and what.

### REQ-037: Draft-only boundary

- No code path in the platform performs a final submission to any funder or test portal. The runner's `submit` step is replaced by `save-draft` on the controlled test portal; the portal's final submit control stays present, and a test proves the runner never activates it.
- The demo completion text becomes "Demo draft saved on the test portal — not submitted, nothing sent to Garfield Weston". Tracking shows these as draft records, not receipts of submission.
- The review screen offers "Download application package" and a link to the funder's own application page, for the manager to submit manually. The platform does not record or imply that anything was submitted.
- The live adapter's final-submit method fails with `FINAL_SUBMISSION_DISABLED`; no request field, environment variable or UI control changes that.

## 4. Acceptance

1. Unauthenticated requests to the live URL are redirected to Google sign-in; no app content is returned.
2. A member of Your Place only sees Your Place. Requests for Our Time's data return 404. Automated tests prove this for every charity-scoped route, including file downloads.
3. A member of both can switch. The choice survives a reload. Each charity's look and data change together.
4. A signed-in non-member sees the "not set up" page and no data.
5. Data persists across browsers and devices for the same user, and is shared by two members of the same charity.
6. Discover, with a brief, returns real grounded opportunities as cards with sources, using both the profile and the brief. The prompt test proves both are present.
7. The admin onboards a third charity from name and website, adjusts its look, adds a member, and that member sees it, all without a deploy.
8. No automated path submits anything. The runner test proves the test portal's submit control is never pressed.
9. Your Place's existing behaviour and look are unchanged apart from the rename, server storage and draft-only change. The existing tests pass after being adapted to server storage.
