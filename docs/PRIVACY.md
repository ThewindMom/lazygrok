# Privacy and No-Telemetry Policy

lazygrok is a local, high-trust plugin. It does **not** collect, transmit, or
disclose any of the following to any external service:

- Prompts or prompt content
- Source code, file contents, or file paths
- Tool arguments or tool results
- Machine identifiers, hostnames, or IP addresses
- Usage events, session metadata, or timing data
- Repository information, git state, or commit hashes
- User identity or authentication tokens

## What the plugin does locally

- Reads hook event JSON from stdin (provided by Grok)
- Reads and writes state files under `.lazygrok/` in the workspace
- Reads and writes plugin state under `GROK_PLUGIN_DATA` or `~/.grok/`
- Writes local diagnostic logs to a configurable local path
- Spawns the hashline MCP server as a local stdio process

## Verification

- No HTTP listeners are started unless explicitly configured by the user.
- No `fetch`, `http`, `net/http` outbound calls exist in the hook or MCP
  runtime for telemetry purposes.
- The `lazygrok doctor` command reports local state only and does not transmit data.

If a future dependency introduces network access, it must be gated behind an
explicit user opt-in and documented here.
