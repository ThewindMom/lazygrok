---
name: rules
description: Use when the user asks about Grok Rules behavior, injected project rules, supported rule file locations, matching, or environment configuration.
---

# Grok Rules

Grok Rules is automatic once the plugin is enabled. It injects:

- static project instructions on `SessionStart` and `UserPromptSubmit`
- matching file-specific rules after Grok `search_replace` by default

Dynamic `PostToolUse` output is injected as additional context and is deduplicated per plugin data session. Grok Rules does not rewrite tool output.

Supported project sources:

- `CONTEXT.md`
- `AGENTS.md`
- `.lazygrok/rules/**/*.md` (preferred for Grok Build state)
- `.grok/rules/**/*.md`
- `.omo/rules/**/*.md`
- `.claude/rules/**/*.md`
- `.cursor/rules/**/*.md`
- `.github/instructions/**/*.md`
- `.github/copilot-instructions.md`

Supported environment knobs (legacy `CODEX_RULES_*` names still apply):

- `CODEX_RULES_DISABLED=1`
- `CODEX_RULES_MODE=both|static|dynamic|off`
- `CODEX_RULES_MAX_RULE_CHARS=<number>`
- `CODEX_RULES_MAX_RESULT_CHARS=<number>`
- `CODEX_RULES_ENABLED_SOURCES=CONTEXT.md,.lazygrok/rules` (`.omo/rules` still accepted)

The legacy `PI_RULES_*` variables are accepted as fallbacks for users migrating from `pi-rules`.
