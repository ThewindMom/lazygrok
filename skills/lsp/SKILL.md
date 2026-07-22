---
name: lsp
description: >
  Language Server Protocol tools via the bundled lsp MCP server — diagnostics,
  navigation, symbols, and rename. Use after edits to verify types and catch errors.
user_invocable: false
---

# LSP tools (MCP `lsp`)

Bundled server: `node ${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/lsp-tools-mcp/dist/cli.js mcp`

## When to use

- **After** `Write` / `StrReplace` on code files — check for new errors
- Go to definition, find references, document symbols
- Safe renames (`prepare_rename` → `rename`)

## Tools (via `CallMcpTool`, server `lsp`)

| Tool | Purpose |
|------|---------|
| `lsp_status` / `lsp.status` | Server and language status |
| `lsp_diagnostics` / `lsp.diagnostics` | Errors and warnings for a file |
| `lsp_goto_definition` | Jump to symbol definition |
| `lsp_find_references` | Find all references |
| `lsp_symbols` | Document / workspace symbols |
| `lsp_prepare_rename` | Validate rename at position |
| `lsp_rename` | Apply workspace rename |

## Configuration

Project LSP config (optional): `.lazygrok/lsp.json` or `.opencode/lsp.json`

Override paths:

- `LSP_TOOLS_MCP_PROJECT_CONFIG` — project config file
- `LSP_TOOLS_MCP_USER_CONFIG` — user config file

Example entry:

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

## Workflow

1. Edit code.
2. Call `lsp_diagnostics` on changed paths.
3. Fix reported errors before claiming the task is done.
4. For symbol renames: `lsp_prepare_rename` → `lsp_rename` (prefer over manual text replace).

## Note (lazygrok hooks)

Task 5+ may stash diagnostics and inject them on the next prompt / Stop. Until then, call MCP tools explicitly after edits.