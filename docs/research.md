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
