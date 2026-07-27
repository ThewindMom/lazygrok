# Grok tools only

**Rule:** Call only tools that appear in **this session’s tool list**. LazyGrok text that still shows foreign names is a porting leftover — ignore it and use the Grok row below.

## Core Grok Build tools (use these names)

| Need | Tool |
|------|------|
| Read file | `read_file` |
| List dir | `list_dir` |
| Search text | `grep` (or shell `rg` via `run_terminal_command`) |
| Edit | `search_replace` / `write` |
| Shell | `run_terminal_command` |
| Todos | `todo_write` |
| Spawn child | `spawn_subagent` (`subagent_type`, `prompt`, `background`) |
| Wait on child/task | `get_command_or_subagent_output` |
| Kill child/task | `kill_command_or_subagent` |
| Web | `web_search` / `web_fetch` / `open_page` / `open_page_with_find` |
| Plan mode | `enter_plan_mode` / `exit_plan_mode` |
| Ask user | `ask_user_question` |
| Scripted multi-agent (internal under `ulw`) | `workflow` → `ulw-discover` / `ulw-review` — never ask user to run `/workflow` |
| Background watch | `monitor` |
| Schedule | `scheduler_create` / `scheduler_list` / `scheduler_delete` |

## Optional / when present in tool list

| Need | Tool |
|------|------|
| Host goals | `create_goal` / `update_goal` only if listed — else `# Goal` + ulw-loop CLI |
| Codegraph MCP | `codegraph_explore` (etc.) if server connected |
| LSP MCP | `lsp_*` if server connected |
| Hashline MCP | hashline tools if server connected |
| Browser | `playwright` MCP tools if connected |

## Spawn shape (only valid form)

```
spawn_subagent({
  subagent_type: "lazygrok:explore",   // or explore / worker / reviewer role from agent list
  prompt: "TASK: …\nDELIVERABLE: …\nSCOPE: …\nVERIFY: …\nSTOP WHEN: …",
  background: true
})
```

Wait: `get_command_or_subagent_output({ task_ids: ["…"], timeout_ms: … })`

## Do not call (not Grok session tools)

Do not invent or call: `task`, `Task`, `spawn_agent`, `multi_agent_*`, `wait_agent`, `TodoWrite`, `call_omo_agent`, `background_output`, `team_*`, `load_skills`, `apply_patch`, `bash(...)` as a tool, `codex_app.*`, or any name not in the live tool list.

If a skill example uses a foreign name, **translate** to the table above and continue. Do not narrate the translation.
