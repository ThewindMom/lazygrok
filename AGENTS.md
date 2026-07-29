# lazygrok — agent guide

**README.md** is for humans (install, features, links). **This file** is for coding agents editing the plugin or debugging hook behavior. Keep changes aligned with both; do not duplicate the full README here.

Inspired by [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent). Upstream handoff/Ralph/boulder behavior is ported and adapted for **Grok Composer** + `grok plugin`.

---

## What this repository is

| Is | Is not |
|----|--------|
| A **Grok plugin** (`plugin.json`, `hooks/hooks.json`, bundled skills/rules) | A standalone CLI or application users run from this repo |
| Go hook binary (`bin/lazygrok-hook-*`) + thin `hooks/run-hook.sh` | User application code |
| Install target: `grok plugin install ThewindMom/lazygrok@v0.4.4 --trust` | Undocumented global hook copies |

After install, Grok loads hooks from `GROK_PLUGIN_ROOT` (installed copy under `~/.grok/installed-plugins/lazygrok-*`, often symlinked to a local clone).

---

## Architecture (30-second map)

```
plugin.json
hooks/hooks.json          → SessionStart, UserPromptSubmit, Pre/PostToolUse, Stop, SessionEnd
hooks/run-hook.sh         → dispatches to bin/lazygrok-hook-<os>-<arch>
cmd/lazygrok-hook + internal/  → all hook logic (see docs/superpowers/plans/2026-06-02-go-hooks-migration.md)
  cmd/user_prompt.go      → single merged additionalContext (do not split into multiple JSON hooks)
  cmd/stop.go             → explicit stop → core loop/boulder → ULW/Ralph → legacy boulder/todo → LSP/plan (first block wins)
  internal/skillgate/     → catalog, PreTool gate, reminders
  internal/intentgate/    → keyword modes
  internal/prometheus/    → /plan, plan-mode PreTool guard
  internal/hashline/      → read cache, LINE#ID PreTool guard
  internal/lsp/           → diagnostics stash, post-tool + Stop
  internal/ralph/         → /ralph-loop, /cancel-ralph
  internal/boulder/       → boulder + todo continuation + todo enforcer state
skills/*/SKILL.md         → user-invocable workflows (discovered by grok inspect)
rules/*.md                → injected on every UserPromptSubmit (with workspace AGENTS.md)
```

`plugin.json` registers only `skills/`, `vendor/lazygrok-skills/`, and
`vendor/lazygrok-hooks/`. Retained upstream source outside those roots is not
an active skill surface. Do not register duplicate LazyGrok hooks globally;
use the documented first-install bridge.

---

## Two state namespaces (do not confuse)

| Location | Owner | Examples |
|----------|--------|----------|
| **`~/.grok/`** | Grok harness | `installed-plugins/`, `state/skill-gate/`, `state/hashline/`, `state/lsp-diagnostics/`, `state/todo-enforcer/`, `state/stop-continuation/`, `sessions/` |
| **`.lazygrok/`** (per workspace) | lazygrok runtime | `boulder.json`, `plans/`, `todos/`, `ralph-loop.local.md`, `handoffs/` |

Analogous to omo’s **`.omo/`** in OpenCode workspaces. Never store plugin source or session catalogs under `.lazygrok/`.

---

## Bundled skills & slash commands

| Skill | Command | Hook involvement |
|-------|---------|------------------|
| `agent-skill-gate` | (meta; Read before mutating) | `session-start`, `user-prompt`, `pre-tool-use`, `post-tool-read` |
| `ralph-loop` | `/ralph-loop "task"` | `user-prompt`, `stop` |
| `ultrawork` | `ulw`, `/ulw`, `ultrawork`, `/ultrawork` | Native skill activation + ULW goal ledger |
| `ulw-loop` | `/ulw-loop "task"` | Durable ULW goals/evidence/checkpoints; never Ralph state |
| `ulw-ralph-loop` | `/ulw-ralph-loop "task"` | Explicit Ralph-family promise + verifier loop only |
| `ulw-workflow` | (internal) | silent panels under `ulw` — user never runs `/workflow` |
| `cancel-ralph` | `/cancel-ralph` | clears an explicit Ralph-family promise loop |
| `handoff` | `/handoff` | `user-prompt` injects PHASE 0–4 instructions |
| `prometheus-plan` | `/plan`, `/prometheus` | `user-prompt` + `pre-tool-use` |
| `hashline-edit` | (workflow) | `hashline` package, `post-tool-read` |
| `ast-grep` | MCP tools | `.mcp.json` + `vendor/ast-grep-mcp` |
| `lsp` | MCP + hook stash | `post-tool-lsp`, Stop step 4 (optional `node`) |

User-facing pause/resume: `/stop-continuation`, `/resume-continuation` (see `rules/12-todo-boulder.md`).

