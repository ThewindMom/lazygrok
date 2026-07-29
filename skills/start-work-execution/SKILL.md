---
name: start-work
description: "Execute a Prometheus work plan in Grok with Boulder state, evidence ledger updates, worktree discipline, parallel subagents, and Stop-hook continuation. Use after planning when the user says start work, execute plan, continue plan, resume plan, or asks to run a .lazygrok/plans plan."
---

## Grok tools only

| Need | Tool |
| --- | --- |
| Spawn | `spawn_subagent({ subagent_type, prompt, background: true })` |
| Wait | `get_command_or_subagent_output({ task_ids, timeout_ms })` |
| Kill | `kill_command_or_subagent({ task_id })` |
| Todos | `todo_write` |
| Shell | `run_terminal_command` |
| Edit | `search_replace` / `write` |
| Read | `read_file` |

Only call tools from this session's tool list. See plugin `rules/15-grok-tools-only.md`.


## ABSOLUTE RULE: YOU ARE AN ORCHESTRATOR — NEVER THE IMPLEMENTER

**YOU DO NOT WRITE CODE. YOU DO NOT EDIT PRODUCT FILES. YOU DO NOT RUN QA YOURSELF. EVERY unit of implementation, test, QA, and review work MUST be delegated to a spawned subagent. NO EXCEPTIONS.** Your hands touch only plan selection, `.lazygrok/` (or `.omo/` if that run already started there) state (Boulder, ledger, plan checkboxes), decomposition, dispatch, verdicts, and evidence records. About to edit a product file or run an implementation command yourself? **STOP. SPAWN A WORKER INSTEAD.** Orchestrate at **MAXIMUM PARALLELISM**: every independent unit runs concurrently; only named dependencies serialize.

### Delegation by difficulty (Grok tier workers)
Size each implementation lane by difficulty and pass it as `subagent_type`: LOW → `lazygrok:lazygrok-worker-low`; MEDIUM → `lazygrok:lazygrok-worker-medium`; HIGH → `lazygrok:lazygrok-worker-high`. Explorer/librarian research lanes keep their own roles. Difficulty is orthogonal to LIGHT/HEAVY rigor in step 4.

## Grok Subagent Reliability

Every `spawn_subagent` **prompt** is a self-contained executable assignment: `TASK: <imperative assignment>`, then `DELIVERABLE`, `SCOPE`, `VERIFY`, and `STOP WHEN`. Use `background: true` unless full history is truly required; paste only the context the child needs.

Plan and reviewer agents may run for a long time: spawn them in the background and keep doing independent root work. Between `get_command_or_subagent_output` calls, back off — double the timeout up to ~5 minutes — instead of spinning short cycles. A timeout only means no new mailbox update arrived; treat a running child as alive. Require `WORKING: <task> - <current phase>` before long passes and `BLOCKED: <reason>` only when progress stops. Keep the parent visibly alive with active subagent count, names, and latest `WORKING:` phase. Fallback only when the child is completed without the deliverable, ack-only after followup, explicitly `BLOCKED:`, or no longer running — then record inconclusive (never a pass), close if safe, and respawn a smaller `background: true` task with the missing deliverable.

# start-work

## Grok goal registration (host tools optional)

Grok often does **not** inject `create_goal` / `update_goal` / `get_goal`
(especially when background workflows are enabled). That is normal.

Silent priority — never narrate missing tools:
1. If `update_goal` or `create_goal` is in the tool list → call with `objective` only (no status/budget).
2. Else bind the turn with a markdown `# Goal` block (objective + success criteria).
3. Always prefer durable structured goals via the ulw-loop CLI (`ulw-evidence` skill):
   `node "${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" create-goals ...`
   Prefer state under `.lazygrok/ulw-loop/`; if the CLI already created `.omo/ulw-loop/`, keep that run's root.
4. Live checklist: `todo_write` (exactly one `in_progress`, mark completed immediately).
5. Host `/goal` slash command is optional extra; do not block on it.

When OmO/Codex docs say "call get_goal / create_goal / update_goal", translate to this protocol.



## Grok Tool Mapping

