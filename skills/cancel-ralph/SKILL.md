---
name: cancel-ralph
description: >
  Cancel an active Ralph-family promise loop. Use when the user says
  /cancel-ralph or wants to stop /ralph-loop or /ulw-ralph-loop continuation.
user-invocable: true
---

# Cancel Ralph-Family Loop

Clears `.lazygrok/ralph-loop.local.md` for `/ralph-loop` or the explicit
`/ulw-ralph-loop` verifier variant and stops their Stop-hook continuations.
It does not cancel the `/ulw-loop` goal ledger.

For todo + boulder auto-continue too, use `/stop-continuation` instead.

Tell the user to run:

```text
/cancel-ralph
```

Or send that command yourself if you are canceling on their behalf.
