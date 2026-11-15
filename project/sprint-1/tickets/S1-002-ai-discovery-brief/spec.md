# Sprint 1: Discovery demo completion specification

Revision: S1-002 draft 1, reviewed by Claude 2026-11-15 | Status: reviewed and planned in [plan.md](plan.md); in implementation together with S1-001.

## Review decisions (Claude, 2026-11-15)

S1-001 had not been implemented when this ticket was reviewed, so both tickets are built together from this spec. No requirement below was changed; these decisions settle points the drafts left open.

| # | Decision | Reason |
| --- | --- | --- |
| R1 | The real fixtures keep only their sourced closing dates and get no opening dates. A timing preview at `?preview=timing` overlays clearly labelled synthetic dates so Upcoming and coexisting markers can be seen at any time. It is not linked from the normal UI. | S1-001 asked Claude to confirm how Upcoming is demonstrated. No real opening dates exist, and the real 2026 deadlines will pass, after which no markers would show. |
| R2 | From 900 px wide the AI discovery panel is two columns (textarea beside the helper text and button). | The grant list already starts far down the page; a full-width seven-line textarea would push it further. |
| R3 | The brief and the discovery freshness marker are optional fields in the existing v1 saved state. | Both drafts required that existing saved decisions are not reset. |
| R4 | The Discover result behaviour is S1-001's as drafted: first suitable grant still in New, in fixture order; one New badge; kept until the manager acts on that grant or another run selects a different one. | S1-002 defers to S1-001 for this and S1-001's defaults needed no correction. |
| R5 | The preview file `discovery-brief-preview.html` mentioned in the ticket is not in the repository, so the panel follows this spec's text. | Checked on disk 2026-11-15. |

This complete specification carries forward the on-disk S1-001 baseline, replaces REQ-016 with the editable AI-discovery brief, and incorporates the verified visual section from S0-003 revision 5.1. S1-001 and other parallel tickets remain independently owned; inspect their latest reviewed specs/code before implementation and record reconciliation rather than reverting their corrections. This ticket does not replace separate Sprint 2 work. Sprint 1 explicitly revises the no-discovery-control baseline; no live discovery or background agent is implemented. Earlier scope and acceptance criteria remain in force except those explicitly revised below.

## Sprint 1: timing markers and simulated discovery

Agreement source: user's 2026-11-15 request to start Sprint 1 and complete the Discovery demo. The two features, compact icon markers beside names, no additional filtering, and reuse of an existing grant are agreed scope. Exact boundaries, clock, marker lifetime and rediscovery selection below are proposed defaults for review, not separately user-approved decisions. More marker criteria may follow; do not invent them now.

### REQ-015: Compact timing markers

- Show **Upcoming** with a calendar icon when the opening date is tomorrow through seven calendar days ahead, inclusive. An opening today is no longer upcoming.
- Show **Due soon** with a clock icon when the closing date is today through one calendar month ahead, inclusive. Add one calendar month and clamp to the last valid day (31 January -> 28/29 February). Exclude a deadline whose known exact closing time has already passed; a date-only deadline remains due through the end of that London date.
- Evaluate using the current Europe/London date/time, not the fixture snapshot date or a hard-coded build date. Recalculate on rendering, return to the tab and the next London midnight; known closing instants also expire while the page remains open. Tests inject a clock.
- Use explicit optional opening date and closing date/time fields; do not parse the human-readable timing copy. Missing, invalid or rolling dates produce no corresponding badge. Contradictory ranges (opening after closing) produce no timing badges and are flagged during fixture validation. Do not infer dates from absent evidence.
- Both markers may coexist when both conditions hold, including a short window which opens soon and closes within a month. They are informational and do not change suitability or available actions.
- Put small icon-plus-short-text badges immediately alongside the grant name in desktop rows and mobile cards. Wrap beneath the name within the same title block when needed; no extra full-width status column. Colour alone and hover-only explanations are insufficient. Keep names readable and retain the existing suitability treatment.
- Show markers wherever a grant appears within Discovery (New, Watchlist, Passed). No new filtering or sorting controls; preserve the existing Show all / Hide unsuitable control and counts. Do not introduce additional date-status categories yet.

Acceptance examples using 15 November 2026 as the test clock: opening 16 or 22 November -> Upcoming; opening 15 or 23 November -> no Upcoming. Closing 15 November before expiry or 15 December -> Due soon; closing 14 November or 16 December -> no Due soon. Test month-end, leap year, London midnight, both badges, missing/rolling dates and expired exact times.

Fixture evidence: current public/js/fixtures.js contains timing strings and no structured opening dates. Add structured closing dates only for the already documented dated examples G-003, G-004 and G-005; preserve the snapshot caveat. Do not invent a real funder's opening date to force a badge. For review/demo evidence, use a clearly labelled synthetic timing override in a test/preview fixture to demonstrate Upcoming; the real six-grant fixture retains its sourced timing. This preview is not a new user-facing settings feature. Confirm during Claude review if a permanently visible synthetic Upcoming example is desired. As time passes the fixed snapshot may naturally show fewer badges.