| Intent | Grok tool |
| --- | --- |
| Spawn a worker | `spawn_subagent({subagent_type:"lazygrok:<role>", prompt:"TASK: ...", background:true})` |
| Wait for background result | `get_command_or_subagent_output({task_ids:[...]})` |
| Stop a runaway | `kill_command_or_subagent({task_id:"..."})` |
| Live checklist | `todo_write` |
| Edit files | `search_replace` / `write` |
| Shell | `run_terminal_command` |
| Read files | `read_file` |
| Binding goal | `# Goal` + ulw-loop CLI (`ulw-evidence`); host `create_goal`/`update_goal` only if present |
| Worker tiers | `lazygrok:lazygrok-worker-low` / `-medium` / `-high` (or `lazygrok-executor`) |
| Reviewers | `lazygrok:lazygrok-code-reviewer`, `lazygrok-qa-executor`, `lazygrok-gate-reviewer` |
| Explorer / librarian / plan | `lazygrok:explore` / `lazygrok:librarian` / `lazygrok:prometheus` |

Every `spawn_subagent` prompt must start with `TASK:`, then `DELIVERABLE`, `SCOPE`, `VERIFY`, `STOP WHEN`.
Prefer `subagent_type` from the installed LazyGrok agents list. Only call tools from this session's tool list (`rules/15-grok-tools-only.md`).

If an example uses a foreign tool name, use the Grok tools table above instead.



## Usage

```text
$start-work [plan-name] [--worktree <absolute-path>] [--make-pr] [--ship]
```

- `plan-name` (optional): a full or partial file stem under `.lazygrok/plans/`.
- `--worktree` (required for PR/branch work; otherwise optional): the task-owned git worktree path.
- `--make-pr` (optional): deliver the work as a pull request. IMPLIES worktree mode: when `--worktree` is absent, create a task-owned worktree (`git worktree add <absolute-path> <base-branch>`) before implementation and record it as `worktree_path`. On completion, push the branch and open a reviewer-readable PR, then hand off with the PR URL - merge only if the user asks.
- `--ship` (optional): full delivery lifecycle; implies `--make-pr`. After the PR opens, stay on the job until it is MERGED: watch CI and review gates, fix failures and address feedback from the worktree (fresh QA evidence for behavior changes), merge per the repository's merge policy, then remove the worktree and sync `.lazygrok/` (or `.omo/` if that run already started there) state back.

### Grok host boundary

Whole-session isolation must be chosen before Grok starts; a plugin hook cannot
change the cwd of the running host process. Interactive Grok documents
`grok --worktree=<name> "<prompt>"`, but Grok Build `0.2.114` does not
materialize `--worktree` in the headless `-p` path. Use this reliable headless
sequence:

```bash
git worktree add --detach /absolute/task-worktree HEAD
grok --cwd /absolute/task-worktree -p "ulw $start-work <plan-name> --worktree /absolute/task-worktree"
```

Never infer isolation from the launch flag. Before implementation, prove the
effective cwd appears in `git worktree list --porcelain`, record the same
absolute path as `worktree_path`, and prove the source checkout remains
unchanged. When start-work begins inside a non-worktree checkout and the task
requires PR/branch or conflict isolation, create the task-owned worktree before
dispatching any implementation and scope every worker command to it.

## Goal and todo discipline (MANDATORY)

Do ALL of this immediately after the plan is selected, BEFORE the first implementation dispatch. Skipping any step is a defect.

1. **Set the goal, in detail.** When a goal tool is available (`create_goal`), call it with a DETAILED objective: the plan name and path, the concrete end state, the phase and task counts, the delivery mode (direct, `--make-pr`, or `--ship`), and how completion will be verified. One work session = one goal. No goal tool -> record the same objective as the first ledger entry.
2. **Register every phase and task as todos.** Mirror the plan into the todo/plan tool of your harness: one phase per plan wave, one todo per column-zero checkbox (including the final verification wave). Register ALL of them up front - never keep tasks in memory only.
3. **Keep them current at every moment.** Mark a todo in_progress when its work dispatches and done immediately after its verification passes. Never batch-complete at the end, never execute work that is not a registered todo; discovered work is appended as a todo before it runs. The todo list, Boulder state, and plan checkboxes must always tell the same story.

