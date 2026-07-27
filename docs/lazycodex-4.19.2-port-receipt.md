# LazyCodex 4.19.2 → LazyGrok port receipt

**Date:** 2026-07-27  
**Plugin version:** 0.4.0  
**Source:** `lazycodex-ai@4.19.2` (`packages/omo-codex/plugin`)  
**Target:** installed LazyGrok plugin (`ThewindMom/lazygrok` @ `db797e1` + port)  
**Tool:** `scripts/port-lazycodex-to-grok.py` + manual Grok scrub/merge

## Goal (what this achieves)

LazyGrok is the Grok-native full port of LazyCodex/OmO: same skills, hooks,
agents, and ULW workflows — adapted to Grok tool surfaces and goal model.

## Structural changes

| Area | Change |
|------|--------|
| **ulw-loop skill** | Replaced Ralph-stub with **OmO goal-ledger** skill + full-workflow (~33KB) from 4.19.2 |
| **ulw-ralph-loop** | New skill + command for previous Ralph VERIFIED promise loop |
| **commands/ulw-loop** | Now loads OmO goal-ledger skill (not Ralph-only) |
| **Workers** | `agents/lazygrok-worker-{low,medium,high}.md` + vendor tomls |
| **hooks.json** | SubagentStop executor-verify also matches `lazygrok-worker-*` / `lazycodex-worker-*` |
| **Skills re-sync** | 25 OmO skills from 4.19.2 under `vendor/lazygrok-skills/` with Grok transforms |
| **Top-level mirrors** | `ulw-loop`, `ulw-plan`, `ultrawork`, `ultimate-browsing`, `coding-agent-sessions`, `start-work-execution` |
| **ulw-research** | Ported; `ultraresearch` kept as alias |
| **teammode** | Content synced + **n/a on Grok** banner |
| **origin/main** | Fast-forwarded 3 commits (boulder compatibility + tests) |

## Grok tool / goal map (enforced in skills)

| Codex / OmO | Grok |
|-------------|------|
| `create_goal` / `get_goal` / `update_goal` | Optional host tools; default **`# Goal`** + **ulw-loop CLI** (`ulw-evidence`) |
| `update_plan` | `todo_write` |
| `spawn_agent` / multi_agent_v* | `spawn_subagent` + `subagent_type` |
| `wait_agent` | `get_command_or_subagent_output` |
| `.omo/` | `.lazygrok/` (accept mid-run `.omo/`) |
| `lazycodex-*` agents | `lazygrok:*` / `lazygrok-*.md` |
| `apply_patch` | `search_replace` / `write` |
| npm auto-update | **not ported** (`grok plugin update`) |

## Not byte-synced (intentional)

- `vendor/lazygrok-hooks/*/dist/cli.js` for ultrawork/ulw-loop/bootstrap/codegraph stay Grok-patched (skill-pointer goal fallback)
- Ralph / skill-gate / hashline / Prometheus / Go Stop chain (Grok-only)
- `coding-agent-sessions` **grok** scanner preserved after LCX merge

## Tests run

| Test | Result |
|------|--------|
| `hooks/test-ulw-loop.sh` | OK |
| `hooks/test-ralph-loop.sh` | OK |
| `hooks/test-bundled-superpowers.sh` | OK (plugin 0.4.0) |
| `hooks/test-prometheus.sh` | OK |
| `hooks/test-todo-boulder.sh` | OK |
| `hooks/test-skill-proactive.sh` | OK |
| structural skill checks | ALL_OK |
| coding-agent-sessions platforms includes `grok` | OK |

## Reload

After install, reload plugins in Grok TUI (Plugins `r` / restart session) so
new skills, agents, and hooks.json matchers are picked up.

## Follow-ups (optional)

1. Re-build ultrawork/ulw-loop component dists from TS source with Grok patches (cleaner than text-port only).
2. Map worker/reviewer TOML models to Grok/OpenAI catalog entries used in this install.
3. Commit + push this port to `ThewindMom/lazygrok` when ready.
4. `ultimate-browsing` engine may still mention Codex paths in deep refs — scrub on demand.


## Component rebuild (2026-07-27)

- Vendored TypeScript sources under `vendor/lazygrok-hooks/{ultrawork,ulw-loop}/src/`
- Permanent Grok skill-pointer (goal fallback + multi-path `SKILL.md` resolve + `GROK_PLUGIN_ROOT`)
- Dists rebuilt with `bun build` via `scripts/rebuild-ulw-components.sh`
- Smoke: ultrawork UserPromptSubmit injects Grok path and resolves
  `vendor/lazygrok-hooks/ultrawork/skills/ultrawork/SKILL.md`
- Component package versions: **4.19.2**
