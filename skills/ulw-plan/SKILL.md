---
name: ulw-plan
description: >
  Ultrawork planning mode: classify the task, decide direct execution or
  delegation, identify parallelizable work, and create a structured plan
  before implementation. Use when starting complex work with /ultrawork.
---

# Ultrawork Plan

Before executing, plan. This is the planning phase of Ultrawork.

## Step 1: Classify the task

Analyze the user's request:
- **Trivial**: typo fix, single-line change → execute directly
- **Moderate**: single-file feature or bug fix → execute directly with tests
- **Complex**: multi-file, multi-domain, or requires research → use parallel delegation

## Step 2: Identify independent subtasks

For complex tasks, break down into independent subtasks:
- Research tasks (can run in parallel)
- Implementation tasks (may have dependencies)
- Review tasks (run after implementation)

## Step 3: Identify dependencies

Map which tasks depend on others:
- Research must complete before implementation that depends on it
- Implementation must complete before review
- Independent tasks can run in parallel

## Step 4: Decide execution strategy

- For trivial/moderate: implement directly
- For complex: launch independent research agents concurrently, then implement, then review
- Keep implementation ownership clear — you own integration

## Step 5: Create the plan

Write a brief plan to `.lazygrok/drafts/ulw-plan.md`:

```markdown
# Ultrawork Plan

## Task Classification
[trivial/moderate/complex]

## Subtasks
1. [task] — [parallel/sequential] — [agent]
2. ...

## Dependencies
- Task 2 depends on Task 1
- ...

## Execution Strategy
[direct execution / parallel delegation]
```

## Step 6: Execute

Follow the plan. Track progress in boulder state. Require tests and final review.
