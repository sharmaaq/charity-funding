# Visual reference and implementation evidence

Inspected 2026-11-15.

## Sources

- User-provided screenshots in this task: deployed Discovery and Your Place homepage. These are the visual reference, not a claim that the existing POC matches it.
- [Your Place homepage](https://your-place.org.uk/): web text retrieved; direct CSS/computed-style inspection could not be completed (local network lookup and browser-session access failed).
- [User-provided deployed app URL](https://charity-funding.cloud.run/): web reader could not retrieve it. No claim of direct live visual testing.
- Local public/styles.css: system-ui body font; #352253 purple, #f58a48 orange; #f3eff8 and #eaf3fa panels. No brand display or body webfont defined. Inspected alongside S0-002 spec revision 4.

## Visible reference characteristics

The homepage screenshot has a vivid yellow-green top strip, spacious white navigation, a saturated purple hero, large chunky irregular uppercase headings, rounded geometric body text, coral lettering in the logo, orange section headings and teal/lavender/lime geometric blocks. Buttons are rectangular with heavy uppercase display lettering and a subtle rough-edge appearance. The app screenshot instead has compact system typography and predominantly muted purple/pale blue components.

Suggested starting palette is an estimate from the supplied image, NOT extracted official brand tokens: purple #442D80, lime #D7DF23, coral #F46B56, orange #F57500, teal #83BEC9, lavender #9784BA. White and dark ink complete the palette. Verify actual CSS values where possible; record any adjustments made for accessible contrast.

Exact font family names are unverified. Inspect the reference CSS before choosing. If its fonts are unavailable for use, Lilita One for display and Poppins for body are proposed freely available visual approximations, not claims about the official font. Verify the selected font's licence/source, include any required notices, and serve locally where practical. Document the substitution explicitly.

No homepage photography, resident images, donation form or actual charity logo is needed for the grant application. Adopt the visual language while keeping YOR Plc and the established privacy requirement (REQ-013).

## Verified from the reference stylesheet (Claude, 2026-11-15)

Source: the reference site's theme stylesheet, `/wp-content/themes/your-place/assets/css/style.css?v=309`, fetched and read directly on 2026-11-15. These values replace the screenshot estimates above.

| Item | Verified value |
| --- | --- |
| Heading font | `font-family: YourPlace, "Lilita One", sans-serif`; uppercase; `letter-spacing: 0.05em`; weight 400; h1 34 px rising to 52 px on wide screens |
| Body font | `Urbanist, sans-serif`, weight 600 as the normal weight; a heavier cut (the ExtraBold file) for bold |
| Purple | `#442C86` |
| Lime | `#D7DB2D`; lime buttons carry navy text `#232551` |
| Coral | `#ED6A53` |
| Orange | `#EA720D` |
| Pink | `#EA5178` |
| Teal / light teal | `#00959A` / `#87C0CA` |
| Light lilac panel | `#F5F3F8` |
| Body text | `#262626` |

Decisions that follow:

- The heading font "YourPlace" is a custom font file served by the charity. It is their property and is not used. **Lilita One** is the fallback their own stylesheet names, so it is the closest legitimate match rather than a guess. Licence: SIL Open Font License.
- The body font is **Urbanist**, not Poppins as proposed above. Licence: SIL Open Font License.
- Both are bundled in the application from the `@fontsource` packages (download URLs in [plan.md](plan.md)); the application makes no external font requests.
- Not verified: the reference's computed styles in a browser, and exact spacing. The address `charity-funding.cloud.run` recorded above is not a real address; the deployed application is at https://charity-funding-36580608208.europe-west1.run.app.
