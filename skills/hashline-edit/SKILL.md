---
name: hashline-edit
description: >
  Hash-anchored search_replace edits using LINE#ID tags from read_file output. PreToolUse
  blocks stale anchors when the file changed since the last cached read.
user-invocable: false
---

# Hashline edits (LINE#ID)

lazygrok caches per-line hashes after each workspace **read_file**. Use those tags in `search_replace` `old_string` when you need precise, conflict-safe edits.

Optional: the **hashline** MCP server (`hashline_read`, `hashline_edit`) provides the same LINE#ID anchors and anchor-based edits when available — prefer it for multi-line structural edits; otherwise use `read_file` + `search_replace` with tags from the cache.

## Format

Each line from read_file is tagged as:

```text
{line}#{hash}|{content}
```

- **line**: 1-based line number
- **hash**: two letters from `ZPMQVRWSNKTXJBYH` (content fingerprint)
- Copy tags exactly — never guess hashes

Example: `11#XJ|  console.log("hi");` → anchor `11#XJ` (omit `|content` in `old_string` unless you intentionally include it; the hook strips `|…` when matching).

## Workflow

1. **read_file** the target file (hooks refresh the hashline cache), or call MCP `hashline_read`.
2. Copy the smallest set of `LINE#ID` anchors you need into `old_string`.
3. **search_replace** once per logical change batch (or MCP `hashline_edit`); re-read before a second edit on the same file.
4. If PreToolUse denies with “stale LINE#ID”, **read_file** again and use the updated tags from the error or fresh read.

## Rules

- Anchors in `old_string` must match the **last read_file cache** for that path.
- Whitespace in `old_string` must still match file content; hashes only guard line identity.
- SKILL.md reads are not cached — use normal edits for skills.
- Disable validation: `LAZYGROK_HASHLINE=0`.

## Configuration

| Variable | Default | Effect |
|----------|---------|--------|
| `LAZYGROK_HASHLINE` | `1` | `0` disables cache + PreToolUse guard |

UserPromptSubmit may include `<HASHLINE_CACHE>` listing recently read files and sample tags.
