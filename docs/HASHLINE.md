# Hashline Tools

The hashline MCP server provides two tools for precise, line-anchored file editing.

## hashline_read

Reads a file and returns each line with a stable `N#XX` anchor.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | yes | Workspace-relative or absolute file path |
| `offset` | integer | no | 1-based starting line (default: 1) |
| `limit` | integer | no | Max lines to return (0 = all) |
| `includeMetadata` | boolean | no | Include file identity metadata |

### Output

- Canonical path
- File identity (size, line count, SHA-256, newline style, final newline)
- Total lines, selected range
- Each line formatted as `{number, hash, content}`
- Truncation metadata

### Anchor format

Anchors are `N#XX` where N is the 1-based line number and XX is a 2-character hash derived from the line's normalized content using xxhash32 and the dictionary `ZPMQVRWSNKTXJBYH`.

Example: line 12 with content `const value = compute()` might have anchor `12#ZP`.

## hashline_edit

Edits a file using line anchors for precise, conflict-free modifications.

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | yes | File path |
| `edits` | array | yes | Edit operations |
| `dryRun` | boolean | no | Return diff without writing |
| `expectedIdentity` | object | no | Expected file identity for race detection |
| `diffContext` | integer | no | Context lines in diff (default: 3) |

### Operations

| Type | Anchor | EndAnchor | Content | Description |
|------|--------|-----------|---------|-------------|
| `replace_line` | yes | — | yes | Replace one anchored line |
| `replace_range` | yes | yes | yes | Replace inclusive range |
| `insert_before` | yes | — | yes | Insert before anchor |
| `insert_after` | yes | — | yes | Insert after anchor |
| `delete_line` | yes | — | — | Delete one anchored line |
| `delete_range` | yes | yes | — | Delete inclusive range |
| `prepend` | — | — | yes | Add to beginning |
| `append` | — | — | yes | Add to end |

### Safety guarantees

- Stale anchors reject without changing the file
- Overlapping edits reject without changing the file
- Concurrent writes to the same file are serialized
- Dry-run produces the same diff without writing
- LF and CRLF line endings are preserved
- Final newline state is preserved
- File permissions are preserved
- Atomic write (temp file + rename)
- Race detection between validation and write
- File size and operation count limits enforced
- Binary files rejected
- Path escape rejected

## Hashline modes

| Mode | Behavior |
|------|----------|
| `off` | No hashline enforcement; native edits behave normally |
| `prefer` | Hashline tools available; native mutations permitted |
| `strict` | Implementation agents must use hashline; native mutations denied (except `.lazygrok` state paths) |
