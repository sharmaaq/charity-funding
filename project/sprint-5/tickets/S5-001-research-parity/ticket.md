# S5-001: Features matched with Research

- Type: iteration
- Created: 2026-11-25
- Agreement: agreed by the user in chat 2026-11-25 (word search, notes, AI assessment and chat, real discovery; "ticket, then build")
- Delivery: planned; Phase A handed to the implementing model
- Owner: Claude wrote the spec and plan (role override of DEC-005, as for S4-001); implementation delegated per workflow
- Predecessor: [S4-001](../../../sprint-4/tickets/S4-001-multi-charity-platform/ticket.md). Its Phase 3 (AI discovery) is delivered by this ticket's Phase B instead; its Phase 4 (admin and themes) is unaffected.
- Specification: [spec.md](spec.md); plan: [plan.md](plan.md)

## Context and source

The user asked to match features between Charity Funding and Research, which share a workflow in the Aifin suite. Research received Charity Funding's review views and Preparing and Tracking split on 2026-11-25 (in `local-govt-bids/apps/research`). This ticket brings Research's search, notes, AI assessment and discussion, and real discovery to Charity Funding. The workspace rule in `C:\aks-code\aifin\CLAUDE.md` now says every new feature in one app is checked for the other. Decisions DEC-009 (free service, charities' own AI credits) and DEC-010 (staging first) apply.

## Requirements and changes

REQ-038 to REQ-043 in [spec.md](spec.md). REQ-040 replaces the demo Discover run and extends REQ-034.

## Review history

- 2026-11-25, Claude: spec and plan written; open points settled with the user in chat.

## Implementation and validation

Built by the implementing model, phase by phase (plan.md). Test counts are as reported by the implementer.

### Phase A: word search and notes (REQ-038, REQ-039) - 2026-11-25

- Built: `public/js/search.js` (pure matching), `public/js/notes.js` (limit and validation, shared with the server), `notes` collection, `workspace.setNote` and `PUT /api/charities/{cid}/notes/{grantId}`, notes in the workspace load, the search box (Discovery tabs and Planning), "N of M" tab counts, the no-match message with Clear search, the Notes control in each card's details (autosave after about 1 s and on blur, "Saved" / "Not saved, will retry" with a retry every 5 s) and the "Has notes" marker.
- Tests: unit 132 pass (1 skipped, as before), integration 87 pass, Playwright 321 pass (15 new, three viewports). New: `tests/unit/search-notes.test.js`, `tests/integration/notes.test.js`, `tests/e2e/search-notes.spec.js`; the isolation suite gained the notes route (non-members get 404 and change nothing).
- Search matches name, funder, summary, reason and note; an empty search shows the lists as before.
- Shipped: commit 21edee5; staging revision charity-funding-staging-00003-w2m (staging answers 302 to accounts.google.com).

### Phase B: real discovery and the model menu (REQ-040, REQ-043 without own keys) - 2026-11-25

- Built: `aifin/shared/sync.mjs` now also copies `ai-core.mjs` to `charity-funding/server/ai/ai-core.mjs` (master unchanged, so nothing else was resynced); `server/ai/runners.js` (Gemini on Vertex with streaming and grounding; Claude and OpenAI as plain REST for Phase D), `server/ai/jobs.js` (in-memory registry, event replay), `server/ai/prompts.js` (prompt, schema, validator), `server/ai/models.js` (built-in models only), `server/ai/fake-runner.js` (scripted AI for every test), `server/services/discovery.js` (run, merge per D5, `meta/discovery.lastRun`); routes `GET /ai/models`, `GET /discover/active`, `POST /discover`, `GET /jobs/:jid/events` (server-sent events, charity-checked). Browser: the Discover panel runs the job and shows progress lines, can be left and re-attached after a reload, "What the AI searched" note, fit score, "Found by AI on <date>", barriers and sources on cards, and an "AI model" menu in the header (remembered per charity in the browser). The demo Discover (`public/js/discovery.js`, the scripted result and the `__DEMO_RUN_DISCOVERY__` hook) is removed.
- Merge (D5): a result matching an existing card (same funder and programme after normalising) updates it; a card that was already there (the seeded Your Place grants) only gains the fit score, barriers and extra sources and keeps its wording and suitability; a card found by AI is refreshed in full. Decisions and notes are separate records and are never touched; nothing is deleted. Suitable = score 50 or more and no hard barrier (D4). The best new suitable card gets the "New" marker.
- Validation (prompts.js): https links only, lengths, valid and ordered dates, not already closed, score 0 to 100, at most 25 items; each dropped item is counted and shown as "ignored".
- Only one run per charity: a second request gets 409 "A discovery run is already in progress." Jobs live in the server's memory (the staging service runs one instance); the saved result is in Firestore, so only the live progress is lost if an instance restarts.
- Tests: unit 142 pass (1 skipped), integration 96 pass, Playwright 312 pass (the Discover tests in `sprint1.spec.js` were rewritten for real discovery against the fake AI; `search-notes.spec.js` unchanged). New: `tests/unit/ai-discovery.test.js`, `tests/integration/discovery.test.js`; the isolation suite covers the four new routes. All automated tests use the fake runner (`AI_FAKE=1` in the Playwright server, never honoured on Cloud Run); none calls a real AI.
- Live sources (D3), recorded in `docs/research.md`: Find a Grant publishes no API or feed that could be found; 360Giving lists past grants only. No feed added; grounded search is the only source and the panel says results are suggestions.
- Live check (one real run, local server on the in-memory store seeded with synthetic Your Place, calling Vertex AI in charity-funding-514818 with the implementer's gcloud login): model gemini-3.8-flash, 101 s, 10 results (10 new, 0 updated, 0 dropped), 20 search queries. Five suitable (scores 62 to 88), five unsuitable (scores 5 to 15, income-limit barriers). Vertex returned no grounding page list, so "pages read" lists the sources the results cite. Results looked plausible for a London homelessness charity but were not fact-checked against the funders' pages.
- Google Cloud: `GOOGLE_CLOUD_PROJECT=charity-funding-514818` set on the staging service only (plan G9; revision charity-funding-staging-00004-5lm) and added to the charity-funding `env` in `deploy\apps.json`. Production gets it only at promotion.
- Not changed: Cloud Run CPU is throttled between requests on the staging service. A run keeps working while any browser tab is connected to its events; if every tab is closed mid-run the run may stall until the next request reaches the instance. Setting "CPU always allocated" would fix that; it is a service setting, not done here.

- Shipped Phase B: commit 3e3e398; staging revision charity-funding-staging-00005-6qn (302 to accounts.google.com).

### Phase C: assessment and discussion (REQ-041, REQ-042) - 2026-11-25

- Built: `assessments` and `threads` collections; `server/services/assist.js`; prompts for the assessment and the discussion opening (`assessGrantPrompt`, `threadContext`, `threadOpening`); routes `GET /assessments/:oid`, `POST /opportunities/:oid/assess` (job), `GET /threads`, `POST /threads` (creates the discussion with its first message and starts the answer, so no empty threads), `GET/PATCH/DELETE /threads/:id`, `POST /threads/:id/messages` (job); answers stream over the existing job events route. Browser: "Assess with AI" and "Discuss" on every card (Discovery and Planning), an assessment panel that streams markdown, shows the saved text with its date and model, and offers Re-assess; "Assessed" marker (also from the workspace load); a Discussions page in the main navigation (list newest first, new discussion with or without a grant, thread view with streaming answers, rename, delete after a confirmation, reload-safe).
- Markdown: no vendor library was added. `public/js/markdown.js` is a small in-house renderer that builds DOM text nodes only (never innerHTML), links must be https and open with `rel="noopener noreferrer"`; supports headings, paragraphs, bullet and numbered lists, bold, italic, code and links. This is the "plain paragraphs" fallback in the plan, a little richer. `public/js/jobs.js` is the shared event follower (used by Discover too).
- A discussion keeps its full history and sends it with every message, so the model can be changed between messages (D8); the first message carries the organisation information, the grant and its saved assessment. A question whose answer failed stays in the thread and is merged into the next message. The stored context is never sent to the browser.
- Spec disagreement: none for this phase. Plan said "`POST ${P}/threads`" for creating a thread; it takes the first message in the same call (the spec's "Ask about funding" and "Discuss" both start with a message).
- Tests: unit 148 pass (1 skipped), integration 103 pass, Playwright 330 pass (18 new in `assist.spec.js`; one existing Planning test now ignores the new Assess button). New: `tests/integration/assist.test.js`, `tests/unit/markdown-jobs.test.js`; the isolation suite covers all eight new routes. Automated tests use the fake runner only.
- Shipped Phase C: commit 0927345; staging revision charity-funding-staging-00006-gfq (302 to accounts.google.com). The assessment and discussion were not run against the real Gemini model (only Discover was); the signed-in check is the user's.

### Phase D: the charity's own AI keys (REQ-043) - 2026-11-25

- Approved by the user; Claude did G8 and G9 (KMS API enabled; key `projects/charity-funding-514818/locations/europe-west1/keyRings/charity-funding/cryptoKeys/ai-keys`; `charity-funding-run` holds `roles/cloudkms.cryptoKeyEncrypterDecrypter` on that key only; `KMS_KEY` set on staging and recorded in `deploy\apps.json`). The implementer changed no IAM or service setting.
- Built: `server/ai/kms.js` (Cloud KMS over REST with the service-account token, as Research's `users.mjs`; an in-memory AES-GCM stand-in for development only), `server/services/ai-keys.js` (keys per charity in `meta/aiKeys`: `{ enc, last4, savedAt, savedBy }`; decrypted keys cached 10 minutes in memory; the key and `enc` never leave the module), `server/ai/models.js` (all six models with `available`; Claude and ChatGPT need a key; a Gemini key of the charity's own moves the Gemini models onto it). Routes: `GET /ai/settings`, `PUT /ai/keys/:provider` (anthropic, openai, gemini; the key is checked with `testKey` from the shared core before it is saved), `DELETE /ai/keys/:provider`; `GET /ai/models` now lists every model with its availability. Every AI route (Discover, Assess, new discussion, message) resolves the picked model and the key for that charity on each request, and the key rides only in the server-side call. If `KMS_KEY` is missing, connecting a key answers 503 "not available" and Claude and ChatGPT stay disabled. The development state viewer shows no blob.
- Browser: Settings page (`#/settings`, in the main navigation) with Claude, ChatGPT and Gemini: paste a key, Connect (checked with the provider), then "Connected, key ending 1234" and Remove (after a confirmation). The key field is cleared after saving and the key is never in the page or in browser storage. The header "AI model" menu lists all six models; Claude and ChatGPT are disabled with "(connect a key in Settings)" until connected, and the menu updates at once when a key is connected or removed (a chosen model that becomes unavailable falls back to the default). The long menu text is capped in width so the header does not overflow at 360 px.
- Any member can connect or remove a key (D9: the charity pays). Keys are per charity; another charity never sees them.
- Tests (fake KMS and fake key check; no real provider is called): unit 152 pass (1 skipped), integration 113 pass, Playwright 348 pass. New: `tests/unit/kms.test.js` (cloud call shape with a stubbed fetch, local round trip, tampering, last four only, cache), `tests/integration/ai-keys.test.js` (check before save, stored value is the blob, per-request key resolution for Discover, Assess and Discuss, removal, per-charity isolation, 404 for non-members, 503 without a KMS, and a scan of every response for the key or `enc`), `tests/e2e/settings.spec.js`; the isolation suite covers the three new routes.
- Live check of the real KMS key from the implementer's machine with the local gcloud login (no access change made): encrypt and decrypt of a dummy string succeeded (the user account has access to the key). The real provider key checks (`testKey` against Anthropic, OpenAI and Google) and real calls with a charity's key were not run: no real key was available and none was invented.
- Shipped Phase D: commit 4f62668; staging revision charity-funding-staging-00008-mjx (302 to accounts.google.com). `GOOGLE_CLOUD_PROJECT` and `KMS_KEY` are both still on that revision.
- Not changed: promotion. Production needs `GOOGLE_CLOUD_PROJECT` and `KMS_KEY`; `deploy\promote.ps1` applies `prodEnv` from `deploy\apps.json` as set up by Claude.

## Handoff

All four phases are built and on staging. Not promoted. G8 and G9 were done by Claude with the user's approval.
