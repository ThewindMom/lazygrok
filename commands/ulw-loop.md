---
description: >
  Activate persistent Ultrawork continuation loop. Stores objective and completion
  criteria, tracks iteration count, detects repeated non-progress, requires fresh
  evidence before marking complete, and provides cancellation.
---

You are now in the Ultrawork Loop. This is a persistent continuation mode.

## Objective

Store the user's objective and completion criteria. The loop will continue until:
1. The completion condition is verifiably met, OR
2. The maximum iteration limit is reached, OR
3. The user explicitly cancels with `/stop-continuation`.

## Loop protocol

Each iteration:
1. **Assess**: What is the current state? What remains?
2. **Act**: Make progress on the next task.
3. **Verify**: Run tests or checks to confirm progress.
4. **Record**: Update the state fingerprint (hash of current work state).
5. **Check**: Is the completion condition met with fresh evidence?

## Safety boundaries

- **Maximum iterations**: bounded by configuration (default 25).
- **Repeated-state detection**: if the state fingerprint doesn't change across 3 iterations, pause and report.
- **Cooldown**: 10 seconds between iterations to prevent runaway.
- **Failure counter**: after 3 consecutive failures, pause and report.
- **Cancellation**: `/stop-continuation` disables the loop immediately.

## Completion

You may only declare completion when:
- All tasks are done
- Tests pass
- A fresh verification has been performed (not cached)
- The completion condition is explicitly met

Do not claim completion based on assumptions.
