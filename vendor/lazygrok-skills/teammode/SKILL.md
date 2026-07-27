---
name: teammode
description: >
  Grok: durable team orchestration is unavailable. Use parallel
  spawn_subagent workers instead. Trigger when user asks for a team of agents
  so you route to fan-out (not a separate team transport).
---

# Parallel agents on Grok (not durable teams)

> **Status:** Grok Build has no durable multi-member team transport. Use parallel one-shot subagents.

## What to do

| Need | Tool |
| --- | --- |
| Parallel research | Same-turn `spawn_subagent` for `lazygrok:explore` and/or `lazygrok:librarian` |
| Parallel implementation | One `spawn_subagent` per independent slice (`lazygrok:lazygrok-worker-*` / `hephaestus`) |
| Wait | `get_command_or_subagent_output({ task_ids, timeout_ms })` |
| Stop | `kill_command_or_subagent` |
| Fixed multi-lane research | Host `workflow` tool when appropriate |

### Spawn contract

```
spawn_subagent({
  subagent_type: "lazygrok:explore",
  prompt: "TASK: …\nDELIVERABLE: …\nSCOPE: …\nVERIFY: …\nSTOP WHEN: …",
  background: true
})
```

- Depth max **1**
- Parent is the only orchestrator
- Only call tools from this session's tool list (`rules/15-grok-tools-only.md`)

If the user asked for "teammode", say once that Grok uses parallel `spawn_subagent` for independent scopes, then fan out.
