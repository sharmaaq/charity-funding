# Decisions

## DEC-001: Shared persistent workflow

- Date: 2026-11-15.
- Status: agreed.
- Agreement source: user's explicit workflow setup request in this session.
- Decision: use docs/workflow.md as the single source of shared working rules, supported by the project documents indexed in project-context.md and short root assistant entry points.
- Rationale: allow both assistants to continue from durable project knowledge without assuming access to one another's chat history.
- Responsibilities and override rules: see [workflow.md](workflow.md).

## DEC-002: Sprint and ticket requirements history

- Date: 2026-11-15.
- Status: agreed.
- Agreement source: user's request to save the POC under a new project folder, with multiple sprints starting at sprint-0 and initial requirements/iterations saved as tickets.
- Decision: use project/sprint-N/tickets; preserve the initial POC as S0-001 and record subsequent requirement iterations as separate numbered tickets.
- Rationale: provide durable review and implementation history shared by ChatGPT and Claude.
- The import does not approve proposals in the source draft. See [project conventions](../project/README.md).

## DEC-003: Specifications stay with their ticket

- Date: 2026-11-15.
- Status: agreed.
- Agreement source: user's instruction to Claude in the takeover session ("spec should stay with the ticket").
- Decision: a ticket's spec.md, research.md and plan.md live in that ticket's folder. A ticket that changes requirements carries a complete revised spec. The sprint README names the current one.
- Rationale: one place per ticket for everything needed to review, plan and implement it.
- Note: ChatGPT's S0-002 draft had placed spec.md and research.md at the sprint root and referred to a DEC-003 for that convention, which was never written. That placement was reversed before being recorded; both files now sit in the S0-002 folder.

## DEC-004: Browser-only state and Sprint 0 phase scope

- Date: 2026-11-15.
- Status: agreed. Recorded by ChatGPT in S0-002 and confirmed by the user's approval of spec revision 4.
- Decision: Sprint 0 keeps all state in browser localStorage, with no accounts, backend state or cross-device sharing. Discovery is functional; Planning & submission and Tracking are labelled placeholders with no simulated submission or outcomes.
- Rationale: get a usable Discovery UI in front of the user for feedback before specifying the full field list.
- Detail: [S0-002 spec](../project/sprint-0/tickets/S0-002-discovery-suitability/spec.md).

## DEC-005: Specify, review, plan, delegate

- Date: 2026-11-15.
- Status: agreed.
- Agreement source: user's instruction to Claude in the takeover session.
- Decision: ChatGPT drafts specifications. Claude reviews them, and after the user approves the spec, plans the work. After the user approves the plan, Claude hands implementation to another model (typically Sonnet) and verifies the result. Stages and gates are in [workflow.md](workflow.md).
- Rationale: not stated by the user. Claude's reading: review and planning stay with one model and the user approves each gate before build effort is spent.
- Supersedes the earlier default in DEC-001's workflow that Claude implements directly.
- The approval gates in this decision are superseded by DEC-006.

## DEC-006: Tickets run through to deployment by default

- Date: 2026-11-15.
- Status: agreed.
- Agreement source: user's instruction to Claude when handing over S0-003: review the ticket, fix it if needed, ask questions only if needed, plan it, have Sonnet execute it, and by default have Sonnet commit, push and deploy as part of each ticket. The user had already struck out the gated pipeline in workflow.md.
- Decision: a ticket runs from review to a deployed result without separate approvals of the spec or plan. The implementing model tests, records results, commits, pushes and deploys. The user reviews the deployed result.
- Limits: the implementing model does not change Google Cloud access (IAM), work around a failed push or deploy, or touch another project; it stops and reports.
- Supersedes the gates in DEC-005. Roles in DEC-005 are unchanged.

No application architecture or stack decision has been agreed yet; one is proposed in the [S0-002 plan](../project/sprint-0/tickets/S0-002-discovery-suitability/plan.md) and becomes a decision when the user approves it.

## DEC-007: Organisation source collection scope

- Date: 2026-11-15.
- Status: user-requested product scope; storage and detailed UI defaults proposed.
- Source: user's Sprint 2 Ticket 1 request.
- Decision: use the top-left YOR Plc organisation entry for general information, managed past bids with actual documents/outcomes/feedback, and a simpler organisation document collection, including regulatory and financial submissions. Preserve this information for later AI-assisted planning/submission.
- Proposed POC interpretation: real browser-local Blob storage in IndexedDB, no AI ingestion yet; existing grant state unchanged. The user has not separately approved these implementation defaults.
- Detail: [S2-001 specification](../project/sprint-2/tickets/S2-001-organisation-document-store/spec.md).
