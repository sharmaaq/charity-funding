# S0-002 implementation plan

Version: 2 | Written: 2026-11-15 by Claude | Status: approved by the user 2026-11-15, with deployment answers D1 to D6 recorded below.

Implements [spec.md](spec.md) revision 4. The spec defines behaviour; this plan defines how to build and verify it. If the two disagree, the spec wins and the implementer reports the conflict.

## Stack

| Choice | Reason |
| --- | --- |
| Static HTML, CSS and JavaScript (ES modules), no framework, no build step | Six fixed records and one screen of logic. Nothing to compile, easy to review. |
| Node 24 server using only `node:http`, zero runtime dependencies | Serves the static files and honours `PORT` on `0.0.0.0`. Node v24.22.1 is installed locally. |
| State logic as a pure module with no DOM access | The same file runs in the browser and under `node --test`. |
| `node --test` for unit tests; Playwright (dev dependency, Chromium only) for browser tests | Viewport overflow, reload persistence and fresh-profile isolation can only be checked in a real browser. |
| `Dockerfile` on `node:24-slim`, deployed with `gcloud run deploy --source` | Docker is not installed on this machine; a source deploy builds in Cloud Build. |

Environment facts checked 2026-11-15: `origin` is already `https://github.com/sharmaaq/charity-funding.git` with one commit on `master`; gcloud is signed in as the user, but its default project is `wti-demo`, so every gcloud command must pass `--project charity-funding-514818` explicitly and must not change the default.

## Files

```
package.json            scripts: start, test, test:unit, test:e2e; engines node >=24; devDependency @playwright/test
server.js               static file server
public/index.html       app shell: header, snapshot banner, three-area navigation, <main>, live status region
public/styles.css       theme and responsive layout
public/js/fixtures.js   the six grants and the YOR Plc profile; the only place grant data lives
public/js/state.js      pure state logic and storage adapter; the only place workflow state lives
public/js/app.js        routing, rendering, event handling
tests/unit/state.test.js
tests/unit/fixtures.test.js
tests/unit/server.test.js
tests/e2e/discovery.spec.js
playwright.config.js    starts the server; projects: phone-360, phone-390, desktop-1280
Dockerfile, .dockerignore, .gcloudignore, .gitignore
README.md               run, test, deploy from a fresh checkout
```

## Design

**Fixtures.** Each grant: `id` (G-001 to G-006), `name`, `funder`, `amount`, `timing`, `summary`, `guidanceUrl`, `guidanceLabel`, `assessment` (`suitable` or `unsuitable`), `reason`, `sources` (array of `{label, url}`). Text comes from the spec's dataset table. Use the pound sign in the UI where the spec writes GBP. The charity is named only as YOR Plc.

**State.** Storage key `charity-funding.demo.v1`. Shape: `{ version: 1, hideUnsuitable: false, grants: { "G-001": { workflow: "new", override: false }, ... } }`.

`state.js` exports:

- `initialState(fixtures)`: all six `new`, no overrides, `hideUnsuitable` false.
- `effectiveSuitability(grant, entry)`: `suitable`, `unsuitable` or `override`.
- `availableActions(grant, entry)`: per the spec's action table.
- `applyAction(state, fixtures, grantId, action)`: returns a new state. Actions: `watch`, `plan`, `pass`, `restore`, `markSuitable`, `abandon`. An action not available for the grant's current state returns the state unchanged. This is what makes repeated clicks harmless.
- `setHideUnsuitable(state, bool)`.
- `selectView(state, fixtures, view)`: returns `{ visible, hiddenCount, total }` for `new`, `watchlist`, `passed`, `planning`. The filter applies to New and Watchlist only. `total` ignores the filter.
- `load(storage, fixtures)` and `save(storage, state)`: `load` returns the initial state when data is missing, unparseable, a different version, or missing a fixture ID. Both tolerate a storage object that throws, and `load` reports `storageAvailable: false` so the UI can show a one-line notice and carry on in memory.

Transitions:

| Action | From | To | Requires |
| --- | --- | --- | --- |
| watch | new | watchlist | effective suitability not `unsuitable` |
| plan | new, watchlist | planning | effective suitability not `unsuitable` |
| pass | new, watchlist | passed | nothing |
| markSuitable | new | new, override set | assessment `unsuitable`, no override yet |
| restore | passed | new | nothing; override kept |
| abandon | planning | passed | nothing; override kept |

