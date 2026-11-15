# Project context

Last updated: 2026-11-15.

## Purpose and users

- Project name: charity-funding.
- Product purpose: a responsive web POC for a charity fundraising manager to triage funding opportunities, see suitability recommendations and decide what to pursue. Planning & submission and Tracking are placeholders in Sprint 0. The demo charity is called YOR Plc. Source: S0-002 spec revision 4.
- Workspace: `C:\aks-code\charity-funding`, the existing local Windows folder also used by Claude for development, as specified by the user.

## Scope and constraints

- Discovery extension S1-002 adds a manager-editable natural-language brief and AI-style simulated discovery. S1-001 is in progress per user report; reconcile its latest reviewed behaviour. The same saved brief is intended for future manual/background AI discovery; no live AI or scheduler in this ticket. See [S1-002](../project/sprint-1/tickets/S1-002-ai-discovery-brief/spec.md).

- Current stage: S0-002 implemented and deployed; S0-003 specifies the user's requested visual restyle for Claude review. Sprint 1 now specifies date markers and simulated discovery in S1-001 (revision 6). No real discovery agent is in scope. See the sprint indexes for the current proposed specification and deployed baseline.
- Sprint 0 scope: six fixed grant examples, no AI integration or automated discovery, browser-local state only, phone/desktop browsers, deployed to Cloud Run (project `charity-funding-514818`), source at https://github.com/sharmaaq/charity-funding. Details are in the S0-002 spec and plan; see the requirements register.
- Assistant responsibilities and task-specific overrides are defined in [workflow.md](workflow.md).
- This setup does not authorise application features, Git initialisation, commits or pushes.

## Current architecture

Current implementation is static HTML/CSS/JavaScript in public/, served by a Node server; package.json specifies Node >=24, node --test and Playwright. Source inspected 2026-11-15; test/deployment evidence is recorded in status.md. The original Java IDE metadata did not establish the application stack.

## Document index

- [Project sprints](../project/README.md): sprint and ticket conventions.
- [Sprint 1](../project/sprint-1/README.md): Discovery demo completion and current complete proposed specification.
- [Sprint 0](../project/sprint-0/README.md): ticket index and pointer to the current specification.

- [workflow.md](workflow.md): shared working rules.
- [requirements.md](requirements.md): product requirements, agreement status and acceptance criteria.
- [research.md](research.md): findings, sources and uncertainty.
- [decisions.md](decisions.md): significant decisions and rationale.
- [status.md](status.md): current progress, verification, blockers and next actions.
- [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md): assistant entry points.

## Sprint 2 specification update — 2026-11-15

- [Sprint 2](../project/sprint-2/README.md) starts with S2-001: organisation overview, historical bids and a document store reached through the YOR Plc brand.
- Current complete proposed specification is [S2-001 revision 7](../project/sprint-2/tickets/S2-001-organisation-document-store/spec.md), carrying forward revision 6. This is specification status, not delivery status.
- Proposed storage adds native browser IndexedDB for real file bytes and organisation records; existing grant localStorage remains intact. No backend/AI integration. Actual planning/submission behaviour is left to later tickets.
