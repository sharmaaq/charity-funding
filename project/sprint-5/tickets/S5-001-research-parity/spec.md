# S5-001: Features matched with Research

Revision: 1. Date: 2026-11-25. Written by Claude from the user's request in chat on 2026-11-25 (role override of DEC-005, as for S4-001). Status: agreed in chat; plan approved with it ("ticket, then build").

This ticket carries forward everything delivered up to S4-001 Phase 2 unchanged, except where a section below says otherwise. Where this spec and S4-001 disagree on AI discovery, this spec wins.

## 1. Background and what the user asked for (2026-11-25)

Charity Funding and Research (`local-govt-bids/apps/research`) are two apps in the Aifin suite with the same find, review, prepare and track workflow (see `../aifin/README.md` in the workspace). They share behaviour, not code, and each keeps its own look. On 2026-11-25 the user asked to match their features:

- Research gained Charity Funding's review views (New, Watchlist, Passed with Watch, Pass, Restore) and its Preparing and Tracking split. That work is in the Research app, not here.
- Charity Funding gains four things Research already has. The user chose all four:
  1. **Word search** over the grant list.
  2. **Notes on each grant.**
  3. **AI assessment and discussion** of a single grant.
  4. **Real discovery**: live searches with fit scores and sources, replacing the demo Discover run.
- Research's AI and start-up tags and its segment chips are **not** brought over: they only make sense for a company bidding for tenders.
- All AI runs on the platform's built-in Gemini by default. A charity can also connect its own AI keys (Claude, ChatGPT or its own Gemini key), in line with DEC-009 (the service is free; charities pay for their own AI use).

## 2. Decisions

| # | Decision | Reason |
| --- | --- | --- |
| D1 | AI calls use the suite's shared AI core (`server/ai/ai-core.mjs`, a copy of the workspace master `aifin/shared/ai-core.mjs` kept in step by `node aifin/shared/sync.mjs`) and plain REST calls, not the `@google/genai` SDK that S4-001's plan named. | Same model list, key checks and Vertex token code as Research; no new dependency. |
| D2 | Built-in Gemini runs on Vertex AI in `charity-funding-514818` with the Cloud Run service account (S4-001 D4, G1 and G4 already done). The service sets `GOOGLE_CLOUD_PROJECT=charity-funding-514818`, because the shared core's default project is the tenders project. | The core reads the project from the environment. |
| D3 | Discovery uses Google Search grounding through Gemini. Live grant feeds are added only where a public, machine-readable source of **open** funding exists; the implementer checks Find a Grant (find-government-grants.service.gov.uk) and 360Giving (which lists past grants, so likely only useful as evidence of funder fit) and records what was found in `research.md`. If none is usable, grounded search is the only source and the screen says so. | Do not invent an API. |
| D4 | A discovered grant gets a **fit score** 0 to 100 and a suitability. Suitable means score 50 or more and no hard eligibility barrier. The existing suitable or unsuitable badge, reason and manager override stay as they are; the score is shown next to them. Barriers are listed in the card's details. | Keeps the S0-002 workflow; adds Research's ranking. |
| D5 | S4-001 D8 applies: a run adds results, updates matching cards (same funder and programme) without touching the manager's decision, and deletes nothing. | Never loses a decision. |
| D6 | Notes are one free-text note per grant per charity, in their own collection, saved as the user types. They are shared by everyone in the charity. | Two people writing notes on different grants never overwrite each other's decisions. |
| D7 | Search filters the cards already on screen, in the browser. It matches grant name, funder, summary, reason and the note, ignoring case. It works in New, Watchlist, Passed and Planning. It is not saved. | Tens of grants per charity; no server search needed. |
| D8 | AI assessment and discussion are per grant and per charity, stored server-side, readable by every member. A discussion keeps its full history and sends it with each message, so the model can change between messages. | Same as Research's discussions. |
| D9 | A charity's own keys are stored per **charity**, not per user (the charity pays), encrypted with Cloud KMS in `charity-funding-514818`. Any member can connect or remove a key; only the last four characters are ever shown back. Keys are checked with the provider before saving. | DEC-009. KMS needs a Google Cloud change (G8), which needs the user's approval. |
| D10 | Out of scope: Research's segment chips, AI and start-up tags, feed refresh scheduling, and S4-001 Phase 4 (admin page and themes), which stays a separate piece of work. | User's instruction. |

