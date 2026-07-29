# Ultrawork activation: native skill path and hook compatibility

LazyGrok ports LazyCodex OmO **ultrawork**. On Grok, the authoritative activation path is native skill matching and a full skill read.

## Native path (authoritative)

- User types `ulw` / `ultrawork` in the prompt.
- Grok matches the **ultrawork** skill from the available-skills catalog.
- The model declares `ULTRAWORK MODE ENABLED!`, reads the complete `skills/ultrawork/SKILL.md`, and follows it for the turn.
- `/ulw` and `/ultrawork` provide deterministic command entry points to the same behavior.
- A control prompt without `ulw` does not select the skill.

This path works without hook-provided context and is the behavior to test in a real Grok session.

## UserPromptSubmit hook (compatibility and diagnostics)

The vendored UPS hook still mirrors the LazyCodex control plane:

1. Host fires `UserPromptSubmit` hooks.
2. Plugin ultrawork hook receives stdin envelope (ideally full `HookEventEnvelope` with `prompt`).
3. Hook matches `ulw` / `ultrawork` and prints JSON with `hookSpecificOutput.additionalContext` (skill pointer / directive).

On current Grok/Linux, passive UserPromptSubmit stdout is not the model's activation context. A successful hook probe proves the hook ran and produced its compatibility payload; it does not replace native skill-selection evidence.

Grok Build constructs:

```json
{
  "hookEventName": "user_prompt_submit",
  "sessionId": "...",
  "cwd": "...",
  "workspaceRoot": "...",
  "timestamp": "...",
  "prompt": "ulw …"
}
```

If the live host ever delivers empty/minimal stdin, LazyGrok recovers the prompt from:

`~/.grok/sessions/<url-encoded-cwd>/prompt_history.jsonl`

using `GROK_SESSION_ID` / `GROK_WORKSPACE_ROOT`, with short retries for history-flush races.

## Hook diagnostics

The active prompt path does not persist prompt envelopes, previews, or diagnostic
artifacts. It stores only a sanitized, short-lived workspace/session binding
through the Go state writer. Validate forwarding with the offline proof below.
Validate activation with a real Grok turn whose first visible line is exactly
`ULTRAWORK MODE ENABLED!` and whose tool history shows the complete Ultrawork
skill was read.

## Offline proof

```bash
node "${GROK_PLUGIN_ROOT}/scripts/verify-ups-inject.mjs"
```

Cases: full envelope, event-only + history, race-delayed history, non-ulw empty,
and probe forwarding. These verify hook behavior, not model activation.

## Registration (critical on Grok 0.2.x)

### Host load-order bug (verified live)

On Grok **0.2.112**, session spawn loads **settings / `~/.grok/hooks/` file hooks only**. Plugin `hooks/hooks.json` is discovered (`has_hooks=true`) but often **not merged into the registry before the first prompt** (especially `grok -p` / headless). Debug signature:

```text
loaded hooks hook_count=3   # settings only — zero LazyGrok UPS
# after user-hooks bridge:
loaded hooks hook_count=9   # includes global/lazygrok:user_prompt_submit[0..3]
```

Live probe after bridge install showed a **full envelope** (not event-only):

```json
{
  "hookEventName": "user_prompt_submit",
  "sessionId": "...",
  "prompt": "ulw say only ZAP2",
  "injectOk": true,
  "stdoutBytes": 1987
}
```

Earlier “event-only stdin” dumps were mostly **synthetic self-tests**, not live host behavior. Neither result changes the native activation contract.

### Install once (not after every update)

```bash
node "${GROK_PLUGIN_ROOT}/scripts/install-user-hooks.mjs"
# writes ~/.grok/hooks/lazygrok.json
```

v4 bridge is a **full mirror** of plugin `hooks/hooks.json` (all events), via
`lazygrok-run.sh` resolving `installed-plugins/lazygrok-*` at runtime. After
`grok plugin update`, no re-install. Bridge installation is explicit rather than
an automatic prompt-time mutation. Audit: `python3 scripts/audit-hooks.py full`.

### Plugin UPS chain (`hooks/hooks.json` + user bridge)

0. `run-hook.sh user-prompt` (Go ralph / slash helpers)
1. **`lazygrok-ups-probe.mjs ultrawork user-prompt-submit`** (probe + inject)
2. `lazygrok-shim.mjs ulw-loop user-prompt-submit`
3. `lazygrok-shim.mjs rules user-prompt-submit`

Offline hook proof: `node scripts/verify-ups-inject.mjs` (full envelope,
event-only+history, race retry, non-ulw empty, probe forwarding). Real activation
proof still comes from Grok selecting and reading the Ultrawork skill.
