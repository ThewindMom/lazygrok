# Troubleshooting

## Hooks do not run after install

1. Confirm plugin is enabled: `grok plugin enable lazygrok`
2. **Reload** in TUI: `Ctrl+L` (opens Hooks & Plugins) → Plugins tab → `r` (reload all plugins); then Hooks tab → `l` (reload hooks). Or start a **new Grok session**.
3. Reinstall from source or GitHub (update may leave stale snapshot):
   ```bash
   grok plugin install github:mihazs/lazygrok --trust
   # or for local clone:
   grok plugin install "$(pwd)" --trust
   ```
4. Clean stale global overlays **and** stale plugin IDs in config (old "user/<hash>/name" entries left by prior installs can cause reload_plugins_impl to report 0 hooks or skip registration):
   ```bash
   bash scripts/remove-global-overlays.sh
   ```
5. Verify hooks are registered and firing:
   - `grok plugin list` and `grok plugin details lazygrok` (should list "hooks")
   - In TUI `Ctrl+L` → Hooks tab: look under **Plugin** source for lazygrok entries (SessionStart, UserPromptSubmit, PreToolUse, Stop, etc.)
   - After a prompt in a fresh workspace: recent non-"test-*" dirs appear under `ls -t ~/.grok/state/skill-gate/ | head -3` and `~/.grok/state/using-superpowers/` (SessionStart + first UserPromptSubmit create these)
   - Scrollback shows hook annotations (e.g. skill gate, ralph) only when plugins UI enabled.

Stale entries example from real config that broke hook calls until cleaned + reload:
```
enabled = [ ..., "user/2dae73a2/lazygrok", "user/f0ac7909/superpowers", ... ]
```
The remove script now prunes these automatically.

## Stale plugin copy

`grok plugin update` may not refresh a broken snapshot. Reinstall from path or GitHub:

```bash
grok plugin install /path/to/lazygrok --trust
# or
grok plugin install github:mihazs/lazygrok --trust
```

## Mutating tools blocked (skill gate)

Hooks deny `Write` / `StrReplace` / `Delete` until at least one catalog `SKILL.md` was `Read` this session.

- Run `grok inspect` and Read a skill whose description matches the task
- Or Read `agent-skill-gate` from the lazygrok plugin path in inspect

## Agent skips skills (Composer 2.5)

Grok may show `<skill_information>` in the prompt — that is **not** loaded skill content. lazygrok injects `<AGENT_SKILL_GATE_PROACTIVE>` on each turn with **Read** paths; follow those before other tools. There is no Skill tool in Grok (use Read on `SKILL.md`). Update the plugin and reload hooks (`grok plugin install` + new session).

## Ralph / ultrawork stops and asks "next phase?" instead of continuing

The Stop hook must see the workspace (stdin `workspaceRoot`/`cwd` or `GROK_WORKSPACE_ROOT`) and a routine stop reason (`EndTurn`, `completed`, etc.). If the loop never started, run `/ralph-loop` or `/ulw-loop` again after `grok plugin update lazygrok` and start a **new session** (or Hooks reload).

While a loop is active, the agent must not ask for permission between iterations — only emit `<promise>DONE</promise>` (ultrawork: then Oracle `<promise>VERIFIED</promise>`) or `/cancel-ralph`.

## Ralph / ultrawork loop will not stop

- Emit the completion promise tag required by the active loop (see `skills/ralph-loop/SKILL.md` or `skills/ulw-loop/SKILL.md`)
- Or run `/cancel-ralph`
- Or `/stop-continuation` to pause continuation (also clears loop + boulder)

## Boulder or todos out of sync

State lives under `.lazygrok/` in the **workspace**, not `~/.grok/`. Check `.lazygrok/boulder.json` and `.lazygrok/todos/<session>.json`.

## Migrated from old `.grok/` workspace folders

Earlier builds used `.grok/` under the project for boulder/ralph state. Current releases use **`.lazygrok/`**. Move any remaining files manually; do not commit `.lazygrok/` to git.

## CI vs local

GitHub Actions runs hook smoke tests only. `grok plugin validate` and `hooks/test-inline-skill-gate.sh` require the Grok CLI locally.