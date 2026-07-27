# Agent Skill Gate (Grok Composer)

Applies to **Grok Composer** in any workspace. Does not govern OpenCode, Cursor, or Claude Code delegation APIs.

## Source of truth

Run `grok inspect` (or rely on SessionStart hook cache at `~/.grok/state/skill-gate/<session>/all-skills.json`). The catalog lists every skill Grok discovered: project, user, and plugin scopes.

## Grok Composer (2.5+)

- There is **no Skill tool** — use **Read** on each applicable `SKILL.md` path.
- `<skill_information>` / `skills_referenced` in the harness are **metadata only**, not loaded skill bodies. You must still Read the file.
- **UserPromptSubmit** injects `<AGENT_SKILL_GATE_PROACTIVE>` with paths matched to the user message — Read those before Grep, Shell, Write, or Task.

## Before mutating tools

1. Identify skills whose **description** matches the user task.
2. **`Read` each applicable `SKILL.md`** using the path from inspect (absolute paths in catalog).
3. Announce one line per skill: `Using <name> to <purpose>`.
4. Hooks block `Write`, `StrReplace`, `EditNotebook`, and `Delete` until at least one catalog skill was `Read` this session (when the catalog is non-empty).

Read-only work (questions, diagnostics, review without edits) should still load skills when descriptions match; for pure explanation with no file changes, reading the meta-skill `agent-skill-gate` once satisfies the hook minimum.

## Path rules

- Always use **absolute** paths from the catalog / proactive block / `GROK_PLUGIN_ROOT`.
- LazyGrok plugin skills: `$GROK_PLUGIN_ROOT/skills/…` and `$GROK_PLUGIN_ROOT/vendor/lazygrok-skills/…`.
- **Never** treat workspace `skills/<name>/SKILL.md` as the LazyGrok catalog (common false failure).
- A UI `Skill <name>` chip without a successful absolute Read does not satisfy the gate.

## Any installed skill

- **Project** skills under `.agents/skills/` or `.grok/skills/` in the workspace
- **User** skills under `~/.grok/skills/` (other tools; not lazygrok duplicates)
- **Plugin** skills from installed Grok plugins (lazygrok under `~/.grok/installed-plugins/lazygrok-*`)

Do not hardcode skill names. Use the catalog.

## Subagents (`spawn_subagent`)

There is no Skill-load tool on Grok; Paste relevant skill **absolute paths** and summaries from the catalog into the subagent `prompt`. For code/gate reviewers, also pass a full diff path (parent writes `git diff … > /tmp/….diff`) — do not make children reverse-engineer git without shell.

## Fail-open

If `grok inspect` fails or returns an empty skill list, hooks allow mutating tools after you `Read` the lazygrok `agent-skill-gate` skill from the plugin path in inspect.

## Meta-skill

Full hook behavior: lazygrok plugin `skills/agent-skill-gate/SKILL.md` (see `grok inspect`).