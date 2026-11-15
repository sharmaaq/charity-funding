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

No external product or funding research has been performed for this setup. Product purpose, users, eligibility rules and data sources remain unknown. Do not treat the project name or IDE configuration as evidence for product requirements.

For future external findings, record the claim, verification status (verified / inference / uncertain), source URL, date checked, limitations and any requirement or decision it informs. Recheck time-sensitive findings before use.
