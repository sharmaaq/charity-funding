# Project context

Last updated: 2026-11-15.

## Purpose and users

- Project name: charity-funding.
- Product purpose: a responsive web POC for a charity fundraising manager to triage funding opportunities, see suitability recommendations and decide what to pursue. Planning & submission and Tracking are placeholders in Sprint 0. The demo charity is called YOR Plc. Source: S0-002 spec revision 4.
- Workspace: `C:\aks-code\charity-funding`, the existing local Windows folder also used by Claude for development, as specified by the user.

## Scope and constraints

- Current stage: S0-002 spec approved; implementation plan awaiting user approval.
- Sprint 0 scope: six fixed grant examples, no AI integration or automated discovery, browser-local state only, phone/desktop browsers, deployed to Cloud Run (project `charity-funding-514818`), source at https://github.com/sharmaaq/charity-funding. Details are in the S0-002 spec and plan; see the requirements register.
- Assistant responsibilities and task-specific overrides are defined in [workflow.md](workflow.md).
- This setup does not authorise application features, Git initialisation, commits or pushes.

## Current architecture

No application source, build definition or tests were present at initial inspection. Existing IntelliJ settings define a Java module and a Java SDK named 27; these are IDE settings, not an agreed language, runtime or architecture decision. Proposed stack (S0-002 plan, not yet approved): static HTML/CSS/JavaScript served by a dependency-free Node 24 server, `node --test` and Playwright for tests.

## Document index

- [Project sprints](../project/README.md): sprint and ticket conventions.
- [Sprint 0](../project/sprint-0/README.md): ticket index and pointer to the current specification.

- [workflow.md](workflow.md): shared working rules.
- [requirements.md](requirements.md): product requirements, agreement status and acceptance criteria.
- [research.md](research.md): findings, sources and uncertainty.
- [decisions.md](decisions.md): significant decisions and rationale.
- [status.md](status.md): current progress, verification, blockers and next actions.
- [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md): assistant entry points.
