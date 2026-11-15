# Sprint 0: Discovery POC specification

Revision: 5.1 | Updated: 2026-11-15 | Status: reviewed by Claude and planned in [plan.md](plan.md); in implementation. S0-002 is already implemented. (Numbered 5.1 because the S1-001 draft already uses revision 6.)

This complete specification carries forward S0-002 revision 4 and adds the S0-003 visual change. It lives with [S0-003](ticket.md) per DEC-003. Only the presentation requirements and delivery notes are changed; earlier review resolutions below remain in force. Revision 5.1 replaces the screenshot-estimated fonts and colours with values verified from the reference stylesheet; nothing else changed.

## Review resolutions

The user answered Claude's review questions on 2026-11-15. The answers are folded into the sections below; this table is the record.

| # | Resolution | Source |
| --- | --- | --- |
| Q1 | Planning has an **Abandon** action that moves the grant to Passed. From there it can be restored to New and worked on again. No separate reset control. | User answer |
| Q2 | No separate undo for a manager override. Passing the grant is the equivalent. The override is kept if the grant is later restored. | User answer; "override is kept" is Claude's reading, consistent with revision 2 |
| Q3 | Overrides go one way only (unsuitable to suitable). | Claude recommendation, accepted |
| Q4 | Always show "N unsuitable hidden" with a Show all link when N > 0. Tab counts show totals regardless of the filter. | Claude recommendation, accepted |
| Q5 | A real Cloud Run deployment is in scope. Repository: https://github.com/sharmaaq/charity-funding. Google Cloud project: `charity-funding-514818`, under the user's own account. | User answer |
| Q6 | The demo charity is called **YOR Plc** everywhere in the application. The real charity it is modelled on is not named in the application. | User answer |
| Q7 | Stack is settled in [S0-002 implementation plan](../S0-002-discovery-suitability/plan.md). | Claude recommendation, accepted |
| Q8 | On a storage version mismatch or unreadable data, discard saved state and start from the fixtures. | Claude recommendation, accepted |

## Goal and agreement

Build a usable responsive website for a fundraising manager at YOR Plc, the demo charity, to review grants, understand suitability recommendations, override them and decide what to pursue. The user wants a working Discovery UI to react to before specifying the full field list. Planning & submission and Tracking are navigable template placeholders only.

Agreed source: user instructions of 2026-11-15 approving browser-only state, mixed suitability examples, visible reasons/icons, filtering, overrides, and placeholders, as recorded by ChatGPT and confirmed by the user's review of revision 3. Existing responsive-web, fixed-feed and no-AI constraints carry forward from the original POC. Detailed UI choices below are implementation defaults delegated by the request to build something usable, not separately approved final designs. Interpret the user's reference to the 'delivery phase' as Discovery in this three-phase context.

## Scope

- Functional Discovery; desktop table, responsive phone cards with equivalent details/actions.
- Six fixed demo opportunities: the original three plus three initially unsuitable records listed below. No runtime AI, live grant search or automated discovery.
- Persistent browser-local decisions and filter preferences. No login, backend state database, organisation management or cross-device synchronisation.
- Planning & submission displays selected grants and a clearly labelled future-work template. Tracking is a clearly labelled future-work template. Neither simulates a completed submission or funding outcome.
- Deploy the application to Google Cloud Run in project `charity-funding-514818`, keep the source in the GitHub repository, and document local run, test and deploy steps. Select a simple stack suitable for this otherwise blank application; existing Java IDE metadata is not a stack requirement. Record the choice and actual commands.

## State and meaning

Each grant has one immutable stable ID and one workflow state: `new`, `watchlist`, `passed` or `planning`. Suitability is separate from workflow state.

Keep the original recommendation (`suitable` or `unsuitable`), its reason and source references. A browser-local manager override can set an originally unsuitable grant's effective suitability to suitable. Overrides go one way only and have no undo action; a manager who changes their mind passes the grant. Display 'Suitable - manager override' and retain the original recommendation and reason in details. The override reflects the manager's decision, not a change to the funder's rules. Do not require accounts or an override explanation for this POC.

