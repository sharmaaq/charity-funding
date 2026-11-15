# Sprint 1 implementation plan (S1-001 and S1-002 together)

Version: 1 | Written: 2026-11-15 by Claude | Status: ready for the implementing model. Runs through to commit, push and deploy (DEC-006).

Neither Sprint 1 ticket has been implemented. S1-002 replaces S1-001's Discover button with the AI discovery panel, so building S1-001's button first would be thrown away. This plan delivers both tickets in one build:

- REQ-015 timing markers, as specified identically in both specs.
- REQ-016 as specified in [S1-002 spec.md](spec.md) (the AI discovery brief). S1-001's "result behaviour" (which grant is chosen, the New badge, its lifetime, the no-result message) is carried into it unchanged.

Authority: S1-002 [spec.md](spec.md), sections "REQ-015", "REQ-016" and "Scope changes and verification", plus the "Review decisions" section at its top. Everything else in that spec describes behaviour that already exists and must not change. If this plan and the spec disagree, the spec wins and the implementer reports it.

Baseline: the deployed S0-003 app (commit 59766e0 or later). Stack unchanged: static HTML/CSS/ES modules, zero runtime dependencies, `node --test` and Playwright. No new dependencies.

## Design

### Timing (new pure module `public/js/timing.js`)

No DOM access, importable by Node tests. All functions take `now` (a `Date`) as a parameter; nothing in this module reads the system clock.

- `londonParts(date)`: year, month, day, and time of day in `Europe/London`, via `Intl.DateTimeFormat` with `timeZone: 'Europe/London'`.
- `addOneMonthClamped({y, m, d})`: same day next month, clamped to that month's last day.
- `isUpcoming(grant, now)`: `opensOn` exists, is valid, and is from tomorrow to seven calendar days ahead (London dates), inclusive.
- `isDueSoon(grant, now)`: the closing London date is from today to today plus one clamped month, inclusive; and if an exact closing instant is known, it has not passed.
- `timingMarkers(grant, now)`: returns `[]`, or any of `'upcoming'`, `'dueSoon'`. Returns `[]` for both when `opensOn` is after the closing date.
- `nextChangeAt(grants, now)`: the earliest of the next London midnight and any future exact closing instant, so the UI can schedule one re-render.

Fixture fields (optional, added to `fixtures.js`):

| Field | Meaning |
| --- | --- |
| `opensOn` | `YYYY-MM-DD`, a London calendar date |
| `closesOn` | `YYYY-MM-DD`, a London calendar date (date-only deadline, due through the end of that day) |
| `closesAt` | ISO instant with offset, for a deadline with a published time |

Real fixture data, from the dates already documented in the spec's dataset table and nothing else:

| Grant | Field |
| --- | --- |
| G-003 | `closesAt: '2026-11-17T12:00:00+00:00'` |
| G-004 | `closesAt: '2026-12-20T17:00:00+00:00'` |
| G-005 | `closesAt: '2026-11-27T17:00:00+00:00'` |

No real grant gets an `opensOn`. G-001, G-002 and G-006 get no timing fields.

Add a fixture validation helper and unit test: dates parse, and no grant has `opensOn` after its closing date.

### Timing preview (review decision R1)

The real fixtures have no opening dates, so Upcoming never appears on the real data, and Due soon disappears as the 2026 deadlines pass. To let the user see the markers at any time without inventing funder dates in the real data:

- When the page URL has the query string `?preview=timing`, the app overlays synthetic timing on the fixtures in memory, computed from the current date: G-001 opens in 3 days (Upcoming only); G-002 opens in 2 days and closes in 20 days (both markers); G-003 closes in 10 days (Due soon only).
- In preview mode a clearly visible notice sits above the grant list: "Timing preview: the opening and closing dates used for markers on this page are synthetic examples, not funder dates." with a link back to the normal view.
- The overlay lives in its own small module (`public/js/preview.js`), affects markers only, never changes the displayed timing text, the workflow state or saved data, and is not linked from the normal UI.

### Markers in the UI

Small icon-plus-text badges in the grant's title block, immediately after the name, wrapping under it when space is short. Calendar icon and "Upcoming"; clock icon and "Due soon"; sparkle icon and "New" (discovery freshness, below). Inline SVG icons, `aria-hidden`; the text carries the meaning. Shown wherever a grant appears in Discovery (New, Watchlist, Passed). Not shown as a separate column. Colours from the existing tokens with measured contrast of at least 4.5:1 for badge text; the three badges must be distinguishable by icon and text, not colour.

`app.js` recomputes markers on every render, on `visibilitychange` when the tab becomes visible, and on a single timer set from `nextChangeAt`. The clock is injectable for browser tests: if `window.__DEMO_NOW__` is set before the app starts (tests set it with `page.addInitScript`), the app uses it as "now"; otherwise `new Date()`.

