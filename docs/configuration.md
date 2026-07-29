# Configuration

## Two state locations

| Path | Owner | Contents |
|------|--------|----------|
| `~/.grok/` | Grok harness | `installed-plugins/`, `state/skill-gate/`, `state/hashline/`, `state/lsp-diagnostics/`, `state/todo-enforcer/`, `state/stop-continuation/` |
| `.lazygrok/` (per workspace) | lazygrok | `boulder.json`, `plans/`, `todos/`, `ralph-loop.local.md`, `handoffs/` |

Do not store plugin source or session catalogs under `.lazygrok/`. `.lazygrok/` is gitignored in this repo.

## Workspace AGENTS.md and rules

On every user prompt, lazygrok injects:

1. Workspace root `AGENTS.md` (if present), size-capped
2. Plugin `rules/*.md` from the install directory

Keep workspace `AGENTS.md` focused on project constraints; use `docs/` in this plugin repo for human guides.

## Environment variables (hooks)

| Variable | Role |
|----------|------|
| `GROK_PLUGIN_ROOT` | Plugin install path (set by harness or local tests) |
| `GROK_HOME` | Defaults to `~/.grok` |
| `GROK_WORKSPACE_ROOT` | Active workspace for `.lazygrok/` and `AGENTS.md` |
| `GROK_SESSION_ID` | Session key for hook state |

### Feature toggles (`LAZYGROK_*`)

| Variable | Default | Role |
|----------|---------|------|
| `LAZYGROK_HASHLINE` | `prefer` | Hashline mode (`off`, `prefer`, or `strict`); after Read, cache line hashes under `~/.grok/state/hashline/<session>/` and deny stale `LINE#ID` edits according to the selected mode |
| `LAZYGROK_INTENT_GATE` | `1` | UserPromptSubmit keyword modes (search / analyze / team / hyperplan) |
| `LAZYGROK_LSP_ENFORCE` | `1` | Stop hook blocks while LSP error diagnostics remain in session stash |
| `LAZYGROK_PLAN_MODE` | (off) | Prometheus plan mode (also toggled via `/plan`) |

Local hook tests: `export GROK_PLUGIN_ROOT="$(pwd)"`.

## Registered skill roots

`plugin.json` registers `skills/`, `vendor/lazygrok-skills/`, and
`vendor/lazygrok-hooks/`. Other retained upstream source trees are provenance
or regeneration inputs only and do not appear in LazyGrok's skill catalog.
Avoid duplicate global `~/.grok/hooks/*.json`; the first-install bridge is the
single documented exception.

## Stop continuation priority

See [hooks/README.md](../hooks/README.md). First block wins:

1. Ralph loop
2. Boulder (`.lazygrok/plans/`)
3. Todo continuation (todo enforcer cooldown / abort window)
4. LSP error diagnostics stash (`LAZYGROK_LSP_ENFORCE`)
5. Root `plan.md` fallback

`/stop-continuation` pauses steps 2–5 until `/resume-continuation` or session end.
