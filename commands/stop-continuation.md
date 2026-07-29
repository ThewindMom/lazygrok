---
description: >
  Disable Ralph, pause core continuation, suppress active boulder
  continuation, suppress todo stop enforcement for the current session,
  persist the explicit user stop. Takes effect immediately.
---

**STOP CONTINUATION — ACTIVE**

The UserPromptSubmit hook has already applied this command atomically for the
current session. Do not edit state files or run a shell command manually.

## What this stops

1. **Disable Ralph**: Clear the ralph loop state. Do not continue on Stop.
2. **Disable Ultrawork**: Clear the ultrawork loop state. Do not continue on Stop.
3. **Pause core continuation**: Persist `paused: true` for the current session's core loop.
4. **Suppress boulder**: Preserve shared boulder state, but do not continue it for this session.
5. **Suppress todo enforcement**: Do not block Stop for incomplete todos this session.
6. **Persist the stop**: The marker file ensures later hooks in this session respect it.

This takes effect **immediately**. Do not attempt to continue working. Acknowledge the stop and wait for the user's next instruction.

The user can resume continuation later with `/resume-continuation`; SessionEnd
also clears the session-local stop and resumes a loop paused by this command.
