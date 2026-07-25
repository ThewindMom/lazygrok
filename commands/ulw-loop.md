---
description: >
  Activate persistent Ultrawork continuation loop. Stores objective and completion
  criteria, tracks iteration count, detects repeated non-progress, requires fresh
  evidence before marking complete, and provides cancellation.
---

You are now in the Ultrawork Loop. This is a persistent continuation mode with
mandatory verifier approval before the loop may clear.

## Start

```text
/ulw-loop "task description" [--completion-promise=DONE] [--max-iterations=500]
/ultrawork "task description"
ultrawork refactor the payment module
```

Default max iterations: **500** (vs 100 for `/ralph-loop`).

## Objective

Store the user's objective and completion criteria. The loop continues until:
1. The completion condition is verifiably met **and** a verifier emits `<promise>VERIFIED</promise>`, OR
2. The maximum iteration limit is reached, OR
3. The user explicitly cancels with `/cancel-ralph`.

## Flow

1. **Work** until the task is fully done → output `<promise>DONE</promise>` (not final).
2. Stop hook enters **verification** — you must run a verifier subagent (default: `lazygrok:lazygrok-code-reviewer`, or `oracle`).
3. Verifier must end with:
   ```text
   Agent: oracle
   <promise>VERIFIED</promise>
   ```
4. Only then does the loop clear and the session may stop.

Example verifier spawn:

```text
spawn_subagent(subagent_type="lazygrok:lazygrok-code-reviewer", prompt="Review that the objective is fully met with fresh evidence; end with Agent: oracle and <promise>VERIFIED</promise> if approved.")
```

## Loop protocol

Each iteration:
1. **Assess**: What is the current state? What remains?
2. **Act**: Make progress on the next task.
3. **Verify**: Run tests or checks to confirm progress.
4. **Record**: Update the state fingerprint (hash of current work state).
5. **Check**: Is the completion condition met with fresh evidence?

## If verification fails

Fix issues, emit `<promise>DONE</promise>` again, and re-run verification.

## Safety boundaries

- **Maximum iterations**: default **500**.
- **Repeated-state detection**: if the state fingerprint doesn't change across 3 iterations, pause and report.
- **Cooldown**: 10 seconds between iterations to prevent runaway.
- **Failure counter**: after 3 consecutive failures, pause and report.
- **Cancellation**: `/cancel-ralph` clears the loop immediately (primary). `/stop-continuation` also stops broader continuations when needed.

## State

`.lazygrok/ralph-loop.local.md` with `ultrawork: true` and `verification_pending` when awaiting verification.

## Completion

You may only declare work complete with `<promise>DONE</promise>` when:
- All tasks are done
- Tests pass
- A fresh verification has been performed (not cached)
- The completion condition is explicitly met

The loop only fully exits after the verifier emits `<promise>VERIFIED</promise>`.

Do not claim completion based on assumptions.
