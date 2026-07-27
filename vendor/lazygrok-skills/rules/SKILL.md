---
name: rules
description: Use when the user asks about Grok Rules behavior, injected project rules, supported rule file locations, matching, or environment configuration.
---

# Grok Rules

## Grok Tool Mapping

| Intent | Grok tool |
| --- | --- |
| Spawn a worker | `spawn_subagent({subagent_type:"lazygrok:<role>", prompt:"TASK: ...", background:true})` |
| Wait for background result | `get_command_or_subagent_output({task_ids:[...]})` |
| Stop a runaway | `kill_command_or_subagent({task_id:"..."})` |
| Live checklist | `todo_write` |
| Edit files | `search_replace` / `write` |
| Shell | `run_terminal_command` |
| Read files | `read_file` |
| Binding goal | `# Goal` block + ulw-loop CLI (`ulw-evidence`); host `create_goal`/`update_goal` only if present |
| Worker tiers | `lazygrok:lazygrok-worker-low` / `-medium` / `-high` (or `lazygrok-executor`) |
| Reviewers | `lazygrok:lazygrok-code-reviewer`, `lazygrok-qa-executor`, `lazygrok-gate-reviewer` |
| Explorer / librarian / plan | `lazygrok:explore` / `lazygrok:librarian` / `lazygrok:prometheus` or `lazygrok-plan` |

Every `spawn_subagent` prompt must start with `TASK:`, then `DELIVERABLE`, `SCOPE`, `VERIFY`, `STOP WHEN`.


Grok Rules is automatic once the plugin is enabled. It injects:

- static project instructions on `SessionStart` and `UserPromptSubmit`
- matching file-specific rules after Grok `search_replace/write` by default

Dynamic `PostToolUse` output is injected as additional context and is deduplicated per plugin data session. Grok Rules does not rewrite tool output.

Supported project sources:

- `CONTEXT.md`
- `.omo/rules/**/*.md`
- `.claude/rules/**/*.md`
- `.cursor/rules/**/*.md`
- `.github/instructions/**/*.md`
- `.github/copilot-instructions.md`

Supported environment knobs:

- `CODEX_RULES_DISABLED=1`
- `CODEX_RULES_MODE=both|static|dynamic|off`
- `CODEX_RULES_MAX_RULE_CHARS=<number>`
- `CODEX_RULES_MAX_RESULT_CHARS=<number>`
- `CODEX_RULES_ENABLED_SOURCES=CONTEXT.md,.omo/rules`

The legacy `PI_RULES_*` variables are accepted as fallbacks for users migrating from `pi-rules`.