### REQ-016: AI-style discovery driven by an editable brief (S1-002)

Agreement: user requested a new ticket on 2026-11-15 to evolve Discover into an AI-style flow, with a natural-language criteria textbox prefilled from the existing charity profile. Manual and future background discovery use the same brief. The user confirms Claude is reviewing/fixing/implementing S1-001, so its final reviewed behaviour may differ from the earlier draft. This ticket extends that work, not a request to revert it. Detailed copy, persistence and loading choices below are proposed implementation defaults.

#### Editable discovery brief

At the top of Discovery, show one compact panel headed **AI discovery**, containing a visible label **What funding are you looking for?**, an editable multiline textarea and a primary **Discover with AI** button with a small sparkle icon. Replace the existing Discover control; do not add a second discovery button or a chat conversation UI. Keep the panel available across New, Watchlist and Passed. Use existing styling, legible body text, responsive width and a roughly 5-7 line textarea on desktop, naturally wrapping/scrolling on phone. This is the main way to guide discovery, not a new table filter.

Pre-populate the actual textarea value (not placeholder text) with this proposed paragraph:

> Find grants for YOR Plc, a London-based charity providing housing and support for people experiencing homelessness, with annual income of approximately GBP 7.1 million. Look for funding for homelessness prevention, accommodation, support services and projects that help people move towards independent living. Include core and running costs, project funding and capital improvements where the fund permits them. Focus on programmes that support work in London or across England and accept charities of our size. Flag funds whose income limits or project-location requirements make us unsuitable, and explain why. Include rolling programmes and opportunities that are open or opening soon. For each opportunity, show the funder, available amount, opening and closing dates where known, a source link and a short explanation of fit; distinguish confirmed eligibility conditions from points that need checking.

The London housing/support profile and approximately GBP 7.1m income come from the existing demo evidence, not a new verification of current accounts. The wider wording is proposed search guidance, not a claim that every listed activity or funding category is a verified organisational fact. Do not invent a target award minimum, maximum, staff count or other organisational constraint. Use YOR Plc in shipped defaults as required by the existing demo-identity decision; the user's reference to Your Place identifies the source profile. User-entered wording is not forcibly renamed.

Helper copy: **Describe your sector, location, organisation size and funding priorities.** Add a restrained **Demo** label and: **This demo uses sample grants. In the full service, AI discovery will use this brief for both manual searches and automatic background searches.** Do not suggest automatic discovery is active now.

#### Saving and using the brief

- Save edits locally as the manager types (a short debounce is acceptable). On Discover, capture and save the latest text even if a debounce has not fired. Navigation/reload retains it; ordinary rendering must not overwrite it with the default.
- Apply the prefilled paragraph only when no brief has ever been saved. Preserve intentional empty edits, then show a linked inline validation message on an empty/whitespace-only submission: **Enter your discovery criteria first.** No run or grant mutation occurs for invalid input. No extra Save/Reset button is required.
- Store the brief as an optional addition to current browser-local data or a compatible separate key; preserve grant decisions, overrides, existing filters and discovery freshness. Missing brief data must not trigger a whole-state reset. Existing unavailable-storage notice/in-memory fallback applies; do not claim durable saving if it fails.
- At activation, capture an immutable run snapshot of the entered brief. The mock discovery function receives it as input. The future manual/background implementation should read the same saved criteria, with each run capturing its own snapshot; do not create a separate background prompt or implement a scheduler/API now.
- During a run, disable the submit button and make the textarea temporarily read-only so the submitted criteria are unambiguous. Re-enable on completion or error. Prevent duplicate runs. Do not insert user text as HTML.

#### Simulated AI run and results

- Clicking the button visibly enters a short **Discovering grants...** state with a spinner and an accessible status announcement. Suggested duration is about 1 second, bounded around 0.8-1.5 seconds for the demonstration; respect reduced motion and avoid fake progress percentages or claims about websites/models actually contacted. This deliberately supersedes S1-001's instant-only presentation if implemented.
- Pass the captured brief to a local mock operation, then use S1-001's reviewed discovery-result behaviour: reuse existing grants, mark the discovered result **New**, reveal the relevant result and retain stable IDs, counts, workflow decisions and overrides. Do not duplicate six grants, move all records back to New, or clear the board before the run.
- The complete existing grant collection remains available through its workflow tabs and existing suitability filter. The request to show grants is not a new instruction to override the user's filter, remove previously rejected grants, or reset Planning. No extra criteria filtering, ranking, prompt parsing or regenerated suitability assessments is implemented in this POC.
- Completion copy should explain the result in demo terms, for example **Demo discovery complete - 1 grant marked as new.** Beside the panel keep **Sample results are fixed in this demo; editing the brief does not change the grant selection.** This makes the brief-driven future workflow clear without pretending the mock understands arbitrary text.
- Retain S1-001's reviewed handling if no grant is eligible for demo rediscovery; report the actual no-result condition without claiming a grant was found. A failed mock run reports a concise retry message, keeps the brief and existing grants, and returns controls to idle. The loading state is transient: a reload preserves the brief and completed state but must not leave the UI stuck busy or restart a run automatically.
- No external AI integration, credentials, live search, network submission of the brief, periodic polling, scheduler, background worker, accounts or shared storage is added. No automatic run on initial load or on every edit.

