---
name: ulw-ralph-loop
description: >
  Ralph-style ultrawork Stop continuation with mandatory verifier
  <promise>VERIFIED</promise> before exit. Use for /ulw-ralph-loop or when you
  want promise+verifier continuation without the full OmO goal ledger.
  For goal-ledger ultrawork prefer the `ulw-loop` skill (OmO create-goals / evidence).
user-invocable: true
---

# ULW Ralph Loop (promise + verifier)

This is the **Ralph continuation** variant of ultrawork — not the OmO goal-ledger
conductor. For durable multi-goal evidence loops, use skill **`ulw-loop`** +
**`ulw-evidence`**.

## Start

```text
/ulw-ralph-loop "task description" [--completion-promise=DONE] [--max-iterations=500]
```

Or use `/ralph-loop` for the non-ultrawork Ralph defaults (lower max iterations).

## Flow

1. Work until fully done → output `<promise>DONE</promise>` (not final).
2. Stop hook enters **verification** — spawn `lazygrok:lazygrok-code-reviewer` (or oracle).
   Parent (or the continuing turn) must pass a **full diff path**, evidence
   paths, and absolute skill paths under `GROK_PLUGIN_ROOT` (never workspace
   `skills/…`). Reviewer has `run_terminal_command` for read-only git fallback.
3. Verifier must end with:
   ```text
   Agent: oracle
   <promise>VERIFIED</promise>
   ```
4. Only then does the loop clear.

## Cancel

`/cancel-ralph`

## State

`.lazygrok/ralph-loop.local.md` with `ultrawork: true` when started via ultrawork-style entry.

## Pair with ultrawork

Ultrawork mode (`ulw` keyword / skill `ultrawork`) still applies. Prefer binding
goals via `# Goal` + `ulw-evidence` even in Ralph mode so evidence survives compaction.
