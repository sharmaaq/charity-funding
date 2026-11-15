# Shared workflow

This is the single source of shared workflow rules for charity-funding.

## Session start and durable knowledge

- At the beginning of every new session, read this file, then [project-context.md](project-context.md) and [status.md](status.md). Read relevant requirements, decisions, research and source code before acting. Do not assume access to the other assistant's chat history.
- Use repository files for durable project knowledge. Chat history and assistant-specific memory are supplementary.
- Roles (DEC-005). ChatGPT Work defaults to research, requirements and drafting specifications. Claude reviews each specification, plans the implementation, delegates the build to an implementing model and verifies the result. The user may explicitly override these roles for an individual task, including asking either assistant to finish work the other could not complete.

## Ticket pipeline

Each ticket moves through these stages in order. The user's approval is the gate between them; an assistant does not advance a ticket on its own.

1. **Specify.** ChatGPT (or Claude, if asked) drafts `spec.md` in the ticket folder.
2. **Review.** Claude reviews the spec against the user's request, the repository and the evidence. Claude fixes clear defects directly and lists anything that changes behaviour or scope as numbered open questions with a recommendation each. The user answers; the answers are folded into the spec.
3. **Approve the spec.** The user reviews the spec again and asks Claude to plan. A spec marked "ready" by an assistant is not approved.
4. **Plan.** Claude writes `plan.md` in the ticket folder: stack, files, steps, tests and how each REQ is verified. The user approves it.
5. **Implement.** Claude hands the approved spec and plan to an implementing model (typically Sonnet). The implementer follows the plan and reports deviations instead of improvising scope.
6. **Verify and record.** Claude checks the result against the acceptance criteria, runs the tests, and records actual results and discrepancies in the ticket and [status.md](status.md).

## Requirements, research and evidence

- Distinguish user-agreed requirements from proposals, assumptions and open questions. An assistant suggestion is not an approved decision without user agreement.
- Give requirements stable identifiers (REQ-001 onward), an explicit agreement status and testable acceptance criteria. Preserve identifiers on revision; do not reuse retired identifiers. Record the source of agreement.
- Record research sources with URLs and the date checked. Distinguish verified findings from inference and uncertainty. Recheck time-sensitive information before relying on it. For local evidence, record the file path and inspection date instead of inventing a URL.
- Code and actual test results are evidence of current behaviour; agreed requirements define intended behaviour. Report discrepancies rather than silently rewriting requirements to match implementation.
- Record significant decisions with stable identifiers (DEC-001 onward), dates, rationale and status: proposed, agreed or superseded. Identify the user agreement for agreed decisions and link superseding decisions when applicable.

## Execution and safe collaboration

- Continue routine work within the requested scope without repeatedly asking for confirmation. Ask when unresolved ambiguity materially changes scope, user-visible behaviour or a significant architectural choice.
- Before editing shared files, reread their current contents and preserve changes made by the user or the other assistant. Check for intervening changes before writing. If concurrent edits conflict, stop editing the affected file and explain the conflict; do not overwrite it.
- If repository access is unavailable, clearly label proposed updates as unsaved. Never claim that a file was updated or synchronised when it was not. Do not create a substitute workspace without user instruction.
- Run checks appropriate to the change and record actual results. Distinguish tests passed, tests failed and tests not run. Do not describe a planned or unexecuted check as passed.

## Documentation and handoff

- Organise sprint baselines and requirement iterations as separate tickets under [project/](../project/README.md). Preserve initial specifications; link subsequent tickets and stable requirement IDs. Maintain the requirements register and sprint index so the current intended behaviour is clear.
- A specification stays with its ticket: `spec.md`, `research.md` and `plan.md` live in the ticket folder, not at the sprint root or in `docs/` (DEC-003). The sprint README names the current specification.
- If an assistant stops mid-task (for example at a usage limit), the other assistant first compares the ticket's claims with what is actually on disk. Files and decisions a ticket refers to may not exist yet.

- After meaningful research, decisions or implementation changes, update relevant project documents before ending the response, without waiting for a separate request. Skip updates for casual questions that change nothing.
- Keep documentation concise and current. Do not append full transcripts or duplicate the same information across documents; link to the authoritative document.
- Use [project-context.md](project-context.md) for the purpose, users, scope, constraints, architecture and document index; [requirements.md](requirements.md) for intended behaviour and acceptance criteria; [research.md](research.md) for findings and sources; [decisions.md](decisions.md) for significant decisions; and [status.md](status.md) for current progress and handoff.
- At handoff, briefly report what changed, what was verified, unresolved issues and the next action. Record this information in status.md, including implementation/test evidence, blockers and pending questions, so the next assistant can continue.
