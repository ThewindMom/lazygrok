# LazyGrok

<!-- Plugin version is 0.4.4 -->

**LazyCodex / OmO for [Grok Build](https://x.ai)** — version **0.4.4**.

LazyGrok is **our** port of [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) **`plugins/omo` @ v4.19.3** onto Grok — not a mindless copy, and not “Codex with renames.” We keep LazyCodex’s ultrawork process (evidence, parallel specialists, Stop loops, skill gate) and **add what Grok has that Codex does not**: native **`workflow`** multi-agent panels, then hide that harness so you only ever say **`ulw`**.

| | |
| --- | --- |
| **Plugin version** | `0.4.4` |
| **Upstream** | [code-yeongyu/lazycodex](https://github.com/code-yeongyu/lazycodex) tag **v4.19.3** (`plugins/omo`) |
| **Install source** | `https://github.com/ThewindMom/lazygrok` |
| **Skill roots** | `skills/` · `vendor/lazygrok-skills/` · `vendor/lazygrok-hooks/` |

---

## First principles: one switch

| Work | What you do |
| --- | --- |
| **Light** (typo, one-liner, “just answer”) | Chat normally. **Do not** say `ulw`. |
| **Serious** (multi-file, design risk, ship-with-evidence) | Put **`ulw`** or **`ultrawork`** in the prompt (or use `/ulw` / `/ultrawork`). |

That is the whole UX. You do **not** run `/workflow`, name discover/review panels, open a hybrid mode, or babysit multi-agent plumbing. LazyGrok does that under ULW.

```text
ulw fix auth session refresh across API + client and prove it with a failing test first
```

What happens (agent-side; you should not think about this):

1. `ULTRAWORK MODE ENABLED!`
2. Binding goal (ulw-loop ledger + `# Goal`)
3. Ultrawork skill (LazyCodex 4.19.3 body + Grok adapters)
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

Agent reference only: skill `ulw-workflow` (`user-invocable: false`). See [docs/ulw-workflow.md](docs/ulw-workflow.md).

Upstream pin: [docs/ultrawork-upstream.md](docs/ultrawork-upstream.md).

**Activation:** Grok's native skill matching sees `ulw` / `ultrawork`, selects the shipped skill, and the model reads its full `SKILL.md`. `/ulw` and `/ultrawork` are deterministic command entry points. UserPromptSubmit hooks remain compatibility diagnostics, but passive hook stdout is not the activation path. Details: [docs/ultrawork-inject.md](docs/ultrawork-inject.md).

**First install only** (Grok loads plugin hooks late; we mirror hooks via `~/.grok/hooks/`):

```bash
node ~/.grok/installed-plugins/lazygrok-*/scripts/install-user-hooks.mjs
# optional full audit:
python3 ~/.grok/installed-plugins/lazygrok-*/scripts/audit-hooks.py full
node ~/.grok/installed-plugins/lazygrok-*/scripts/verify-ups-inject.mjs
```

Dynamic plugin root: `grok plugin update` does **not** require re-running the
installer. Missing bridges are repaired explicitly with `install-user-hooks.mjs`;
the prompt hook never rewrites user configuration.

---

## Grok harness map

| LazyCodex / OmO | Grok / LazyGrok |
| --- | --- |
| `create_goal` / `update_goal` | Optional host tools; default **ulw-loop CLI** + `# Goal` |
| `update_plan` | `todo_write` |
| `multi_agent_v1.spawn_agent` / `wait_agent` | `spawn_subagent` / `get_command_or_subagent_output` |
| Codex worktree-capable workers | Grok `spawn_subagent(..., isolation: "worktree")` when branch/review/conflict isolation is warranted |
| Parallel coding (explore/worker/review) | Same-turn subagent waves **and** silent `workflow` discover/review panels under ULW |
| **No Rhai workflow engine** | Grok **`workflow`** — LazyGrok addition, user-invisible under `ulw` |
| **Grok tools only** | Always-on `rules/15-grok-tools-only.md` |
| Teammode durable teams | **n/a** on Grok — parallel one-shot subagents only |
| `apply_patch` | `search_replace` / `write` |
| In-app browser | `playwright` MCP (else agent-browser) |
| `lazycodex-*` agents | `lazygrok:*` / `lazygrok-*.md` |
| `.omo/{plans,boulder.json,start-work,ulw-loop,evidence}` | `.lazygrok/...` for new work; an existing `.omo` run stays on its original root |
| npm auto-update SessionStart | Not ported — use `grok plugin update` |

LazyGrok aims for behavioral parity, not fake API parity. Ordinary `ulw` work does not create a worktree merely to display a larger checklist; LazyCodex does not require that either. LazyGrok requires or recommends worktrees at the same risk boundaries where isolation matters: PR/branch review, conflicting parallel edits, and explicitly isolated subagents. Grok Build can provide per-child worktree isolation, but it does not expose LazyCodex’s durable team mailbox/task bus. `git_bash` is also intentionally unavailable on Grok/Linux.

For whole-session isolation, choose the worktree before Grok starts. Interactive Grok documents `grok --worktree=<name> "<prompt>"`, but Grok Build `0.2.114` does not materialize `--worktree` in the headless `-p` path. The reliable headless form is:

```bash
git worktree add --detach /absolute/task-worktree HEAD
grok --cwd /absolute/task-worktree -p "ulw <task>"
```

Hooks cannot move an already-running Grok process into another checkout. If a running ULW session reaches a PR/branch, conflicting-edit, or explicit-isolation boundary, LazyGrok instead creates or selects a task-owned worktree and requires all subsequent edits, commands, tests, and evidence capture to use that absolute path.

---

## What’s included

### Skills (trimmed LazyCodex-for-Grok surface)

**Top-level (`skills/`):**  
`ultrawork` · `ulw-loop` · `ulw-plan` · `ulw-evidence` · `ulw-ralph-loop` · `ulw-workflow` (internal) · `ralph-loop` · `cancel-ralph` · `prometheus-plan` · `start-work-execution` · `agent-skill-gate` · `hashline-edit` · `handoff` · `init-deep` · `lsp` · `git-master` · `refactoring` · `remove-ai-slops` · `coding-agent-sessions` · `ultimate-browsing`

**Vendored OmO (`vendor/lazygrok-skills/`):**  
`programming` · `debugging` · `frontend` · `visual-qa` · `review-work` · `ultraresearch` / `ulw-research` · `ast-grep` · `comment-checker` · `rules` · `refactor` · `lsp-setup` · `teammode` · `lcx-*` · …

There is exactly one user-facing `start-work` catalog entry: `skills/start-work-execution/`. The upstream vendored copy is retained only as the non-invocable `start-work-reference` for provenance and regeneration, so Grok skill discovery cannot choose between two same-name workflows.

As of **0.4.1+**, superpowers and non-OmO filler packs are **not** registered. First-prompt skill inject uses **agent-skill-gate**.

### Agents (22)

**OmO / LazyCodex roles:** Sisyphus, Atlas, Hephaestus, Prometheus, Metis, Momus, Oracle, Librarian, Explore, Explorer  

**LazyGrok workers & gates:** `lazygrok-worker-{low,medium,high}` · `lazygrok-executor` · `lazygrok-code-reviewer` · `lazygrok-qa-executor` · `lazygrok-gate-reviewer` · `lazygrok-clone-fidelity-reviewer` · `lazygrok-plan` · `lazygrok-librarian` · `lazygrok-metis` · `lazygrok-momus`

Agent models default to **`inherit`** (no hard-coded Codex model IDs).

### Components (`vendor/lazygrok-hooks/`)

Aligned with LazyCodex 4.19.3 OmO components, Grok-patched where needed:

`ultrawork` · `ulw-loop` · `bootstrap` · `codegraph` · `comment-checker` · `lsp` · `lsp-daemon` · `lsp-tools-mcp` · `rules` · `start-work-continuation` · `lazygrok-executor-verify`

The `git-bash` and `git-bash-mcp` sources stay vendored only for upstream provenance and regeneration. They have no active hook or MCP registration because Git Bash is unsupported on Grok/Linux. LazyGrok does not ship or invoke the upstream telemetry component.

The v4.19.3 LSP source is vendored alongside its bundle. In-flight aborts propagate to the language server as JSON-RPC `$/cancelRequest`; on Linux, workspace edits are revalidated at commit time and reject symlink/path-identity changes before descriptor-anchored writes. The LSP tools and daemon have lockfile-backed, source-sensitive builds. Host-side Grok cancellation still follows Grok Build’s own cancellation token lifecycle.

Rebuild ULW dists: `scripts/rebuild-ulw-components.sh`. Runtime parity checks: `python3 scripts/test_runtime_parity.py -v`. The 4.19.3 port generator preserves the hand-adapted Grok `ulw-loop` and `start-work` workflows instead of replacing them with mechanically renamed Codex instructions, then synchronizes the complete canonical ULW tree into both runtime mirrors.

### MCP servers

| Server | Purpose |
| --- | --- |
| `hashline` | Hash-anchored read/edit |
| `lazygrok-codegraph` | Symbol/edge knowledge graph |
| `lazygrok-lsp` / `lazygrok-lsp-tools` / `lazygrok-lsp-daemon` | LSP diagnostics & navigation |

`git_bash` is not an available LazyGrok MCP server on Grok/Linux; use Grok's normal terminal/git tools.

### Hooks

**35 entries** across 14 lifecycle events (`hooks/hooks.json`), including:

- **UserPromptSubmit** — ultrawork / ulw-loop / rules  
- **Stop** — Ralph / ulw-loop resume / start-work continuation  
- **PreToolUse** — skill-gate, spawn guard, goal budget
- **PostToolUse** — LSP, comment-checker, hashline cache, rules  
- **SubagentStop** — executor-verify (includes `lazygrok-worker-*`)

Performance-critical paths use the Go binary (`bin/lazygrok-hook-*`) via `hooks/run-hook.sh`.

### Slash commands

`/ulw` · `/ultrawork` · `/ulw-loop` · `/ulw-ralph-loop` · `/ralph-loop` · `/plan` · `/start-work` · `/handoff` · `/stop-continuation` · `/resume-continuation`

(You still do not need these for basic ULW — the keyword is enough.)

### Continuation & evidence

Grok terminal subprocesses do not inherit hook-only session variables. The
prompt hook therefore records a private, prompt-free workspace-hash binding;
the ULW CLI uses it only when no explicit ID is supplied and rejects concurrent
ambiguity or a conflicting invented ID.

| Mode | Behavior |
| --- | --- |
| **Ralph** | Stop-hook work-until-done + completion promise |
| **ulw-ralph-loop** | Ralph + `<promise>VERIFIED</promise>` verifier gate |
| **ulw-loop (OmO ledger)** | `goals.json` + `ledger.jsonl` + checkpoints; LIGHT: explicit root-self-review provenance; HEAVY: independent reviewer gate |
| **start-work / boulder** | Prometheus plan execution with continuation |

New state is written under **`.lazygrok/`**. Existing **`.omo/`** boulder, start-work, ULW, and evidence state remains readable and stays on that root for mid-run continuity; new ULW plan scaffolds use `.lazygrok`, while an existing same-slug legacy plan remains on `.omo`. ULW state is keyed by the exact session ID injected by Grok's prompt hook; inherited Codex session/thread variables are stripped before vendored hook CLIs run so launching Grok from another agent cannot cross-contaminate ledgers. Native Grok `SubagentStop` receipts block LazyGrok executors/workers for three attempts unless the active run has a real, non-empty `.lazygrok/evidence/executors/<session>/<agent>/` receipt (or the same scoped legacy path for an existing `.omo` run); the fourth attempt is the documented bounded escape hatch and clears the counter, including when an unsafe hard-linked primary counter forces the guarded recovery counter. ULW spawn reservations fail closed on oversized hook input or malformed counters, and persist through a synced temporary sibling plus atomic rename so a killed writer cannot reset the fan-out budget. State roots, plans, receipts, counters, Boulder files, ledgers, direct CLI input, and session-history enrichment reject symlink and hard-link aliases and use descriptor-pinned bounded access. Generated recovery commands bind to the running package location rather than an installation hash, so plugin updates and relocated installations keep working. Plans are written through a synced temporary sibling and atomic rename. On Linux, Go workspace-state and LSP edit mutations stay bound to verified directory descriptors so concurrent parent swaps cannot redirect creation, reads, writes, renames, or deletes; executor attempt-state writes never delete through legacy paths. Sensitive state/evidence and LSP mutation operations fail closed on macOS and Windows instead of using pathname-only fallbacks. Local state directories/files are repaired to `0700`/`0600`; active hook paths retain neither diagnostic payloads nor user prompts. Grok ULW Stop re-fires remain enforced under the ledger-aware two-strike retry budget even after Grok sets `stopHookActive`. Start-work accepts plans only from the selected state root and trusts a recorded worktree only when Git proves it belongs to the current repository.

---

## Installation

```bash
grok plugin install https://github.com/ThewindMom/lazygrok --trust
# or short form if your marketplace maps it:
# grok plugin install ThewindMom/lazygrok --trust
```

`--trust` skips Grok's confirmation prompt; omit it for interactive review.
Pin a reviewed tag or full commit SHA for an immutable install. See
[docs/installation.md](docs/installation.md) for the exact forms.

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
| [docs/lazycodex-4.19.3-port-receipt.md](docs/lazycodex-4.19.3-port-receipt.md) | 4.19.3 delta port receipt |
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
