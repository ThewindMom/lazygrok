# Troubleshooting

## Hooks do not run after install

1. Confirm plugin is enabled: `grok plugin enable lazygrok`
2. **Reload** in TUI: `Ctrl+L` (opens Hooks & Plugins) → Plugins tab → `r` (reload all plugins); then Hooks tab → `l` (reload hooks). Or start a **new Grok session**.
3. Reinstall from source or GitHub (update may leave stale snapshot):
   ```bash
   grok plugin install ThewindMom/lazygrok@v0.4.4 --trust
   # or for local clone:
   grok plugin install "$(pwd)" --trust
   ```
4. Archive and regenerate the LazyGrok user-hook bridge:
   ```bash
   bash scripts/remove-global-overlays.sh
   ```
   If `config.toml` still contains an old `user/<hash>/lazygrok` entry, remove
   that exact stale entry before reinstalling; the cleanup script does not edit
   Grok configuration.
5. Verify hooks are registered and firing:
   - `grok plugin list` and `grok plugin details lazygrok` (should list "hooks")
   - In TUI `Ctrl+L` → Hooks tab: look under **Plugin** source for lazygrok entries (SessionStart, UserPromptSubmit, PreToolUse, Stop, etc.)
   - After a prompt in a fresh workspace: recent non-"test-*" dirs appear under `ls -t ~/.grok/state/skill-gate/ | head -3`
   - Scrollback shows hook annotations (e.g. skill gate, ralph) only when plugins UI enabled.

Stale entries example from real config that broke hook calls until cleaned + reload:
```
enabled = [ ..., "user/2dae73a2/lazygrok", ... ]
```
## Stale plugin copy

`grok plugin update` may not refresh a broken snapshot. Reinstall from path or GitHub:

```bash
grok plugin install /path/to/lazygrok --trust
# or
grok plugin install ThewindMom/lazygrok@v0.4.4 --trust
```

## Mutating tools blocked (skill gate)

Hooks deny `Write` / `StrReplace` / `Delete` until at least one catalog `SKILL.md` was `Read` this session.

- Run `grok inspect` and Read a skill whose description matches the task
- Or Read `agent-skill-gate` from the lazygrok plugin path in inspect

## Agent skips skills (Composer 2.5)

Grok may show `<skill_information>` in the prompt — that is **not** loaded skill content. lazygrok injects `<AGENT_SKILL_GATE_PROACTIVE>` on each turn with **Read** paths; follow those before other tools. There is no Skill tool in Grok (use `read_file` on the **absolute** `SKILL.md` path from the catalog / `GROK_PLUGIN_ROOT`). Never open workspace-relative `skills/<name>/SKILL.md` for LazyGrok plugin skills — they live under `~/.grok/installed-plugins/lazygrok-*/skills/` (and `vendor/lazygrok-skills/`). A UI chip `Skill <name>` without a successful absolute read is not activation. Reviewer subagents need parent-prepared `git diff` paths plus `run_terminal_command`; do not invent MCP `bash`/`Shell`. Update the plugin and reload hooks (`grok plugin install` + new session).

## Ultrawork says "No update_goal tool available"

Expected on Grok when background workflows are on: the host often does **not**
inject model-facing `update_goal` / `create_goal`. Ultrawork should open with a
binding `# Goal` block and optionally use the ulw-loop CLI (`ulw-evidence`
skill) for durable criteria/evidence. Do not disable workflows solely to force
the legacy tool unless you need that host path.

## Ralph stops and asks "next phase?" instead of continuing

The Stop hook must see the workspace (stdin `workspaceRoot`/`cwd` or
`GROK_WORKSPACE_ROOT`) and a routine stop reason (`EndTurn`, `completed`, etc.).
If the loop never started, run `/ralph-loop` again after
`grok plugin update lazygrok` and start a **new session** (or Hooks reload).

While Ralph is active, the agent must not ask for permission between iterations:
finish and emit `<promise>DONE</promise>`, or use `/cancel-ralph`.

## Ralph loop will not stop

- Emit the completion promise tag required by `skills/ralph-loop/SKILL.md`
- Or run `/cancel-ralph`
- Or `/stop-continuation` to pause continuation (also clears loop + boulder)

## ULW activation or completion is missing

`ulw`, `/ulw`, `ultrawork`, `/ultrawork`, and `/ulw-loop` use the ULW skill
and goal ledger, not Ralph state. Confirm that Grok selected and read
`skills/ultrawork/SKILL.md`, then inspect `.lazygrok/ulw-loop/` goals and
evidence. ULW completes through its quality gate and checkpoint; neither
`/cancel-ralph` nor a `VERIFIED` promise controls it.

## Boulder or todos out of sync

State lives under `.lazygrok/` in the **workspace**, not `~/.grok/`. Check `.lazygrok/boulder.json` and `.lazygrok/todos/<session>.json`.

## Migrated from old `.grok/` workspace folders

Earlier builds used `.grok/` under the project for boulder/ralph state. Current releases use **`.lazygrok/`**. Move any remaining files manually; do not commit `.lazygrok/` to git.

## CI vs local

GitHub Actions runs hook smoke tests only. `grok plugin validate` and `hooks/test-inline-skill-gate.sh` require the Grok CLI locally.
