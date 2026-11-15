# S0-003: Match the Your Place visual style

- Created: 2026-11-15
- Type: UI requirements iteration
- Requested by: user, after reviewing the deployed first cut and providing screenshots of Discovery and the Your Place homepage.
- Requirement agreement: visual alignment requested; detailed design choices below are proposed implementation defaults for Claude to review.
- Status: reviewed and planned by Claude 2026-11-15; with the implementing model for build, test, commit, push and deploy.
- Current complete specification: [spec.md](spec.md), revision 5.1. Plan: [plan.md](plan.md).
- Predecessor: [S0-002](../S0-002-discovery-suitability/ticket.md), implemented and deployed.

## Problem and outcome

Discovery currently looks like a generic administrative table. Its system font, muted purple/orange palette, pale blue bars and small heading do not reproduce the reference's distinctive typography, vivid colours and graphic shapes. Restyle the app so it visibly belongs to the same design family while retaining YOR Plc as the demo identity and keeping the grant workflow usable.

## Scope

Revise REQ-008 and add REQ-014 (brand fidelity and visual evidence). Apply the shared shell and typography to all three phases. Keep the dataset, actions, field list, persistence and placeholder behaviour from S0-002. This is not the deferred full Discovery-field iteration.

## Evidence

See [research.md](research.md). Reference screenshots were supplied in this chat. The concrete design directions and acceptance criteria are embedded in spec.md so implementation does not depend on access to this chat.

## Review by Claude, 2026-11-15

- Read the reference site's stylesheet directly and replaced the screenshot estimates with verified values (table in [research.md](research.md)). Body font is Urbanist, not Poppins. The reference's heading font is the charity's own custom file and is not used; Lilita One is the fallback its stylesheet declares.
- Spec updated to revision 5.1 with those values. No behaviour, data or scope change, so no questions were raised with the user.
- Wrote [plan.md](plan.md). It adds automated checks for tokens, contrast, font loading and same-origin requests, and a screenshot script for the REQ-014 evidence.
- S1-001's draft spec carried forward the estimated fonts and colours from revision 5; it needs these verified values when it is reviewed.

## Implementation and validation

Implemented by Claude (Fable 5.2) on 2026-11-15.

**Files.** Added: public/fonts/ (3 woff2, 2 licence texts), tests/unit/theme.test.js, tests/e2e/theme.spec.js, tests/evidence/capture.mjs, evidence PNGs. Changed: public/styles.css (rewritten), public/index.html (strip, header, title band with roofline SVG, workspace; display-font preload), public/js/app.js (presentation only: title-band h1 set per route, button class names, grant and template headings now h2; no state, route or action change), server.js (.woff2 content type), playwright.config.js (BASE_URL switch), tests/unit/server.test.js (font served as font/woff2), tests/e2e/discovery.spec.js (two selector edits, below), README.md. state.js, fixtures.js and the storage key are untouched.

**Tokens.** purple #442C86, lime #D7DB2D, navy #232551, ink #262626, lilac #F5F3F8, coral #ED6A53, orange #EA720D, teal #00959A, light teal #87C0CA. Derived: muted #4D4660, line #D9D4E3, neutral-border #766F8A, purple-dark #33206A, lime-dark #C3C721, lilac-hover #E9E4F2; the existing green/red badge colours are kept.

**Fonts.** Lilita One 400 and Urbanist 600/800, latin woff2 from cdn.jsdelivr.net/npm/@fontsource/*, saved locally with their SIL OFL licence texts. Loading result (Playwright, all three viewports): document.fonts.check true for all three; computed h1 family starts with Lilita One and body with Urbanist; no cross-origin request on any route. The charity's custom heading font was not used.

**Contrast (measured in theme.test.js).** white on purple 10.77; navy on lime 9.66; purple on lime 7.21; ink on white 15.13; ink on lilac 13.73; purple on white 10.77; purple on lilac 9.77; muted on white 8.90 and on lilac 8.07; white on purple-dark 13.50; navy on lime-dark 7.91; purple on lilac-hover 8.64; ok-fg on ok-bg 7.98; bad-fg on bad-bg 8.01. Large or non-text: coral on white 3.09 (36 px wordmark, passes 3:1 as large text); neutral border on white 4.76; navy focus outline on white 14.43; lime focus outline on purple 7.21. Coral border on lilac is 2.81, below 3:1: it is decoration only on the unsuitable reason panel, and the badge icon, badge text and reason text carry the meaning.

**Tests.** npm test: 28 of 28 unit; Playwright 63 of 63 (21 per project: phone-360, phone-390, desktop-1280), including all 45 existing tests.

**Existing tests edited (markup moved).** tests/e2e/discovery.spec.js: two uses of `page.locator('main h2')` became `page.locator('h1')`, because the page heading moved from an h2 inside main to the h1 in the title band. Assertions unchanged.

**Evidence** (evidence/ folder): before-1280-{discovery-new,planning,tracking}; after-{1280,390,360}-{discovery-new,unsuitable,override,details-open,planning,tracking}.

**Assessment against the reference** (judged against the verified stylesheet values and the described reference; I did not open the live reference site). Typography: Lilita One uppercase headings and Urbanist body are clearly present and read as the same family; the reference's own custom font differs slightly in shape. Palette: purple and lime dominate; coral, orange and light teal appear only in the motif, wordmark and decorative borders. Header: white, two-colour wordmark, lime bar under the current page. Buttons: purple and lime display-type primary buttons, outlined secondary and quieter Pass/Abandon. Motif: angular house shapes at the right of the band, smaller on phones, never overlapping the title (tested). Weak points: the motif is simple and flat compared with the reference's rough-edged shapes; the demo strip takes four lines on a 360 px phone; the grant list starts about 380 px down at 1280x800.

**Deviations.** Plan and spec did not conflict. Wordmark kept as mixed-case "YOR Plc" (not uppercased) to keep the exact demo name. Mark suitable also uses the display face. Grant and template headings became h2 so heading order is h1 then h2. The h1 has no focus outline when focused by script (it is not a control).

**Not tested.** Live comparison with the reference site, real phone devices, browsers other than Chromium.

**Deployment.** Not yet deployed at the time of this commit; result recorded in the following commit.

## Verification of this specification task

Repository startup documents, S0-002 revision 4, requirements/decisions and public/styles.css inspected. Existing uncommitted status/index/ticket edits preserved. Application tests were not run: this task changes documentation only. Live app could not be retrieved through the web reader; visual baseline is the user's screenshot plus local source.
