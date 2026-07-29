# Changelog

All notable changes to this project are documented in this file.

Releases are normally automated via [release-please](https://github.com/googleapis/release-please) when GitHub Actions billing is active. While Actions is disabled, use [`scripts/manual-release.sh`](scripts/manual-release.sh).

## Unreleased

### LazyCodex 4.19.3 sync
* Port ULW’s parallelism decision to Grok’s actual transport: independent `spawn_subagent` workers only; overlapping work stays sequential and parent-owned
* Update CodeGraph bootstrap to 4.19.3 with ancestor project discovery, per-project worker locks, stale-lock recovery, and failure cooldowns
* Add the frontend interaction-mechanics reference and routing for micro-interaction/motion work
* Make Grok-native skill selection the documented ULW activation path, add deterministic `/ulw`, and use Grok-supported `user-invocable` skill metadata
* Split ULW activation from legacy Ralph completely: `ulw`, `/ulw`, `ultrawork`, and `/ulw-loop` use only the ULW goal ledger; promise + verifier remains explicit as `/ulw-ralph-loop`, alongside `/ralph-loop` and `/cancel-ralph`
* Preserve the worktree/cwd/source-clean contract in the injected ultrawork skill and all generated copies
* Correct active docs for the 0.4.4 install/bootstrap, inactive upstream superpowers sources, manual build-time prompt variants, and the complete local/remote MCP privacy inventory
* Keep vendored git-bash compatibility sources while explicitly leaving the unsupported `git_bash` MCP unregistered on Grok/Linux
* Keep Codex config migration and version-only root hook status changes out of the Grok runtime

## [0.4.5](https://github.com/ThewindMom/lazygrok/compare/v0.4.4...v0.4.5) (2026-07-29)


### Features

* **ultrawork:** sync LazyCodex 4.19.3 for Grok ([8ad2290](https://github.com/ThewindMom/lazygrok/commit/8ad22900ac513356ec4562ebf900426650cc1f53))
* **ulw:** complete LazyCodex 4.19.3 parity for Grok ([8de70e1](https://github.com/ThewindMom/lazygrok/commit/8de70e116188046cba725c6d5ea4e3adc8c25f33))


### Bug Fixes

* **docs:** correct issue install source ([cd945fc](https://github.com/ThewindMom/lazygrok/commit/cd945fc20eb329f8df1f060a0d46e7a52413897c))
* **docs:** use supported Grok install sources ([b0ae9e6](https://github.com/ThewindMom/lazygrok/commit/b0ae9e6e9eda72970f65600375fef3490ff3ced0))
* **hooks:** drop Codex bootstrap on Grok ([6bb7e9a](https://github.com/ThewindMom/lazygrok/commit/6bb7e9a4f6e960f92d3dd3933cd07401f579bbf4))
* **hooks:** heal persisted mirror on update ([69908f7](https://github.com/ThewindMom/lazygrok/commit/69908f765285d519d55a74cd144713d4e6b8e5fd))
* **hooks:** keep mirror healing durable ([bcaf873](https://github.com/ThewindMom/lazygrok/commit/bcaf873833ebbc94a2524779b3dd69440881273c))
* **port:** contain skill metadata rewrites ([ed41b37](https://github.com/ThewindMom/lazygrok/commit/ed41b372a2df93955847ce1eec522b103e34c4d5))
* **port:** emit valid Grok install command ([7ebe499](https://github.com/ThewindMom/lazygrok/commit/7ebe49939ed6fc5fd09ff2333b6df3f2000d2294))
* **port:** make source mode explicit ([d8c2d33](https://github.com/ThewindMom/lazygrok/commit/d8c2d3383fee5d110a5047473ea8e5b4ea387da7))
* **port:** preserve generated Grok contracts ([9771f8e](https://github.com/ThewindMom/lazygrok/commit/9771f8e962ae28452ff9fc17a41c2ad5733a53ad))
* **port:** remove upstream install guidance ([ef2e6b6](https://github.com/ThewindMom/lazygrok/commit/ef2e6b602ad38e5e9f0ac635454f501a03348834))
* **port:** separate source and tool rewrites ([e121ec3](https://github.com/ThewindMom/lazygrok/commit/e121ec3627bd0f51b4c420288a83ba077b37ad3d))
* **ralph:** fail closed on state mutation errors ([1915aff](https://github.com/ThewindMom/lazygrok/commit/1915aff7e4455a73650717e9c3ff29eec42cf08c))
* **runtime:** bind loop mutations to owning sessions ([d2da373](https://github.com/ThewindMom/lazygrok/commit/d2da373576bd926bbeb46e5cd6fea48cd7ef0473))
* **runtime:** enforce Grok workflow ownership ([6c60016](https://github.com/ThewindMom/lazygrok/commit/6c6001611047ce35751e24a0aeb2bd1d6b16e4f6))
* **runtime:** fail closed on active workflow state ([925d121](https://github.com/ThewindMom/lazygrok/commit/925d1214727597229d8fa17896c70d6f5dee6d11))
* **runtime:** reject malformed workflow metadata ([0d3d413](https://github.com/ThewindMom/lazygrok/commit/0d3d413581ebb884cdc97a458079072c08c7ee69))
* **skills:** use Grok-native frontmatter keys ([84f5dc7](https://github.com/ThewindMom/lazygrok/commit/84f5dc7ed695660f69e0df12af551c6cccd9ca39))
* **state:** prevent cross-session workflow mutations ([8f6b4b7](https://github.com/ThewindMom/lazygrok/commit/8f6b4b76b2c118a72c1728cdaf603fefb3b37cce))
* **ulw:** bootstrap banner before skill read ([aa1f1cd](https://github.com/ThewindMom/lazygrok/commit/aa1f1cd9df8838ed5e8358281af2f92e5590fe72))
* **ulw:** synchronize Grok skill surfaces ([2b341d7](https://github.com/ThewindMom/lazygrok/commit/2b341d73711325f714d523ca6ba112279b59dbd6))
* **workflows:** enforce active ownership and Grok schemas ([55519dc](https://github.com/ThewindMom/lazygrok/commit/55519dcc0b2e2881da5fb80d78a7b52ae8e0e57d))

## [0.4.4] (2026-07-27)

### Docs / first principles
* README ownership table: **discover + review** use silent Grok `workflow` panels; **implement** stays parent + workers (no `ulw-implement`)
* Clarify `docs/ulw-workflow.md`, `skills/ulw-workflow`, `docs/examples/README.md` three-phase model
* CHANGELOG notes for silent panels already shipped in 0.4.3

## [0.4.3] (2026-07-27)

### Silent Grok `workflow` panels under one keyword (`ulw`)
* Auto **`ulw-discover`** / **`ulw-review`** via native `workflow` tool (agent-internal; user never names panels)
* Shipped Rhai: `docs/examples/ulw-discover.rhai`, `docs/examples/ulw-review.rhai` → `~/.grok/workflows/`
* Internal skill `ulw-workflow` (`user_invocable: false`) + `docs/ulw-workflow.md`
* **Implement is not a workflow:** parent + `spawn_subagent` workers own RED→GREEN / commits / done claim

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
* Bounded `lazygrok-ups-probe.mjs` forwarder + race-safe prompt_history recovery in shim
* **`scripts/install-user-hooks.mjs` (v4)** → full mirror of all plugin hooks under `~/.grok/hooks/` (dynamic plugin root)
* **`scripts/audit-hooks.py`** — inventory, dry-run (39 commands), parse live debug, session inspect
* Offline: `scripts/verify-ups-inject.mjs`; live activation verified from Grok session history
* Prompt-time diagnostic persistence was later removed; only sanitized session bindings remain
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
* Documented manual removal of stale plugin IDs from `~/.grok/config.toml`. `scripts/remove-global-overlays.sh` archives only the legacy `lazygrok.json` and `lazygrok-run.sh` user-hook bridge files; it does not rewrite plugin configuration.

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
