---
name: agent-skill-gate
description: >
  MANDATORY before code changes, debugging, planning, or multi-step implementation in ANY
  repository. Discover skills via grok inspect, Read every SKILL.md whose description matches
  the task, then use tools. Hooks block mutating tools until at least one catalog skill was
  Read. superpowers skills ship bundled in lazygrok (vendor/superpowers/skills).
---

# Agent Skill Gate

## When this applies

Every Grok Composer session where you might call `grep`, `Read` (for implementation context),
`Write`, `StrReplace`, `Shell` (mutating), or delegate `task()` for implementation.

## Workflow

1. Trust the skill catalog from `grok inspect`, SessionStart, or **UserPromptSubmit** `<AGENT_SKILL_GATE_PROACTIVE>` (paths matched to the message).
2. For the user's request, list which catalog skills plausibly apply (by description).
3. **`Read` each applicable skill file** before other tools (Grok Composer has no Skill tool; ignore superpowers text that says otherwise).
4. If the prompt shows `<skill_information>`, treat it as hints only — still **Read** full `SKILL.md` content.
4. Say `Using <name> to <purpose>` for each skill loaded.
5. Only then run mutating or broad search tools.

## Hook enforcement

The **lazygrok** plugin (`grok plugin install github:mihazs/lazygrok --trust`) registers
hooks via `hooks/hooks.json`. They deny mutating tools when the catalog is non-empty and
no skill was Read yet. Satisfy the gate by Reading any applicable catalog entry, or this
meta-skill file (path from `grok inspect`).

## Rules reference

Bundled at `rules/00-agent-skill-gate.md` inside the lazygrok plugin install directory.