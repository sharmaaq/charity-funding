# S0-002: Usable Discovery, suitability and placeholders

- Date: 2026-11-15
- Type: requirements iteration
- Agreement: spec revision 4 approved by the user on 2026-11-15, after answering Claude's review questions (resolutions table in the spec).
- Delivery: deployed to Cloud Run on 2026-11-15; awaiting the user's phone check.
- Owner: ChatGPT drafted the spec; Claude reviews, plans and delegates implementation (DEC-005).
- Predecessor: [S0-001](../S0-001-initial-requirements/ticket.md).
- Specification: [spec.md](spec.md), revision 4. Plan: [plan.md](plan.md), version 2. Evidence: [research.md](research.md).

## Changes and scope

- Confirm browser-only persistence; no shared phone/desktop state. Accounts, organisations and shared persistence deferred.
- Extend fixtures to six, including unsuitable grants with prominent icon, reason and source.
- Add persistent Show all / Hide unsuitable and manager override to Suitable, retaining the original assessment; allow Pass and usual suitable workflow after override.
- Build usable Discovery now with provisional fields; full field list comes in a subsequent iteration.
- Replace proposed submission simulation and functional tracking with labelled placeholders. Keep Plan application as a move into the Planning placeholder.

Affected: REQ-001 through REQ-010 revised or clarified; REQ-011 through REQ-013 added. See the spec for criteria, defaults, sources and future scope. DEC-004 records browser-state and phase scope.

## Evidence and assumptions

[Research](research.md) records official sources and suitability inferences. Two unsuitable examples recovered from prior research; one new geography example. UI defaults (six fixtures, initial Show all, table/cards, filter behaviour and minimal placeholder handoff) implement the user's delegated UI request. 'Delivery phase' interpreted as Discovery; no fourth phase added.

## Review history

- ChatGPT drafted spec revision 2 at the sprint root and stopped at a usage limit before updating the sprint index, requirements register, decisions and status.
- 2026-11-15, Claude: took over at the user's request. Moved spec.md and research.md into this ticket folder (DEC-003). Set the spec to "under review", replaced its implement-now handoff with delivery notes, and added eight open questions (Q1 to Q8) with recommendations. No requirement was changed. Completed the shared-document updates ChatGPT had not reached. Weekdays for the fixture dates (17 and 27 November 2026) were checked against the calendar; funder pages were not re-fetched.
- 2026-11-15, user: answered Q1, Q2, Q5 and Q6 in the spec and accepted Claude's recommendations for Q3, Q4, Q7 and Q8.
- 2026-11-15, Claude: folded the answers into spec revision 4 (Abandon in Planning, no override undo, hidden count, Cloud Run deployment in scope, demo charity renamed YOR Plc, discard stale storage). Wrote plan.md version 1. Checked locally: origin is the GitHub repository with one commit on master; gcloud is signed in but defaults to a different project, so the plan passes the project explicitly; Docker is not installed, so the plan uses a source deploy.
- 2026-11-15, user: approved the plan with deployment answers D1 to D6, then changed the hand-off: the implementer runs the tests, the user tests locally, and the implementing model commits, pushes and deploys on request. Plan updated to version 2 and the workflow updated to match.

## Implementation and validation

Implemented on 2026-11-15 by Sonnet from spec revision 4 and the plan. Everything in this section is as reported by the implementer; Claude did not re-run the tests or exercise the app, at the user's direction.

- Stack: static HTML/CSS/JavaScript (ES modules, `"type": "module"`), dependency-free Node 24 server, `node --test`, Playwright (Chromium) as the only dev dependency.
- Files: package.json, package-lock.json, server.js, playwright.config.js, public/index.html, public/styles.css, public/js/fixtures.js, public/js/state.js, public/js/app.js, tests/unit/{state,fixtures,server}.test.js, tests/e2e/discovery.spec.js, Dockerfile, .dockerignore, .gcloudignore, .gitignore, README.md.
- Run: `npm install`, `npm start`, then http://localhost:8090. `/healthz` returns `ok`. The local default was moved from 8080 to 8090 by Claude on 2026-11-15 because another project's Cloud Run proxy holds 127.0.0.1:8080 on this machine; Cloud Run still supplies `PORT`.
- Tests run by the implementer with `npm test`: unit 22 passed, 0 failed; Playwright 45 passed, 0 failed (15 each at 360, 390 and 1280 px wide).
- Deviations: none from the spec or plan reported. Implementation choices: an overridden grant's row shows the override note together with the original reason; after an action, focus moves to the view heading and a live region announces the result with a link; guidance and source links open in a new tab; the desktop header row sits outside the list and is hidden from assistive technology.
- Not tested: Dockerfile and the deploy command; any browser other than Chromium; a real phone; measured colour contrast; screen readers; a fresh-checkout install; the external guidance links.

### Deployment, 2026-11-15

- The user tested locally, then committed and pushed (e958f8d on `master`, equal to `origin/master` when checked).
- Service `charity-funding`, region `europe-west1`, project `charity-funding-514818`, public access, max 1 instance, 256Mi. Revision `charity-funding-00001-94k`.
- URL: https://charity-funding-36580608208.europe-west1.run.app (also https://charity-funding-4zw3jha7va-ew.a.run.app).
- Command, run by Claude at the user's direction: `gcloud run deploy charity-funding --source . --region europe-west1 --project charity-funding-514818 --allow-unauthenticated --max-instances 1 --memory 256Mi --quiet`.
- First two attempts failed: the default compute service account, which runs the build, had no roles and could not read the uploaded source. With the user's approval Claude granted it `roles/run.builder` on the project; the third attempt succeeded.
- Checked by Claude against the live URL: `/` 200 and contains "YOR Plc"; `/js/fixtures.js` (six grant IDs), `/js/state.js`, `/js/app.js` and `/styles.css` 200 with correct content types; an unknown path returns the app's 404.
- Discrepancy: `/healthz` returns Google's own 404 on Cloud Run and never reaches the app. Cloud Run's front end reserves that path. It works locally and nothing depends on it. Renaming it (for example to `/health`) is a candidate for the next ticket.
- Not run: the Playwright suite against the deployed URL (the config has no way to point at an external URL without editing it); the user's phone check.
- Created in the project as by-products: Artifact Registry repository `cloud-run-source-deploy` and bucket `run-sources-charity-funding-514818-europe-west1`.

## Next action

1. User does the phone check from the spec against the URL above.
2. Record the result here and in docs/status.md. Requirement changes arising from the review go into S0-003.
