---
name: handoff
description: >
  Create a durable handoff document for session continuity: objective,
  completed work, changed files, remaining tasks, test status, blockers,
  active state. Use when ending a session or transferring context.
---

# Handoff

Create a concise, durable handoff for context restoration.

## What to include

1. **Objective** — the user's original request
2. **Completed work** — what has been done
3. **Changed files** — paths and what changed
4. **Remaining tasks** — what still needs to be done
5. **Test status** — what passes and what fails
6. **Blockers** — any issues preventing progress
7. **Active state** — Ralph/Ultrawork/boulder status

## What NOT to include

- Secrets, API keys, tokens, credentials
- Full file contents — just paths and descriptions
- Full transcript data — summarize
- Unrelated context

## Format

Write to `.lazygrok/handoff.md`:

```markdown
# Handoff

## Objective
[The user's original request]

## Completed Work
- [What was done]

## Changed Files
- path/to/file — what changed

## Remaining Tasks
- [ ] Task description

## Test Status
- [pass/fail] test description

## Blockers
- [Any blockers, or "None"]

## Active State
- Ralph: [active/inactive]
- Ultrawork: [active/inactive]
- Boulder: [work ID and status]
```

Keep it concise. This is for quick context restoration, not a full report.
