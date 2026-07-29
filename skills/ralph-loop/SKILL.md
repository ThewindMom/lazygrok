---
name: ralph-loop
description: >
  Start a Ralph Loop — autonomous work-until-done via Stop-hook continuations.
  Use when the user says ralph loop, /ralph-loop, or wants the agent to keep going
  until it emits a completion promise tag. Pair with cancel-ralph to stop.
user-invocable: true
---

# Ralph Loop

## Start

User runs:

```text
/ralph-loop "your task description" [--completion-promise=DONE] [--max-iterations=100] [--strategy=continue|reset]
```

Or invoke this skill and state the task in the same message.

## Behavior (Grok hooks)

1. `UserPromptSubmit` writes `.lazygrok/ralph-loop.local.md` in the workspace and injects loop instructions.
2. You work until the task is **fully** complete.
3. When done, output: `<promise>DONE</promise>` (or your custom `--completion-promise` text).
4. If you stop without that tag, the **Stop** hook blocks exit and injects a continuation prompt (up to `max-iterations`, default 100).
5. Pending todos can still block stop when no Ralph loop is active (`stop-verify-pending`).

## Rules

- Do not emit the completion promise early.
- Use todos for multi-step work.
- Each iteration must make real progress.
- Do not ask the user to continue or start the "next phase" — the Stop hook auto-continues until the promise tag or `/cancel-ralph`.

## Verified Ralph variant

For verified completion (Oracle subagent required), use
**`ulw-ralph-loop`** instead:

```text
/ulw-ralph-loop "same task" [--max-iterations=500]
```

See the LazyGrok `ulw-ralph-loop` skill (`grok inspect` for path). The
separate `/ulw-loop` command owns the durable goal ledger and is not a Ralph
promise loop.

## Cancel

```text
/cancel-ralph
```

Or use the `cancel-ralph` skill. It cancels either Ralph-family loop, not the
ULW goal ledger.

## State file

Workspace-relative: `.lazygrok/ralph-loop.local.md` (lazygrok; omo uses `.omo/`).
