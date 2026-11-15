# S3-001: Funder selection and submission research

Checked 2026-11-15. Official sources only. Public document inspection, not authenticated portal testing. Source URLs are research evidence, not executable API endpoints unless expressly stated.

## Selection

| Existing candidate | Evidence | Decision |
| --- | --- | --- |
| G-001 Garfield Weston Regular Grants | Proposal and accounts upload; rolling route; current Blackbaud portal linked publicly | Select. A core-support proposal suits the housing/support profile and demonstrates document reuse. Eligibility remains conditional. |
| G-002 Reaching Communities England | [Official application guidance](https://www.tnlcommunityfund.org.uk/funding/funding-programmes/reaching-communities-england/how-to-apply) describes two stages; [public questions](https://account.tnlcommunityfund.org.uk/Preview/Application/f3dd86e5-ae7b-4119-a7f6-adc44158cbf7) are available | Credible subsequent adapter. Longer project-development questionnaire and staged process make it less compact for this first demonstration. No verified applicant API. |
| G-003 DPS Scale | [Official page](https://www.the-sse.org/programme/the-dps-social-commitment-programme-scale/) distributes application information through registration of interest | Do not select. Form access and organisational/participant eligibility remain unresolved. Search snippets and earlier evidence disagree about the 16/17 November deadline; this task does not change the fixture. |

## Source register and confidence

### R1: Current application route — verified public guidance

https://garfieldweston.org/for-grant-applicants/how-to-apply/

Regular applicants create/use a portal account, provide contact/organisation information, demographic and safeguarding answers, and upload a proposal plus latest accounts/annual return. Proposal can be PDF or Word. The page says receipt is acknowledged by email. This establishes the broad workflow, not the exact current authenticated field schema.

The header points to `https://bbgm-apply.yourcausegrants.com/apply/auth/signin`. The Regular Grants link is an Outlook Safe Links wrapper. Its encoded `url` parameter decodes to:

`https://bbgm-apply.yourcausegrants.com/apply/programs/983d63b4-7ade-4619-9392-d9955b78fe31`

The wrapper failed in the retrieval tool; the decoded programme URL also could not be rendered there. The generic sign-in page returned a JavaScript-required shell. Programme ID is extracted from the funder's link, not authenticated verification that the programme is still accepting applications. Resolve from the official page again during live connector discovery. Do not treat the Safe Links tracking URL as an API.

### R2: Current proposal specification — verified document, April 2026

https://garfieldweston.org/wp-content/uploads/2026/04/Application-guidelines-1.pdf

Regular requests are below GBP 100,000; applications are rolling. Proposal: at most ten A4 pages, minimum 11-point type, PDF/Word, no appendices. Cover purpose, need, beneficiaries, outcomes, inclusion, partnerships, leadership, financial forecasts, fundraising and fallback plans. Include accounts/return; at least one year's financial history is needed. Core funding supports operations. Reapplication generally follows at least twelve months after the decision email. No specific requested amount is compulsory under this guidance. Bank details are requested after an award, not a reason to collect them in this demo.

The spec's questionnaire structure, word budgets and example figures are our design, not copied portal questions. Detailed current demographic controls, conditional fields, upload field limits and declarations remain unverified.

### R3: Funder FAQ — verified; conflict recorded

https://garfieldweston.org/for-grant-applicants/how-to-apply/application-faqs/

Core grants may contribute to general salary expenditure, not an application solely for a named post. The FAQ says core support is unlikely to exceed 10% of annual budget; the April 2026 PDF says generally 10–20%. Do not encode either percentage as an eligibility hard rule. Our example GBP 50,000 is illustrative, not a funding recommendation or commitment. Income and annual operating budget are distinct figures.

### R4: Portal migration — verified official announcement

https://garfieldweston.org/about-us/news-insights/new-grant-portal/

Announcement dated 4 August 2025 says the portal changed and identifies Blackbaud Grantmaking. It supports collaborators and a consolidated applicant account. The older [2023 portal guide](https://garfieldweston.org/wp-content/uploads/2023/06/Using-our-online-grants-system.pdf) is obsolete evidence for current selectors, navigation and attachment limits. In particular do not implement its Save & Finish Later/Review & Submit labels or 25 MB total limit as verified current facts.

### R5: Current portal help — vendor workflow, not funder-specific fields

Funder help link: https://garfieldweston.org/for-grant-applicants/how-to-apply/using-our-online-grants-system/

Vendor index: https://webfiles-sc1.blackbaud.com/files/support/helpfiles/grantsconnect/content/gc-applicants.html

Application workflow: https://webfiles-sc1.blackbaud.com/files/support/helpfiles/grantsconnect/content/gc-applicants-apply-for-grants.html

Vendor documentation describes programme links, login, organisation selection, possible eligibility questions, autosaved forms, submission and a subsequent application status/reference. A programme can require signing. Organisation vetting can intervene. The vendor explicitly distinguishes programme-specific questions from general product guidance. These are reasons to include pause states and read-back checks; not proof of a specific Garfield Weston screen sequence.

### R6: API feasibility — verified product scope, absence claim deliberately limited

https://developer.blackbaud.com/skyapi/products/grantmaking

https://developer.blackbaud.com/skyapi/docs/applications/scopes

Blackbaud describes its Grantmaking API as exposing grantmaking-office data/functionality, including payments/status operations. OAuth read/write access is subject to the consenting user's permissions. No publicly documented applicant-authorised endpoint for lodging this Garfield Weston application was established by this research. This is not proof no private integration exists. An applicant login must not be assumed to grant access to the funder's tenant API. Do not invent a POST /applications endpoint on Blackbaud or use the funder's client credentials.

The REST endpoints in spec.md are our own proposed application API. The proposed live transport is browser automation, conditional on mapping and authorised access.

### R7: Upload limits — generic and configurable

https://webfiles-sc1.blackbaud.com/files/support/helpfiles/grantsconnect/content/gc-guide-file-requirements.html

https://webfiles-sc1.blackbaud.com/files/support/helpfiles/grantmaking/content/what%27s%20recent.html

Generic vendor upload guidance lists a 29 MB per-file default and ten files per upload. Grantmaking release notes describe configurable file types and sizes. Neither establishes the current Garfield Weston field limits. The POC uses its own stricter 10 MiB-per-file cap; the live adapter must discover the field's actual types, cardinality and limit. Do not accept arbitrary code/archive files just because generic vendor guidance lists them.

### R8: Linked postal/email form — historical supporting schema only

https://garfieldweston.org/wp-content/uploads/2024/04/Apr-2024-Application-form-and-checklist-.pdf

Still linked from the current application page, but dated April 2024, before migration. It includes organisation/contact details, charity status, income bracket, request type/amount, geography, beneficiary counts, tax residence, prior application, safeguarding, permissions and demographic questions. It contains an email instruction, while the website labels the link postal. Do not silently use email as a fallback submission route. We did not confirm that email ingestion is currently accepted or automate email delivery.

This form informs the preparation checklist only. Do not describe its wording, options or required markers as the current online form. Demographic answers, safeguarding declarations and permissions cannot be inferred from the charity's name or beneficiaries.

### R9: Charity source and naming — existing repository evidence

See [S0-002 research](../../../sprint-0/tickets/S0-002-discovery-suitability/research.md) and [Charity Commission record](https://register-of-charities.charitycommission.gov.uk/en/charity-search/-/charity-details/5028848/full-print).

The prior research records Your Place, charity 1147794, London homelessness housing/support and income GBP 7,113,419 for year ended 31 March 2025. These figures were not refreshed in this task. The agreed public demo identity is YOR Plc. Do not ship the real charity identity or identifier in demo seeds or infer a real legal form from 'Plc'. All new budget, staff, beneficiary and contact examples must be visibly synthetic. The organisation document store is still being built; no uploaded document contents were available/read during this task.

## Unverified items and required live discovery evidence

No authenticated screens, exact labels/DOM locators, hidden field values, organisation match, applicant session/MFA behaviour, programme availability, current attachment controls, funder permission for unattended operation, live draft creation or receipt were verified. Do not mark the live connector done from passing a mock test. Before live operation record these facts in a dated portal-map and a redacted walkthrough; use the matrix and stop conditions in spec.md. No account registration, interest registration, outgoing message or real application was performed in this research.
