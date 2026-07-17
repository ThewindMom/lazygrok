# Ralph + Ultrawork Loops (Grok)

Modeled on [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) `ralph-loop` and `ulw-loop`.

## Commands

| Command | Effect |
|---------|--------|
| `/ralph-loop "task" [--max-iterations=100]` | Work-until-done; exit on `<promise>DONE</promise>` |
| `/ulw-loop` / `/ultrawork` / `ultrawork <task>` | Same + mandatory verifier; exit on `<promise>VERIFIED</promise>` |
| `/cancel-ralph` | Clear `.lazygrok/ralph-loop.local.md` |

## Ultrawork verification

After `<promise>DONE</promise>`, run `task(subagent_type="code-reviewer", ...)` (override via `RALPH_ORACLE_SUBAGENT`). Verifier output must include `Agent: oracle` and `<promise>VERIFIED</promise>`.

## While active

- Keep working until the completion promise tag (default `<promise>DONE</promise>`; ultrawork adds Oracle `<promise>VERIFIED</promise>`).
- Do not ask the user to continue each turn — the Stop hook injects continuation.
- Do not pause with "can we start the next phase?" — proceed autonomously until done or `/cancel-ralph`.

## Hooks

- `user-prompt` — start/cancel (merged UserPromptSubmit)
- `stop` — continuation chain (Ralph first; see `hooks/README.md`)

Skills: `ralph-loop`, `ulw-loop`, `cancel-ralph` (lazygrok plugin; see `grok inspect`).