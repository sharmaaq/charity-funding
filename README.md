# charity-funding

Sprint 0 proof of concept: a responsive web app where a fundraising manager at YOR Plc (a demo charity) reviews six fixed demo grants, sees suitability recommendations with reasons, overrides unsuitable ones, and decides what to pursue. Planning & submission and Tracking are placeholders. State is kept in the browser (localStorage) only.

Stack: static HTML, CSS and ES modules; a Node 24 server using only `node:http`. No runtime dependencies. The only dev dependency is `@playwright/test`.

## Run locally

Requires Node 24 or later.

```
npm install
npm start
```

Open http://localhost:8090. Port 8090 is this project's own local default, chosen so it does not collide with other projects on 8080. On Cloud Run the platform sets `PORT` and the server uses that. To override locally:

```
PORT=3000 npm start          # bash
$env:PORT=3000; npm start    # PowerShell
```

`GET /healthz` returns `ok`.

## Test

One-off setup for the browser tests (downloads Chromium only):

```
npx playwright install chromium
```

Then:

```
npm test                  # unit, integration, then Playwright tests
npm run test:unit         # node --test, no browser needed
npm run test:integration  # node --test: demo API, test portal and runner (starts real headless Chromium)
npm run test:e2e          # Playwright at 360, 390 and 1280 px wide
```

The Playwright config starts its own server on port 8091 and uses a fresh browser context for every test.

## Discovery extras (Sprint 1)

- `?preview=timing` overlays synthetic opening and closing dates (G-001 opens in 3 days; G-002 opens in 2 and closes in 20; G-003 closes in 10) so the Upcoming and Due soon markers can be seen at any time. A notice says the dates are synthetic; displayed timing text and saved data never change. It is not linked from the normal UI.
- Test hooks, set before the app starts (for example with Playwright `page.addInitScript`): `window.__DEMO_NOW__` (ISO string or milliseconds) fixes the clock used for markers, and `window.__DEMO_RUN_DISCOVERY__` replaces the local discovery simulation. With a fixed clock the midnight refresh timer is not scheduled.
- Evidence screenshots: `node tests/evidence/capture.mjs <baseUrl> sprint1`.

## Organisation information and document store (Sprint 2)

- Click the YOR Plc name in the header (`#/organisation`) for the editable organisation overview, past funding bids and organisation documents.
- Files are genuinely uploaded, stored and downloaded, but only in this browser (IndexedDB database `charity-funding.organisation`, schema 1). Nothing is sent to the server. Clearing site data removes them; another browser profile or origin starts with its own sample data. The app never deletes or recreates this database to recover from an error.
- Limits (constants in `public/js/org/validation.js`): PDF, DOCX, XLSX, CSV, TXT, PNG, JPEG; 10 MiB per file; 100 MiB in total. Browser quota may be lower. These are format checks, not malware scanning.
- Sample bids and documents are fictional and marked "Synthetic demo example"; they are seeded once, and deleting them keeps them deleted.
- If IndexedDB cannot be opened, the sample content is shown read-only and every change is disabled. Grant triage (localStorage) is independent.
- `public/js/org/repository.js` is the only code that touches the stores; `catalogue()` is the source-access boundary for later features. Test hook: `window.__ORG_TEST_HOOKS__` ({ limits, abortNext }), set before the organisation area opens.
- Storage-heavy browser tests (`tests/e2e/organisation-storage.spec.js`) run in the desktop project only.

## Guided application and submission demo (Sprint 3, S3-001)

- G-001 (Garfield Weston Regular Grants, core costs) has an application workspace at `#/planning/G-001/application`, a generated proposal PDF and an immutable package (browser only, in the organisation database, now schema 2).
- **Run submission demo** sends the reviewed package to this app's own server (`POST /api/submission-demo-runs`). The server validates it, then a headless Chromium fills, uploads to, submits and reads a receipt from a **controlled test portal** that runs on `127.0.0.1` for that one request only. Nothing is sent to Garfield Weston or Blackbaud, and the browser in the run cannot reach any other host. Progress streams back as NDJSON; the DEMO receipt is saved in this browser and listed in Tracking.
- `GET /api/submission-capabilities` reports whether the runner can start (`demoAvailable`) and why live submission is unavailable (`liveAvailable: false`, `liveBlockers`). There is no live mode and no switch for one.
- One run at a time per instance (429 otherwise); same-origin requests only; 21 MB request limit, 10 MB per file; 90-second run deadline. This is a no-login POC and is not suitable for confidential production applications.
- Server code: `server/api.js`, `server/manifest.js` (validation shared with the browser modules), `server/multipart.js`, `server/demo-portal.js`, `server/demo-runner.js`, `server/adapters/`. Runtime dependencies: `playwright` (pinned to the test version) and `busboy`.

## Layout

- `server.js` static server for `public/` only (404 for anything else, including path traversal).
- `public/js/fixtures.js` the six grants (the only place grant data lives).
- `public/js/state.js` pure state logic and storage adapter (no DOM access; also imported by the unit tests).
- `public/js/app.js` routing and rendering.
- `public/js/timing.js` pure Europe/London date logic for the Upcoming / Due soon markers (takes `now` as a parameter).
- `public/js/preview.js` the `?preview=timing` overlay; `public/js/discovery.js` the default brief and the local discovery simulation.
- `tests/unit`, `tests/e2e` tests.

## Deploy to Google Cloud Run

Deployment is a separate, reviewed step. From the repository root, with `gcloud` signed in (pass the project explicitly; do not change the default project):

```
gcloud run deploy charity-funding --source . --region europe-west1 --project charity-funding-514818 --allow-unauthenticated --max-instances 1 --memory 1Gi --cpu 1 --timeout 180
```

This builds from the `Dockerfile` in Cloud Build (Docker is not needed locally). The image installs Chromium's headless shell and its system libraries at build time for the submission demo, which needs 1 GiB of memory and a request timeout above the 90-second run deadline. Then check `https://<service-url>/healthz`.

## Fonts and licences

Lilita One (display) and Urbanist (body, weights 600 and 800) are bundled in `public/fonts/` from the `@fontsource` packages, with their SIL Open Font License texts (`LICENSE-lilita-one.txt`, `LICENSE-urbanist.txt`). The page makes no requests to any other origin.

## Test a deployed site

```
$env:BASE_URL="https://charity-funding-36580608208.europe-west1.run.app"; npm run test:e2e    # PowerShell
BASE_URL=https://... npm run test:e2e                                                          # bash
```

With `BASE_URL` set, Playwright starts no local server. Evidence screenshots: `node tests/evidence/capture.mjs <baseUrl> <before|after>`.
