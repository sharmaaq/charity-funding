# Research

Last updated: 2026-11-15.

## Verified workspace findings

| Finding | Source | Date checked |
| --- | --- | --- |
| The exact local Windows workspace is accessible as an ordinary directory, with no link or junction target reported. | PowerShell inspection of C:\aks-code\charity-funding | 2026-11-15 |
| Before this setup, only five IntelliJ configuration files existed; no project instructions, README, application source, build definition or tests were present. | Recursive file inventory of C:\aks-code\charity-funding | 2026-11-15 |
| Git did not recognise the folder as a repository. | git status --short and git rev-parse --show-toplevel, both returned fatal: not a git repository | 2026-11-15 |
| IntelliJ defines a Java module and Java SDK named 27. This does not establish an agreed application stack. | .idea/charity-funding.iml and .idea/misc.xml | 2026-11-15 |

## External research and uncertainties

The POC draft was imported on 2026-11-15; see [S0-001](../project/sprint-0/tickets/S0-001-initial-requirements/ticket.md). Funding claims, links and snapshot dates are source-document claims, not independently verified during import. Historical workspace findings above describe the initial setup; current inspection confirms Git is now configured at C:/aks-code/charity-funding and was clean before the import.

Grant and charity-profile evidence for the six Sprint 0 fixtures is kept with its ticket: [S0-002 research](../project/sprint-0/tickets/S0-002-discovery-suitability/research.md).

For future external findings, record the claim, verification status (verified / inference / uncertain), source URL, date checked, limitations and any requirement or decision it informs. Recheck time-sensitive findings before use.

## S3-001 submission research — 2026-11-15

See [ticket research](../project/sprint-3/tickets/S3-001-automated-submission/research.md) for official URLs, dated claims and limitations. Selected Garfield Weston Regular Grants for core-support preparation. Verified public proposal/upload guidance and an August 2025 migration to Blackbaud; old 2023 portal instructions are not reliable current selectors/limits. Current linked programme ID extracted, but authenticated form/eligibility/receipt not inspected. Blackbaud publishes a grantmaking-office API; an applicant submission endpoint was not established. Real live submission remains unverified. Proposed controlled demo uses actual browser automation and our own API, never an invented funder API. No document-store contents, real accounts, portal draft or outgoing application were accessed/sent in this task.

## S5-001 live grant sources — 2026-11-25

Question (spec D3): is there a public, machine-readable source of **open** funding that discovery could read directly, instead of relying only on grounded search?

| Source | Finding | Status | Date checked |
| --- | --- | --- | --- |
| Find a Grant, https://www.find-government-grants.service.gov.uk/ | The public pages mention no API, feed or data download. The footer says content is under the Open Government Licence v3.0; the only update route offered is an email sign-up. Its terms page was not read. | Verified for the home page; terms and any hidden API uncertain | 2026-11-25 |
| 360Giving / GrantNav, https://www.360giving.org/data/ | Publishes past grants awarded (funder, recipient, amount, date) in the 360Giving Data Standard, with a GrantNav search and an API. It describes who funds what, not open calls, so it cannot say what is open now. Its API terms were not read. | Verified from the public page; limitation: past grants only | 2026-11-25 |

Decision: no direct feed was added. Discovery uses Google Search grounding through Gemini only, and the Discover panel says results are suggestions to check on the funder's own page. Find a Grant is named in the prompt as an official source to search. A 360Giving look-up of a funder's past awards to charities like the applicant is a possible later use as evidence of funder fit, not as a list of open funds. Recheck both if a feed is wanted later.

Live Gemini check (one real run, recorded in the [S5-001 ticket](../project/sprint-5/tickets/S5-001-research-parity/ticket.md)).
