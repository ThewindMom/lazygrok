---
name: ast-grep
description: >
  Structural code search and rewrite via the bundled ast_grep MCP server.
  Use for AST patterns ($VAR, $$$), not regex. Prefer over Grep when matching syntax trees.
user_invocable: false
---

# AST-Grep (MCP `ast_grep`)

Bundled server: `node ${GROK_PLUGIN_ROOT}/vendor/ast-grep-mcp/dist/cli.js mcp`

## When to use

- Find or rewrite **syntax-shaped** code (functions, imports, classes, control flow)
- Refactors that must respect language grammar (25 languages)

## When **not** to use

- Plain text, alternation (`foo|bar`), or regex wildcards → use **Grep** / `rg` instead

## Tools (via `CallMcpTool`, server `ast_grep`)

| Tool | Purpose |
|------|---------|
| `search` | AST pattern search (`pattern`, `lang`, optional `paths`, `globs`, `context`) |
| `replace` | AST rewrite (`pattern`, `rewrite`, `lang`; `dryRun` defaults to **true**) |

## Pattern syntax

- `$VAR` — one AST node (identifier, expression, statement, …)
- `$$$` — zero or more nodes (args, bodies, …)
- Patterns must be **valid source** for the chosen `lang`

Examples:

- TypeScript: `function $NAME($$$) { $$$ }`, `console.log($$$)`
- Python: `def $FUNC($$$)`, `class $C($$$)` (no trailing colon in pattern)
- Go: `func $NAME($$$) { $$$ }`

## Workflow

1. **Search** with a concrete pattern; narrow `paths` / `globs` if noisy.
2. **Replace** with `dryRun: true` first; review preview; then `dryRun: false`.
3. After edits, run **LSP diagnostics** on touched files (see `skills/lsp`).

## Aliases

Some hosts expose the same tools as `ast_grep_search` / `ast_grep_replace`.