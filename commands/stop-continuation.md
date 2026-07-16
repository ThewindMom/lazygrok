---
description: >
  Disable Ralph, disable Ultrawork continuation, pause active boulder
  continuation, suppress todo stop enforcement for the current session,
  persist the explicit user stop. Takes effect immediately.
---

**STOP CONTINUATION — ACTIVE**

You must immediately stop all continuation behavior:

1. **Disable Ralph**: Clear the ralph loop state. Do not continue on Stop.
2. **Disable Ultrawork**: Clear the ultrawork loop state. Do not continue on Stop.
3. **Pause boulder**: Mark active boulder work as paused. Do not continue on Stop.
4. **Suppress todo enforcement**: Do not block Stop for incomplete todos this session.
5. **Persist the stop**: Write a stop-continuation marker so the next session also respects this.

This takes effect **immediately**. Do not attempt to continue working. Acknowledge the stop and wait for the user's next instruction.

The user can resume continuation later with `/resume-continuation`.