Full event map and stop priority: **`hooks/README.md`** (read when touching Stop or UserPromptSubmit).

---

## Where to look (progressive disclosure)

| Task | Read first |
|------|------------|
| Install / publish / repo URL | `README.md`, `docs/installation.md` |
| Hook events, stop chain, `.lazygrok/` layout | `hooks/README.md` |
| Skill-gate behavior | `skills/agent-skill-gate/SKILL.md`, `rules/00-agent-skill-gate.md` |
| Ralph | `skills/ralph-loop/SKILL.md`, `rules/10-ralph-loop.md`, `internal/ralph/` |
| ULW | `skills/ultrawork/SKILL.md`, `skills/ulw-loop/SKILL.md`, `docs/ulw-workflow.md` |
| Boulder + todos | `rules/12-todo-boulder.md`, `internal/boulder/` |
| Handoff format | `skills/handoff/SKILL.md`, `rules/11-handoff.md` |
| IntentGate / Prometheus / hashline / LSP | `internal/{intentgate,prometheus,hashline,lsp}/`, `internal/cmd/`, `docs/configuration.md` |
| ast-grep MCP build | `scripts/build-mcp-runtimes.sh`, `vendor/ast-grep-mcp/` |
| Remove stale global install | `scripts/remove-global-overlays.sh` |

Do not paste entire skill bodies into this file. Load the path from `grok inspect` when implementing.

---

## Development workflow

1. Clone repo; set `export GROK_PLUGIN_ROOT="$(pwd)"` for local hook tests.
2. Edit `hooks/`, `skills/`, or `rules/` — see decision table below.
3. Run smoke tests (required before claiming done):

```bash
cd lazygrok
grok plugin validate .
export GROK_PLUGIN_ROOT="$(pwd)"
bash hooks/test-ralph-loop.sh
bash hooks/test-ulw-loop.sh
bash hooks/test-todo-boulder.sh
bash hooks/test-stop-verify.sh
bash hooks/test-using-superpowers-first-prompt.sh
bash hooks/test-handoff.sh
bash hooks/test-workspace-context.sh
bash hooks/test-intent-gate.sh
bash hooks/test-prometheus.sh
bash hooks/test-hashline.sh
bash hooks/test-lsp.sh
```

4. Refresh install: `grok plugin update lazygrok` (or `grok plugin install "$(pwd)" --trust`).
5. **New Grok session** or TUI Hooks reload (`Ctrl+L`) — hooks do not always hot-reload mid-session.

Optional E2E: `bash hooks/test-inline-skill-gate.sh` (needs `grok` CLI + trusted workspace).

---

## What to change when (decision table)

| You need to… | Edit | Avoid |
|--------------|------|--------|
| New slash command or prompt injection | `internal/cmd/user_prompt.go` plus the owning `internal/<feature>/` package | Extra `UserPromptSubmit` JSON in `hooks.json` (overwrites context) |
| New lifecycle hook event | `hooks/hooks.json` + new script under `hooks/` | Duplicate manifest under `~/.grok/hooks/` |
| Agent-facing workflow / phases | `skills/<name>/SKILL.md` | Long prose only in `rules/` without a skill |
| Always-on Composer rules | `rules/*.md` (keep short) | 30+ “don’t” lines without “do” alternatives |
| Workspace file paths (boulder, todos) | `internal/boulder/` constants + docs | Hardcoded `/home/...` paths anywhere in repo |
| Stop continuation order | `internal/cmd/stop.go` only | Second Stop hook registration |
| IntentGate keyword modes | `internal/intentgate/`, `rules/13-intent-gate.md` | Duplicate mode logic in `internal/cmd/user_prompt.go` |
| Prometheus plan mode | `internal/prometheus/`, `skills/prometheus-plan/` | Allow non-`.lazygrok` writes while plan mode active |
| Hashline LINE#ID guard | `internal/hashline/`, `internal/core/hashline/`, `internal/cmd/post_tool_read.go` | Second PreToolUse hook in `hooks.json` |
| LSP stash + Stop block | `internal/lsp/`, `internal/cmd/post_tool_lsp.go` | Inline LSP calls in `internal/cmd/stop.go` |
| ast-grep / lsp MCP dist | `scripts/build-mcp-runtimes.sh`, `vendor/*` | Commit `node_modules` (run build script) |
| Todo enforcer cooldown | `internal/boulder/todos.go`, `internal/cmd/stop.go` | Ad-hoc sleep in stop handler |
| Feature smoke test | `hooks/test-<feature>.sh` | Skipping tests when changing hook packages |

Pair every **don’t** with a **do** in rules (e.g. don’t add global `~/.grok/hooks/*.json` → do install via `grok plugin install`).

---

## How skill gate works

