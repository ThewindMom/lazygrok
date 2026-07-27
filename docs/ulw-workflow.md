# ULW + Grok workflows (agent-internal)

**Users only say `ulw`.** They do not run `/workflow`, open hybrid modes, or name panels.

LazyGrok ports LazyCodex ultrawork process, then uses Grok’s native **`workflow`** tool
(something Codex does not have) to **force** discovery and HEAVY review fan-out under that
single keyword.

## UX

| User | Agent |
|------|--------|
| No `ulw` | Normal chat — no ULW panels |
| `ulw` / `ultrawork` | Full ultrawork; auto `ulw-discover` / `ulw-review` when needed |

## Ownership

| Owner | Responsibilities |
|-------|------------------|
| **Parent ULW** | Goals, notepad, RED→GREEN, SURFACE QA, workers, commits, done claim |
| **`ulw-discover`** | Parallel explore (+ librarian) → findings packet |
| **`ulw-review`** | Dimension review + adversarial verify → blockers vs notes |

## Scripts

| Name | Install path | Source |
|------|----------------|--------|
| `ulw-discover` | `~/.grok/workflows/ulw-discover.rhai` | `docs/examples/ulw-discover.rhai` |
| `ulw-review` | `~/.grok/workflows/ulw-review.rhai` | `docs/examples/ulw-review.rhai` |

Silent resolution: `name` first, then `script_path` under `GROK_PLUGIN_ROOT/docs/examples/`, then `spawn_subagent` fallback.

## Why this exists

LazyCodex has no Rhai workflow engine. Grok does. LazyGrok uses that strength so multi-file
ULW cannot skip explore, and HEAVY work gets a structured review panel — without teaching
users a second product surface.

Agent skill: `skills/ulw-workflow/SKILL.md` (`user_invocable: false`).
Binding UX: `skills/ultrawork/SKILL.md`.
