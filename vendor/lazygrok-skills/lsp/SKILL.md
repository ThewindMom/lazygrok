---
name: lsp
description: Use when Grok needs language-server diagnostics, definitions, references, symbols, or rename safety checks in the current workspace.
---

# LSP (Grok)

Call **`lsp`** or **`lazygrok-lsp`** MCP tools through the tool interface (not `CallMcpTool`); `lsp.*` / `lsp_*` are tool-call names, not shell commands. Prefer after `write` / `search_replace` on code files.

## Tools

- `lsp.status` / `lsp_status`: list configured, installed, missing, disabled, and active language servers.
- `lsp.diagnostics` / `lsp_diagnostics`: check one file or directory for LSP diagnostics. Prefer `severity: "error"` after edits.
- `lsp.goto_definition` / `lsp_goto_definition`: locate a symbol definition from file, line, and character.
- `lsp.find_references` / `lsp_find_references`: find usages of a symbol across the workspace.
- `lsp.symbols` / `lsp_symbols`: inspect document symbols or search workspace symbols.
- `lsp.prepare_rename` / `lsp_prepare_rename`: check whether a rename is valid at a position.
- `lsp.rename` / `lsp_rename`: apply a language-server workspace edit for a rename.

## Config

Project config lives at `.lazygrok/lsp.json` (or `.codex/lsp-client.json` if present); user override via `LSP_TOOLS_MCP_USER_CONFIG`.

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
