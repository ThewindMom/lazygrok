# LazyGrok

<!-- Plugin version is 0.4.3 -->

**LazyCodex / OmO for [Grok Build](https://x.ai)** — version **0.4.3**.

LazyGrok ports [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) **`plugins/omo` @ v4.19.2** onto Grok’s tool surface (not a mindless Codex copy). Upstream process text and components stay LazyCodex; Grok gets permanent harness adapters (`todo_write`, `spawn_subagent`, ulw-loop ledger when host `create_goal` is missing, plugin paths, hooks).

| | |
| --- | --- |
| **Plugin version** | `0.4.3` |
| **Upstream** | [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) tag **v4.19.2** (`plugins/omo`) |
| **Install source** | `https://github.com/ThewindMom/lazygrok` |
| **Skill roots** | `skills/` · `vendor/lazygrok-skills/` · `vendor/lazygrok-hooks/` (no superpowers pack) |

## Ultrawork in one keyword

Say **`ulw`** or **`ultrawork`** anywhere in the prompt (or `/ultrawork`). That is enough.

You do **not** need `/goal` or extra slash commands. Bootstrap:

1. `ULTRAWORK MODE ENABLED!`
2. **Binding goal** = ulw-loop ledger (`create-goals`) always; `# Goal` mirror; host `create_goal` / `update_goal` only if present (silent if absent)
3. Full **ultrawork** skill (LazyCodex 4.19.2 body + Grok renames)
4. `todo_write` checklist

| Layer | Role |
| --- | --- |
| **ulw-loop ledger** | Source of truth for criteria + evidence (Codex `create_goal` equivalent on Grok) |
| **`# Goal`** | Transcript / compaction contract |
| **Host `/goal`** | Optional outer belt when goal mode is on |
| **Grok workflows** | Optional pipelines for sub-jobs — not the ULW engine |

Upstream pin: [docs/ultrawork-upstream.md](docs/ultrawork-upstream.md).

**Hard inject vs soft skill path:** the UPS hook inject is the LazyCodex-faithful bootstrap; skill-list activation is a soft fallback. Measure inject only via `~/.grok/state/lazygrok/ups-probe-latest.json` (never stale `hooks.log`). Details: [docs/ultrawork-inject.md](docs/ultrawork-inject.md).

**First install only** (Grok loads plugin hooks late; we mirror **all** plugin hooks via `~/.grok/hooks/`):

```bash
node ~/.grok/installed-plugins/lazygrok-*/scripts/install-user-hooks.mjs
# optional full audit:
python3 ~/.grok/installed-plugins/lazygrok-*/scripts/audit-hooks.py full
node ~/.grok/installed-plugins/lazygrok-*/scripts/verify-ups-inject.mjs
```

Dynamic plugin root — `grok plugin update` does **not** require re-run. UPS probe self-heals a missing/stale bridge (v4 full mirror).

## Grok harness map

| LazyCodex / OmO | Grok / LazyGrok |
| --- | --- |
| `create_goal` / `update_goal` | Optional host tools; default **ulw-loop CLI** + `# Goal` |
| `update_plan` | `todo_write` |
| `multi_agent_v1.spawn_agent` / `wait_agent` | `spawn_subagent` / `get_command_or_subagent_output` |
| Parallel coding (explore/worker/review) | **Same-turn** `spawn_subagent` waves (depth 1); see `rules/14-coding-multi-agent.md` |
| **Grok tools only** | Always-on `rules/15-grok-tools-only.md` — only call tools in the live session list |
| Teammode durable teams | **n/a** on Grok — parallel one-shot subagents only |
| `apply_patch` | `search_replace` / `write` |
| In-app browser | `playwright` MCP (else agent-browser) |
| `lazycodex-*` agents | `lazygrok:*` / `lazygrok-*.md` |
| `.omo/plans` | `.lazygrok/plans` (accept mid-run `.omo/ulw-loop/`) |
| npm auto-update SessionStart | Not ported — use `grok plugin update` |

## What’s included

### Skills (trimmed LazyCodex-for-Grok surface)

**Top-level (`skills/`, 20):**  
`ultrawork` · `ulw-loop` · `ulw-plan` · `ulw-evidence` · `ulw-ralph-loop` · `ralph-loop` · `cancel-ralph` · `prometheus-plan` · `start-work-execution` · `agent-skill-gate` · `hashline-edit` · `handoff` · `init-deep` · `lsp` · `git-master` · `review-work` · `refactoring` · `remove-ai-slops` · `coding-agent-sessions` · `ultimate-browsing`

**Vendored OmO (`vendor/lazygrok-skills/`, 26):**  
`programming` · `debugging` · `frontend` · `visual-qa` · `ultraresearch` / `ulw-research` · `start-work` · `ulw-loop` · `ulw-plan` · `ultrawork` · `ast-grep` · `comment-checker` · `rules` · `refactor` · `lsp-setup` · `teammode` · `lcx-doctor` · `lcx-report-bug` · `lcx-contribute-bug-fix` · … (plus mirrors of core ULW skills)

As of **0.4.1+**, superpowers and non-OmO filler packs are **not** registered. First-prompt skill inject uses **agent-skill-gate**.

### Agents (22)

**OmO / LazyCodex roles:** Sisyphus, Atlas, Hephaestus, Prometheus, Metis, Momus, Oracle, Librarian, Explore, Explorer  

**LazyGrok workers & gates:** `lazygrok-worker-{low,medium,high}` · `lazygrok-executor` · `lazygrok-code-reviewer` · `lazygrok-qa-executor` · `lazygrok-gate-reviewer` · `lazygrok-clone-fidelity-reviewer` · `lazygrok-plan` · `lazygrok-librarian` · `lazygrok-metis` · `lazygrok-momus`

Agent models default to **`inherit`** (no hard-coded Codex gpt-5.6 IDs).

### Components (`vendor/lazygrok-hooks/`)

Aligned with LazyCodex 4.19.2 OmO components, Grok-patched where needed:

`ultrawork` · `ulw-loop` · `bootstrap` · `codegraph` · `comment-checker` · `git-bash` · `git-bash-mcp` · `lsp` · `lsp-daemon` · `lsp-tools-mcp` · `rules` · `start-work-continuation` · `lazygrok-executor-verify` · `teammode` · `telemetry`

Rebuild ULW dists: `scripts/rebuild-ulw-components.sh`.

### MCP servers

| Server | Purpose |
| --- | --- |
| `hashline` | Hash-anchored read/edit |
| `lazygrok-codegraph` | Symbol/edge knowledge graph |
| `lazygrok-lsp` / `lazygrok-lsp-tools` / `lazygrok-lsp-daemon` | LSP diagnostics & navigation |
| `lsp` | Bundled LSP MCP |
| `git_bash` | Git via MCP (when registered) |

(Plus host/user MCPs such as `grep_app` / `context7` if you add them globally.)

### Hooks

**40 entries** across 14 lifecycle events (`hooks/hooks.json`), including:

- **UserPromptSubmit** — ultrawork / ulw-loop / rules  
- **Stop** — Ralph / ulw-loop resume / start-work continuation  
- **PreToolUse** — skill-gate, spawn guard, goal budget, git-bash  
- **PostToolUse** — LSP, comment-checker, hashline cache, rules  
- **SubagentStop** — executor-verify (includes `lazygrok-worker-*`)

Performance-critical paths use the Go binary (`bin/lazygrok-hook-*`) via `hooks/run-hook.sh`.

### Slash commands

`/ultrawork` · `/ulw-loop` · `/ulw-ralph-loop` · `/ralph-loop` · `/plan` · `/start-work` · `/handoff` · `/stop-continuation` · `/resume-continuation`

### Continuation & evidence

| Mode | Behavior |
| --- | --- |
| **Ralph** | Stop-hook work-until-done + completion promise |
| **ulw-ralph-loop** | Ralph + `<promise>VERIFIED</promise>` verifier gate |
| **ulw-loop (OmO ledger)** | `goals.json` + `ledger.jsonl` + checkpoints; LIGHT: `light-quality-gate` then `checkpoint`; HEAVY: reviewer gate |
| **start-work / boulder** | Prometheus plan execution with continuation |

State prefers **`.lazygrok/`** (accepts mid-run **`.omo/ulw-loop/`** if already created).

## Installation

```bash
grok plugin install https://github.com/ThewindMom/lazygrok --trust
# or short form if your marketplace maps it:
# grok plugin install ThewindMom/lazygrok --trust
```

Local clone:

```bash
git clone https://github.com/ThewindMom/lazygrok.git
grok plugin install "$(pwd)/lazygrok" --trust
```

Update:

```bash
grok plugin update lazygrok
```

Then **reload plugins** in the TUI (or start a new session) so skills/hooks match the new commit.

## Uninstall

```bash
grok plugin uninstall lazygrok --confirm
```

Removes plugin-owned install only; does not wipe unrelated Grok config.

## Configuration

Precedence (highest first):

1. Environment (`LAZYGROK_*`, `GROK_PLUGIN_ROOT`, …)
2. Workspace: `.lazygrok/config.jsonc`
3. User: `~/.grok/lazygrok/config.jsonc`
4. Built-in defaults

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) and [docs/installation.md](docs/installation.md).