### Discovery state (extend `public/js/state.js`)

Keep storage key `charity-funding.demo.v1` and version 1. Add two optional top-level fields:

| Field | Meaning |
| --- | --- |
| `freshId` | ID of the one grant currently badged New by discovery, or absent |
| `brief` | The saved discovery brief. Absent means never saved (show the default). An empty string is a deliberate empty brief and is preserved |

`load` must accept saved v1 data that lacks these fields without resetting anything, and must drop a `freshId` that is not a known grant ID. Existing reset rules for corrupt or wrong-version data are unchanged.

New pure functions:

- `discoveryCandidate(state, fixtures)`: the first grant in fixture order whose workflow is `new` and whose effective suitability is not `unsuitable`; or `null`.
- `applyDiscovery(state, fixtures)`: sets `freshId` to the candidate and returns `{ state, grantId }`; with no candidate returns the same state and `grantId: null`.
- `setBrief(state, text)`.
- `applyAction` (existing): when an action actually changes a grant's workflow or override and that grant is `freshId`, clear `freshId`. A no-op action leaves it.

New module `public/js/discovery.js`: `runMockDiscovery({ brief, delayMs })` returns a promise that resolves after the delay with `{ briefUsed: brief }`. It makes no network request. The app calls it with the captured brief, then calls `applyDiscovery`. The function is passed into the app's discovery controller so tests can substitute one that rejects.

### AI discovery panel

At the top of Discovery, above the tabs, on all three views. Contents, with the exact copy from the spec:

- Heading "AI discovery" with a small "Demo" label.
- Label "What funding are you looking for?" bound to a `<textarea>`; helper text "Describe your sector, location, organisation size and funding priorities."
- Primary button "Discover with AI" with a sparkle icon.
- Demo explanation and "Sample results are fixed in this demo; editing the brief does not change the grant selection."
- An inline error slot linked with `aria-describedby`, and a status line.

Behaviour:

- The textarea value is the saved brief, or the default paragraph from the spec when no brief was ever saved. Keep the default paragraph in one constant.
- Typing saves after a 400 ms debounce. Re-rendering the grant list must not recreate the textarea or move the caret: render the panel once and update it in place.
- On click: flush the debounce, save the current text, then validate. Empty or whitespace-only: show "Enter your discovery criteria first.", move focus to the textarea, change nothing else.
- Otherwise: capture the text, set busy (button disabled, textarea `readOnly`, status "Discovering grants..." with a spinner, announced through the live region), call the mock with a delay of about 1 second, then apply the result.
- Success: switch to the New view, re-render, scroll the result into view, and announce "Demo discovery complete - 1 grant marked as new."
- No candidate: announce "No demo grant available to rediscover. Restore a suitable grant to New to repeat the demo." and change nothing.
- Mock failure: announce "Discovery could not be completed. Please try again.", keep the brief and all grants, return to idle.
- While busy, further clicks do nothing. Busy state is in memory only; a reload shows idle and never starts a run.
- The brief is always inserted as text (`value` / `textContent`), never as HTML.
- With `prefers-reduced-motion: reduce`, the spinner does not animate.

Layout (review decision R2): the grant list already starts a long way down the page, so keep the panel compact. From 900 px wide it is two columns, the textarea on the left (about 6 rows) and the helper text, demo note and button on the right. Below 900 px it stacks, with a 6-row textarea. The panel uses the lilac panel style with a lime top border.

## Files

| File | Change |
| --- | --- |
| `public/js/timing.js` | New |
| `public/js/preview.js` | New |
| `public/js/discovery.js` | New |
| `public/js/fixtures.js` | Add the three `closesAt` values and a validation helper. No other data change |
| `public/js/state.js` | Add `freshId`, `brief` and the functions above |
| `public/js/app.js` | Panel, markers, preview notice, timers |
| `public/styles.css` | Panel, badges, spinner, preview notice |
| `tests/unit/timing.test.js` | New |
| `tests/unit/state.test.js` | Add discovery, brief and compatibility cases |
| `tests/unit/fixtures.test.js` | Add timing-field validation |
| `tests/e2e/sprint1.spec.js` | New |
| `tests/evidence/capture.mjs` | Add Sprint 1 scenes |
| `README.md` | Note the preview URL and the injected test clock |

## Tests

Unit, timing (all with an injected `now`; the base clock is 2026-11-15 10:00 London):

