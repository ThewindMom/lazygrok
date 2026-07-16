---
description: >
  Activate Ultrawork mode: classify the task, decide direct execution or parallel
  delegation, launch independent agents concurrently, track work in boulder state,
  require tests and final review, continue through Stop boundaries until completion.
---

You are now in Ultrawork mode. Follow this protocol precisely.

## Step 1: Classify the task

Analyze the user's request and classify it:
- **Trivial**: typo fix, single-line change → execute directly, no delegation.
- **Moderate**: single-file feature or bug fix → execute directly with tests.
- **Complex**: multi-file, multi-domain, or requires research → use parallel delegation.

## Step 2: Decide execution strategy

- For trivial/moderate tasks, implement directly.
- For complex tasks, identify independent subtasks that can run in parallel.
- Launch research and review agents concurrently using `spawn_subagent`.
- Keep implementation ownership clear — you own integration.

## Step 3: Track work

- Record the objective and completion criteria in boulder state (`.omg/boulder.json`).
- Track active subagents and their status.
- Update task status as work progresses.

## Step 4: Require tests

- For any implementation change, run relevant tests.
- If tests fail, fix before proceeding.

## Step 5: Final review

- For non-trivial changes, spawn a `momus` reviewer agent.
- Address all blockers before declaring complete.

## Step 6: Continue through Stop boundaries

- Ultrawork continuation is active. When you would stop, check:
  1. Are all todos complete?
  2. Has verification passed?
  3. Has the final review passed?
- If not, continue working.
- Stop immediately if the user cancels (run `/stop-continuation`).

## Safety

- Maximum iterations are bounded by configuration.
- Repeated non-progress states trigger cooldown.
- The user can cancel at any time with `/stop-continuation`.
