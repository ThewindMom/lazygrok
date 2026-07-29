# Examples

## Ralph loop — work until done

```text
/ralph-loop "fix all failing hook tests and update hooks/README if stop order changes"
```

The hook writes `.lazygrok/ralph-loop.local.md`. If you try to stop without the completion promise, the Stop hook injects a continuation prompt (up to `max-iterations`, default 100).

Cancel: `/cancel-ralph`

## Ultrawork — goal ledger and evidence

```text
/ulw-loop "implement docs/ and README discoverability overhaul"
ultrawork add GitHub issue templates
```

Both forms activate the ULW contract: create durable goals and criteria, capture
evidence, run the tier-appropriate quality gate, and checkpoint completion.
They do not create `.lazygrok/ralph-loop.local.md` and do not use a
`<promise>VERIFIED</promise>` exit.

## ULW multi-agent panels (Grok `workflow` — agent-internal)

**Users never run these.** Typing **`ulw`** is enough; the parent auto-calls panels
when multi-file discovery or HEAVY review is required. Codex has no equivalent engine;
LazyGrok uses Grok’s `workflow` tool under the hood.

Scripts (install once for silent `name:` resolution) — **discover + review only**:

- `docs/examples/ulw-discover.rhai` → `~/.grok/workflows/ulw-discover.rhai`
- `docs/examples/ulw-review.rhai` → `~/.grok/workflows/ulw-review.rhai`

**No implement panel.** RED→GREEN stays on the parent (+ worker `spawn_subagent`).

Agent protocol: [docs/ulw-workflow.md](../ulw-workflow.md).

## Handoff — continue in a new session

```text
/handoff
```

Produces a structured HANDOFF CONTEXT block and saves a copy under `.lazygrok/handoffs/handoff-<timestamp>.md`. In the next session:

```text
Continue from handoff .lazygrok/handoffs/handoff-YYYYMMDD-HHMMSS.md
```

## Boulder + todos

When boulder state is active (`.lazygrok/boulder.json`), prompts include plan progress and Stop may block until plan/todo work advances. `TodoWrite` is mirrored to `.lazygrok/todos/<session>.json`.

Pause auto-continue without deleting workspace state: `/stop-continuation`  
Resume: `/resume-continuation`
