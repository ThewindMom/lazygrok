---
name: rules
description: Use when the user asks about Grok Rules behavior, injected project rules, supported rule file locations, matching, or environment configuration.
---

# Grok Rules

Grok Rules is automatic once the plugin is enabled. It injects:

- static project instructions on `SessionStart` and `UserPromptSubmit`
- matching file-specific rules after Grok `apply_patch` by default

Dynamic `PostToolUse` output is injected as additional context and is deduplicated per plugin data session. Grok Rules does not rewrite tool output.

Supported project sources:

- `CONTEXT.md`
- `.lazygrok/rules/**/*.md`
- `.grok/rules/**/*.md`
- `.claude/rules/**/*.md`
- `.cursor/rules/**/*.md`
- `.github/instructions/**/*.md`
- `.github/copilot-instructions.md`

Supported environment knobs:

- `GROK_RULES_DISABLED=1`
- `GROK_RULES_MODE=both|static|dynamic|off`
- `GROK_RULES_MAX_RULE_CHARS=<number>`
- `GROK_RULES_MAX_RESULT_CHARS=<number>`
- `GROK_RULES_ENABLED_SOURCES=CONTEXT.md,.lazygrok/rules`

The legacy `PI_RULES_*` variables are accepted as fallbacks for users migrating from `pi-rules`.