Persist workflow states, suitability overrides and the hide-unsuitable preference using localStorage, under an app-specific versioned key. A reload restores them. If the saved data is unreadable or has a different version, discard it and start from the fixtures. A fresh browser profile starts independently with the demo fixtures. People sharing the same browser profile and origin share that local demo state; there is no per-person isolation without future authentication. Avoid wording that claims each person has a private account. Gracefully report if storage is unavailable and continue the session in memory.

Future scope: logged-in users, multiple users per organisation, shared backend state, permissions and synchronisation. Do not implement these in Sprint 0 or pre-empt their detailed design.

## Discovery UI and actions

Discovery opens on New. New, Watchlist and Passed are always reachable, including when empty. The initial New view uses 'Show all' and shows all six demo grants. 'All' means all suitability assessments within the selected workflow view, not a mixture of Passed and New.

Provide a conspicuous two-option control: **Show all** / **Hide unsuitable**. Save the preference across reloads and visits. Interpret 'open unsuitable grants' as actionable grants in New/Watchlist, not whether an external application deadline remains open. Filtering never passes or deletes a grant. Whenever the filter hides at least one record in the current view, show "N unsuitable hidden" with a Show all action, including when it hides every record. The counts on New, Watchlist and Passed show the total in that workflow state regardless of the filter. Passed remains accessible and unfiltered so discarded grants can be reviewed/restored. A passed grant does not reappear in New when the filter changes.

| View and effective suitability | Available actions | Result |
| --- | --- | --- |
| New, suitable | Watch; Plan application; Pass | Move respectively to Watchlist, Planning, or Passed. |
| Watchlist, suitable | Plan application; Pass | Move to Planning or Passed. |
| New, unsuitable | Mark suitable; Pass | Override suitability in place, or move to Passed. An unsuitable grant cannot reach Watchlist without an override. |
| Passed, either suitability | Restore to New | Restore workflow state; keep any existing override. |
| Planning (shown in Planning & submission) | Abandon | Move to Passed. It can be restored to New from there. |

Plan application opens Planning & submission and shows the selected grant in its placeholder list. It creates no duplicate grant. No active Watch/Plan actions for unsuitable records until Mark suitable is used. An override makes the regular suitable actions available immediately and the record remains visible under Hide unsuitable. Passing and restoring does not erase the original assessment. Repeated clicks and reloads must not duplicate records.

## Provisional fields and presentation

The full field list is explicitly deferred to the next iteration. Do not wait for it. For this reviewable version, show:

- Grant name and funder; amount; deadline or rolling/open wording; short purpose; source link.
- A Suitability column/section with icon AND text. Use an obvious warning/cross icon plus 'Unsuitable' for rejected recommendations, a check plus 'Suitable' otherwise, and a distinct manager-override label.
- The unsuitable reason must be readable in the row/card without requiring a hover or opening a modal. Colour alone is insufficient. Details can expand the source evidence and original assessment.
- Clear, labelled action buttons, workflow-view counts and useful empty states. No dead buttons that look functional.

## S0-003 visual design requirements

Match the supplied Your Place homepage's design language substantially more closely. The requirement to restyle is agreed by the user's 2026-11-15 request; the following measurements and approximations are concrete implementation defaults. Sources and verification limits are in [visual research](research.md).

### Typography

Verified from the reference stylesheet (see research): headings use a custom font with Lilita One as the declared fallback; body text uses Urbanist at weight 600. The custom heading font belongs to the charity and must not be copied. Use **Lilita One** for page headings, prominent section titles, the wordmark and primary button labels, and **Urbanist** (600 normal, 800 bold) for body copy, navigation and table text. Do not leave system-ui as the designed primary font. Bundle the font files with their Open Font License texts, make no external font requests, use font-display: swap and retain legible fallbacks.

