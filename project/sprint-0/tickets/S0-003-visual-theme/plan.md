# S0-003 implementation plan

Version: 1 | Written: 2026-11-15 by Claude | Status: ready for the implementing model. Under the shared workflow (DEC-006) this plan runs straight through to commit, push and deploy.

Implements the S0-003 visual requirements in [spec.md](spec.md) revision 5.1, using the verified values in [research.md](research.md). The spec defines the outcome; this plan defines how. If they disagree, the spec wins and the implementer reports the conflict.

This is a restyle. Behaviour, data, state, storage key and routes do not change.

## Verified design values

Fonts (both under the SIL Open Font License, bundled locally, no external requests):

| Role | Family | Weights | File source |
| --- | --- | --- | --- |
| Display: page title, section headings, wordmark, primary button labels | Lilita One | 400 | `https://cdn.jsdelivr.net/npm/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2` |
| Body, navigation, table text | Urbanist | 600 (normal), 800 (bold) | `https://cdn.jsdelivr.net/npm/@fontsource/urbanist/files/urbanist-latin-600-normal.woff2` and `...-800-normal.woff2` |

Licence texts: `https://cdn.jsdelivr.net/npm/@fontsource/lilita-one/LICENSE` and `https://cdn.jsdelivr.net/npm/@fontsource/urbanist/LICENSE`. Save the fonts as `public/fonts/*.woff2` and the licences as `public/fonts/LICENSE-lilita-one.txt` and `public/fonts/LICENSE-urbanist.txt`. All five URLs returned 200 when checked on 2026-11-15.

The reference's own display font is a custom file belonging to the charity. Do not download or use it. Lilita One is the fallback the reference stylesheet itself declares.

Colour tokens (exact values from the reference stylesheet):

| Token | Value | Use |
| --- | --- | --- |
| `--purple` | `#442C86` | Title band, table header, primary buttons, headings, links |
| `--lime` | `#D7DB2D` | Demo strip, selected states, the Mark suitable button |
| `--navy` | `#232551` | Text on lime |
| `--ink` | `#262626` | Body text |
| `--lilac` | `#F5F3F8` | Quiet panels: reasons, details, placeholders |
| `--coral` | `#ED6A53` | Accent only: wordmark second colour, motif, decorative borders |
| `--orange` | `#EA720D` | Accent only: motif |
| `--teal` | `#00959A` | Accent only: motif |
| `--light-teal` | `#87C0CA` | Accent only: motif |

Rules: white text only on purple (or navy). Navy or purple text on lime. Never white or body text on coral, orange, teal, light teal or lime. Accent colours never carry meaning alone. Keep the existing green/red semantic colours for the suitability badges, adjusted only if a measured contrast check fails. Any extra neutral you need (borders, muted text) must be derived and listed in the report with its contrast.

Type rules: display text is uppercase with `letter-spacing: 0.05em`, weight 400. Page title about 40 px desktop, 30 px phone. Body 16 px, weight 600, line height 1.5. Grant names stay sentence case in Urbanist 800 at 18 to 20 px. Reasons and long text are never set in the display face. `font-display: swap`, with `system-ui, sans-serif` fallbacks.

## Layout

Top to bottom, on every route:

1. **Demo strip.** Lime background, navy text, full width. Carries the existing snapshot line and assessment caveat, unchanged in wording. It moves above the header.
2. **Header.** White, about 80 px tall on desktop. Wordmark "YOR Plc" in Lilita One: "YOR" in purple, "Plc" in coral at a size where coral on white passes 3:1 as large text (measure it; if it fails, use purple for both and put coral in an underline bar). Keep the "Grant funding (demo)" descriptor in body type. Navigation on the right in Urbanist 800, purple; the current page has a 4 px lime bar under it plus `aria-current`. On phones the navigation wraps under the wordmark.
3. **Title band.** Purple, about 110 px desktop and 72 px phone. One `h1` in white display type naming the current area: Discovery, Planning & submission, or Tracking. A roofline motif sits at the right edge: three or four simple angular house and block shapes in lime, coral, light teal and orange, drawn as inline SVG or CSS. It is `aria-hidden`, has `pointer-events: none`, never overlaps the title, and shrinks or hides below 480 px.
4. **Workspace.** White, centred, max width 1240 px, 24 px gutters on desktop and 16 px on phone.

Components:

- **Discovery tabs** (New, Watchlist, Passed): rectangular, 2 px radius. Selected: purple background, white text, 4 px lime bottom bar. Unselected: white with a 2 px purple border. Counts keep their accessible labels.
- **Filter control**: two joined buttons. Pressed: lime background, navy text, 2 px navy border and a leading check mark drawn in CSS. Unpressed: white with a purple border.
- **Buttons**: at least 44 px tall, 2 px radius. Primary (Plan application): purple, white Lilita One uppercase label. Mark suitable: lime with navy label. Secondary (Watch, Restore to New): white with 2 px purple border, Urbanist 800. Quiet (Pass, Abandon): white with a thinner neutral border. Hover and active states darken slightly; nothing appears only on hover.
- **Grant list**: keep the single DOM structure with cards below 900 px and the four-column grid from 900 px. Header row purple with white Urbanist 800 uppercase labels. White rows, thin neutral separators, 16 to 20 px cell padding. The unsuitable reason sits in a lilac panel with a coral left border, still with its icon and text. Details panels are lilac. Remove the pale blue bars.
- **Placeholder pages**: same shell. The "Placeholder - future iteration" notice becomes a lime-bordered lilac panel. Template sections are lilac panels with display-type headings. No new controls.
- **Focus**: 3 px navy outline with a white inner ring on light surfaces; lime outline on purple surfaces. Must stay visible on every control.

## Files

