# Coding multi-agent (LazyCodex feel on Grok)

**Goal:** non-trivial coding should feel like LazyCodex — parallel specialists, parent orchestrates, evidence before “done.” On Grok, discovery/review fan-out also uses the native `workflow` tool **under** ultrawork so the user only says `ulw`.

## Host truth

Use **only** tools in this session’s list. Canonical names: `rules/15-grok-tools-only.md`.

Spawn: `spawn_subagent({ subagent_type, prompt, background: true })`  
Wait: `get_command_or_subagent_output` · Kill: `kill_command_or_subagent`  
Depth max **1**. Parallel one-shot children only (no durable team re-task).

## When to fan out (coding)

| Situation | Action (same parent turn) |
|-----------|---------------------------|
| Unfamiliar area / multi-module | Auto discovery: internal `workflow` **`ulw-discover`** if available; else `lazygrok:explore` |
| Needs library/docs/API outside repo | Discover with `need_external: true`, or also `lazygrok:librarian` |
| Independent implementation slices | `lazygrok:lazygrok-worker-*` or `hephaestus` per slice (`spawn_subagent`) |
| HEAVY / user asked rigorous review | Auto review after green evidence: internal **`ulw-review`**; else `lazygrok:lazygrok-code-reviewer` |
| One known file, typo, obvious one-liner | **no** fan-out — parent only |

## Grok `workflow` panels (internal — not a user command)

Parent owns goals, RED→GREEN, SURFACE QA, commits, done claim. Panels never ship product work.
**Never** ask the user to run `/workflow` or name panels. User switch is only `ulw` / `ultrawork`.

- Scripts: `~/.grok/workflows/ulw-*.rhai` or plugin `docs/examples/ulw-*.rhai`
- Agent reference: skill `ulw-workflow` (`user_invocable: false`)
- Fallback when `workflow` tool is missing: classic `spawn_subagent` waves

## Prompt contract (every child)

```
TASK: <imperative>
DELIVERABLE: <artifact or findings shape>
SCOPE: <paths / limits>
VERIFY: <how parent will check>
STOP WHEN: <terminal condition>
```

## Barrier

Launch the whole independent wave (internal panels and/or subagents) → keep doing non-dependent root work → wait until each is terminal (or mark inconclusive) → **then** implement or mark todos complete.

Skipping the discovery wave on multi-file or unfamiliar coding is a defect (same class as LazyCodex skipping explore).

## Ultrawork

If the prompt has `ulw` / `ultrawork`, obey the full ultrawork skill (authoritative multi-agent block for that run). Fan-out is automatic under ULW.