**Routing.** Hash routes: `#/discovery/new` (default), `#/discovery/watchlist`, `#/discovery/passed`, `#/planning`, `#/tracking`. Unknown hashes go to the default. Plan application navigates to `#/planning`.

**Discovery screen.**

- Snapshot banner: "Demo discovery - 15 November 2026 snapshot", with a line saying assessments are demo recommendations for YOR Plc.
- Tabs New, Watchlist, Passed, each with its total count. Always present.
- Show all / Hide unsuitable as a two-button segmented control with `aria-pressed`. Shown on New and Watchlist, not on Passed.
- When the filter hides records: "N unsuitable hidden" plus a Show all button.
- One semantic list of grants. Each item contains name, funder, amount, timing, summary, guidance link, suitability badge (inline SVG icon plus text: "Suitable", "Unsuitable", "Suitable - manager override"), the reason in plain text, action buttons, and a native `<details>` element holding the original assessment and source links. From 900 px wide the list is laid out as a table-like grid with a header row; below that, as stacked cards. One DOM structure, two layouts, so phone and desktop cannot drift apart.
- Empty states: New points to Watchlist and Passed; Watchlist and Passed say what puts a grant there.
- After every action, a polite live region announces the result ("Regular Grants moved to Watchlist") with a link to where the grant went.

**Planning & submission.** "Placeholder - future iteration" notice. List of grants in `planning` with name, funder, guidance link, suitability badge, details, and an **Abandon** button. Abandon moves the grant to Passed and announces it with a link to Passed. Below the list, non-interactive template sections "Application preparation" and "Submission" with descriptive text. Empty state points to Discovery.

**Tracking.** "Placeholder - future iteration" notice and non-interactive template sections "Application status" and "Outcomes". No records, dates or buttons.

**Theme.** White page; `#352253` headings and primary buttons; `#F3EFF8` and `#EAF3FA` panels; `#F58A48` as accent only, never as the sole carrier of meaning and never as text on white (contrast is too low). Buttons at least 44 px tall. Visible focus outline. System font stack. No external fonts, scripts or network calls.

**Server.** Serves `public/` only. Resolves the request path against `public/` and rejects anything that escapes it. Correct content types, `X-Content-Type-Options: nosniff`, `Cache-Control: no-cache`. `/` serves `index.html`; unknown paths return 404. `GET /healthz` returns 200 `ok`. Listens on `0.0.0.0`, port from `PORT`, default 8090 locally (8080 is taken by another project on this machine; Cloud Run supplies `PORT`). Exports a `createServer()` function so the unit test can start it on an ephemeral port.

## Steps for the implementer

1. Scaffold `package.json`, `.gitignore` (`node_modules/`, `test-results/`, `playwright-report/`, `.transfer-temp/`), and `server.js` with its unit test.
2. Write `fixtures.js` and `fixtures.test.js`.
3. Write `state.js` and `state.test.js`. Get the unit tests passing before any UI work.
4. Build `index.html`, `styles.css` and `app.js`: Discovery first, then Planning, then Tracking.
5. Write the Playwright tests and run them at all three viewport sizes.
6. Write `Dockerfile`, `.dockerignore`, `.gcloudignore` (exclude `docs/`, `project/`, `tests/`, `.idea/`, `node_modules/`, `.transfer-temp/`) and `README.md`.
7. Run `npm test` and report actual output.

Rules for the implementer:

- Do not edit anything under `docs/` or `project/`. Report results in the final message; Claude records them.
- During the build, do not run `git commit`, `git push` or any `gcloud` command. Shipping is a separate step the user triggers after their own testing.
- Do not add dependencies beyond `@playwright/test`. Do not add features the spec does not list. In particular: no reset control, no undo-override, no notes, no submission or tracking records.
- If the spec is ambiguous or seems wrong, choose the simplest reading, continue, and list the choice in the final report.

## Tests and requirement coverage

Unit (`node --test`):