| File | Change |
| --- | --- |
| `public/fonts/` | New: three `.woff2` files and two licence texts |
| `public/styles.css` | Rewritten around the tokens and layout above |
| `public/index.html` | Reordered shell: strip, header, title band, workspace. Preload the display font |
| `public/js/app.js` | Presentation markup only: set the title-band `h1` per route, class names. No change to state calls, routes or action handling |
| `server.js` | Add `.woff2` (`font/woff2`) and `.txt` (`text/plain; charset=utf-8`) content types |
| `playwright.config.js` | If `BASE_URL` is set, use it as `baseURL` and start no local server; otherwise unchanged |
| `tests/unit/server.test.js` | Add: a font file is served as `font/woff2` |
| `tests/unit/theme.test.js` | New: see Tests |
| `tests/e2e/theme.spec.js` | New: see Tests |
| `tests/evidence/capture.mjs` | New: screenshot script, see Evidence |
| `README.md` | Fonts and licences note; how to run tests against a deployed URL |

Do not change `public/js/state.js`, `public/js/fixtures.js`, the storage key, or the meaning of any existing test.

## Steps

1. **Before screenshots first, before touching any application file.** Write `tests/evidence/capture.mjs`, start the current app, and capture the "before" set at 1280 px.
2. Download the fonts and licences. Add the server content types and their unit test.
3. Restructure `index.html` and `app.js` markup, then rewrite `styles.css`.
4. Add `theme.test.js` and `theme.spec.js`. Add the `BASE_URL` switch to the Playwright config.
5. Run `npm test`. Fix the restyle until the existing 22 unit and 45 browser tests and the new ones pass. An existing test may be edited only where the markup it selects has moved, never to relax what it checks; list every such edit.
6. Capture the "after" screenshots. Look at them. Compare with the reference (you may open https://your-place.org.uk/ in Playwright for your own comparison, but do not save its screenshot or any of its assets into the repository). Iterate on the CSS until typography, palette, header, buttons and motif clearly read as the same family.
7. Record results in the ticket and status (see Recording), then commit, push, deploy and verify (see Shipping).

## Tests

`tests/unit/theme.test.js`:

- The nine tokens above are defined in `styles.css` with exactly those values.
- WCAG contrast, computed in the test from the token values: white on purple, navy on lime, purple on lime, ink on white, ink on lilac, purple on white and purple on lilac are each at least 4.5:1. Print the measured ratios.
- `styles.css` declares `@font-face` for Lilita One and Urbanist with `font-display: swap`, every referenced font file exists, and both licence files exist.
- No file under `public/` references an `http://` or `https://` URL for a font, stylesheet or script.

`tests/e2e/theme.spec.js`, at all three viewport sizes:

- After `document.fonts.ready`, `document.fonts.check` is true for Lilita One 400 and Urbanist 600 and 800.
- The computed `font-family` of the title-band `h1` starts with Lilita One, and of `body` with Urbanist.
- The title band's computed background is the purple token and the demo strip's is the lime token.
- Each route shows exactly one `h1` with the right area name.
- Every request the page makes is same-origin.
- The motif is `aria-hidden` and does not intercept a click on the navigation.

The existing overflow, 44 px and keyboard tests already cover the layout requirements and must still pass.

## Evidence

`tests/evidence/capture.mjs` takes a base URL, a label (`before` or `after`) and an output directory, and saves PNGs named `<label>-<width>-<scene>.png` into `project/sprint-0/tickets/S0-003-visual-theme/evidence/`.

| Set | Widths | Scenes |
| --- | --- | --- |
| before | 1280 | discovery-new, planning, tracking |
| after | 1280, 390, 360 | discovery-new, unsuitable (G-004 in view), override (after Mark suitable on G-004), details-open, planning (one grant planned), tracking |

## Recording

Under the shared workflow the implementer records its own results before committing. Edit only these two places:

- `project/sprint-0/tickets/S0-003-visual-theme/ticket.md`: fill the "Implementation and validation" section with files changed, final tokens, font sources and licences, measured contrast ratios, font-loading result, test counts, the list of evidence files, your assessment of typography, palette, header, buttons and motif against the reference, deviations, and anything not tested. After deploying, add the revision name and the live checks.
- `docs/status.md`: update the S0-003 line under Progress and its line under Verification, and remove S0-003 from Next action. Leave every other line, including the S1-001 material, as it is.

Do not edit any other file under `docs/` or `project/`.

## Shipping

1. `git status`. The working tree also holds uncommitted documentation from the specification work (docs/, project/ including sprint-1). That is expected and goes in the same commit. If anything else unexpected is present, stop and report it.
2. Commit everything on `master` with a message that names S0-003 and summarises the restyle, ending with the two attribution lines given in the hand-off.
3. `git push origin master`.
4. Deploy: `gcloud run deploy charity-funding --source . --region europe-west1 --project charity-funding-514818 --allow-unauthenticated --max-instances 1 --memory 256Mi --quiet`. Always pass `--project`; never change gcloud's defaults.
5. Verify the live site at https://charity-funding-36580608208.europe-west1.run.app: `/` returns 200, a font file returns 200 as `font/woff2`, `styles.css` contains `#442C86`, and the full Playwright suite passes with `BASE_URL` set to that URL. Do not use `/healthz` for the live check; Cloud Run intercepts that path.
6. Add the deployment results to the ticket and status, commit that as a second small commit and push.

Stop and report, without a workaround, if the push is rejected, the deploy fails on permissions, or any step would change IAM or touch another Google Cloud project.

## Out of scope

Any change to behaviour, data or state. The `/healthz` path. The S1-001 markers and Discover button. The full Discovery field list. The real charity's name, logo, photographs or custom font.
