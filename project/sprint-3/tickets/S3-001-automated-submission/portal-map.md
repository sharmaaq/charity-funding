# S3-001 portal map: Garfield Weston Regular Grants (live), template

Status: **empty template. Nothing below has been observed.** The live connector is disabled (`liveAvailable: false`), and no session with the real portal has taken place. This file lists what must be recorded, from the current authenticated screens, before a live adapter could be considered (spec section 12). Do not fill it from the 2024 form, from public guidance or from the demo portal. The demo portal (`gwf-demo-v1`) is this project's own test site, and its selectors say nothing about the real one.

Capture rules: record only what is on the current screen, using a session that the authorised applicant opened and controls. Never record credentials, cookies or MFA codes. Keep screenshots and traces of real organisation data private and out of this repository; only redacted notes belong here. A field is either **verified** (seen on the current screen, with a date) or **UNMAPPED**. Nothing in between.

## 1. Programme and access

| Item | Value | Evidence date |
| --- | --- | --- |
| Programme name and ID as shown in the portal | UNMAPPED | |
| Funder or tenant identity shown | UNMAPPED | |
| Accepting-applications indicator | UNMAPPED | |
| Official entry link (from the funder's own site) | UNMAPPED | |
| Login and redirect domains | UNMAPPED | |
| MFA, CAPTCHA or consent steps (record only; never bypass) | UNMAPPED | |
| Session timeout | UNMAPPED | |
| Website terms or funder permission covering automated completion | UNMAPPED (readiness blocker until confirmed) | |

## 2. Organisation and drafts

| Item | Value | Evidence date |
| --- | --- | --- |
| Organisation search and selection behaviour | UNMAPPED | |
| Identifiers used to match the organisation | UNMAPPED | |
| Where existing drafts are listed ("My applications") | UNMAPPED | |
| External draft ID and resume URL format | UNMAPPED | |
| Save and auto-save triggers (which actions write to the funder) | UNMAPPED | |

## 3. Fields

One row per visible field, page by page. Include eligibility branches, demographic branches, declarations, the terms version and any signature requirement.

| Page or section | Canonical ID | Label (exact) | Role and input type | Required when | Allowed values (actual option values) | Max length or format | Locator (role or label, scoped) | Parent scope | Evidence date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | |

Locator preference: a unique `getByRole` or `getByLabel` scoped to the right section, then stable documented attributes, then reviewed CSS only if necessary. Never write placeholder selector strings that look executable.

## 4. Attachments

| Role | Accepted types | Size limit | Count | Upload acknowledgement shown | Hash or size visible after upload | Evidence date |
| --- | --- | --- | --- | --- | --- | --- |
| Proposal | UNMAPPED | | | | | |
| Accounts | UNMAPPED | | | | | |

## 5. Review, submit and receipt

| Item | Value | Evidence date |
| --- | --- | --- |
| Review page behaviour | UNMAPPED | |
| Final submit label and confirmation prompt | UNMAPPED | |
| Receipt or reference shown after submission | UNMAPPED | |
| Status shown for a submitted application | UNMAPPED | |
| Known anti-automation restrictions | UNMAPPED | |

## 6. Fingerprint

When the map above is complete, record the approved fingerprint: field count, labels, required conditions, enum options and funder identity. Any change to these invalidates the map and stops a live run before anything is changed.

| Fingerprint element | Approved value | Date |
| --- | --- | --- |
| | | |

## Readiness gates (all unmet)

The gates are listed in `server/adapters/gwf-live-readiness.js` and reported by `GET /api/submission-capabilities` as `liveBlockers`. `liveAvailable` stays false while any gate is unmet. A mock or the demo portal cannot satisfy the mapping gate.
