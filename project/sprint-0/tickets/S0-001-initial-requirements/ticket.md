# S0-001: Initial POC requirements

- Date: 2026-11-15
- Type: initial requirements
- Agreement: import and sprint organisation agreed by the user's request on this date; product specification remains a draft for review.
- Delivery: awaiting requirements review; not implemented.
- Owner: ChatGPT requirements/review; Claude implementation/testing.
- Predecessor: none.

## Source and scope

[Full original POC draft](charity-funding-poc-spec.md), titled Charity Funding POC, dated 15 November 2026. Imported from `libfile_f4f6d6bfd2dc8191a7dfbddf5f9ebb92` (7195-byte source). Saved from the complete text read after direct download failed; no intentional content edits.

The draft describes a responsive charity fundraising workflow with Discovery, Planning & submission, and Tracking, three fixed grant examples, no AI calls or automated discovery, and Cloud Run hosting. Detailed requirements and acceptance criteria are indexed in [the requirements register](../../../../docs/requirements.md).

The source's last paragraph suggests a different destination, `docs/charity-funding-poc-spec.md`. The user's newer request establishes this sprint/ticket location instead; the original source text is preserved as historical context.

## Review questions

- Confirm the draft behaviour before implementation, particularly the explicitly proposed planning note, simulated submission and Awaiting decision tracking.
- Confirm browser-local persistence versus shared desktop/phone state.
- Review Discovery layout and assessment fields, which the draft defers.
- Confirm implementation stack and deployment/access arrangements; no deployment was requested in this import task.
- Colour values are proposed. Grant details are imported snapshot claims, not independently verified in this session.

## Context boundary and handoff

The complete source document was available; only a partial summary of the originating chat was available. Do not infer agreement from unseen messages. A further handoff is useful only for missing decisions, rationale or constraints. Record these as a new iteration ticket.

Next action: review this baseline and capture any changes in S0-002. Claude should implement only the agreed scope, record actual tests/discrepancies in the relevant ticket, and update shared status. No code or application tests were run for this documentation import.
