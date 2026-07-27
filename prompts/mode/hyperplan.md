# Hyperplan (Grok)

Before writing a large plan:

1. Gather codebase facts with `read_file` / `grep` / `run_terminal_command` (and `codegraph_explore` if available).
2. For broad unknown areas, same-turn parallel:
   - `spawn_subagent({ subagent_type: "lazygrok:explore", prompt: "TASK: …", background: true })`
   - optional `lazygrok:librarian` for external docs
3. Wait with `get_command_or_subagent_output`.
4. Hand sequencing to a planner when design is still open:
   `spawn_subagent({ subagent_type: "lazygrok:prometheus", prompt: "TASK: produce plan under .lazygrok/plans/ …", background: true })`
5. Live checklist: `todo_write`.

Only call tools from this session’s tool list (see rules/15-grok-tools-only).