Use display headings in uppercase with 0.05em tracking (the reference value); approximately 36-44 px desktop and 28-32 px phone. Body is 16 px with 1.5-1.6 line height. Grant titles remain readable sentence-case, 18-20 px in bold body type. Do not use decorative lettering for long suitability explanations. Verify both actual font loading and the computed family after loading.

### Colour and shape

Create shared CSS tokens using the values verified from the reference stylesheet: purple #442C86; lime #D7DB2D; navy #232551 (text on lime); coral #ED6A53; orange #EA720D; teal #00959A; light teal #87C0CA; light lilac #F5F3F8 for panels; body ink #262626; white surfaces. These replace the earlier muted palette. Purple and lime are the dominant brand pairing; coral/orange and teal/lavender are supporting accents, not six competing row colours.

Use navy or purple text on lime and white text on purple. Test normal text contrast >=4.5:1, large text >=3:1 and controls/focus indicators >=3:1 against adjacent colours. Do not assume white text on orange/coral or lime is accessible. Preserve distinct suitable/unsuitable semantic icon-plus-text badges; they need not use the brand accent colours.

Use mostly rectangular, lightly softened controls (roughly 0-4 px radius), bold display primary labels and optional restrained rough-edge decoration. Add a small original geometric roofline or angular motif to the page-title band, echoing the reference. Decoration must not clip labels, obscure focus outlines, intercept pointer events or enter the accessibility tree. No large photographic hero above the working list.

### Application layout

1. A compact lime demo strip with purple text, preserving the snapshot and assessment caveat. This adapts the reference's top strip to useful application content; no newsletter or donation controls.
2. A white header with more breathing room (roughly 76-88 px desktop), a prominent two-colour YOR Plc wordmark using the chosen type and the three existing navigation destinations. Retain the exact demo name; do not include the real logo or real charity name in served files. Wrap neatly on mobile.
3. A compact purple page-title band with white display lettering ('Discovery', or the current phase) and a restrained geometric accent. Aim for 96-140 px desktop; reduce on phone. It should establish the reference's character without pushing the grant list far below the fold.
4. White workspace with clear spacing between the tabs, suitability filter and grant table/cards. Use purple-and-lime active/selected states with an additional border/shape/text cue. Preserve counts and the hidden-unsuitable message.
5. Keep the four-column desktop table and phone cards. Use a purple header, white rows, quiet separators, consistent 16-20 px cell padding and restrained pale tinted detail panels instead of dominant blue bars. Keep reasons visible and preserve all content/actions. Primary actions use purple/white or lime/purple; secondary actions are quieter outlined controls. No hover-only actions.
6. Apply the same shell, type, tokens and button treatment to Planning & submission and Tracking, including their empty/template states. Do not add functionality to either placeholder.

Use a centred workspace around 1200-1320 px wide, with 24-32 px desktop gutters and 16 px phone gutters. Preserve at least 44 px touch targets. At 360, 390 and 1280 px, labels, navigation, filters and action groups must fit without page-level horizontal scrolling; long grant names wrap naturally. Keep keyboard focus clearly visible on every surface.

### Visual acceptance and evidence

- REQ-008 (revised): reference-style display/body typography, stronger purple/lime palette, white header and compact title band are visibly present across all phases; suitability icons, text and reasons remain accessible. The restyle cannot be satisfied by changing only two hex values.
- REQ-014 (new): provide before/after screenshots at 1280 px and after screenshots at 390 and 360 px; include initial Discovery, an unsuitable record, a manager override, expanded details and Planning/Tracking. Compare them with the supplied reference and explicitly assess typography, palette, header, buttons and geometric detail. Record chosen font sources/licences, actual font-loading result, final CSS tokens and measured contrast pairs.
- Preserve REQ-001 through REQ-013 except the explicit REQ-008 presentation revision. Keep storage keys/schema and existing saved decisions intact. Keep YOR Plc naming, source links, grant data, all transitions (including Abandon), filtering/counts and placeholders unchanged.
- Run the existing unit/Playwright regression suite after implementation and record actual results. Add or adapt only checks needed for font loading, overflow or affected layout; do not rewrite functional expectations to hide regressions. Visual comparison is required in addition to passing tests.