## Docs

| Doc | Contents |
| --- | --- |
| [docs/ultrawork-upstream.md](docs/ultrawork-upstream.md) | Ultrawork upstream pin & re-sync rule |
| [docs/lazycodex-4.19.2-port-receipt.md](docs/lazycodex-4.19.2-port-receipt.md) | 4.19.2 port receipt |
| [docs/lazygrok-grok-compat-report.md](docs/lazygrok-grok-compat-report.md) | Grok compatibility notes |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Install/hooks/goal issues |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |

Port / re-sync helper: `scripts/port-lazycodex-to-grok.py`.

## Grok limitations (by design)

- Subagents are one level deep (no recursive spawn from leaves)
- Only `PreToolUse` can hard-block tools; other hooks are advisory/continuation
- Host `create_goal` / `update_goal` often **absent** when background workflows are on — use the ledger
- Do not expect Codex multi_agent mailbox APIs or npm SessionStart auto-update

## Privacy

No LazyGrok-owned telemetry to third parties. See [docs/PRIVACY.md](docs/PRIVACY.md).

## License

MIT — [LICENSE](LICENSE), [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Vendored OmO components retain their upstream licenses/attribution under `vendor/lazygrok-hooks/` and `vendor/lazygrok-skills/`.

## Acknowledgments

- [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) (OmO / LazyCodex) — primary upstream  
- [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) — historical OMO lineage  
- Grok Build / xAI harness this port targets  
