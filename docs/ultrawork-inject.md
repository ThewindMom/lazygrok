# Ultrawork inject: hard path vs soft path

LazyGrok ports LazyCodex OmO **ultrawork**. There are two different activation systems. Do not confuse them.

## Soft path (skill-driven)

- User types `ulw` / `ultrawork` in the prompt.
- The model sees the keyword + the **ultrawork** skill in the available-skills list.
- Model may declare `ULTRAWORK MODE ENABLED!`, read `skills/ultrawork/SKILL.md`, and create a ulw-loop ledger.
- **Works without any hook inject.** Session `019fa318` proved this: task + ledger complete, no proven hook bootstrap.

Soft path is useful UX. It is **not** LazyCodex-faithful hard mode.

## Hard path (UPS inject)

Control plane:

1. Host fires `UserPromptSubmit` hooks.
2. Plugin ultrawork hook receives stdin envelope (ideally full `HookEventEnvelope` with `prompt`).
3. Hook matches `ulw` / `ultrawork` and prints JSON with `hookSpecificOutput.additionalContext` (skill pointer / directive).
4. Host merges that context into the model turn **before** reasoning.

Official Grok Build (`xai-org/grok-build`) constructs:

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

## Measurement (authoritative)

**Do not use** `~/.grok/logs/hooks.log` — it can be stale for weeks and is not a live inject oracle.

After any live `ulw` turn, check:

| File | Meaning |
|------|---------|
| `~/.grok/state/lazygrok/ups-probe-latest.json` | Live stdin shape, env, stdout bytes, `injectOk` (proves hook **ran**) |
| `~/.grok/state/lazygrok/last-ups-result.json` | Shim result: `inject_ok` / `empty_ultrawork_stdout`, `promptSource`, recovery attempts |
| Session `chat_history.jsonl` | Whether inject text appears as context (host merge) |

Green hard inject:

1. `ups-probe-latest.json` `at` is seconds old for the session you just ran.
2. `injectOk: true` and `stdoutBytes` ≳ 500.
3. Prefer `classification.shape: "full_envelope"` with `hasPrompt: true`. Event-only + recovery also counts if `injectOk`.

## Offline proof

```bash
node "${GROK_PLUGIN_ROOT}/scripts/verify-ups-inject.mjs"
```

Cases: full envelope, event-only + history, race delayed history, non-ulw empty, probe artifact write.

## Registration

UPS chain in `hooks/hooks.json`:

0. `run-hook.sh user-prompt` (Go ralph / slash helpers)
1. **`lazygrok-ups-probe.mjs ultrawork user-prompt-submit`** (probe + inject)
2. `lazygrok-shim.mjs ulw-loop user-prompt-submit`
3. `lazygrok-shim.mjs rules user-prompt-submit`

If `ups-probe-latest.json` does not refresh after a new `ulw` session, the host is not running plugin UPS hooks for that turn (registration / trust / load order) — soft path may still work.
