---
name: comment-checker
description: Use when Grok needs to understand or respond to automatic comment-checker feedback emitted after an edit-like PostToolUse hook.
---

# Grok Comment Checker

The plugin registers a `PostToolUse` hook for successful `search_replace`, `write`, `edit`, `search_replace`, and `search_replace` calls.

When comment-checker reports a warning after a patch, Grok receives blocking feedback and should fix or explain the flagged comment before moving on.

## Scope

- No MCP tool is exposed.
- Non-edit tools are ignored by this plugin.
- Missing checker binaries emit no hook output so normal Grok work can continue.