## Demo dataset

Display 'Demo discovery - 15 November 2026 snapshot' and make clear assessments are demo recommendations. Dates remain fixed and records stay usable after deadlines. 'Suitable' means a candidate to assess, not verified eligibility or a funding promise. Keep all six in one fixture file with source URLs and assessment reasons; do not create live integrations.

YOR Plc profile for assessment: a London homelessness housing and support charity with reported annual income of about GBP 7.1m. YOR Plc is a demo name. The profile is modelled on a real charity whose name and registration number are recorded only in the research file and must not appear in the application. Source evidence and limitations: [grant research](../S0-002-discovery-suitability/research.md).

| Stable ID | Opportunity / funder | Amount and timing for demo | Initial assessment and reason | Guidance |
| --- | --- | --- | --- | --- |
| G-001 | Regular Grants / Garfield Weston Foundation | Under GBP 100,000; rolling (original snapshot) | Suitable candidate: core, project or capital support can fit the charity's work; application/project eligibility still requires review. | [Apply](https://garfieldweston.org/for-grant-applicants/how-to-apply/) |
| G-002 | Reaching Communities England / The National Lottery Community Fund | From GBP 20,001; open at snapshot | Suitable candidate: community support in England and tackling disadvantage align with the demo profile; a qualifying project must be developed. | [Programme](https://www.tnlcommunityfund.org.uk/funding/funding-programmes/reaching-communities-england) |
| G-003 | DPS Social Commitment Programme - Scale / School for Social Entrepreneurs | Up to GBP 10,000 plus learning; original snapshot extension to noon UK time 17 November 2026 | Suitable candidate: housing insecurity/homelessness theme aligns; growth, trading and participant requirements need checking. | [Programme](https://www.the-sse.org/programme/the-dps-social-commitment-programme-scale/) |
| G-004 | Capital grants / Help the Homeless | Up to GBP 5,000; next quarterly deadline 20 December 2026, 17:00 | Unsuitable: restricted to charities with turnover below GBP 500,000; YOR Plc's GBP 7.1m reported income exceeds this size limit. Capital-only; no core costs/salaries. | [Criteria](https://www.help-the-homeless.org.uk/applying-for-funding) |
| G-005 | Sustaining Accommodation Fund / St Martin-in-the-Fields Charity | Up to GBP 5,000 block grant, up to GBP 500 per person; published closing date 27 November 2026, 17:00 | Unsuitable: applicants need annual income below GBP 2m; YOR Plc reported GBP 7.1m. The homelessness theme fits, but organisational size does not. | [Fund](https://smitfc.org/sustaining-accommodation-fund/) |
| G-006 | National Lottery Awards for All Scotland / The National Lottery Community Fund | GBP 300-20,000 for community-led projects; open at snapshot | Unsuitable for this London service scenario: funds projects in Scotland. This is a project-location mismatch, not a blanket claim that a London-registered charity could never run a Scottish project. | [Programme](https://www.tnlcommunityfund.org.uk/funding/funding-programmes/national-lottery-awards-for-all-scotland) |

G-004 and G-005 were recovered from previous research and rechecked. G-006 is newly researched for this iteration. Do not mark the previously discussed GLA/Housing Justice opportunity ineligible merely because example applications or portal evidence were unavailable; missing evidence is not a failed funding criterion.

## Planning & submission and Tracking placeholders

Planning & submission must be a polished navigable page titled as such with a visible 'Placeholder - future iteration' notice. Show the grants moved from Discovery (name, funder, source, suitability) and template sections such as Application preparation and Submission. These sections can contain descriptive placeholder text, not fake editable application forms or functional submission controls. The one working control is **Abandon** on each grant, which moves it to Passed and tells the manager where it went. Empty state: select a suitable grant from Discovery. Grant details remain accessible.

Tracking must be navigable with 'Placeholder - future iteration' and clearly unpopulated template sections for application status and outcomes. Do not create fake applications, dates, Awaiting decision records or a Record demo submission button. The original proposed planning-note/submission/tracking flow is superseded.

## Acceptance criteria and verification

| ID | Current acceptance criteria | Status/source |
| --- | --- | --- |
| REQ-001 | All three areas reachable on desktop/phone; no horizontal page overflow at 360/390 px. | Agreed scope; viewport sizes carried-forward implementation defaults. |
| REQ-002 | Fresh browser shows six New records, three suitable and three unsuitable; fixed snapshot banner; no AI/live discovery. | Agreed S0-002; six selected as implementation default for 'a few'. |
| REQ-003 | Actions in the transition table update the correct view immediately; Passed is recoverable; empty views remain accessible. Abandon in Planning moves the grant to Passed. | Agreed Discovery scope; Abandon agreed 2026-11-15 (Q1). |
| REQ-004 | One record per stable grant ID; details remain accessible across views; repeated actions cannot duplicate it. | Retained implementation constraint. |
| REQ-005 | Plan application moves a suitable grant to the Planning placeholder and opens it; Abandon is its only working control; no submission functionality. | Agreed S0-002; replaces earlier proposal. |
| REQ-006 | Tracking is a labelled template with no fabricated submitted applications or outcomes. | Agreed S0-002; replaces earlier proposal. |
| REQ-007 | Reload preserves actions, overrides and filter preference; a separate browser starts fresh; no login/shared state. | Explicitly agreed S0-002. |
| REQ-008 | Meet S0-003 visual design requirements above while retaining readable suitability icons, text, reasons and accessible controls. | User requested closer visual alignment; implementation defaults specified above. |
| REQ-009 | Document fresh-checkout run/test/deploy; service honours PORT and listens on 0.0.0.0; deployed to Cloud Run in `charity-funding-514818` and the HTTPS URL checked on a phone; source pushed to GitHub. | Deployment agreed 2026-11-15 (Q5). |
| REQ-010 | Automated state/filter tests and desktop/phone smoke tests below pass, or actual gaps are recorded. | Validation required by shared workflow. |
| REQ-011 | Show all initially includes six; Hide unsuitable leaves three and shows "3 unsuitable hidden"; tab counts unchanged by the filter; filter persists and does not pass/delete records; Passed remains reviewable. | Agreed filter; defaults/semantics specified here. |
| REQ-012 | Mark suitable on G-004 enables Watch/Plan, shows manager override, preserves original rejection reason, survives reload and appears under Hide unsuitable. | Explicitly agreed S0-002. |
| REQ-013 | All six fixtures include sources/reasons; unsuitable reasons identify concrete size/location mismatches; the application names the charity only as YOR Plc. | Agreed mixed suitability dataset; naming agreed 2026-11-15 (Q6). |

| REQ-014 | Supply visual comparison evidence, loaded fonts, final tokens, measured contrast and responsive checks specified above. Evidence screenshots are saved in this ticket's `evidence/` folder. | New S0-003 validation criteria. |

Automated checks: fresh six/three counts; filtering without mutation; unsuitable Pass then Restore; unsuitable override then Watch then Plan; original reason retained; uniqueness after repeated actions; Plan then Abandon then Restore; hidden count and tab counts under the filter; storage round-trip, discard on version mismatch, and fresh-context isolation; no occurrence of the real charity's name or number in served files. Smoke-test navigation, immediate feedback, empty states, readable reasons and keyboard/phone use at the stated widths. Verify that no submission controls or generated tracking records exist. Do not report deployment as tested unless the actual URL was checked.

## Delivery notes

S0-002 is deployed. This ticket requests a visual change, not a new build of its functionality. It is planned in [plan.md](plan.md) and, under the shared workflow (DEC-006), the implementing model builds, tests, commits, pushes and deploys it; the user reviews the deployed result. Preserve unrelated changes and saved browser state. Record implementation and actual validation in this ticket and docs/status.md. The full Discovery field list remains deferred.