#### Acceptance and verification

1. A fresh browser displays the editable default paragraph, label, helper and one Discover with AI control; existing grant views and timing markers still work.
2. Editing, navigating and reloading retain the exact brief (including line breaks); a saved empty brief stays empty and is rejected on submit without changing grants.
3. Discover passes the latest non-empty brief to the mock exactly once, even if clicked repeatedly or before persistence debounce fires; a visible busy state announces progress and ends cleanly.
4. Successful runs retain S1-001's reviewed uniqueness, discovery marker and decision-preservation behaviour; no-result and error paths announce truthful outcomes and re-enable controls. Arbitrary edits do not silently change canned grant selection or suitability.
5. Existing saved state lacking brief fields loads without losing triage/overrides/filter/freshness. Unavailable storage still permits editing and discovery in memory with the existing notice.
6. No brief is sent to an external service, and no run occurs on load, edit or reload. The manual mock consumes the saved-brief snapshot; background use is explained as future functionality.
7. Check keyboard use, visible labels/focus, status announcements, reduced motion, long text and no horizontal overflow at 360/390/1280 px. Provide screenshots of populated idle, edited busy and completed results. Run relevant state/DOM regression tests and record actual results, not planned outcomes.

This expands REQ-016 and REQ-007 rather than allocating new IDs; REQ-008 and REQ-010 cover its accessible presentation and validation. REQ-015 and earlier reviewed functional behaviour remain unchanged.
### Scope changes and verification

REQ-002 now permits the local Discover simulation while retaining six fixed fixtures and no runtime discovery. REQ-007 extends persistence to optional freshness metadata. REQ-008 includes compact markers. REQ-010 adds meaningful date-boundary and discovery-state tests. REQ-004 uniqueness and all manager decisions remain protected. REQ-011 remains the existing suitability filter only. REQ-015 and REQ-016 are agreed feature scope with proposed detailed defaults above.

Implementation evidence must cover date evaluation with an injected clock, repeated discovery, persistence compatibility, manager-state protection, and desktop/mobile rendering at 1280/390/360 px including coexisting markers and long names. Run the relevant existing regression checks. Record actual results, screenshots and any discrepancies in ticket.md. The two features are the user's intended endpoint for this Discovery demo, subject to further criteria they may supply; this does not complete Planning or Tracking.

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
| Q7 | Stack is settled in [S0-002 implementation plan](../../../sprint-0/tickets/S0-002-discovery-suitability/plan.md). | Claude recommendation, accepted |
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

Match the supplied Your Place homepage's design language substantially more closely. The requirement to restyle is agreed by the user's 2026-11-15 request; the following measurements and approximations are concrete implementation defaults. Sources and verification limits are in [visual research](../../../sprint-0/tickets/S0-003-visual-theme/research.md).

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

YOR Plc profile for assessment: a London homelessness housing and support charity with reported annual income of about GBP 7.1m. YOR Plc is a demo name. The profile is modelled on a real charity whose name and registration number are recorded only in the research file and must not appear in the application. Source evidence and limitations: [grant research](../../../sprint-0/tickets/S0-002-discovery-suitability/research.md).

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

| REQ-014 | Supply visual comparison evidence, loaded fonts, final tokens, measured contrast and responsive checks specified above. | New S0-003 validation criteria. |

Automated checks: fresh six/three counts; filtering without mutation; unsuitable Pass then Restore; unsuitable override then Watch then Plan; original reason retained; uniqueness after repeated actions; Plan then Abandon then Restore; hidden count and tab counts under the filter; storage round-trip, discard on version mismatch, and fresh-context isolation; no occurrence of the real charity's name or number in served files. Smoke-test navigation, immediate feedback, empty states, readable reasons and keyboard/phone use at the stated widths. Verify that no submission controls or generated tracking records exist. Do not report deployment as tested unless the actual URL was checked.

## Historical S0-003 delivery notes (carried forward)

S0-002 is deployed. This ticket requests a visual change, not a new build of its functionality. Claude reviews S0-003 and follows the current shared workflow for planning, implementation and shipping. Do not treat the historical S0-002 plan as a plan for this restyle. Preserve unrelated changes and saved browser state. Record implementation and actual validation in this ticket and docs/status.md. Provide a local preview for UI review and distinguish it from any later deployment. The full Discovery field list remains deferred.

## Current S1-002 handoff

Claude reviews this ticket against the latest S1-001 implementation and records any reconciliation in ticket.md. Implement using the current static frontend and existing state/test tools under docs/workflow.md; no new model SDK or backend required. The specification task changes documentation only. Earlier S0-003 delivery notes are historical, not this ticket''s shipping instructions.
