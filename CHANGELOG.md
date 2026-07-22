# Changelog

All notable changes to this project are documented in this file.

Releases are normally automated via [release-please](https://github.com/googleapis/release-please) when GitHub Actions billing is active. While Actions is disabled, use [`scripts/manual-release.sh`](scripts/manual-release.sh).

## [0.2.1](https://github.com/ThewindMom/lazygrok/compare/v0.2.0...v0.2.1) (2026-07-22)


### Features

* add coding-agent-sessions skill with Grok scanner ([81f10fe](https://github.com/ThewindMom/lazygrok/commit/81f10fe579919d094a7d484497e6e7f7d40d1e7a))
* add epistemic instrumentation to ultraresearch skill ([96ebe6b](https://github.com/ThewindMom/lazygrok/commit/96ebe6be1ef7bf1a1d0f764f17989806728d7d0e))
* add ultimate-browsing skill with agent-browser + playwright routing ([556f252](https://github.com/ThewindMom/lazygrok/commit/556f25267e280d8fbc71cc4c7f6fdae94b6958cb))
* close remaining gaps with lazycodex omo v4.19.1 ([b5e8625](https://github.com/ThewindMom/lazygrok/commit/b5e8625f218c951ecc330a0a97f6676580d1d305))
* exhaustive gap closure — upgrade all components to v4.19.1, fix hooks, add missing files ([ca269de](https://github.com/ThewindMom/lazygrok/commit/ca269de64f4fbed55b8065b87e6dff0f00c640ed))
* **go:** boulder and todo stop enforcer ([36ffdd0](https://github.com/ThewindMom/lazygrok/commit/36ffdd0da23aea99d0f47a2640f6141c3f90c68e))
* **go:** config flags and session-start binary doctor ([f845b5b](https://github.com/ThewindMom/lazygrok/commit/f845b5b47ca0e65c8cb00b59836837f439c1292e))
* **go:** cross-compile omg-hook and arch dispatcher ([20603e9](https://github.com/ThewindMom/lazygrok/commit/20603e9c53f569027b9cc2b5cf269a45b75f6b84))
* **go:** port hashline-core line hash with golden tests ([ba2432d](https://github.com/ThewindMom/lazygrok/commit/ba2432dfee5098dc7f6a6c5a4c3b66fe92ddbb22))
* **go:** post-tool-read hashline cache ([0176745](https://github.com/ThewindMom/lazygrok/commit/0176745d1dd8162f47a45d7aecb057bbda727ccd))
* **go:** pre-tool-use chain in omg-hook ([b4679ce](https://github.com/ThewindMom/lazygrok/commit/b4679ce115c0065e5f249ab676cf5eeb9030fbc7))
* **go:** scaffold omg-hook module with hookio and hookenv ([1d667bf](https://github.com/ThewindMom/lazygrok/commit/1d667bfbfaf71fd4c64361eb91b73e3ee2ac6f0d))
* **go:** stop chain in omg-hook ([77e4d83](https://github.com/ThewindMom/lazygrok/commit/77e4d839fe768ffe325df95b442f41665d8577db))
* **go:** user-prompt merge and session lifecycle ([d61c312](https://github.com/ThewindMom/lazygrok/commit/d61c312ec908d9705b06b3b1c1d3dbb6761e259b))
* **hashline:** port line hash computation from hashline-core ([29abed1](https://github.com/ThewindMom/lazygrok/commit/29abed1b9bbe999d9694fb6412ad726b257f0acb))
* **hashline:** read cache and PreToolUse stale-edit guard ([272d234](https://github.com/ThewindMom/lazygrok/commit/272d2349e8af536649e3cd88d53897982e28ed7b))
* **intent-gate:** keyword modes on UserPromptSubmit ([6b7d926](https://github.com/ThewindMom/lazygrok/commit/6b7d926294cbd1efb6a7c5d41abfe0b684d6e41a))
* **lsp:** post-edit diagnostics stash and Stop enforcement ([a9eb007](https://github.com/ThewindMom/lazygrok/commit/a9eb0075cff6d4be71db5aa3eebe0777d2fd87bc))
* **mcp:** bundle ast-grep and lsp-tools MCP servers ([04bef01](https://github.com/ThewindMom/lazygrok/commit/04bef0164a64cbed14361c2a3113c83dd53acd3b))
* overhaul README and docs for Grok Build discoverability ([684e3d0](https://github.com/ThewindMom/lazygrok/commit/684e3d03b5a6e82050290c51b82cb1fe5b15e194))
* **plugin:** bundle superpowers skills in oh-my-grok ([7c7703e](https://github.com/ThewindMom/lazygrok/commit/7c7703e09e5d28ac9fcc9ea0b28c0acb7ed87852))
* port ultrawork skill, spawn guard, ulw-loop evidence bridge from omo v4.19.1 ([a1914f8](https://github.com/ThewindMom/lazygrok/commit/a1914f8323cdbcbf5568b8511271fcc20d083235))
* **prometheus:** plan mode, md-only guard, start-work boulder ([6653a0f](https://github.com/ThewindMom/lazygrok/commit/6653a0f6ce2b14a3a9feb9a89cf5a0ee3986600c))
* prompt variants loaded from prompts-core, grok variant synced ([bdcd666](https://github.com/ThewindMom/lazygrok/commit/bdcd66663fd016c9b0a68cc3958f1a6a1c647d90))
* **todo-enforcer:** cooldown and abort window on Stop chain ([9e98719](https://github.com/ThewindMom/lazygrok/commit/9e98719acf3c670153ffb470ac5b1438889a507f))
* wire ulw-loop stop-resume and spawn guard hooks ([b928a83](https://github.com/ThewindMom/lazygrok/commit/b928a833cf3586aaafc0d80717d73dccad3929b6))


### Bug Fixes

* add lazygrok-shim.mjs to translate Grok events to Codex format ([a492876](https://github.com/ThewindMom/lazygrok/commit/a492876c623dae0d884d9ae4b4b2b35c11e4e445))
* **docs,scripts:** sanitize stale plugin IDs causing hooks not called + expand troubleshooting with verification steps ([5ed9a65](https://github.com/ThewindMom/lazygrok/commit/5ed9a65694fbfeeb9a3e691a6f5e83b069025bc8))
* **hashline:** populate cache on Read via post-tool-read.sh ([3d5b521](https://github.com/ThewindMom/lazygrok/commit/3d5b5214eb375a8ba9e2fa077bd5e5a05d2d3071))
* **hooks:** restore Ralph/Ultrawork Stop continuation on Composer 2.5 ([a45cb0a](https://github.com/ThewindMom/lazygrok/commit/a45cb0a61f98c85f510928710a9be50924122624))
* LSP post-tool-lsp hook, comment-checker binary, bare ulw trigger ([f25d4dd](https://github.com/ThewindMom/lazygrok/commit/f25d4ddabc75fb4ead25dbcebf621487f01541a9))
* LSP PostToolUse hook works with Grok via shim ([941575a](https://github.com/ThewindMom/lazygrok/commit/941575a6ee77dd8a8e43605c4ed3de6a1e414092))
* remove broken auto-update hook and fix LSP skill path ([f2cf0c3](https://github.com/ThewindMom/lazygrok/commit/f2cf0c3057bfc501f34d7489cac3cf67267407a4))
* remove lazygrok-git-bash MCP server (Windows-only, fails silently on Linux) ([1977658](https://github.com/ThewindMom/lazygrok/commit/197765856982a8079a687b8d38847bbe5da6eb2e))
* **skill-gate:** proactive skill loading for Grok Composer 2.5 ([c52668b](https://github.com/ThewindMom/lazygrok/commit/c52668b2520abdc394003a0b97df0ae4761c05d5))

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
