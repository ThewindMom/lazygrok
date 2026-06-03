# AST-Grep (structural search)

Prefer the bundled **`ast_grep`** MCP server for syntax-shaped search and refactors.

## Use AST-Grep when

- Matching **functions, classes, imports, calls**, or other grammar nodes
- Refactoring with **meta-variables** (`$NAME`, `$$$`) and `replace` + `dryRun`

## Use Grep / `rg` when

- Plain text, regex, alternation, or cross-cutting string search
- The pattern is not valid source code for a single `lang`

## Discipline

1. `search` before `replace`; scope with `paths` / `globs` when possible.
2. Always preview `replace` with `dryRun: true` before applying.
3. Run **`lsp_diagnostics`** on touched files after structural edits.

See `skills/ast-grep/SKILL.md` and `skills/lsp/SKILL.md`.