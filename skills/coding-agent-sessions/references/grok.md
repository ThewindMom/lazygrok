# Grok Build Sessions

## Default locations

| Platform | Unix/macOS | Windows |
|---|---|---|
| Grok Build | `~/.grok/sessions/` | `%USERPROFILE%\.grok\sessions\` |

## Session structure

Each session lives at `~/.grok/sessions/<url-encoded-cwd>/<session-id>/`:

```
~/.grok/sessions/
  %2Fhome%2Fuser%2Fproject/     # URL-encoded working directory
    019f7073-7ee3-.../          # Session UUID (UUIDv7)
      summary.json              # Session metadata (id, cwd, summary, timestamps, model)
      events.jsonl              # Event stream (turn_started, tool_started, tool_completed, ...)
      prompt_context.json       # Prompt metadata (personas, agents_md, mode)
      rewind_points.jsonl       # Rewind/checkpoint state
      resources_state.json      # Resource tracking
```

## summary.json fields

| Field | Type | Notes |
|---|---|---|
| `info.id` | string | Session UUID |
| `info.cwd` | string | Working directory |
| `session_summary` | string | First-line summary / first user prompt |
| `created_at` | string | ISO timestamp |
| `updated_at` | string | ISO timestamp |
| `current_model_id` | string | Model identifier (e.g. `grok-4.5`, `umans-glm-5.2`) |
| `num_messages` | int | Total messages |
| `num_chat_messages` | int | Chat messages (excluding tool calls) |

## events.jsonl event types

| Type | Contains |
|---|---|
| `turn_started` | session_id, turn_number, model_id |
| `tool_started` | tool_name |
| `tool_completed` | tool_name, duration |
| `mcp_server_starting` | server_name, transport |
| `mcp_server_connected` | server_name |
| `mcp_tool_call_started` | server_name, tool_name |
| `mcp_tool_call_completed` | server_name, tool_name, duration |
| `permission_requested` | tool_name, args |
| `permission_resolved` | tool_name, decision |
| `phase_changed` | phase |
| `turn_ended` | turn_number |
| `loop_started` | loop_type |

## CLI usage

```bash
# List Grok sessions:
python3 scripts/find-agent-sessions.py list --platform grok --limit 20

# Search Grok sessions:
python3 scripts/find-agent-sessions.py find "deploy" --platform grok

# Read a specific Grok session:
python3 scripts/find-agent-sessions.py read <session-id> --platform grok
```

## Notes

- The `cwd` in `summary.json.info.cwd` is the authoritative working directory.
  If absent, the parent directory name is URL-decoded to recover it.
- The `current_model_id` field contains the model slug; the provider prefix
  (before the first `-`) is extracted as `provider`.
- Grok sessions do not currently have a subagent/child session concept in the
  same way as Claude or Codex; `parent_id` and `agent` are `None`.
- Sessions are sorted by `updated_at` (falling back to file mtime).