| Test | Covers |
| --- | --- |
| Six fixtures, unique IDs, three suitable and three unsuitable, every one has reason, guidance URL and sources | REQ-002, REQ-013 |
| No file under `public/` contains the real charity's name or registration number | REQ-013 |
| Initial state: six in New, filter off | REQ-002, REQ-011 |
| Every row of the transition table, plus every disallowed action leaving state unchanged | REQ-003, REQ-005 |
| Unsuitable: Watch and Plan unavailable; after Mark suitable they are available and the original reason is still on the fixture | REQ-012 |
| Pass then Restore keeps the override; Plan then Abandon then Restore returns the grant to New | REQ-003, REQ-012 |
| Repeating any action leaves exactly one entry per grant ID | REQ-004 |
| Filter: New shows three with `hiddenCount` 3 and `total` 6; Passed is unfiltered; toggling changes no workflow state | REQ-011 |
| Save then load round-trips; corrupt JSON, wrong version and throwing storage all yield a usable initial state | REQ-007 |
| Server: `/` and assets return 200 with correct types, `/healthz` 200, path traversal and unknown paths 404, honours `PORT` | REQ-009 |

Browser (Playwright, each at 360, 390 and 1280 px wide):

| Test | Covers |
| --- | --- |
| Fresh context shows six grants in New, the snapshot banner, and three areas reachable from the navigation | REQ-001, REQ-002 |
| `document.documentElement.scrollWidth <= clientWidth` on every route | REQ-001 |
| Unsuitable badge has icon and text, and the reason is visible without interaction | REQ-008 |
| Pass G-001, see it in Passed, restore it, see it in New | REQ-003 |
| Hide unsuitable shows three and "3 unsuitable hidden"; reload keeps the filter; Show all restores six | REQ-011 |
| Mark G-004 suitable, Watch, Plan application; lands on Planning with the override label; reload keeps it; Abandon sends it to Passed | REQ-005, REQ-012 |
| Tracking has the placeholder notice and no buttons inside `<main>` | REQ-006 |
| A second fresh browser context starts with six in New | REQ-007 |
| Every action button is reachable and operable by keyboard; buttons are at least 44 px tall | REQ-008 |

## After the implementer finishes

Changed by the user on 2026-11-15: the implementer's own test run stands as the automated check, the user does the remaining testing locally, and the implementing model ships when the user asks.

1. Claude records the implementer's reported stack, files, commands, test results, deviations and untested items in [ticket.md](ticket.md) and docs/status.md, labelled as reported by the implementer. Claude does not re-run the tests or walk the app by hand.
2. Claude gives the user the local run command and URL.
3. The user tests locally.

## Deployment (implementing model, when the user asks)

Runs only on the user's request after their local testing.

Answered by the user on 2026-11-15:

| # | Question | Answer |
| --- | --- | --- |
| D1 | Cloud Run region | Agreed: `europe-west1` |
| D2 | Service name | Agreed: `charity-funding` |
| D3 | Public access without sign-in, so the phone can open the URL? The app holds no private data, but anyone with the URL can see it. | Agreed: yes |
| D4 | Is billing enabled on `charity-funding-514818`, and may Claude enable the Cloud Run, Cloud Build and Artifact Registry APIs there? | Agreed: yes |
| D5 | Commit everything (docs, project folder and the app) to `master` and push to `origin`? One commit or docs and app separately? | Agreed: two commits on `master`, docs then app |
| D6 | `.transfer-temp/` (ChatGPT's leftover transfer scripts): delete, or just ignore via `.gitignore`? | Agreed: ignore |

Steps:

1. Already done by Claude on 2026-11-15: project confirmed active with billing enabled; Cloud Run, Cloud Build and Artifact Registry APIs enabled; docs committed locally as the first commit (not pushed).
2. Commit the application as the second commit.
3. Push `master` to `origin`.
4. Deploy: `gcloud run deploy charity-funding --source . --region europe-west1 --project charity-funding-514818 --allow-unauthenticated --max-instances 1 --memory 256Mi`.
5. Check the HTTPS URL: `/healthz`, then the Playwright suite against the deployed URL.
6. User does the phone check from the spec. Record the URL, revision and results in the ticket and status.

If the first source deploy asks to create an Artifact Registry repository or grant the build service account a role, stop and show the user the prompt rather than accepting it silently.

## Out of scope

Continuous deployment from GitHub, custom domain, authentication, analytics, the full Discovery field list, any working Planning or Tracking behaviour beyond Abandon.
