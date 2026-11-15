# Shared workflow

This is the single source of shared workflow rules for charity-funding.

## Session start and durable knowledge

- At the beginning of every new session, read this file, then [project-context.md](project-context.md) and [status.md](status.md). Read relevant requirements, decisions, research and source code before acting. Do not assume access to the other assistant's chat history.
- Use repository files for durable project knowledge. Chat history and assistant-specific memory are supplementary.
- Roles (DEC-005). ChatGPT Work defaults to research, requirements and drafting specifications. Claude reviews each specification, plans the implementation, delegates the build to an implementing model and verifies the result. The user may explicitly override these roles for an individual task, including asking either assistant to finish work the other could not complete.

## Ticket pipeline

Default flow for every ticket (DEC-006). It runs straight through; the only stop before shipping is a question Claude genuinely needs answered.

1. **Specify.** ChatGPT (or Claude, if asked) drafts `spec.md` in the ticket folder.
2. **Review and fix.** When the user asks, Claude reviews the spec against the request, the repository and the evidence, and fixes defects directly. Claude asks the user only when an open point changes behaviour or scope and cannot be settled from the request, the code or the evidence. Otherwise it records what it changed in the ticket and carries on.
3. **Plan.** Claude writes `plan.md` in the ticket folder: files, steps, tests, how each requirement is verified, and the shipping steps.
4. **Implement, test and ship.** Claude hands the spec and plan to an implementing model (typically Sonnet). By default that model builds, runs the automated tests, records its results in the ticket and [status.md](status.md), commits, pushes to `master` and deploys to Cloud Run, then checks the live site. Commit, push and deploy are part of every ticket unless the user says otherwise for that ticket.
5. **Report.** Claude relays the implementer's results to the user, labelled as reported by the implementer. Claude does not re-run the tests or re-test by hand unless the user asks.
6. **User review.** The user reviews the deployed result; feedback becomes the next ticket.

The implementing model stops and reports instead of working around a rejected push, a deployment permission failure, anything that would change access (IAM) in Google Cloud, or anything touching another Google Cloud project.

