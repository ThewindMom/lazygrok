---
description: >
  Create a concise durable handoff: objective, completed work, changed files,
  remaining tasks, test status, blockers, and active state. Avoid copying
  secrets or excessive transcript data.
---

Create a handoff document for session continuity.

## Gather information

1. **Objective**: What was the user's original request?
2. **Completed work**: What has been done so far?
3. **Changed files**: List all files modified (from git diff or boulder state).
4. **Remaining tasks**: What still needs to be done?
5. **Test status**: What tests pass/fail?
6. **Blockers**: Any issues preventing progress?
7. **Active state**: Ralph/Ultrawork/boulder state if active.

## Write handoff

Write the handoff to `.omg/handoff.md` with the following structure:

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

## Rules

- Do NOT include secrets, API keys, tokens, or credentials.
- Do NOT include full transcript data — summarize.
- Do NOT include file contents — just paths and descriptions.
- Keep it concise — this is for quick context restoration.
