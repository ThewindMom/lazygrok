---
description: >
  Activate OmO-style ULW goal-ledger loop on Grok: create-goals, evidence
  criteria, Manual-QA channels, worker delegation via spawn_subagent, Stop
  resume. Prefer skill ulw-loop + ulw-evidence. For Ralph promise+verifier
  only, use /ulw-ralph-loop or skill ulw-ralph-loop.
---

You are now in **ulw-loop** (OmO goal-ledger ultrawork on Grok).

## Mandatory skill load

1. Read skill `ulw-loop` (`SKILL.md` + `references/full-workflow.md` as needed).
2. Read skill `ulw-evidence` for CLI create-goals / record-evidence / checkpoint.
3. If the prompt also contains `ultrawork`/`ulw`, follow skill `ultrawork` directive.

## Goal binding on Grok

Host `create_goal` / `update_goal` may be absent — that is normal.
- Open with a binding `# Goal` block.
- Create durable goals via the ulw-loop CLI (see `ulw-evidence`).
- Track live steps with `todo_write`.

## Workers

Delegate implementation/QA with `spawn_subagent` and:
- `lazygrok:lazygrok-worker-low|medium|high`
- `lazygrok:lazygrok-executor`
- reviewers: `lazygrok-code-reviewer`, `lazygrok-qa-executor`, `lazygrok-gate-reviewer`

## Cancel / related

- `/cancel-ralph` stops Ralph-family promise loops, including the explicit `/ulw-ralph-loop` variant; it does not cancel this ULW goal ledger.
- `/stop-continuation` stops broader continuations.
- Ralph-only verifier loop: skill `ulw-ralph-loop`.
