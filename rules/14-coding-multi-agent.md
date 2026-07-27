# Coding multi-agent (LazyCodex feel on Grok)

**Goal:** non-trivial coding should feel like LazyCodex — parallel specialists, parent orchestrates, evidence before “done.”

## Host truth

Use **only** tools in this session’s list. Canonical names: `rules/15-grok-tools-only.md`.

Spawn: `spawn_subagent({ subagent_type, prompt, background: true })`  
Wait: `get_command_or_subagent_output` · Kill: `kill_command_or_subagent`  
Depth max **1**. Parallel one-shot children only (no durable team re-task).

## When to fan out (coding)

| Situation | Action (same parent turn) |
|-----------|---------------------------|
| Unfamiliar area / multi-module | `lazygrok:explore` (required) |
| Needs library/docs/API outside repo | also `lazygrok:librarian` |
| Independent implementation slices | `lazygrok:lazygrok-worker-*` or `hephaestus` per slice |
| HEAVY / user asked rigorous review | `lazygrok:lazygrok-code-reviewer` after green evidence |
| One known file, typo, obvious one-liner | **no** fan-out — parent only |

## Prompt contract (every child)

```
TASK: <imperative>
DELIVERABLE: <artifact or findings shape>
SCOPE: <paths / limits>
VERIFY: <how parent will check>
STOP WHEN: <terminal condition>
```

## Barrier

Spawn the whole independent wave → keep doing non-dependent root work → `get_command_or_subagent_output` until each child is terminal (or mark inconclusive) → **then** implement or mark todos complete.

Skipping the discovery wave on multi-file or unfamiliar coding is a defect (same class as LazyCodex skipping explore).

## Ultrawork

If the prompt has `ulw` / `ultrawork`, also obey the full ultrawork skill (hard multi-agent block there is authoritative for that run).
