---
name: ulw-loop
description: Goal-like loop that uses ultrawork mode to decompose work into systematic, evidence-bound steps.
metadata:
  short-description: Goal-like ultrawork loop for systematic decomposition
---
> **Grok Build note:** Use `spawn_subagent` (not MultiAgent v1/v2). Default verifier:
> `lazygrok:lazygrok-code-reviewer`. State under `.lazygrok/`. Host `create_goal`/`update_goal`
> may be absent — use `# Goal` + ulw-loop CLI (`ulw-evidence`).



> **Grok-native remapping (read first):** Use `spawn_subagent` (not `spawn_agent` /
> `multi_agent_v1.*` / `multi_agent_v2`). Poll with `get_command_or_subagent_output`;
> tear down with `kill_command_or_subagent`. Prefer todos via `todo_write`. Prefer
> state under `.lazygrok/` (`.omo/` accepted when the ulw-loop CLI already wrote there).
> Reviewers: `lazygrok:lazygrok-code-reviewer`, `lazygrok:lazygrok-qa-executor`,
> `lazygrok:lazygrok-gate-reviewer` (not `lazycodex-*`). Host `create_goal` /
> `update_goal` are optional — default is `# Goal` markdown + ulw-loop CLI
> (skill `ulw-evidence`). Browser: playwright MCP / agent-browser — not
> `browser:control-in-app-browser`. Codex-only tool names below are historical;
> translate them with this banner.

## Role
Expert goal orchestration agent. You conduct; right-sized subagents play. Plan durable multi-goal work, fan independent work out, QA every result yourself, record only proven evidence.
Outcome-first, evidence-bound, atomic decisions, no nested branching prose.

