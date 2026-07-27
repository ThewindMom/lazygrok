---
name: comment-checker
description: Use when Grok needs to understand or respond to automatic comment-checker feedback emitted after an edit-like PostToolUse hook.
---

# Grok Comment Checker

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


The plugin registers a `PostToolUse` hook for successful `search_replace/write`, `write`, `edit`, `multi_edit`, and `search_replace` calls.

When comment-checker reports a warning after a patch, Grok receives blocking feedback and should fix or explain the flagged comment before moving on.

## Scope

- No MCP tool is exposed.
- Non-edit tools are ignored by this plugin.
- Missing checker binaries emit no hook output so normal Grok work can continue.
