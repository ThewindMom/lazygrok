---
name: hashline-edit
description: >
  Hash-anchored StrReplace edits using LINE#ID tags from Read output. PreToolUse
  blocks stale anchors when the file changed since the last cached read.
user_invocable: false
---

# Hashline edits (LINE#ID)

oh-my-grok caches per-line hashes after each workspace **Read**. Use those tags in `StrReplace` `old_string` when you need precise, conflict-safe edits.

## Format

Each line from Read is tagged as:

```text
{line}#{hash}|{content}
```

- **line**: 1-based line number
- **hash**: two letters from `ZPMQVRWSNKTXJBYH` (content fingerprint)
- Copy tags exactly — never guess hashes

Example: `11#XJ|  console.log("hi");` → anchor `11#XJ` (omit `|content` in `old_string` unless you intentionally include it; the hook strips `|…` when matching).

## Workflow

1. **Read** the target file (hooks refresh the hashline cache).
2. Copy the smallest set of `LINE#ID` anchors you need into `old_string`.
3. **StrReplace** once per logical change batch; re-read before a second edit on the same file.
4. If PreToolUse denies with “stale LINE#ID”, **Read** again and use the updated tags from the error or fresh read.

## Rules

- Anchors in `old_string` must match the **last Read cache** for that path.
- Whitespace in `old_string` must still match file content; hashes only guard line identity.
- SKILL.md reads are not cached — use normal edits for skills.
- Disable validation: `OMG_HASHLINE=0`.

## Configuration

| Variable | Default | Effect |
|----------|---------|--------|
| `OMG_HASHLINE` | `1` | `0` disables cache + PreToolUse guard |

UserPromptSubmit may include `<HASHLINE_CACHE>` listing recently read files and sample tags.