- Opening 16 and 22 November: Upcoming. Opening 15 and 23 November: not.
- Closing 15 November (date-only, and with a time later that day) and 15 December: Due soon. Closing 14 November and 16 December: not. An exact time earlier today: not.
- Month clamp: from 31 January, the window ends 28 February (2027) and 29 February (2028).
- London midnight: at 23:30 UTC on a summer date (already the next day in London) the London date is used. Include one case each side of a clock change.
- Both markers together; missing, invalid and rolling dates give none; opening after closing gives none.
- `nextChangeAt` returns the next London midnight, or an earlier closing instant.
- Real fixtures at the base clock: G-003 and G-005 are Due soon, G-004 is not (20 December is after 15 December), no grant is Upcoming.

Unit, state:

- Fresh state has no `freshId` and no `brief`.
- `applyDiscovery` on a fresh state picks G-001; repeated, it still gives one `freshId` and six grants.
- After G-001 is watched, discovery picks G-002. After Mark suitable on G-004 with G-001 to G-003 moved out of New, it picks G-004.
- No suitable grant in New: same state, `grantId` null.
- A real action on the fresh grant clears `freshId`; a no-op action does not; an action on another grant does not.
- Saved v1 data without the new fields loads with all decisions, overrides and filter intact. An unknown `freshId` is dropped. An empty-string brief round-trips as empty. Line breaks in the brief round-trip.

Browser (`tests/e2e/sprint1.spec.js`, all three viewport projects, clock injected at 2026-11-15 10:00 London unless stated):

- Fresh page: panel present with the default paragraph as the textarea's value, one "Discover with AI" button, no New badges, six grants.
- Markers on real data at the injected clock: Due soon beside G-003 and G-005 only; none Upcoming.
- `?preview=timing`: the notice is shown; G-001 Upcoming, G-002 both, G-003 Due soon; the displayed timing text is unchanged.
- Edit the brief (with a line break), navigate to Tracking and back, reload: exact text retained. Typing does not lose focus or caret when a grant action re-renders the list.
- Clear the brief and submit: the validation message is shown and linked, no badge appears, nothing is saved to grants. Reload: the brief is still empty.
- Discover: the button is disabled and the textarea read-only while busy; "Discovering grants..." is announced; then exactly one New badge on G-001, still six grants, the New view is shown, completion is announced.
- Edit the brief and click Discover immediately (before the debounce): the saved brief equals the edited text.
- Double click: one run. Repeat after completion: still one New badge.
- Reload after discovery: badge retained. Watch G-001: badge cleared.
- Hide unsuitable preference and an override survive a discovery run.
- No candidate (pass G-001 to G-003): the no-result message, no badge.
- Injected failing mock: retry message, controls return to idle, brief and grants unchanged.
- No request leaves the origin during a run; no run starts on load.
- No horizontal overflow on Discovery with the panel and with all three badges on one long-named grant (preview mode plus discovery); the Discover button is at least 44 px tall and keyboard operable.

All existing tests must still pass. An existing test may be edited only where markup it selects has moved, never to relax an assertion; list each edit.

## Evidence

Extend `tests/evidence/capture.mjs` and save to `project/sprint-1/tickets/S1-002-ai-discovery-brief/evidence/` at 1280, 390 and 360 px: `brief-idle`, `brief-edited-busy`, `discovery-complete`, `markers-real` (clock injected at 2026-11-15), `markers-preview` (preview mode, showing coexisting badges). Look at them and fix what looks wrong before shipping.

## Recording

Before committing, fill the "Implementation and validation" section of both `project/sprint-1/tickets/S1-001-discovery-markers/ticket.md` and `project/sprint-1/tickets/S1-002-ai-discovery-brief/ticket.md` (the first may point to the second for shared detail), and update the S1-001 and S1-002 lines of `docs/status.md` and the delivery column of `project/sprint-1/README.md`. Leave all other documentation as it is.

## Shipping

Same as S0-003:

1. `git status`. Other documentation may be changing on disk because specification work continues in parallel; that is expected and may be committed along with this work. Do not edit it.
2. Commit on `master` with a message naming S1-001 and S1-002, ending with the two attribution lines from the hand-off. `git push origin master`.
3. `gcloud run deploy charity-funding --source . --region europe-west1 --project charity-funding-514818 --allow-unauthenticated --max-instances 1 --memory 256Mi --quiet` (PowerShell; always pass `--project`).
4. Verify https://charity-funding-36580608208.europe-west1.run.app: `/` returns 200, `/js/timing.js` returns 200, and the full Playwright suite passes with `BASE_URL` set to it. Do not use `/healthz`.
5. Record the revision and live results in the tickets and status, commit and push.

Stop and report, without a workaround, on a rejected push, a deployment permission failure, anything needing an IAM change, or anything touching another Google Cloud project.

## Out of scope

Real AI calls or any network use of the brief; filtering, ranking or re-assessing grants from the brief; new filters or sorting; date categories beyond the two markers; a scheduler or background agent; anything in Sprint 2 or Sprint 3.
