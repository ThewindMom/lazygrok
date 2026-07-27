---
name: lsp
description: Use when Grok needs language-server diagnostics, definitions, references, symbols, or rename safety checks in the current workspace.
---

# Grok LSP

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


Call `lsp` MCP tools through the tool interface; `lsp.*`/`mcp__lsp__*` are tool-call names, not shell commands.

## Tools

- `lsp.status`: list configured, installed, missing, disabled, and active language servers.
- `lsp.diagnostics`: check one file or directory for LSP diagnostics. Prefer `severity: "error"` after edits.
- `lsp.goto_definition`: locate a symbol definition from file, line, and character.
- `lsp.find_references`: find usages of a symbol across the workspace.
- `lsp.symbols`: inspect document symbols or search workspace symbols.
- `lsp.prepare_rename`: check whether a rename is valid at a position.
- `lsp.rename`: apply a language-server workspace edit for a rename.

## Config

Project config lives at `.codex/lsp-client.json`; user config lives at `~/.grok/lsp-client.json`.

```json
{
	"lsp": {
		"typescript": {
			"command": ["typescript-language-server", "--stdio"],
			"extensions": [".ts", ".tsx", ".js", ".jsx"]
		}
	}
}
```

Use `lsp.status` first when diagnostics report a missing language server.
