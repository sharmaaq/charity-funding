# S5-001 implementation plan: features matched with Research

Version: 1. Written 2026-11-25 by Claude. Authority: [spec.md](spec.md); if they disagree, the spec wins and the implementer reports it.

Built in four phases, A to D. Each phase ends with `npm test` passing, results recorded in `ticket.md` and `docs/status.md`, a commit and push to `master`, and a deploy to **staging only** with `deploy\stage.ps1 -App charity-funding` run from the workspace folder `C:\aks-code\aifin` (DEC-010). Production changes only when the user asks to promote.

Reference code (read, do not copy blindly; this app keeps its own look and structure): Research in `C:\aks-code\aifin\local-govt-bids\apps\research` — `src/ai.mjs` (runners, streaming), `src/prompts.mjs` (assessment and sweep prompts and schemas), `server.mjs` (jobs, threads, key settings), `src/users.mjs` (KMS-encrypted keys), `public/app.js` (job events, discussions, settings UI).

## Google Cloud changes (need the user's approval)

| Step | Change | Phase |
| --- | --- | --- |
| G8 | Create KMS key ring `charity-funding` and key `ai-keys` in `europe-west1` in `charity-funding-514818`; grant the runtime service account `charity-funding-run` `roles/cloudkms.cryptoKeyEncrypterDecrypter` on that key only | D |
| G9 | Set `GOOGLE_CLOUD_PROJECT=charity-funding-514818` and `KMS_KEY` (the key's resource name) on the staging service, and on production at promotion | B, D |

The implementer stops before G8 and reports; Claude asks the user. Everything else needs no access change: Vertex AI was enabled (G1) and granted (G4) in S4-001.

## Phase A: word search and notes (REQ-038, REQ-039)

1. `server/store/contract.js`: add the `notes` collection. Memory and GCP stores need no other change.
2. `server/services/workspace.js`: `load` returns `notes`; new `setNote(cid, grantId, text, email)` (validates length, opportunity exists, empty deletes). Route `PUT ${P}/notes/:oid` in `server/routes.js`.
3. Browser: search box and filtering in `public/js/app.js` (pure matching function in a small module, unit-tested); counts "N of M"; empty-result message. Notes control inside each card's details with debounced autosave through the existing ordered save chain (`commit` style), "Has notes" marker.
4. Tests: unit (matching, note validation), integration (notes isolation: member, non-member 404, admin), Playwright (search across tabs, note saves and survives Pass and Restore, 360 px layout).

## Phase B: real discovery (REQ-040, REQ-043 model picker without own keys)

1. Add `charity-funding` targets to `aifin/shared/sync.mjs` (`charity-funding/server/ai/ai-core.mjs`) and run it. `server/ai/runners.js`: Gemini runner with streaming and grounding, ported from Research's `runGemini`; Claude and OpenAI runners ported as plain REST (no Agent SDK) for Phase D.
2. `server/ai/jobs.js`: in-memory job registry with event replay (as Research's `claude.mjs` `startJob`), one discovery job per charity at a time; `GET ${P}/jobs/:id/events` as server-sent events, membership-checked.
3. `server/ai/prompts.js`: discovery prompt (profile + brief), result schema with fit score, barriers and sources, and the validator (S4-001 plan Phase 3 step 1). Unit tests with a fake runner.
4. `POST ${P}/discover`: runs the job, merges per spec D5, records the run (queries, sources, counts) in `meta/discovery.lastRun`.
5. Discover panel: progress lines, "What the AI searched" note, fit score on cards, barriers and sources in details. Remove `public/js/discovery.js` mock and the scripted demo result; update tests that relied on it.
6. Model picker in the header listing built-in models only in this phase.
7. Research the live sources (spec D3) and record findings in `research.md`; add a feed only if usable.
8. Live check on staging: one real Discover for Your Place, recorded with model, duration and result count.

## Phase C: assessment and discussion (REQ-041, REQ-042)

1. Collections `assessments` and `threads`. Routes: `POST ${P}/opportunities/:oid/assess` (job), `GET ${P}/threads`, `POST ${P}/threads`, `GET/PATCH/DELETE ${P}/threads/:id`, `POST ${P}/threads/:id/messages` (job).
2. Prompts for assessment and the discussion opening, adapted from Research's grant prompts to a charity applicant.
3. UI: "Assess with AI" and "Discuss" on cards; assessment panel with streaming markdown (sanitised: vendor marked and DOMPurify as Research does, or render as plain paragraphs if adding the vendor files is disproportionate; say which); Discussions page in the navigation.
4. Tests: fake runner for all automated tests; isolation for every new route; Playwright for assess, re-assess, discuss, rename and delete.

## Phase D: the charity's own keys (REQ-043)

1. Stop for G8 approval.
2. `server/services/ai-keys.js`: encrypt and decrypt with KMS (REST, service-account token, as Research's `users.mjs`), store `{ provider, enc, last4, savedAt, savedBy }` in `meta/aiKeys`; never return `enc`. Check keys with `testKey` from the shared core before saving.
3. Routes: `GET ${P}/ai/settings` (models with availability, connections), `PUT/DELETE ${P}/ai/keys/:provider`. Every AI route resolves the picked model and key per request.
4. Settings page and the full model picker.
5. Tests: fake KMS in memory; keys never appear in any response, log or test snapshot; non-members 404.

## Shipping

As every ticket (docs/workflow.md step 4), to staging. The implementer reports the staging revision and what the user should check by hand (sign in, search, notes, Discover, Assess, Discuss, Settings).