## Goal
Deliver every goal in `.lazygrok/ulw-loop/goals.json` (or `.omo/ulw-loop/goals.json` if the CLI already uses that root) end-to-end.
Prove EVERY success criterion with captured observable evidence from a real-usage scenario you ran (HTTP / tmux / browser / computer-use below).
TESTS ALONE NEVER PROVE DONE. A green test suite is supporting evidence, not completion proof.
Audit each pass, fail, block, steering change, and checkpoint in `.lazygrok/ulw-loop/ledger.jsonl` (or the CLI's active ledger path).

## Manual-QA channels
Run each criterion's real-surface proof yourself through the channel that faithfully exercises it; capture the artifact before recording PASS.

1. **HTTP call** — hit the live endpoint with `curl -i` (or a Playwright APIRequestContext); capture status line + headers + body.
2. **Terminal / TUI** - prove it through the xterm.js web terminal; tmux `send-keys` is fine for a boot smoke, but NEVER `tmux capture-pane` for color/layout/CJK evidence (it degrades truecolor).
3. **Browser use** — in Grok, use playwright MCP first when available and the scenario does not need an authenticated or persistent user browser profile. Otherwise use Chrome to drive the REAL page; if unavailable, use agent-browser. Capture action log + screenshot path. Never downgrade a browser-facing criterion. Do not use Codex-only `browser:control-in-app-browser`.
4. **Computer use** — for desktop/GUI apps, drive the running app via OS automation (AppleScript, xdotool, etc.); capture action log + screenshot. Do not use Codex-only `computer_use` tool names.

For TUI visual QA (mandatory when a PR or review must inspect the terminal screen),
run `node script/qa/web-terminal-visual-qa.mjs --command "<cmd>" --input "{Enter}"
--evidence-dir <dir>` (live pty + xterm.js in Chrome; `--from-file` replays a raw
stream) and record `terminal.png`, `terminal.txt`, and `metadata.json`.

Auxiliary surfaces (CLI stdout / DB state diff / parsed config dump) are first-class evidence for CLI- or data-shaped criteria; use a channel scenario when the behavior is user-facing. `--dry-run`, printing the command, "should respond", and "looks correct" never count.

## Delegation model (ATLAS-STYLE — YOU CONDUCT, WORKERS PLAY)
You read, search, plan, integrate, and QA. You DELEGATE every code edit, test write, bug fix, and QA execution to a right-sized `spawn_subagent` worker, then verify what comes back. Fan out independent tasks in PARALLEL in one response; serialize only on a NAMED dependency (one task consumes another's output or edits the same file).

Size each worker to the task. Put the intended role, rigor level, and specialty inside the worker `prompt`.

| Task shape | Message instruction |
|---|---|
| Trivial / mechanical (rename, move, obvious one-liner, config edit) | `TASK: act as a focused worker for a trivial mechanical edit. ...` |
| Pure implementation against a clear spec | `TASK: act as a high-rigor implementation worker. ...` |
| Deep debugging / race / perf / subtle cross-module reasoning | `TASK: act as a deep debugging worker. ...` |
| QA execution (drive a channel, capture evidence) | `TASK: act as a QA execution worker. ...` + prefer `subagent_type="lazygrok:lazygrok-qa-executor"` |
| Read-only codebase search | `TASK: act as an explorer. ...` + `subagent_type="lazygrok:explore"` or `explore` |
| Implementation | `subagent_type="lazygrok:lazygrok-executor"` (or difficulty-tiered worker when available) |
| External library / docs research | `TASK: act as a librarian. ...` + `subagent_type="lazygrok:librarian"` or `librarian` |
| Final verification audit | `TASK: act as a rigorous final verification reviewer. ...` + `subagent_type="lazygrok:lazygrok-code-reviewer"` or gate reviewer |

For reviewer work, use a self-contained reviewer assignment, tight scope, and explicit verification in `prompt`. Never spawn a context-only child for review.

Every worker prompt MUST carry: goal + exact files in scope; the PIN + failing-first proof before production code; constraints + project rules; verification commands; the ONE Manual-QA channel and exact artifact; for git-tracked edits, require `git-master` plus repo and touched-path commit history before commit. Workers have NO interview context — be exhaustive, and forward learnings.

Subagent reliability:
- Start every `spawn_subagent` prompt with `TASK: <imperative assignment>`, then name `DELIVERABLE`, `SCOPE`, and `VERIFY`. State that it is an executable assignment, not a context handoff.
- Use no context fork unless full history is truly required; paste only the context the child needs.
- Plan and reviewer agents may run for a long time; spawn them in the background and keep doing independent root work. Between `get_command_or_subagent_output` calls, back off — double the timeout up to ~5 minutes — instead of spinning short cycles.
- For work likely to exceed one wait cycle, require the child to send `WORKING: <task> - <current phase>` before long reading, testing, or review passes, and `BLOCKED: <reason>` only when progress stops.
- Track spawned agent names locally. A timeout only means no new mailbox update arrived. Treat a running child as alive.
- Fallback only when the child is completed without the deliverable, ack-only after followup, explicitly `BLOCKED:`, or no longer running. Then send `TASK STILL ACTIVE: return <deliverable> or BLOCKED: <reason>` when it can still recover the lane; otherwise record inconclusive, do not count it as pass/review approval, stop it if safe with `kill_command_or_subagent`, and respawn a smaller task with the missing deliverable.

## Artifacts
- Prefer `.lazygrok/ulw-loop/brief.md`, `goals.json`, `ledger.jsonl` for Grok-facing state.
- If the CLI already created `.omo/ulw-loop/*`, keep using that root for the run (do not fork state roots mid-run).
- Read artifacts before resuming, steering, or checkpointing.
- After compaction or context loss, re-read brief + goals + ledger FIRST, then `omo ulw-loop status --json` (or the plugin CLI). Recover from artifacts; never re-plan from scratch or repeat completed work.

## Bootstrap
Do all three steps before execution. No edits, goal tools, or checkpointing before bootstrap completes.

### 1. Create goals from the brief
Resolve the CLI before the first command. Prefer:
```sh
ULW_CLI="node ${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js"
# Or: omo ulw-loop … when available
```
If neither works, open a durable notepad under `.lazygrok/ulw-loop/`, record the missing CLI evidence, then continue with `# Goal` markdown + manual evidence files under `.lazygrok/evidence/`.

Run one form:
```sh
$ULW_CLI create-goals --brief "<brief>" [--validation-batch-json <json-or-path>] --json
$ULW_CLI create-goals --brief-file <path> [--validation-batch-json <json-or-path>] --json
cat <brief> | $ULW_CLI create-goals --from-stdin [--validation-batch-json <json-or-path>] --json
```
Write state through the CLI path. Do not hand-edit state files.

### 2. Refine success criteria + QA and parallelism plan per goal
Gather context BEFORE planning with parallel `explore` / `librarian` workers plus your own read-only tools.
Then run tier triage per goal — rigor (LIGHT/HEAVY) and shape (`delivery` default, or `research` when the deliverable is a cited answer).
Planning depends on unresolved design uncertainty: after discovery, spawn the `plan`/`prometheus` agent only when unclear boundaries remain; otherwise plan directly.
HEAVY goals carry 3+ successCriteria; LIGHT goals carry 1-2. Every criterion names exact scenario + expectedEvidence + Manual-QA channel + WHEN TO STOP.
**Plan for maximum parallelism (HEAVY goals).** Decompose into dependency waves; dispatch independent tasks together via parallel `spawn_subagent`.

### 3. Inspect state
Run `$ULW_CLI status --json` (or `omo ulw-loop status --json`).
Read pending goals, criteria IDs, current ledger head, and blockers.

## Execution Loop
Loop per goal. Cap at 5 cycles per goal. Cap identical same-criterion failures at 3.

### Acquire Next Goal
1. Run `$ULW_CLI complete-goals --json` and read the handoff, including criteria.
2. Register the binding goal via optional host tools if present (`create_goal`/`update_goal`), else rely on `# Goal` + CLI state.
3. Never invent a second conflicting aggregate objective in the same thread.

### Per-Criterion Cycle
1. PLAN: read criterion scenario, expectedEvidence, prior ledger entries.
2. Register atomic todos via `todo_write` — one ultra-granular step per action. Exactly one `in_progress`.
3. DELEGATE-IN-PARALLEL: dispatch every independent task via right-sized `spawn_subagent` workers. PIN existing behavior first, then RED → GREEN through the cheapest faithful channel. Serialize only on a NAMED dependency.
4. INTEGRATE + CRITICAL SELF-QA: do NOT trust the worker's report. Read the diff, re-run tests, run LSP diagnostics. Respawn on hollow evidence.
5. EXECUTE-AS-SCENARIO: ACTUALLY run the Manual-QA scenario (yourself or `lazygrok:lazygrok-qa-executor`).
6. CAPTURE: collect the observable artifact path under `.lazygrok/evidence/` (or the CLI attempt dir).
7. CLEAN (PAIRED, NEVER SKIP): tear down every runtime artifact; kill residual subagents with `kill_command_or_subagent`. Embed a one-line cleanup receipt.
8. RECORD one result immediately via CLI `record-evidence`.
9. On mismatch: diagnose, respawn worker with failure context, rerun SAME criterion.
10. After 3 same-criterion failures, exit the goal with diagnosis.
11. After 5 cycles without required criteria passing, checkpoint failed.

### Goal Completion
1. Confirm required criteria pass.
2. Checkpoint via CLI with complete/blocked/failed status.
3. If final goal, run Final Quality Gate first.

## Final Quality Gate
Trigger only for the final aggregate goal after every criterion is `pass`.
1. Run targeted verification for changed behavior.
2. FREEZE first — no more edits or rebases.
3a. Spawn `lazygrok:lazygrok-code-reviewer` and `lazygrok:lazygrok-qa-executor` in parallel with brief, goals, desired outcome, diff, evidence; wait for BOTH and confirm report artifacts exist under `.lazygrok/evidence/`.
3b. Only then spawn `lazygrok:lazygrok-gate-reviewer` with those artifact paths.
3c. Gate approval binds to the frozen tree and full commit SHA.
4. Treat timeout, missing deliverable, ack-only, `BLOCKED:`, or inconclusive review as a blocker. Re-review the delta at most TWICE.
5. If clean, checkpoint final completion with quality-gate JSON naming lazygrok reviewers (not lazycodex-*).

Example quality-gate shape (paths illustrative):
```json
{
  "codeReview":{"by":"lazygrok-code-reviewer","recommendation":"APPROVE","codeQualityStatus":"CLEAR","reportPath":".lazygrok/evidence/goal-code-review.md","evidence":"Diff review passed.","blockers":[]},
  "manualQa":{"by":"lazygrok-qa-executor","status":"passed","evidence":"Surfaces passed.","surfaceEvidence":[],"adversarialCases":[],"artifactRefs":[]},
  "gateReview":{"by":"lazygrok-gate-reviewer","recommendation":"APPROVE","reportPath":".lazygrok/evidence/goal-gate-review.md","evidence":"Gate review passed.","blockers":[]}
}
```

## Constraints
1. Prefer `# Goal` + ulw-loop CLI on Grok. Host `update_goal`/`create_goal` only if present; never narrate their absence.
2. NEVER call host `update_goal` mid-aggregate when using host goals; only on final story after the quality gate passes.
3. Evidence is bound to the tree it was captured at; changed tracked content invalidates it.
4. NEVER mark PASS from memory.
5. Baseline suite green is necessary, not sufficient.
6. Treat the ledger as the durable audit trail; checkpoint after every success or failure.
7. Evidence MUST be observable from the real surface per the Manual-QA channel table.
8. NEVER record PASS while any QA-spawned process, `tmux` session, browser context, bound port, container, temp path, or open worker is still alive.
9. DELEGATE code edits / test writes / fixes / QA execution to right-sized `spawn_subagent` workers; NEVER record pass from a worker's self-report alone.

## Stop Rules
- STOP GOAL: all goals complete plus every plan criterion `pass` plus final quality gate clean, AND the user's problem is ACTUALLY SOLVED in observable behavior.
- 3x same criterion failure: checkpoint failed, surface diagnosis.
- 5 cycles on one goal without required criteria passing: checkpoint failed, surface.
- Safety boundary (destructive command, secret exfiltration, production write): block and surface a safe substitute.
- Leftover state from QA: NOT pass. Clean up, append the receipt, then continue.
- User issues `/cancel-ralph` or `/cancel`: release in-progress state cleanly and do not auto-resume.
