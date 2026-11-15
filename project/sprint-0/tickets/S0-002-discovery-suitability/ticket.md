# S0-002: Usable Discovery, suitability and placeholders

- Date: 2026-11-15
- Type: requirements iteration
- Agreement: spec revision 4 approved by the user on 2026-11-15, after answering Claude's review questions (resolutions table in the spec).
- Delivery: implemented locally by Sonnet; awaiting the user's local testing. Not pushed, not deployed.
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
- Not done: application code is uncommitted; nothing is pushed; nothing is deployed. Claude enabled the Cloud Run, Cloud Build and Artifact Registry APIs on `charity-funding-514818` and committed the docs locally (cff3728).

## Next action

1. User tests locally.
2. On the user's request, the implementing model commits the application, pushes `master` and deploys to Cloud Run per the plan's deployment section.
3. User does the phone check; the URL, revision and results are recorded here and in docs/status.md.