## 3. Requirements

### REQ-038: Word search

- A search box sits above the grant list on Discovery (all three tabs) and Planning, labelled "Search grants".
- Typing filters the visible cards to those whose name, funder, summary, reason or note contains every word typed (case-insensitive). Tab counts show the number matching, for example "New 2 of 6".
- An empty result says "No grants match "<text>"." with a "Clear search" button.
- The search text is kept while switching tabs and cleared on reload.

### REQ-039: Notes on each grant

- Every grant card has a "Notes" control in its details. Opening it shows a text box with the current note (at most 5,000 characters).
- The note saves automatically about one second after typing stops, and when the box loses focus. A small status says "Saved" or "Not saved, will retry".
- A card with a note shows a "Has notes" marker on the collapsed card.
- Notes survive decisions (Watch, Pass, Restore, Plan) and discovery runs.
- API: `GET` is part of the workspace load (`notes: { [grantId]: { text, updatedAt, updatedBy } }`); `PUT /api/charities/{cid}/notes/{grantId}` with `{ text }`. Empty text deletes the note. Non-members get 404 (REQ-031).

### REQ-040: Real discovery (replaces the demo Discover run; extends REQ-034)

- Discover sends the charity's organisation information plus the brief to the AI with grounding on, and asks for open or upcoming grants the charity could apply for, each with: name, funder, amount, timing text, opens and closes dates where known, summary, fit score, suitability, reason, barriers, guidance URL and at least one source URL.
- Results are validated as in S4-001 plan Phase 3 step 1 (HTTPS URLs only; drop malformed, oversized or bad-date items), merged per D5, and marked as found by AI with the run date.
- During a run the panel shows progress lines (what is being searched) and can be left; the result appears when done. One run at a time per charity; a second request gets "A discovery run is already in progress".
- After a run, a "What the AI searched" note under the panel lists the queries and sources used and how many grants were new or updated.
- Each card shows the fit score. Details list barriers and sources.
- Your Place's six seeded grants and the G-001 application stay. The demo Discover button and its scripted result are removed.
- The AI model used is the one chosen in the model picker (REQ-043); default built-in Gemini.

### REQ-041: AI assessment of one grant

- Every card has "Assess with AI". It reads the grant's guidance page and linked documents (grounded) and the charity's organisation information, and writes a short markdown assessment: verdict (Apply, Apply with changes, Watch or Don't apply) with a fit score; what the funder wants; eligibility check, rule by rule, with what the charity has and what is missing; how the charity could make a strong case; questions to ask the funder. Under 450 words, sources listed at the end.
- The assessment streams onto the screen as it is written, is saved with its date and model, and is shown again later with "Re-assess".
- The card shows an "Assessed" marker once one exists.

### REQ-042: Discussion about a grant

- "Discuss" on a card opens a discussion thread for that grant: the AI gets the grant, its assessment if any and the organisation information with the first message.
- Messages stream in; the thread is saved and listed under a "Discussions" link in the main navigation, newest first. Threads can be renamed and deleted (with confirmation).
- A discussion can also be started with no grant ("Ask about funding").

### REQ-043: AI model choice and the charity's own keys

- The header gets an "AI model" menu listing the models from the shared AI core. Built-in Gemini models are always available; Claude and ChatGPT models are available once the charity has connected the key, and are otherwise shown disabled with "connect a key in Settings".
- A "Settings" page (main navigation) shows the charity's AI connections: Claude (Anthropic), ChatGPT (OpenAI), Gemini (own key, optional). Connect = paste key, checked with the provider, then saved encrypted (D9). Shows "Connected, key ending 1234" and a Remove button.
- Every AI action (Discover, Assess, Discuss) uses the model picked in the menu; the choice is remembered in the browser per charity.
- Calls with the charity's own key are billed to the charity's provider account; built-in calls to the platform's Google Cloud project.

## 4. Unchanged

Sign-in and tenancy (REQ-030 to REQ-033), the draft-only boundary (REQ-037), the G-001 application and Tracking, the S0-003 look and per-charity branding.
