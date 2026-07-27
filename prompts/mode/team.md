# Parallel work on Grok

For parallel coding, use multiple same-turn `spawn_subagent` calls (`background: true`), then `get_command_or_subagent_output({ task_ids, timeout_ms })`. Parent orchestrates; depth 1.

Roles: `lazygrok:explore`, `lazygrok:librarian`, `lazygrok:lazygrok-worker-*`, `lazygrok:lazygrok-code-reviewer`.

Child prompt: TASK / DELIVERABLE / SCOPE / VERIFY / STOP WHEN.

Only call tools from this session’s tool list (see rules/15-grok-tools-only).
