# LazyGrok

<!-- Plugin version is 0.4.4 -->

**LazyCodex / OmO for [Grok Build](https://x.ai)** — version **0.4.4**.

LazyGrok is **our** port of [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) **`plugins/omo` @ v4.19.2** onto Grok — not a mindless copy, and not “Codex with renames.” We keep LazyCodex’s ultrawork process (evidence, parallel specialists, Stop loops, skill gate) and **add what Grok has that Codex does not**: native **`workflow`** multi-agent panels, then hide that harness so you only ever say **`ulw`**.

| | |
| --- | --- |
| **Plugin version** | `0.4.4` |
| **Upstream** | [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) tag **v4.19.2** (`plugins/omo`) |
| **Install source** | `https://github.com/ThewindMom/lazygrok` |
| **Skill roots** | `skills/` · `vendor/lazygrok-skills/` · `vendor/lazygrok-hooks/` |

---

## First principles: one switch

| Work | What you do |
| --- | --- |
| **Light** (typo, one-liner, “just answer”) | Chat normally. **Do not** say `ulw`. |
| **Serious** (multi-file, design risk, ship-with-evidence) | Put **`ulw`** or **`ultrawork`** in the prompt (or `/ultrawork`). |

That is the whole UX. You do **not** run `/workflow`, name discover/review panels, open a hybrid mode, or babysit multi-agent plumbing. LazyGrok does that under ULW.

```text
ulw fix auth session refresh across API + client and prove it with a failing test first
```

What happens (agent-side; you should not think about this):

1. `ULTRAWORK MODE ENABLED!`
2. Binding goal (ulw-loop ledger + `# Goal`)
3. Ultrawork skill (LazyCodex 4.19.2 body + Grok adapters)
4. Automatic **discovery** fan-out when the tree is multi-file / unfamiliar
5. **Implement** RED → GREEN → real-surface evidence → cleanup (parent + workers)
6. Automatic **review** when the tier is HEAVY (or you demanded rigorous review)
7. Commits + stop when criteria actually pass

### Who owns which phase? (first principles)

ULW is three phases. Grok’s `workflow` tool is used only where a **deterministic multi-agent panel** is the right tool — not for the product change itself.

| Phase | Mechanism | Why |
| --- | --- | --- |
| **Discover** | Silent `workflow` → **`ulw-discover`** (else explore/librarian `spawn_subagent`) | Parallel read-only fan-out with budget/phase rail; findings only — never edits |
| **Implement** | **Parent ULW** + optional `lazygrok-worker-*` / Hephaestus via **`spawn_subagent`** | RED→GREEN, notepad, evidence, commits, and the done claim must stay one owner. **No `ulw-implement` panel** (by design) |
| **Review** | Silent `workflow` → **`ulw-review`** after evidence (HEAVY / rigorous) (else code-reviewer spawn) | Structured multi-dimension + adversarial verify against a prepared diff; parent still fixes blockers |

There are exactly two shipped ULW panel scripts: `ulw-discover` and `ulw-review`. Implementation is never handed to a workflow so a panel finish cannot be mistaken for “shipped.”

---

## Why LazyGrok exists (LazyCodex + Grok strengths)

[LazyCodex OmO](https://github.com/code-yeongyu/lazycodex) is the best-in-class **process** for serious agent coding: ultrawork, goal ledgers, explore → implement → verify, Ralph-style continuation. Codex has no Grok **`workflow`** tool — its “workflows” are skill + hook + CLI loops only.

[Grok Build](https://x.ai) adds harness strengths LazyCodex cannot assume:

| Grok strength | What we do with it |
| --- | --- |
| **`workflow` tool** (Rhai panels, `parallel()`, agent budget, phase rail, journal) | Force **discovery** and **HEAVY review** fan-out under ULW — not implementation |
| **`spawn_subagent` + wait/kill** | **Implementation** workers, plan, librarian, and fallback explore/review — same LazyCodex wave discipline |
| **Background runs + `/workflows` dashboard** | Agent uses them; **you** still only type `ulw` |
| Host goals often **off** when workflows are on | Durable **ulw-loop ledger** + `# Goal` (not a bug) |
| Plugin hooks + skill gate | Always-on LazyCodex-style discipline on Grok tools only |

So the product thesis is:

> **Port LazyCodex process fidelity. Use Grok’s workflow engine for forced explore + structured review (where Codex is weak). Keep implementation parent-owned. Keep the user model as simple as one keyword.**

Upstream process text stays LazyCodex-shaped; harness adapters are permanent (`todo_write`, `spawn_subagent`, ledger when `create_goal` is missing, plugin paths, hooks, silent `ulw-discover` / `ulw-review`).

---

## Ultrawork in one keyword

Say **`ulw`** or **`ultrawork`** anywhere in the prompt. No `/goal` required.

| Layer | Role |
| --- | --- |
| **ulw-loop ledger** | Source of truth for criteria + evidence (Codex `create_goal` equivalent on Grok) |
| **`# Goal`** | Transcript / compaction contract |
| **Host `/goal`** | Optional outer belt when goal mode is on |
| **Grok `workflow` panels** | **Internal** ULW engine for discover + HEAVY review — not a second user product |

Panel scripts (shipped; installed for silent use):

- `docs/examples/ulw-discover.rhai` → `~/.grok/workflows/ulw-discover.rhai`
- `docs/examples/ulw-review.rhai` → `~/.grok/workflows/ulw-review.rhai`

Agent reference only: skill `ulw-workflow` (`user_invocable: false`). See [docs/ulw-workflow.md](docs/ulw-workflow.md).

Upstream pin: [docs/ultrawork-upstream.md](docs/ultrawork-upstream.md).

**Hard inject vs soft skill path:** UPS hook inject is the LazyCodex-faithful bootstrap; skill-list activation is a soft fallback. Measure inject via `~/.grok/state/lazygrok/ups-probe-latest.json` (never stale `hooks.log`). Details: [docs/ultrawork-inject.md](docs/ultrawork-inject.md).

**First install only** (Grok loads plugin hooks late; we mirror hooks via `~/.grok/hooks/`):

```bash
node ~/.grok/installed-plugins/lazygrok-*/scripts/install-user-hooks.mjs
# optional full audit:
python3 ~/.grok/installed-plugins/lazygrok-*/scripts/audit-hooks.py full
node ~/.grok/installed-plugins/lazygrok-*/scripts/verify-ups-inject.mjs
```

Dynamic plugin root — `grok plugin update` does **not** require re-run. UPS probe self-heals a missing/stale bridge.

---

## Grok harness map

| LazyCodex / OmO | Grok / LazyGrok |
| --- | --- |
| `create_goal` / `update_goal` | Optional host tools; default **ulw-loop CLI** + `# Goal` |
| `update_plan` | `todo_write` |
| `multi_agent_v1.spawn_agent` / `wait_agent` | `spawn_subagent` / `get_command_or_subagent_output` |
| Parallel coding (explore/worker/review) | Same-turn subagent waves **and** silent `workflow` discover/review panels under ULW |
| **No Rhai workflow engine** | Grok **`workflow`** — LazyGrok addition, user-invisible under `ulw` |
| **Grok tools only** | Always-on `rules/15-grok-tools-only.md` |
| Teammode durable teams | **n/a** on Grok — parallel one-shot subagents only |
| `apply_patch` | `search_replace` / `write` |
| In-app browser | `playwright` MCP (else agent-browser) |
| `lazycodex-*` agents | `lazygrok:*` / `lazygrok-*.md` |
| `.omo/plans` | `.lazygrok/plans` (accept mid-run `.omo/ulw-loop/`) |
| npm auto-update SessionStart | Not ported — use `grok plugin update` |

---

## What’s included

### Skills (trimmed LazyCodex-for-Grok surface)

**Top-level (`skills/`):**  
`ultrawork` · `ulw-loop` · `ulw-plan` · `ulw-evidence` · `ulw-ralph-loop` · `ulw-workflow` (internal) · `ralph-loop` · `cancel-ralph` · `prometheus-plan` · `start-work-execution` · `agent-skill-gate` · `hashline-edit` · `handoff` · `init-deep` · `lsp` · `git-master` · `review-work` · `refactoring` · `remove-ai-slops` · `coding-agent-sessions` · `ultimate-browsing`

**Vendored OmO (`vendor/lazygrok-skills/`):**  
`programming` · `debugging` · `frontend` · `visual-qa` · `ultraresearch` / `ulw-research` · `start-work` · `ast-grep` · `comment-checker` · `rules` · `refactor` · `lsp-setup` · `teammode` · `lcx-*` · …

As of **0.4.1+**, superpowers and non-OmO filler packs are **not** registered. First-prompt skill inject uses **agent-skill-gate**.

### Agents (22)

**OmO / LazyCodex roles:** Sisyphus, Atlas, Hephaestus, Prometheus, Metis, Momus, Oracle, Librarian, Explore, Explorer  

**LazyGrok workers & gates:** `lazygrok-worker-{low,medium,high}` · `lazygrok-executor` · `lazygrok-code-reviewer` · `lazygrok-qa-executor` · `lazygrok-gate-reviewer` · `lazygrok-clone-fidelity-reviewer` · `lazygrok-plan` · `lazygrok-librarian` · `lazygrok-metis` · `lazygrok-momus`

Agent models default to **`inherit`** (no hard-coded Codex model IDs).

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

(You still do not need these for basic ULW — the keyword is enough.)

### Continuation & evidence

| Mode | Behavior |
| --- | --- |
| **Ralph** | Stop-hook work-until-done + completion promise |
| **ulw-ralph-loop** | Ralph + `<promise>VERIFIED</promise>` verifier gate |
| **ulw-loop (OmO ledger)** | `goals.json` + `ledger.jsonl` + checkpoints; LIGHT: `light-quality-gate` then `checkpoint`; HEAVY: reviewer gate |
| **start-work / boulder** | Prometheus plan execution with continuation |

State prefers **`.lazygrok/`** (accepts mid-run **`.omo/ulw-loop/`** if already created).

---

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

After install, ensure ULW panel scripts are present (plugin update may reinstall these):

```bash
PLUGIN=$(ls -d ~/.grok/installed-plugins/lazygrok-* | sort | tail -1)
mkdir -p ~/.grok/workflows
cp -f "$PLUGIN"/docs/examples/ulw-discover.rhai ~/.grok/workflows/
cp -f "$PLUGIN"/docs/examples/ulw-review.rhai ~/.grok/workflows/
```

---

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
| [docs/ulw-workflow.md](docs/ulw-workflow.md) | Internal ULW + Grok workflow panels (agent protocol) |
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
- Workflow runs interrupted by process exit are not fully durable across restarts
- Do not expect Codex multi_agent mailbox APIs or npm SessionStart auto-update

## Privacy

No LazyGrok-owned telemetry to third parties. See [docs/PRIVACY.md](docs/PRIVACY.md).

## License

MIT — [LICENSE](LICENSE), [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Vendored OmO components retain their upstream licenses/attribution under `vendor/lazygrok-hooks/` and `vendor/lazygrok-skills/`.

## Acknowledgments

- [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) (OmO / LazyCodex) — primary upstream process  
- [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) — historical OMO lineage  
- [Grok Build](https://x.ai) / xAI — harness, including native `workflow` multi-agent panels this port leans on  