## Phase 1: Select the plan

1. Read `.lazygrok/boulder.json` if it exists. Fall back to `.omo/boulder.json` only for a legacy run.
2. List Prometheus plan files under `.lazygrok/plans/`.
3. If `plan-name` was provided, select the matching plan.
4. If exactly one active or paused Boulder work exists for this session, resume it.
5. If no active work exists and exactly one plan exists, select it.
6. If no active work exists and there is no selectable plan, enter **No-plan bootstrap**.
7. If multiple plans remain possible, ask one focused selection question.

### No-plan bootstrap

When the user explicitly said `start work` / `$start-work` and no selectable plan exists, treat that phrase as approval: bootstrap `ulw-plan` to create the approved plan before execution and implementation, instead of stalling or asking for generic approval again. A brief or notes file without waves, checkboxes, and acceptance criteria is NOT decision-complete — enter this bootstrap too.

1. Invoke the `ulw-plan` skill from the current request and require its dynamic adversarial workflow: collect, verify, design, adversarial plan-review, synthesize.
2. The generated Prometheus plan must be saved under `.lazygrok/plans/<slug>.md` before implementation or Boulder state writes that point at plan work.
3. Use maximum safe parallelism in the generated plan: independent files/tasks fan out; same-file writes, shared state, and named dependencies serialize.
4. Preserve safety boundaries. Ask one focused question only when the objective is missing, destructive, or has a safety/product ambiguity that repository exploration cannot resolve.
5. After the plan exists, continue directly to Phase 2.

## Phase 2: Create or update Boulder state

Write `.lazygrok/boulder.json` before implementation starts. Prefix session ids with `grok:` so the continuation hook can identify its own session.

```json
{
  "schema_version": 2,
  "active_work_id": "<work-id>",
  "works": {
    "<work-id>": {
      "work_id": "<work-id>",
      "active_plan": ".lazygrok/plans/<plan-name>.md",
      "plan_name": "<plan-name>",
      "session_ids": ["grok:<session_id>"],
      "status": "active",
      "worktree_path": null
    }
  }
}
```

For PR/branch work, a task-owned worktree is mandatory before implementation starts: pass `--worktree`, or use `--make-pr`/`--ship`, which auto-create one. Verify the path with `git worktree list --porcelain` or create it with `git worktree add <path> <branch-or-HEAD>`, then store the absolute path as `worktree_path`. All edits, commands, tests, and evidence capture must run inside that worktree.

## Phase 3: Execute the next checkbox

1. Read the full selected plan.
2. Find the first unchecked column-0 checkbox in `## TODOs` or `## Final Verification Wave`.
3. Ignore nested checkboxes under acceptance criteria, evidence, and definition-of-done sections.
4. Classify the checkbox tier and record it in its ledger entry. Default is LIGHT — a narrow change inside existing layers. Take HEAVY only on a fact you can point to: a new module / abstraction / domain model; auth, security, or session; an external integration; a DB schema or migration; concurrency or transaction boundaries; a cross-domain refactor; or the plan or user signals care. When unsure, take HEAVY; upgrade and redo skipped gates the moment a HEAVY fact surfaces; never downgrade.
5. Decompose that checkbox into atomic sub-tasks. Collect every other unchecked checkbox in the same plan wave whose dependencies are met — their lanes execute concurrently.
6. **DELEGATE EVERYTHING. YOU NEVER IMPLEMENT.** Dispatch ALL independent sub-tasks across those checkboxes in one parallel `spawn_subagent` burst; serialize only named dependencies. Verification and checkbox marking stay per-checkbox.

Each sub-task message must include:

