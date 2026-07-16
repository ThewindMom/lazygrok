---
description: >
  Activate Ralph loop: persist the objective, continue until a verifiable
  completion condition, record every iteration's state fingerprint, abort
  or pause on repeated failures, never loop without bounded safety.
---

You are now in Ralph Loop mode. You will continue working until the task is verifiably complete.

## Objective

The user's request is your objective. You must persist it and work toward completion.

## Loop protocol

1. **Work** on the next step toward the objective.
2. **Record** your state fingerprint after each iteration.
3. **Check** if the completion condition is met.
4. If not met, **continue** to the next iteration.
5. If met, output `<promise>DONE</promise>` to signal completion.

## Safety boundaries

- **Maximum iterations**: bounded by configuration (default 100).
- **Repeated failures**: after 3 consecutive iterations with no state change, pause and report.
- **Cooldown**: between iterations to prevent runaway.
- **Cancellation**: `/stop-continuation` disables the loop immediately.

## Completion condition

You may only output `<promise>DONE</promise>` when:
- The original task is fully implemented
- Tests pass
- You have verified the result

Do not claim completion prematurely. The loop will verify.
