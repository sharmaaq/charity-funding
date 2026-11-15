# Charity Funding POC

Draft for review · 15 November 2026

**For Claude after review.** Build a responsive web application for a charity fundraising manager. The demo should let the manager review three discovered grants, decide which to pursue, and carry one through planning into tracking. It must work in a phone browser and run on Google Cloud Run, with the source kept in GitHub.

## Requested scope

- The three areas are **Discovery**, **Planning & submission**, and **Tracking**. Discovery is the main workflow for this draft.
- Discovery opens on **New** opportunities. The manager can **Watch**, **Plan application**, or **Pass**. Passed grants stay available for review and can be restored to New.
- Bundle the three grants below as a fixed discovery feed. Label it **Demo discovery** with the 15 November 2026 snapshot date. The POC simulates the future background discovery agent using these records. It runs without AI model calls or automated discovery.

## Discovery

Give the manager access to **New**, **Watchlist**, and **Passed** from Discovery, including when one of those lists is empty. Show the grant name, funder, amount, timing, a short funding summary, and a link to the funder's guidance. This gives the manager enough information to make the first decision. The detailed layout and assessment fields will be specified in the next review.

| View | Action | Result |
| --- | --- | --- |
| New | **Watch** | Move the grant to Watchlist for later consideration. |
| New or Watchlist | **Plan application** | Move the grant to Planning & submission and open its planning record. |
| New or Watchlist | **Pass** | Move the grant to Passed and take it out of the current list. |
| Passed | **Restore to New** | Return the grant to New so it can be considered again. |

Use one workflow state per grant, keyed by a stable grant ID. Show the result of each action immediately and keep the grant details available wherever it appears. Repeating an action must leave a single record. An empty New list should point the manager to Watchlist and Passed.

### Demo discovery feed

Show the fund details as they stood on 15 November 2026. Leave all three available for triage as demo records after the source dates have passed.

| Opportunity and funder | Funding and timing | Summary and application route |
| --- | --- | --- |
| **Regular Grants** · Garfield Weston Foundation | Under £100,000. Rolling applications. | Charities can seek support for core costs, projects or capital work. The full application is online and includes a proposal and recent accounts. [How to apply](https://garfieldweston.org/for-grant-applicants/how-to-apply/) · [Application guidelines](https://garfieldweston.org/for-grant-applicants/how-to-apply/application-guidelines/) |
| **Reaching Communities England** · The National Lottery Community Fund | From £20,001. Open at the snapshot date. | Funding for projects that strengthen communities in England, including projects from larger charities. Online first stage, with a second stage by invitation. [Programme and application](https://www.tnlcommunityfund.org.uk/funding/funding-programmes/reaching-communities-england) |
| **DPS Social Commitment Programme — Scale** · School for Social Entrepreneurs | Up to £10,000 alongside the learning programme. The published extension was to noon UK time on 17 November 2026. | For established organisations ready to grow work addressing housing insecurity or homelessness. The applicant registers interest to receive the online form. [Programme and application](https://www.the-sse.org/programme/the-dps-social-commitment-programme-scale/) |

## Planning, submission and tracking

**Proposed POC behaviour.** In Planning & submission, show each selected grant, the source link, and one optional planning note. Provide a **Record demo submission** action. It saves today's date as the demo submission date and moves the record to Tracking. The label and confirmation should make the simulation clear.

In Tracking, list the grant, funder, demo submission date, and status **Awaiting decision**. Open the row to see the original grant details and planning note. This provides one complete path to show in a demo. The next specification can define application preparation, portal automation, outcome updates, and resubmissions.

## Phone layout and theme

- Build the phone layout first. Keep all three areas easy to reach and stack grant cards and actions in one column. Check a viewport around 390 px wide and a desktop viewport. Keep the layout usable at 360 px with no horizontal scrolling.
- Adapt Your Place's colours to a working interface. Use white pages, deep purple for headings and primary buttons, pale lavender or blue panels, and orange accents for emphasis. Use clear headings, comfortably sized text and touch targets, and text labels for every status. Suggested starting colours are `#352253` (purple), `#F58A48` (orange), `#F3EFF8` (lavender), and `#EAF3FA` (blue). These are proposed POC values. [Your Place website](https://your-place.org.uk/) · [Your Place rebrand](https://your-place.org.uk/rebrand-information/)

## Implementation and hosting

- Use the existing repository and stack where practical. If it is a blank project, a small web server serving HTML, CSS, and JavaScript is enough. Keep the grant fixtures in one file and the workflow state in one place.
- **Proposed POC storage.** Save decisions, notes, and demo submission dates in browser local storage so they survive a reload. Each browser has its own demo state. Confirm during review whether the desktop and phone need to share the same decisions before adding shared storage.
- Keep the source in the existing `charity-funding` repository and version it in GitHub. Deploy one HTTP service to Cloud Run. A manual source deploy from a GitHub checkout is sufficient. The service must listen on `0.0.0.0` using the port supplied in `PORT`. Document how to run, test and deploy from a fresh checkout. Use the Cloud Run HTTPS URL for the phone demo. [Deploy from source](https://docs.cloud.google.com/run/docs/deploying-source-code) · [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract)

## Basic testing and handoff

- **Claude.** Run a small automated workflow test covering Watch → Plan → Record demo submission and Pass → Restore to New. Confirm that each move leaves one record and that the correct view shows it. Smoke-test the app in desktop and phone-sized browsers, including a reload after a change. Verify the Cloud Run URL once deployed and record what was tested and any gaps.
- **Manual phone check.** Open the URL in a fresh browser session. Confirm the three grants appear in New, pass one and restore it, watch a second, then plan the third and record a demo submission. Check that Tracking shows it and that a reload retains the decisions. Check that the text, navigation and actions are comfortable to use on the phone.

After review, place this specification at `docs/charity-funding-poc-spec.md` in the existing `charity-funding` repository. Claude should follow the repository workflow and record the implementation and test results there.
