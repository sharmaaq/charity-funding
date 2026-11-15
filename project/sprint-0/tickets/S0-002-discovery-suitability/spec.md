# Sprint 0: Discovery POC specification

Revision: 4 | Updated: 2026-11-15 | Status: approved by the user for planning (2026-11-15). Implementation waits for approval of [plan.md](plan.md).

This is the current Sprint 0 specification. It lives with its ticket, [S0-002](ticket.md), per DEC-003. Revision 2 was drafted by ChatGPT; revision 3 was Claude's review pass; revision 4 folds in the user's answers. The [original draft](../S0-001-initial-requirements/charity-funding-poc-spec.md) is historical only.

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
| Q7 | Stack is settled in [plan.md](plan.md). | Claude recommendation, accepted |
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

Use an uncluttered theme: white background, deep purple headings/primary actions, pale panels, orange accents. Starting colours: #352253, #F58A48, #F3EFF8, #EAF3FA; adjust contrast as needed. Keep keyboard focus visible, controls labelled and touch targets comfortable (aim for 44 px). At 360 px and 390 px, use stacked cards without page-level horizontal scrolling; verify desktop at approximately 1280 px. This is a first UI for feedback, not a final design system.

## Demo dataset

Display 'Demo discovery - 15 November 2026 snapshot' and make clear assessments are demo recommendations. Dates remain fixed and records stay usable after deadlines. 'Suitable' means a candidate to assess, not verified eligibility or a funding promise. Keep all six in one fixture file with source URLs and assessment reasons; do not create live integrations.

YOR Plc profile for assessment: a London homelessness housing and support charity with reported annual income of about GBP 7.1m. YOR Plc is a demo name. The profile is modelled on a real charity whose name and registration number are recorded only in the research file and must not appear in the application. Source evidence and limitations: [grant research](research.md).

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
| REQ-008 | Table/cards visibly show icon, text and rejection reason; usable focus, labels, contrast and touch actions. | Agreed suitability visibility; visual treatment delegated. |
| REQ-009 | Document fresh-checkout run/test/deploy; service honours PORT and listens on 0.0.0.0; deployed to Cloud Run in `charity-funding-514818` and the HTTPS URL checked on a phone; source pushed to GitHub. | Deployment agreed 2026-11-15 (Q5). |
| REQ-010 | Automated state/filter tests and desktop/phone smoke tests below pass, or actual gaps are recorded. | Validation required by shared workflow. |
| REQ-011 | Show all initially includes six; Hide unsuitable leaves three and shows "3 unsuitable hidden"; tab counts unchanged by the filter; filter persists and does not pass/delete records; Passed remains reviewable. | Agreed filter; defaults/semantics specified here. |
| REQ-012 | Mark suitable on G-004 enables Watch/Plan, shows manager override, preserves original rejection reason, survives reload and appears under Hide unsuitable. | Explicitly agreed S0-002. |
| REQ-013 | All six fixtures include sources/reasons; unsuitable reasons identify concrete size/location mismatches; the application names the charity only as YOR Plc. | Agreed mixed suitability dataset; naming agreed 2026-11-15 (Q6). |

Automated checks: fresh six/three counts; filtering without mutation; unsuitable Pass then Restore; unsuitable override then Watch then Plan; original reason retained; uniqueness after repeated actions; Plan then Abandon then Restore; hidden count and tab counts under the filter; storage round-trip, discard on version mismatch, and fresh-context isolation; no occurrence of the real charity's name or number in served files. Smoke-test navigation, immediate feedback, empty states, readable reasons and keyboard/phone use at the stated widths. Verify that no submission controls or generated tracking records exist. Do not report deployment as tested unless the actual URL was checked.

## Delivery notes

No further field-list review is needed before implementation starts, but the user's approval of [plan.md](plan.md) is (see [workflow](../../../../docs/workflow.md)). Preserve unrelated changes. Deliver a locally runnable app first, then the Cloud Run deployment. Do not invent credentials, regions or settings the user has not confirmed. A deployment problem must not block local delivery.

Implementation files, chosen stack, commands, test results and discrepancies are recorded in the [ticket](ticket.md) and docs/status.md, not here. Change this spec only for agreed requirements or explicitly recorded implementation defaults; do not rewrite requirements to match code.