1. Goal and exact files or directories in scope.
2. When the task touches existing behavior: a baseline characterization test, written first, that pins current observable behavior and passes on the unchanged code (exact inputs, exact observable, exact assertion). Then the failing-first proof for the new behavior before production changes — a unit test where a seam exists, otherwise the sub-task's Manual-QA scenario captured failing. A test that mirrors its implementation (mock-call assertions, pinned constants) is not evidence.
3. Implementation constraints from the plan and project rules.
4. Automated verification commands to run.
5. One Manual-QA channel, named with the exact tool and exact invocation (the literal `curl`, `send-keys`, `playwright MCP tools` action, `page.click`, payload, selectors, and the binary observable that decides PASS/FAIL), not "verify it works". A LIGHT checkbox needs one real-surface proof of its deliverable, and auxiliary surfaces (CLI stdout, DB state diff, parsed config dump) are first-class when the surface is CLI- or data-shaped:
   - HTTP call: `curl -i` against the live endpoint.
   - Terminal / TUI: drive a real pty; `tmux send-keys` is fine for a boot/behavior smoke, but color/layout/CJK evidence goes through the xterm.js web terminal below, NEVER `tmux capture-pane`.
   - Browser use: in Grok, use `playwright MCP tools` first when available and the scenario does not need an authenticated or persistent user browser profile; otherwise drive the real page with Chrome, or agent-browser (https://github.com/vercel-labs/agent-browser) when Chrome is unavailable.
   - Computer use: OS-level GUI automation against the running desktop app when the surface is not a page.
   - TUI visual evidence: when a TUI claim needs visual QA or PR proof, run `node script/qa/web-terminal-visual-qa.mjs --command "<cmd>" --input "{Enter}" --evidence-dir <dir>` (real pty rendered through xterm.js in Chrome) and attach `terminal.png` plus `metadata.json`.
6. The adversarial classes that apply to this sub-task (from the 9 ultraqa classes) and how each is probed.
7. Required artifact path and cleanup receipt.

The 9 ultraqa classes are trigger-mapped: new input parsing → malformed input; untrusted external text → prompt injection; resumable or long-running flows → cancel/resume; generated or cached artifacts → stale state; uncommitted user files in scope → dirty worktree; long external commands → hung or long commands; new or timing-sensitive tests → flaky tests; log-based success claims → misleading success output; mid-operation interrupts → repeated interruptions. A class applies when its trigger fact holds. Probe each applicable class; record the rest as not-applicable with a one-line reason.

## Phase 4: Verify and record evidence

For each checkbox, complete all five gates before marking it done:

1. Plan reread: confirm the checkbox and acceptance criteria.
2. Automated verification: run tests, typecheck, lint, build, or the plan-specific equivalent.
3. Manual-QA channel: capture a real artifact, not a dry-run claim.
4. Adversarial QA: exercise every class the Phase 3 trigger map marks applicable and capture the observable result for each.
5. Cleanup: register every QA resource teardown as its own todo when spawned (QA scripts, tmux assets, browser sessions, PIDs, ports, containers, temp dirs), execute each, and capture the receipt. No QA asset is left running.

Append evidence to `.lazygrok/start-work/ledger.jsonl`, one JSON object per line. Include at least `event`, `plan`, `task`, `session_id`, `commands`, `artifact`, `adversarial_classes`, and `cleanup` fields. `adversarial_classes` lists each probed class with its observable result and each ruled-out class with a one-line reason.

### Sisyphus-style completion contract

A worker done claim is never final: each implementation sub-task returns a `DoneClaim`, a different context runs `AdversarialVerify` probing or reproducing the claim, failures loop back to the executor, and only a confirmed verifier verdict becomes `FullyDone`.

```json
{
  "DoneClaim": {
    "task": "<task id/title>",
    "changed_files": ["path"],
    "tests": ["exact command + result"],
    "manual_qa": ["artifact path"],
    "cleanup": ["receipt"],
    "risks": ["known risk or none"]
  },
  "AdversarialVerify": {
    "verdict": "confirmed | false-positive | needs-fix | needs-human-review",
    "evidence": ["file path, command, log, artifact, or explicit not inspected"],
    "repro": "exact command or manual steps when available",
    "confidence": 0.0
  }
}
```

Rules:
- `confirmed` is the only pass verdict. `false-positive`, `needs-fix`, and `needs-human-review` all block checkbox completion.
- The verifier must be independent from the executor: use `lazygrok-gate-reviewer`, a scoped `worker` reviewer, or root only when root did not implement or materially rewrite that task.
- A worker done claim must be independently verified before it becomes checkbox completion.
- On any non-confirmed verdict, append the feedback to the ledger, reset the checkbox work to in-progress, and re-dispatch the executor with the exact failure.
- The verifier must probe the applicable adversarial keys, including `stale_state`, `dirty_worktree`, and `misleading_success_output`, before allowing `FullyDone`.

## Phase 5: Mark progress

Only after verification passes:

1. Edit the plan checkbox from `- [ ]` to `- [x]`.
2. Re-read the plan and confirm the remaining count decreased.
3. Append a `task-completed` ledger entry.
4. Continue with the next checkbox. Do not ask whether to continue.

## Completion

When all top-level checkboxes in `## TODOs` and `## Final Verification Wave` are complete:

1. Run the plan's final verification commands.
2. Complete the **Global Review and Debugging Gate** before any completion claim, PR creation, PR handoff, branch handoff, or merge:
   - Invoke the `review-work` skill with the final diff, changed files, user goal, constraints, run command, and verification evidence. All five review lanes must return PASS. A timeout, missing deliverable, ack-only child, `BLOCKED:`, or inconclusive lane is a gate failure, not approval.
   - Each passing review lane binds to the exact full commit SHA it reviewed. Immediately append a durable record to `.lazygrok/start-work/ledger.jsonl` with the lane name, full SHA, PASS verdict, and report artifact/source. Before same-SHA reuse after any continuation or compaction, re-read the ledger record and require the exact lane/SHA pair; memory, chat history, or an unstamped report is not coverage. New commits require fresh applicable lane coverage.
   - Run a debugging-oriented runtime audit even when the review passes: name at least three plausible failure hypotheses for the changed surface, run the distinguishing checks against the actual artifact, and append a separate durable record with the audit name, exact full SHA, verdict, and evidence artifact/source to `.lazygrok/start-work/ledger.jsonl`. Reuse it only after re-reading an exact audit/SHA match.
   - If any review lane or debugging hypothesis fails, invoke the `debugging` skill, confirm root cause with runtime evidence, add the minimal failing test or reproduction, fix it, rerun the affected verification, then rerun the Global Review and Debugging Gate.
   - Evidence hygiene is mandatory: redact or mask secrets and sensitive user data before writing `.lazygrok/start-work/ledger.jsonl`, a PR body, or a handoff. Never include raw tokens, credentials, auth headers, cookies, API keys, env dumps, private logs, or PII; use concise summaries, lengths, hashes, or short non-sensitive prefixes instead.
   - If the work includes creating, updating, or handing off a PR, refresh `git status` and the PR/branch state from the task-owned worktree after the gate, and include only redacted review/debugging evidence in the PR body or handoff.
3. Finish the PR/branch lifecycle from its task-owned worktree: sync `.lazygrok/` (or `.omo/` if that run already started there) state back to the main repo, create or update the PR when requested, wait for CI/review/Cubic gates, merge by default unless explicitly opted out, and remove the worktree only after successful merge or explicit handoff.
4. Remove or mark the Boulder work as completed.
5. Print an `ORCHESTRATION COMPLETE` block with the plan path, verification commands, Global Review and Debugging Gate verdict, artifacts, and cleanup receipts.

## Hard rules

- No production change before a failing-first proof exists (unit test at a seam, otherwise the failing Manual-QA scenario), and no change to existing behavior before a baseline characterization test pins the current behavior and passes on the unchanged code.
- No `--dry-run` as completion evidence.
- No tests-only completion claim. A Manual-QA artifact is required.
- **NO DIRECT IMPLEMENTATION BY THE ORCHESTRATOR.** Root NEVER edits product files, writes tests, or runs QA itself — a spawned worker does.
- No completion claim while an applicable ultraqa adversarial class was never probed. Each applicable class needs a captured observable result; each skipped class needs a one-line not-applicable reason in the ledger.
- No `ORCHESTRATION COMPLETE`, final response, PR creation, PR handoff, or merge before the Global Review and Debugging Gate passes with recorded evidence.
- No PR/branch implementation or review in the main worktree; create or use a task-owned git worktree first.
- No unprefixed session ids in Boulder state. Grok sessions are always `grok:<session_id>`.
- No stale-memory execution. The plan and ledger are the durable source of truth.
