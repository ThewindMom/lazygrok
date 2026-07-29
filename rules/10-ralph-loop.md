# Ralph Loop (Grok)

The legacy Ralph Stop loop is separate from the ULW goal-ledger contract.

## Commands

| Command | Effect |
|---------|--------|
| `/ralph-loop "task" [--max-iterations=100]` | Work-until-done; exit on `<promise>DONE</promise>` |
| `/cancel-ralph` | Clear `.lazygrok/ralph-loop.local.md` |

`/ulw`, `ultrawork`, and `/ulw-loop` activate the separate ULW skill and
goal ledger. They never create Ralph state and never use Ralph `VERIFIED`
completion.

The explicitly separate `/ulw-ralph-loop` skill retains the Ralph-family
promise plus verifier contract and may use `VERIFIED`. It is not an alias for
any ULW goal-ledger trigger. `/cancel-ralph` can clear either explicit
Ralph-family promise loop.

## While Ralph is active

- Keep working until the completion promise tag (default `<promise>DONE</promise>`).
- Do not ask the user to continue each turn — the Stop hook injects continuation.
- Do not pause with "can we start the next phase?" — proceed autonomously until done or `/cancel-ralph`.

## Hooks

- `user-prompt` — start/cancel Ralph (merged UserPromptSubmit)
- `stop` — shared priority chain; ULW/Ralph runs after core
  continuation/Boulder and before legacy Boulder/todo (see `hooks/README.md`)

Skills: `ralph-loop`, `ulw-ralph-loop`, `cancel-ralph` (lazygrok plugin; see `grok inspect`).
