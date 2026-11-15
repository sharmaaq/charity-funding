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
npm test              # unit tests, then Playwright tests
npm run test:unit     # node --test, no browser needed
npm run test:e2e      # Playwright at 360, 390 and 1280 px wide
```

The Playwright config starts its own server on port 8091 and uses a fresh browser context for every test.

## Discovery extras (Sprint 1)

- `?preview=timing` overlays synthetic opening and closing dates (G-001 opens in 3 days; G-002 opens in 2 and closes in 20; G-003 closes in 10) so the Upcoming and Due soon markers can be seen at any time. A notice says the dates are synthetic; displayed timing text and saved data never change. It is not linked from the normal UI.
- Test hooks, set before the app starts (for example with Playwright `page.addInitScript`): `window.__DEMO_NOW__` (ISO string or milliseconds) fixes the clock used for markers, and `window.__DEMO_RUN_DISCOVERY__` replaces the local discovery simulation. With a fixed clock the midnight refresh timer is not scheduled.
- Evidence screenshots: `node tests/evidence/capture.mjs <baseUrl> sprint1`.

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
gcloud run deploy charity-funding --source . --region europe-west1 --project charity-funding-514818 --allow-unauthenticated --max-instances 1 --memory 256Mi
```

This builds from the `Dockerfile` in Cloud Build (Docker is not needed locally). Then check `https://<service-url>/healthz`.

## Fonts and licences

Lilita One (display) and Urbanist (body, weights 600 and 800) are bundled in `public/fonts/` from the `@fontsource` packages, with their SIL Open Font License texts (`LICENSE-lilita-one.txt`, `LICENSE-urbanist.txt`). The page makes no requests to any other origin.

## Test a deployed site

```
$env:BASE_URL="https://charity-funding-36580608208.europe-west1.run.app"; npm run test:e2e    # PowerShell
BASE_URL=https://... npm run test:e2e                                                          # bash
```

With `BASE_URL` set, Playwright starts no local server. Evidence screenshots: `node tests/evidence/capture.mjs <baseUrl> <before|after>`.
