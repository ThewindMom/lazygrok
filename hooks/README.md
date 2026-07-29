# Grok hooks layout

Plugin manifest: **`hooks/hooks.json`** (loaded via `GROK_PLUGIN_ROOT`). Install
with `grok plugin install ThewindMom/lazygrok@v0.4.4 --trust` (or `$(pwd)` from
a local clone), then create the documented first-install user-hook bridge.

## Runtime

Hooks run as a **single Go binary** per OS/arch: `bin/lazygrok-hook-<platform>`. [`run-hook.sh`](run-hook.sh) selects the binary and passes a subcommand (`session-start`, `user-prompt`, `pre-tool-use`, …). Rebuild with `scripts/build-hook.sh` (requires Go 1.22+). End users need **no** Python or Go installed.

Optional: **`grok`** CLI for `grok inspect` (skill catalog on SessionStart); **`node`** for LSP diagnostics post-edit (bundled MCP under `vendor/`).

## Event map

| Event | Subcommand | Role |
|-------|------------|------|
| `SessionStart` | `session-start` | Reset session state, refresh skill catalog, skill-gate banner |
| `UserPromptSubmit` | **`user-prompt`** | **One** merged `additionalContext` (see below) |
| `PreToolUse` | `pre-tool-use` | Prometheus plan-mode → hashline → skill gate |
| `PostToolUse` (Read) | `post-tool-read` | Hashline cache + mark SKILL.md loaded |
| `PostToolUse` (TodoWrite) | `post-tool-todo-write` | Mirror todos → `.lazygrok/todos/<session>.json` |
| `PostToolUse` (Write\|StrReplace) | `post-tool-lsp` | LSP diagnostics → `~/.grok/state/lsp-diagnostics/<session>.json` |
| `Stop` | `stop` | Explicit stop → core continuation/Boulder → ULW/Ralph → legacy Boulder/todo → LSP/plan |
| `SessionEnd` | `session-end` | Reset session state |

## UserPromptSubmit (merged)

**`user-prompt`** collects and emits a single JSON payload:

1. **LazyGrok first-prompt skill gate** (agent-skill-gate content and Grok Read-tool note)
2. **Skill gate proactive** — `<AGENT_SKILL_GATE_PROACTIVE>` with matched `SKILL.md` paths (catalog refresh if SessionStart missed)
3. Workspace `AGENTS.md` + plugin `rules/*.md` (every prompt; size-capped)
4. Ralph start/cancel only (`/ralph-loop`, `/cancel-ralph`); ULW activation remains on its separate skill/ledger hooks
5. **IntentGate** — search / analyze / team / hyperplan banners (`LAZYGROK_INTENT_GATE`)
6. **Prometheus** — `/plan`, `/start-work`, plan-mode state
7. `/handoff`, `/stop-continuation`, `/resume-continuation`
8. Boulder context (`.lazygrok/boulder.json`)
9. **LSP** — `<LSP_DIAGNOSTICS>` from session stash
10. **Hashline** — `<HASHLINE_CACHE>` for recently read files
11. Skill-gate reminder (unloaded ids)

## Stop (priority chain)

**First block wins** (see `internal/cmd/stop.go`):

1. **Explicit session stop** — allow immediately; no later continuation layer runs
2. **Core continuation** — session-owned bounded loops and cooldowns
3. **Core Boulder** — session-owned work records
4. **ULW goal bridge and Ralph-family promise loops**
5. **Legacy Boulder** — `.lazygrok/plans/*.md` progress
6. **Todo continuation** — incomplete `TodoWrite` items
7. **LSP** — error diagnostics in the session stash
8. **Pending plan** — root/session unchecked boxes (fallback)

Grok fires **`Stop`** (not Claude Code’s `session.idle`).

After `/stop-continuation`, the explicit-stop gate skips every continuation
layer until `/resume-continuation` or `SessionEnd`.

**PreToolUse** (`pre-tool-use`): prometheus plan-mode deny → hashline stale `LINE#ID` deny → skill gate.

## Workspace state (`.lazygrok/`)

| Path | Purpose |
|------|---------|
| `.lazygrok/boulder.json` | Active plan work (omo-compatible schema) |
| `.lazygrok/plans/*.md` | Prometheus-style plans |
| `.lazygrok/todos/<session>.json` | Todo mirror |
| `.lazygrok/run-continuation/<session>.json` | Pause marker (with `~/.grok/state/stop-continuation/`) |
| `.lazygrok/ralph-loop.local.md` | Explicit Ralph-family promise loop |
| `.lazygrok/handoffs/*.md` | Saved handoff summaries |

Session hook state under **`~/.grok/state/`**: skill-gate, stop-continuation, **hashline** (`state/hashline/<session>/`), **lsp-diagnostics** (`state/lsp-diagnostics/<session>.json`), **todo-enforcer**.

Configured MCP servers are listed in `.mcp.json`: local stdio `hashline`,
`lazygrok-lsp`, `lazygrok-lsp-tools`, `lazygrok-lsp-daemon`, and
`lazygrok-codegraph`; remote, user-invoked `grep_app` and `context7`.
Network/privacy details: [docs/PRIVACY.md](../docs/PRIVACY.md).

## Inactive upstream source

Retained upstream source outside the skill roots in `plugin.json` does not
register skills or hooks. The LazyGrok first-prompt injection loads
`agent-skill-gate`.

## Tests

From repo root with `GROK_PLUGIN_ROOT` set (see main README):

```bash
export GROK_PLUGIN_ROOT="$(pwd)"
bash hooks/test-stop-verify.sh
bash hooks/test-ralph-loop.sh
bash hooks/test-ulw-loop.sh
bash hooks/test-todo-boulder.sh
bash hooks/test-using-superpowers-first-prompt.sh
bash hooks/test-handoff.sh
bash hooks/test-intent-gate.sh
bash hooks/test-prometheus.sh
bash hooks/test-hashline.sh
bash hooks/test-lsp.sh
```

`LAZYGROK_*` toggles: [docs/configuration.md](../docs/configuration.md).
