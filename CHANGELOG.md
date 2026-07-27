# Changelog

All notable changes to this project are documented in this file.

Releases are normally automated via [release-please](https://github.com/googleapis/release-please) when GitHub Actions billing is active. While Actions is disabled, use [`scripts/manual-release.sh`](scripts/manual-release.sh).

## [0.4.3] (2026-07-27)

### Coding multi-agent (LazyCodex feel on Grok)
* Always-on `rules/14-coding-multi-agent.md` + intent-gate `task()` → real `spawn_subagent` waves
* Ultrawork hard **CODING MULTI-AGENT** block (skill + directive) + UPS skill-pointer step 5
* `start-work-execution` spawn table fixed to Grok `subagent_type`/`prompt` (no fake `agent_type`/`message`)
* Teammode reduced to n/a stub → parallel one-shot subagents only
* Rebuild ultrawork dist so inject carries the multi-agent bootstrap

### Grok tools only (no foreign harness names)
* Always-on `rules/15-grok-tools-only.md` — allowlist of Grok session tools
* Atlas / hyperplan / team prompts rewritten to `spawn_subagent` only (removed OpenCode `task()` bodies)
* Ultrawork prompt variants synced to Grok directive (no Codex multi_agent text)
* Vendor skill dual-surface `fork_turns`/`task_name` blocks replaced with Grok-only spawn paragraph
* Prefer allowlist language over long “don’t call X” lists that prime wrong tools

### Ultrawork from code-yeongyu/lazycodex@4.19.2
* Source of truth: https://github.com/code-yeongyu/lazycodex `plugins/omo` tag **v4.19.2**
* Full LCX ultrawork SKILL body + mechanical Grok renames (`todo_write`, `spawn_subagent`, playwright, `lazygrok:*`)
* Binding goal: ulw-loop `create-goals` ledger (= LCX `create_goal` when host tools missing) + `# Goal`
* skill-pointer: LCX bootstrap shape + ledger + LazyGrok path resolve; dists rebuilt
* See `docs/ultrawork-upstream.md`

### Hard UPS inject + full hook bridge (Grok 0.2.x)
* Permanent `lazygrok-ups-probe.mjs` + race-safe prompt_history recovery in shim
* **`scripts/install-user-hooks.mjs` (v4)** → full mirror of all plugin hooks under `~/.grok/hooks/` (dynamic plugin root)
* **`scripts/audit-hooks.py`** — inventory, dry-run (39 commands), parse live debug, session inspect
* Offline: `scripts/verify-ups-inject.mjs`; live: `ups-probe-latest.json` + debug fires
* Dropped broken default **git_bash** MCP; ulw-plan prefers `.lazygrok/` drafts
* Docs: `docs/ultrawork-inject.md` (soft skill path vs hard inject)

## [0.4.2] (2026-07-27)

### UX
* **One keyword:** `ulw` / `ultrawork` is enough — no user `/goal` ceremony
* Bootstrap: host `create_goal`/`update_goal` if present → always `# Goal` + ulw-loop `create-goals` + `todo_write`
* Clarifies Grok host `/goal` is optional bonus, not required for ULW

## [0.4.1] (2026-07-27)

### Changes
* **Skill surface trimmed** to LazyCodex-for-Grok only: dropped superpowers pack registration and non-OmO filler skills; keep Ralph/ulw, skill-gate, hashline, prometheus, handoff, ulw-evidence
* First-prompt inject uses **agent-skill-gate** (not using-superpowers)
* Skill-gate catalog scans `skills/` + `vendor/lazygrok-skills` only

### P2 fixes
* Component package versions/dists aligned to **4.19.2** (bootstrap + codegraph re-synced)
* Agent TOML models set to **`inherit`** (no Codex gpt-5.6 hardcodes)
* **`ulw-loop light-quality-gate`**: Grok LIGHT final complete path with real attempt artifacts; accepts `lazygrok-*` reviewer role names
* Smoke checkpoint complete verified end-to-end

## [0.4.0] (2026-07-27)

### Features

* **LazyCodex 4.19.2 skill port** — re-sync OmO skills (ulw-loop, ulw-plan, ulw-research, ultrawork, start-work, frontend, programming, debugging, visual-qa, ultimate-browsing, …) with Grok tool map
* **`ulw-loop` is OmO goal ledger** on Grok (`# Goal` + ulw-loop CLI + `todo_write` + `spawn_subagent`); full-workflow Dynamic Steering / Manual-QA channels
* **`ulw-ralph-loop`** skill + command — previous Ralph `<promise>VERIFIED</promise>` loop split out of `ulw-loop`
* **Worker agents** — `lazygrok-worker-{low,medium,high}` MD agents; SubagentStop executor-verify matcher includes workers
* Port script `scripts/port-lazycodex-to-grok.py`
* **Rebuilt ultrawork/ulw-loop dists** from TypeScript with permanent Grok skill-pointer (`scripts/rebuild-ulw-components.sh`) + receipt `docs/lazycodex-4.19.2-port-receipt.md`

### Grok adaptations preserved

* Host `create_goal`/`update_goal` optional (workflows often hide them); durable goals via `ulw-evidence` CLI under `.lazygrok/`
* No multi_agent_v2/teammode transport; no npm auto-update SessionStart
* `coding-agent-sessions` Grok platform scanner kept after LCX merge

## [0.2.1](https://github.com/ThewindMom/lazygrok/releases/tag/v0.2.1) (2026-06-03)

### Fixes

* Hooks from the plugin not being called after install or updates (stale `user/<hash>/name` entries in `~/.grok/config.toml` `[plugins] enabled` could cause `reload_plugins_impl` to report 0 hooks or skip registration of the current snapshot's `hooks/hooks.json`).
* Expanded "Hooks do not run after install" troubleshooting with detailed reload steps (Plugins `r`, Hooks `l`), reinstall from path, verification commands (plugin list/details, TUI Hooks tab under Plugin source, recent non-test state dirs under `~/.grok/state/skill-gate/` and `using-superpowers/` after a prompt), and scrollback annotation notes.
* `scripts/remove-global-overlays.sh` now also sanitizes stale plugin IDs from the enabled list (removes old `user/xxx/lazygrok` and `superpowers` entries, ensures canonical short names like `lazygrok` are present; backs up config). This complements the global hooks/skills/rules cleanup and `grok plugin enable`.

## [0.2.0](https://github.com/ThewindMom/lazygrok/releases/tag/v0.2.0) (2026-06-03)

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

## [0.1.0](https://github.com/ThewindMom/lazygrok/releases/tag/v0.1.0) (2026-06-02)

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