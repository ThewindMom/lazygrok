---
name: ulw-plan
description: >
  Ultrawork planning mode: classify the task, decide direct execution or
  delegation, identify parallelizable work, and create a structured plan
  before implementation. Use when starting complex work with /ultrawork.
---

# Ultrawork Plan

Before executing, plan. This is the planning phase of Ultrawork.

## Grok-native tools and paths

| Intent | Tool / path |
|---|---|
| Parallel research or review agents | `spawn_subagent` (`subagent_type`: `explore`, `librarian`, `metis`, `momus`, `oracle`, …) |
| Track plan steps and progress | `todo_write` |
| Plan / draft artifacts | `.lazygrok/drafts/`, `.lazygrok/plans/<slug>.md` |
| Boulder / continuation state | `.lazygrok/boulder.json` |
| Ulw-loop ledger (when looping) | `.lazygrok/ulw-loop/` via the ulw-loop CLI / skill |

Do not use foreign harness names (`Task`, `TodoWrite`, `.omo/` state roots) for new work. Prefer `.lazygrok/` for all Grok-facing plan and boulder state.

## Step 1: Classify the task

Analyze the user's request:
- **Trivial**: typo fix, single-line change → execute directly
- **Moderate**: single-file feature or bug fix → execute directly with tests
- **Complex**: multi-file, multi-domain, or requires research → use parallel delegation

## Step 2: Identify independent subtasks

For complex tasks, break down into independent subtasks:
- Research tasks (can run in parallel via concurrent `spawn_subagent` calls)
- Implementation tasks (may have dependencies)
- Review tasks (run after implementation; e.g. `spawn_subagent` with `momus` or `lazygrok-code-reviewer`)

## Step 3: Identify dependencies

Map which tasks depend on others:
- Research must complete before implementation that depends on it
- Implementation must complete before review
- Independent tasks can run in parallel

## Step 4: Decide execution strategy

- For trivial/moderate: implement directly
- For complex: launch independent research agents concurrently with `spawn_subagent`, then implement, then review
- Keep implementation ownership clear — you own integration
- Mirror progress with `todo_write` so boulder/stop hooks can see advancement

## Step 5: Create the plan

Write a brief plan to `.lazygrok/drafts/ulw-plan.md` (or `.lazygrok/plans/<slug>.md` when promoting a full plan):

```markdown
# Ultrawork Plan

## Task Classification
[trivial/moderate/complex]

## Subtasks
1. [task] — [parallel/sequential] — [agent via spawn_subagent]
2. ...

## Dependencies
- Task 2 depends on Task 1
- ...

## Execution Strategy
[direct execution / parallel spawn_subagent delegation]
```

## Step 6: Execute

Follow the plan. Track progress with `todo_write` and boulder state under `.lazygrok/boulder.json`. Require tests and final review.
