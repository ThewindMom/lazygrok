---
name: teammode
description: >
  Grok: n/a for LazyCodex-style durable teams. On Grok Build use parallel
  spawn_subagent workers instead. Trigger only when user says teammode/team of
  agents so you can refuse multi_agent_v2 and route to fan-out.
---

# Teammode on Grok — n/a

> **Status: not runnable on Grok Build.** LazyCodex teammode needs Codex
> `multi_agent_v2` (durable agents, re-task, mailbox) or `codex_app` threads.
> Grok has neither. Do not invent those tools.

## What to do instead (coding / parallel work)

| Need | Do this |
| --- | --- |
| Parallel research | Same-turn `spawn_subagent` for `lazygrok:explore` and/or `lazygrok:librarian` |
| Parallel implementation | One `spawn_subagent` per independent slice (`lazygrok:lazygrok-worker-*` / `hephaestus`) |
| Wait | `get_command_or_subagent_output({task_ids, timeout_ms})` |
| Stop | `kill_command_or_subagent` |
| Fixed multi-lane research pipeline | Host `workflow` tool / `/deep-research` (Rhai), not teammode |

### Spawn contract

```
spawn_subagent({
  subagent_type: "lazygrok:explore",  // or worker / reviewer role
  prompt: "TASK: …\nDELIVERABLE: …\nSCOPE: …\nVERIFY: …\nSTOP WHEN: …",
  background: true
})
```

- Depth max **1** — children do not spawn.
- Parent is the only orchestrator (Sisyphus/Atlas/`start-work` style).
- No `.lazygrok/teams` state, no bind-agent, no durable re-task.

If the user insisted on “teammode,” say once:

`Teammode transport unavailable on Grok — using parallel spawn_subagent for independent scopes.`

Then fan out. Do not run `team.mjs init` expecting Codex behavior.
