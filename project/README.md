# Project sprints and tickets

Each sprint lives in `sprint-N/`, starting with [sprint-0](sprint-0/README.md). Each initial requirements baseline and subsequent iteration is a separate ticket under that sprint's `tickets/` folder.

- Ticket IDs: `S0-001`, `S0-002`, etc.; sprint 1 starts at `S1-001`. Never reuse IDs.
- Use a folder named `<ID>-<short-description>`. Everything belonging to the ticket stays in that folder: `ticket.md`, its specification (`spec.md`), supporting research (`research.md`) and the implementation plan (`plan.md`). Do not keep specifications at the sprint root (DEC-003).
- A ticket that changes requirements carries a complete revised `spec.md`, so an implementer reads one file. The sprint README names the current specification. Earlier tickets' specifications are frozen history; do not edit them.
- Use the [ticket template](ticket-template.md). Update the sprint index and shared [requirements register](../docs/requirements.md) when requirements change.
- Keep agreement status separate from delivery status. Draft proposals are not approved by being imported or written into a spec.
- Shared rules, including who specifies, plans and implements, remain in [workflow.md](../docs/workflow.md); current cross-assistant handoff remains in [status.md](../docs/status.md).

## Sprints

| Sprint | Scope | Status |
| --- | --- | --- |
| [Sprint 0](sprint-0/README.md) | Initial charity fundraising POC | S0-002 deployed; S0-003 visual spec drafted |
| [Sprint 1](sprint-1/README.md) | Complete Discovery demo: markers and simulated discovery | S1-001 in progress (user report); S1-002 specified |
| [Sprint 2](sprint-2/README.md) | Organisation information and document store | S2-001 planned; queued behind Sprint 1 |
| [Sprint 3](sprint-3/README.md) | Guided application and automated submission demonstration | S3-001 planned in three phases; queued behind S2-001 |
| [Sprint 4](sprint-4/README.md) | Multi-charity platform: sign-in, tenancy, server storage, AI discovery, themes | S4-001 Phases 1 and 2 live; Phase 3 moved to S5-001 |
| [Sprint 5](sprint-5/README.md) | Features matched with Research: search, notes, real discovery, AI assessment and discussion, own AI keys | S5-001 planned |
