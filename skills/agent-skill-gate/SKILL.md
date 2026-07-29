---
name: agent-skill-gate
description: >
  MANDATORY before code changes, debugging, planning, or multi-step implementation in ANY
  repository. Discover skills via grok inspect, read_file every SKILL.md whose description matches
  the task, then use tools. Hooks block mutating tools until at least one catalog skill was
  loaded via read_file. LazyCodex-for-Grok skills ship in skills/ + vendor/lazygrok-skills (no superpowers pack).
---

# Agent Skill Gate

## When this applies

Every Grok Composer session where you might call `grep`, `read_file` (for implementation context),
`write`, `search_replace`, `run_terminal_command` (mutating), or delegate `spawn_subagent` for implementation.

## Workflow

1. Trust the skill catalog from `grok inspect`, SessionStart, or **UserPromptSubmit** `<AGENT_SKILL_GATE_PROACTIVE>` (paths matched to the message).
2. For the user's request, list which catalog skills plausibly apply (by description).
3. **`read_file` each applicable skill file** before other tools (Grok Composer has no Skill tool; load skills by reading their `SKILL.md` path; ignore superpowers text that says otherwise).
4. If the prompt shows `<skill_information>`, treat it as hints only — still **read_file** full `SKILL.md` content.
5. Say `Using <name> to <purpose>` for each skill loaded.
6. Only then run mutating or broad search tools.

## Path rules (Grok)

- Use the **absolute path from the catalog** / proactive injection / `GROK_PLUGIN_ROOT`.
- LazyGrok plugin skills live under
  `$GROK_PLUGIN_ROOT/skills/…` and
  `$GROK_PLUGIN_ROOT/vendor/lazygrok-skills/…`
  (install dir: `~/.grok/installed-plugins/lazygrok-*`).
- **Do not** open workspace-relative `skills/<name>/SKILL.md` for LazyGrok
  plugin skills — that path is almost never present and is the #1 false
  "skill activation failed" failure mode.
- Project-local skills under `.agents/skills/` or `.grok/skills/` are the
  only case where a workspace path is correct (and only when the catalog
  lists that path).
- A UI label `Skill <name>` without a successful absolute `read_file` does
  **not** satisfy the gate.
- When spawning subagents that need a skill perspective, paste absolute
  skill paths into the child `prompt` (paste absolute skill paths into the child prompt; no separate skill-load tool).

## Hook enforcement

The **lazygrok** plugin (`grok plugin install ThewindMom/lazygrok --trust`) registers
hooks via `hooks/hooks.json`. They deny mutating tools when the catalog is non-empty and
no skill was read via `read_file` yet. Satisfy the gate by reading any applicable catalog entry, or this meta-skill file (path from `grok inspect`).

## Rules reference

Bundled at `rules/00-agent-skill-gate.md` inside the lazygrok plugin install directory.