1. **SessionStart** (`internal/cmd/session_start.go`) — runs `grok inspect`, caches catalog at `~/.grok/state/skill-gate/<session>/all-skills.json`, injects skill list + rules path.
2. **UserPromptSubmit** (`internal/cmd/user_prompt.go`) — `build_prompt_reminder()` nudges unloaded skills each prompt.
3. **PreToolUse** (`internal/cmd/pre_tool_use.go`) — on `Write` / `StrReplace` / `EditNotebook` / `Delete`, **deny** if catalog is non-empty and no `SKILL.md` was Read this session (`skills.loaded` empty).
4. **PostToolUse** (`internal/cmd/post_tool_read.go`) — when agent Reads a catalog `SKILL.md`, append skill id to `skills.loaded`.
5. **Fail-open** — empty catalog: allow edits after Reading meta-skill `agent-skill-gate`.

Agent workflow: `grok inspect` → Read matching skills → announce `Using <name> to <purpose>` → mutating tools.

Human detail: [docs/skills.md](docs/skills.md#skill-gate-flow). Full meta-skill: `skills/agent-skill-gate/SKILL.md`.

---

## Plugin editing rules

1. **One JSON context per event** — `internal/cmd/user_prompt.go` merges all `UserPromptSubmit` parts; never add a second manifest entry for the same event.
2. **Stop order** — only change in `internal/cmd/stop.go`; update `hooks/README.md` + tests.
3. **New slash command** — add an `internal/<feature>/` collector and call it from `internal/cmd/user_prompt.go`, add `skills/<name>/SKILL.md` with `user_invocable: true`, add `hooks/test-<feature>.sh`.
4. **Workspace paths** — constants in `internal/boulder/`; never hardcode user home directories in tracked files.
5. **Docs** — human guides in `docs/` and `README.md`; this file stays hook/skill oriented.

Human docs: `docs/installation.md`, `docs/skills.md`, `docs/configuration.md`. Roadmap: `ROADMAP.md`.

### Example: add a prompt hook fragment

1. Create `internal/myfeature/` with a collector returning context text.
2. Call the collector from `internal/cmd/user_prompt.go` and merge its result into the single emitted context.
3. Add `hooks/test-my-feature.sh` with `GROK_PLUGIN_ROOT` set and stdin JSON fixture.
4. Document in `hooks/README.md` UserPromptSubmit list.

### Example: add a user-invocable skill

1. Add `skills/my-skill/SKILL.md` with frontmatter `name`, `description`, `user_invocable: true`.
2. If the skill needs prompt injection, wire a collector in `internal/cmd/user_prompt.go` (patterns: `internal/boulder`, `internal/ralph`).
3. Run `grok plugin validate .` and hook smoke tests.

---

## Conventions

- **Shell**: `bash`, `set -euo pipefail`; hook entry via `hooks/run-hook.sh`.
- **Search**: use `rg`, not `grep`, in docs and agent instructions for this repo.
- **Paths in repo**: machine-agnostic (`$(pwd)`, `lazygrok/`); author metadata in `plugin.json` / LICENSE is fine; no contributor home directories in source.
- **Hook JSON output**: one `additionalContext` per event per manifest path; `internal/cmd/user_prompt.go` merges parts.
- **Tests**: temp dirs use `.lazygrok/` subdirs; do not depend on a specific user workspace path.
- **Go** hooks (`internal/boulder/`, etc.) stay compatible with omo boulder schema where possible.

---

## Anti-patterns

- Registering the same hooks in **`~/.grok/hooks/*.json`** and the plugin (double Stop / UserPromptSubmit).
- Adding legacy `user-prompt-*.sh` hooks to `hooks.json` (merged handler exists).
- Changing stop order without updating `hooks/README.md` and tests.
- Documenting only `~/.grok/` for boulder/ralph state — user workspaces use **`.lazygrok/`**.
- Bloating this AGENTS.md past ~150 lines; link to `hooks/README.md` and skills instead.

---

## Verification checklist (before PR / push)

- [ ] CI hook smoke tests pass (same as `.github/workflows/ci.yml`; skip `test-inline-skill-gate.sh`)
- [ ] `grok plugin validate .` passes (local; Grok CLI not in CI)
- [ ] All `hooks/test-*.sh` scripts pass with `GROK_PLUGIN_ROOT` set (except inline E2E)
- [ ] Conventional commit message if the change should appear in the next release
- [ ] Do not bump `plugin.json` version — release-please handles it via Release PR
- [ ] No leaked home-directory paths in tracked files
- [ ] `hooks/hooks.json` uses `${GROK_PLUGIN_ROOT}` for commands
- [ ] New skill has frontmatter `name` + `description` triggers; `user_invocable: true` if slash command

Human install docs: **README.md**. Hook internals: **hooks/README.md**.
