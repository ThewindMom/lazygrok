# Todo + Boulder tracking (Grok / omo)

## Todo continuation

Stop hook blocks with omo-style `[TODO CONTINUATION]` when `todo_write` todos are pending/in_progress.

- Mirror: `.lazygrok/todos/<sessionId>.json` (updated on each `todo_write`)
- Pause: `/stop-continuation`
- Resume: `/resume-continuation`

## Boulder (`boulder.json`)

Active work tracked at `.lazygrok/boulder.json` (schema v2, omo-compatible fields).

- Plans: `.lazygrok/plans/*.md` (structured `## TODOs` / `## Final Verification Wave` checkboxes)
- Stop hook: `[BOULDER CONTINUATION]` while plan incomplete; `BOULDER COMPLETE` nudge when all checked
- Context injected each prompt when a session is registered in boulder state
- `/stop-continuation` clears the session's Ralph loop, pauses its core
  continuation, and suppresses Boulder without deleting shared Boulder state

## Stop hook order

See LazyGrok `hooks/README.md`. The single chain in `internal/cmd/stop.go`
allows an explicitly stopped session first, then evaluates core continuation,
core Boulder, ULW/Ralph, legacy Boulder, todos, LSP diagnostics, and pending
plan checkboxes. First block wins.
