# Privacy, Network Access, and No-Telemetry Policy

LazyGrok itself sends **no telemetry**. Its hooks and local MCP processes do
not automatically collect, transmit, or disclose:

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

Workspace and plugin state can contain the objective or workflow data needed to
resume a run. LazyGrok creates and repairs its private directories and files with
`0700`/`0600` permissions; artifacts created by external shell commands inherit
that process's umask but remain enclosed by private state directories. This is
local persistence, not telemetry.
The session bridge stores only a workspace hash, exact Grok session ID, and
timestamp so terminal-side ULW commands can bind to the hook session without
retaining the prompt.
The first-prompt skill-gate marker is stored at the legacy local path
`~/.grok/state/using-superpowers/<session>/first_prompt_done`; despite that
directory name, the active injected content is `agent-skill-gate`, and the
marker file is empty.

The upstream telemetry component is removed during LazyGrok port generation and
is not shipped or invoked.

## MCP inventory

The shipped `.mcp.json` registers these servers:

| Server | Transport | Network behavior |
| --- | --- | --- |
| `hashline` | Local stdio | None |
| `lazygrok-lsp` | Local stdio | None |
| `lazygrok-lsp-tools` | Local stdio | None |
| `lazygrok-lsp-daemon` | Local stdio | None |
| `lazygrok-codegraph` | Local stdio | None |
| `grep_app` | Remote HTTPS to `https://mcp.grep.app` | Sends the query supplied when the user or agent invokes grep.app |
| `context7` | Remote HTTPS to `https://mcp.context7.com/mcp` | Sends the library/documentation query supplied when the user or agent invokes Context7 |

The local servers operate on local workspace data. The two remote MCP servers
are network services, not telemetry: they are contacted only when their tools
are explicitly invoked, and their requests are governed by those services'
privacy policies.

## Other user-invoked network access

LazyGrok skills may direct the agent to use host-provided web search, browsing,
or URL fetch tools for a task. Those calls can send search terms, URLs, page
requests, and any deliberately supplied context to the selected network
provider. Library installation, Git operations, plugin installation/update,
and user-run shell commands may also access the network. None of these actions
is automatic LazyGrok telemetry, but users should review tool arguments before
approving or invoking them when data is sensitive.

## Verification

- No HTTP listeners are started unless explicitly configured by the user.
- No `fetch`, `http`, or `net/http` outbound calls exist in the LazyGrok hook
  or local MCP runtime for telemetry purposes.
- Port generation and runtime-parity tests fail if a telemetry hook route is
  registered.
- Linux state mutations are descriptor-anchored. Sensitive state/evidence and
  LSP mutation operations fail closed on other platforms.
- The `lazygrok doctor` command reports local state only and does not transmit data.

If a future LazyGrok runtime dependency introduces automatic network access, it
must be gated behind explicit user opt-in and documented here.
