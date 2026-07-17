# Changelog

All notable changes to this project are documented in this file.

Releases are normally automated via [release-please](https://github.com/googleapis/release-please) when GitHub Actions billing is active. While Actions is disabled, use [`scripts/manual-release.sh`](scripts/manual-release.sh).

## [0.2.1](https://github.com/mihazs/lazygrok/releases/tag/v0.2.1) (2026-06-03)

### Fixes

* Hooks from the plugin not being called after install or updates (stale `user/<hash>/name` entries in `~/.grok/config.toml` `[plugins] enabled` could cause `reload_plugins_impl` to report 0 hooks or skip registration of the current snapshot's `hooks/hooks.json`).
* Expanded "Hooks do not run after install" troubleshooting with detailed reload steps (Plugins `r`, Hooks `l`), reinstall from path, verification commands (plugin list/details, TUI Hooks tab under Plugin source, recent non-test state dirs under `~/.grok/state/skill-gate/` and `using-superpowers/` after a prompt), and scrollback annotation notes.
* `scripts/remove-global-overlays.sh` now also sanitizes stale plugin IDs from the enabled list (removes old `user/xxx/lazygrok` and `superpowers` entries, ensures canonical short names like `lazygrok` are present; backs up config). This complements the global hooks/skills/rules cleanup and `grok plugin enable`.

## [0.2.0](https://github.com/mihazs/lazygrok/releases/tag/v0.2.0) (2026-06-03)

### Features

* **Bundled superpowers** — `vendor/superpowers/skills/` (obra/superpowers v5.1.0); no separate superpowers plugin install
* **Go hook runtime** — `bin/lazygrok-hook-*` replaces bash/python hook libs; `hooks/run-hook.sh` dispatcher
* IntentGate, Prometheus plan mode, hashline read cache + PreToolUse guard, LSP diagnostics stash
* Bundled ast-grep and lsp-tools MCP servers (`scripts/build-mcp-runtimes.sh`)
* Todo enforcer cooldown/abort window on Stop chain
* `Taskfile.yml` for dev/CI commands

### Fixes

* Ralph / Ultrawork Stop continuation on Grok Composer 2.5 (workspace env + stopReason handling)
* Proactive skill loading: `<AGENT_SKILL_GATE_PROACTIVE>`, Grok Read-tool guidance vs `skill_information` metadata
* Hashline cache on any `Read` (not only `SKILL.md`)

### Chores

* lefthook pre-commit rebuilds `bin/lazygrok-hook-*`
* SessionStart runs on all session starts (removed narrow matcher)

## [0.1.0](https://github.com/mihazs/lazygrok/releases/tag/v0.1.0) (2026-06-02)

### Features

* Initial lazygrok Grok plugin: skill gate, Ralph/ultrawork loops, todo + boulder continuation, unified Stop chain
* Workspace runtime state under `.lazygrok/` (boulder, plans, todos, ralph-loop, handoffs)
* Handoff skill (`/handoff`) ported from oh-my-openagent
* Per-prompt injection of workspace `AGENTS.md` and bundled plugin `rules/*.md`
* Merged `UserPromptSubmit` hook; Stop priority chain in `hooks/lib/stop-chain.sh`
* First-prompt `using-superpowers` injection when superpowers is installed

### Documentation

* Marketing README, `docs/` guides, `ROADMAP.md`, GitHub issue/PR templates
* Agent-focused `AGENTS.md` with skill-gate flow and plugin editing rules
* SVG logo (`.github/lazygrok.svg`)

### CI

* GitHub Actions hook smoke tests (`.github/workflows/ci.yml`)
* release-please workflow (`.github/workflows/release.yml`) — requires Actions billing to run