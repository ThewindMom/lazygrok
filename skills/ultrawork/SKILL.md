---
name: ultrawork
description: >
  Binding ultrawork mode for LazyGrok. Triggered when the user says ultrawork or ulw
  (one keyword is enough — do not require /goal or other commands). Hook injects a
  bootstrap that points at this file. Read the whole file and follow every rule for
  the rest of the task.
metadata:
  short-description: ULW mode — one keyword, full evidence-driven execution
user_invocable: true
---

<ultrawork-mode>

**MANDATORY**: First user-visible line this turn MUST be exactly:
`ULTRAWORK MODE ENABLED!`

[CODE RED] Maximum precision. Outcome-first. Evidence-driven.

# User trigger (only this)

The user only needs to say **`ulw`** or **`ultrawork`** (anywhere in the prompt).
Do **not** ask them to also run `/goal`, `/ulw-loop`, or `/ulw-evidence`. You perform
registration and ledger setup yourself.

# Role

## Goal registration (do all applicable layers — silent on missing tools)

Strip `ulw` / `ultrawork` from the user text; remainder = **objective**.

1. **Grok host tools (when present in this session's tool list)**  
   - `create_goal` → call with `objective` only (no status, no token_budget).  
   - `update_goal` → use for progress / complete / blocked **only if** a host goal is already active (e.g. user previously used `/goal`). Never claim host completion without real evidence.  
   - If neither tool exists: **not a defect** — continue. Do not lecture the user about missing tools.

2. **Transcript contract (always)**  
   Open with a markdown `# Goal` block: objective, tier (LIGHT/HEAVY), success criteria with scenarios, when-to-stop. This is for humans + compaction; it does **not** replace host `/goal` or the ULW ledger.

3. **Durable ULW ledger (always for non-trivial work)** — skill `ulw-evidence`:  
   ```bash
   node "${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" create-goals --brief "<objective>" --json
   ```  
   Prefer `.lazygrok/ulw-loop/`; keep `.omo/ulw-loop/` if that run already started there.  
   Record evidence with `record-evidence`; LIGHT final complete via `light-quality-gate` then `checkpoint`.

4. **Live checklist (always):** `todo_write` — exactly one `in_progress`.

Optional: if the user already ran `/goal` before saying ulw, host orchestration is a bonus — still do layers 2–4.


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
Prefer `subagent_type` from the installed LazyGrok agents list. Do not use Codex multi_agent_v1/v2 tool names.

When a skill or workflow still shows Codex MultiAgent examples, translate them with this table.


## 0. Survey the skills, gather context, then size the work
First, survey the loaded skill list and read the description of each
loosely relevant skill. Decide explicitly which skills this task will
use and prefer using every genuinely applicable one — name them in the
notepad with a one-line reason each. Skipping a skill that fits the
task is a defect. Open a skill's body only when THIS session will
execute its workflow; skills a delegated session needs are named in
its prompt and read there, not here.
Next, fire the first discovery wave under Finding things below.
Then run Tier triage (above) on the change set and record the tier —
tier sizes evidence and review, never who plans. Size planning by
what the wave left UNDECIDED, not by how many steps you can list:
spawn the `plan` agent only when open design decisions remain —
unclear module boundaries, several viable decompositions, or a
multi-file build whose dependency order is not obvious — pass it the
gathered findings (file:line facts, constraints, unknowns), and
follow its wave order, parallel grouping, and verification exactly.
A known procedure — however many steps — and questions about work you
are delegating never justify a planner: plan directly in the notepad.
Never spawn `plan` before the discovery wave has returned.

## 1. Register the binding goal (Grok-native channels)
You MUST register a binding goal via the Grok goal protocol (`# Goal` + ulw-loop CLI; host `create_goal` only if present). Call it with
exactly `objective`; do not include `status`. Only when no goal tool
exists on this surface, open your reply with a `# Goal` block treated
as binding. Goals are unlimited; never invent a numeric budget or
limit.
The criteria MUST list, upfront:
- The user-visible deliverable in one line, and the tier with its
  justification.
- Success criteria sized by tier (LIGHT 1-2, HEAVY 3+ covering happy
  path, edge cases — boundary / empty / malformed / concurrent — and
  adjacent-surface regression named by file + function), each naming
  its exact scenario: the literal command / page action / payload and
  the binary PASS/FAIL observable, plus the evidence artifact it will
  capture.
- For each criterion, the failing-first proof (test id or scenario)
  that will be captured RED BEFORE the implementation and GREEN after.
  Evidence added after the green code does NOT satisfy this.
- WHEN TO STOP, in one line: "I'll stop right away when <the exact
  observable state that ends this run>". The Stop rules bind to this
  line — the moment it holds, you stop.

These scenarios are the contract. You are not done until every one of
them PASSES with its evidence captured.

## 2. Open the durable notepad
Run: `NOTE=$(mktemp -t ulw-$(date +%Y%m%d-%H%M%S).XXXXXX.md)`. Echo the
path. Initialise it with these sections and APPEND (never rewrite) as
you work:

```
# Ultrawork Notepad — <one-line goal>
Started: <ISO timestamp>

## Plan (exhaustively detailed)
<every step you will take, in order, broken to atomic actions>

## Success criteria + QA scenarios
<copied from the goal>

## Now
<the single step in progress>

## Todo
<every remaining step, ordered>

## Findings
<every non-obvious fact discovered, with file:line refs>

## Learnings
<patterns / pitfalls / principles to remember next turn>
```

Append each finding, decision, command, RED/GREEN capture, and QA
artifact path the moment it happens. Update `## Now` and
`## Todo` on every transition. Append-only — never rewrite. This notepad
is your durable memory and it OUTLIVES the context window. After any
compaction or context loss (a `Context compacted` notice, a summarized
history, or you no longer see your own earlier steps), STOP and re-read
the WHOLE notepad FIRST before any other action, then resume from
`## Now`. Recover
state from the notepad; do not re-plan from scratch or re-run completed
steps.

## 3. Register obsessive todos via `todo_write`
The todo tool is Grok `todo_write` — your live, user-visible
checklist. Translate every action from the plan into one `todo_write`
step — one step per atomic work unit: an edit plus its verification, a
QA scenario run, a teardown. Keep each step small enough to finish
within a few tool calls.
Call `todo_write` on EVERY state transition — the instant a step starts
(mark it `in_progress`) and the instant it finishes (mark it `completed`
and the next `in_progress`). Exactly ONE `in_progress` at a time. Mark
completed IMMEDIATELY — never batch, never let the rendered plan lag
behind reality. Add newly discovered steps the moment they surface
instead of waiting for the next pass. Step text encodes WHERE / WHY
(which criterion it advances) / HOW / VERIFY:
`path: <action> for <criterion> — verify by <check>`.

GOOD pair (test-first, ordered):
  `foo.test.ts: Write FAILING case invalid-email→ValidationError for criterion 2 — verify by RED with assertion msg`
  `src/foo/bar.ts: Implement validateEmail() RFC-5322-lite for criterion 2 — verify by foo.test.ts GREEN + curl 400 body`
BAD: "Implement feature" / "Fix bug" / "Add tests later" / writing
production code before its failing test → rewrite.

# Finding things (lead with these, code-mode the first wave)
Never guess from memory — locate with the right tool, and re-read before
you claim or change. **USE CODE MODE AGGRESSIVELY FOR BOUNDED WAVES.**
When multiple independent tool calls produce results that can be materially
filtered, joined, deduplicated, or reduced, make ONE `exec` / eval JavaScript
program that calls eligible tools concurrently with `Promise.all` and emits only
decision-relevant evidence. For shell-native repo work without programmatic
tool access, use ONE Python script with `concurrent.futures`, `subprocess`,
and utility functions to batch commands and reduce output. Keep direct calls
when one result chooses the next action, outputs are already small, semantic
judgment is required between calls, approval or side effects are involved,
or native artifacts / citations must be preserved.
- Architecture / flow / blast radius → `codegraph_explore` first when
  `codegraph_*` exists; if unavailable, continue with repo tools and LSP.
- **SYMBOLS REQUIRE LSP** — definitions, references, rename impact,
  workspace symbols, and diagnostics use the available `lsp_*` tools, not
  text search. Run diagnostics after edits and treat errors as blocking.
- Repo text / filenames / history / bounded shell output → `rg`,
  `rg --files`, `git`, and native utilities; narrow output in-program.
- Structural call / function / class / import shapes and codemods → the
  `ast-grep` skill or `sg` with `$VAR` / `$$$` metavariables.
When discovery needs multiple angles or the module layout is
unfamiliar, delegate to the `explorer` subagent (read-only codebase
search, absolute-path results). For research that leaves the repo —
library/API/docs/web — delegate to the `librarian` subagent. Spawn them
`background: true` and keep doing root work while they run.

# Execution loop (PIN → RED → GREEN → SURFACE → CLEAN)
Until every success criterion PASSES with its evidence captured:
1. Pick next criterion → mark in_progress → update notepad `## Now`.
2. PIN + RED: when touching existing behavior, first pin it with a
   characterization test that passes on the unchanged code. Then
   capture the failing-first proof through the cheapest faithful
   channel — a unit test where a seam exists, an integration/e2e test
   where the behavior lives in wiring, or the criterion's real-surface
   scenario captured failing when no test seam exists. It must fail
   for the RIGHT reason (not a syntax error, not a missing import).
   Paste RED output into the notepad. No production code yet.
   TEST-ONLY TARGET (regression coverage for behavior that is already
   correct): there is no natural RED and no production change to make
   — this is the sole exception to the production-RED/GREEN steps.
   Substitute a mutation proof: temporarily force the exact regression
   each new assertion names (revert the fix commit or break the seam,
   never committed), capture the assertion failing, then revert the
   mutation and capture GREEN. An assertion that stays green under its
   mutation is not coverage — fix the fixture (a value equal to the
   default it must override proves nothing) or assert the artifact the
   criterion names, never an expected value re-derived from the output
   under test. Reverting the probe IS the GREEN; skip step 3's
   production change for a TEST-ONLY task and go to step 4.
   PROSE TARGET (prompt, SKILL.md, rule, markdown): the wording is
   NOT the behavior — never pin sentences, phrase presence/absence,
   or word/char counts. PIN only a machine-consumed value (parsed
   frontmatter field, a sentinel token a hook greps, the doc's JSON
   sample through its real validator) or one `toBe` equality between
   two shipped copies. A pure-prose change with no machine consumer
   has NO seam: ship it on review + QA-by-read, NO test — a text grep
   is pretend-coverage, not RED proof.
3. GREEN (skip for TEST-ONLY — reverting the mutation is GREEN): write
   the SMALLEST production change that flips RED→GREEN.
   Before GREEN work that depends on external review, PR, issue, or
   branch state, refresh current branch/PR/issue state and preserve existing ordering/policy;
   separate compatibility detection from policy changes unless the goal
   explicitly asks to change policy.
   Re-run the proof. Capture GREEN output. A GREEN far larger than the
   criterion implies means the proof was too coarse — split it.
4. SURFACE: run the real-surface proof the criterion named (channel
   table above; auxiliary surface for CLI- or data-shaped criteria),
   end-to-end, yourself. If the RED proof was the scenario itself,
   re-run it now and capture it passing. Paste the artifact path into
   the notepad.
5. CLEANUP (PAIRED — NEVER SKIP): the moment a QA scenario spawns any
   resource, register its teardown as its own todo (e.g.
   `cleanup: kill server pid for criterion 2 — verify kill -0 fails`).
   Every runtime artifact the QA spawned in step 4 MUST be torn down
   before this step completes:
   server PIDs (`kill <pid>`; verify `kill -0` fails), `tmux` sessions
   (`tmux kill-session -t ulw-qa-<criterion>`; verify with `tmux ls`),
   browser / Playwright contexts (`.close()`), containers
   (`docker rm -f`), bound ports (`lsof -i :<port>` empty), temp
   sockets / files / dirs (`rm -rf` the `mktemp` paths), QA-only env
   vars. Append a one-line cleanup receipt to the notepad next to the
   artifact, e.g. `cleanup: killed 12345; tmux kill-session ulw-qa-foo;
   rm -rf /tmp/ulw.aB12cD`. No receipt → criterion stays in_progress.
6. Verify: LSP diagnostics clean on changed files + the test scope
   this criterion touched green (no skipped, no xfail added this
   turn). Re-run a validation command (suite, typecheck, build) only
   when its inputs changed since its last green run; ONE full-suite
   pass belongs immediately before the final message, not after
   every increment.
7. Mark completed. Append non-obvious findings / learnings.
8. After each increment, re-run the scenarios that increment could
   have affected; re-run the full set once, right before the final
   message. Record PASS/FAIL inline with the evidence paths AND the
   cleanup receipt. Loop until all PASS.

Within a step, follow Finding things; NEVER parallelise RED and GREEN of
the same criterion.

# Waiting discipline (a poll costs a full model round)
Every status check you issue as a tool call replays the entire
accumulated context through the model. When a command will run long
(installs, builds, test suites, containers, CI), run it to completion
in ONE call with a timeout sized to the expected duration, or send
output to a log file and read it once when a completion signal is
expected. Never re-poll the same surface with empty reads or
sub-minute waits — batch waiting into the fewest, longest blocking
calls the harness allows, and do independent root work while the
command runs. If two consecutive checks show no state change, double
the wait before the next check or switch to a completion signal.

# Grok subagent reliability
Every `spawn_subagent` message is self-contained and starts with
`TASK: <imperative assignment>`, then names `DELIVERABLE`, `SCOPE`,
`VERIFY`, and `STOP WHEN` — the observable condition that ends the
child's run; a child without a stop condition wanders past its goal.
State that it is an executable assignment, not a context handoff. Use `background: true` unless full history is truly
required; paste only the context the child needs. Full-history forks can
make the child continue old parent context instead of the delegated task.
Use the Grok Tool Mapping table. Always pass `subagent_type` and put the full assignment in `prompt`/`message`.


# TOML-backed subagent routing compatibility
Installed role TOMLs (`~/.grok/agents/`) bind ONLY via `agent_type`.
`spawn_subagent` `spawn_subagent` schema does NOT (verified
`message`, and expect the session model for children. Difficulty tiers
when `agent_type` IS exposed: low -> `lazygrok-worker-low`
(gpt-5.6-luna/high), medium -> `lazygrok-worker-medium`
(gpt-5.6-luna/max), high -> `lazygrok-worker-high` (gpt-5.6-sol/max);
explorer/librarian carry their own TOMLs (gpt-5.6-luna/low). Difficulty
(model power) is orthogonal to LIGHT/HEAVY rigor (process size).

Treat child status as a progress signal, not a timeout counter. For
work likely to exceed one wait cycle, tell the child to send
`WORKING: <task> - <current phase>` before long reading, testing, or
review passes, and `BLOCKED: <reason>` only when it cannot progress.
Track spawned agent names locally. Use `get_command_or_subagent_output` for mailbox
signals, but a timeout only means no new mailbox update arrived.
Treat a running child as alive and keep doing independent root work.
Fallback only when the child is completed without the
deliverable, ack-only, or no longer running. If that followup is still
silent or ack-only, record the result as inconclusive, do not count it
as approval/pass, close it if safe, and respawn a smaller
`background: true` task with the missing deliverable.

# Subagent-dependent transition barrier
Do not mark an `todo_write` step `completed` while an active child owns
evidence for that step. Do not start dependent implementation until the
audit, research, or review result is integrated or explicitly recorded
as inconclusive. Do not generate a plan before spawned research lanes
that feed the plan have returned or been closed as inconclusive.
Spawn every independent child for the current wave first. After the wave
is launched, run `get_command_or_subagent_output` for each spawned child until
each reaches terminal status (`completed`, `failed`, `blocked`, or
explicitly recorded inconclusive) before any dependent `todo_write`
transition, `create_goal` continuation, implementation tool call, plan
drafting, approval-gate work, PR handoff, or final response. A timeout is
not terminal status.
Do not write the final answer, PR handoff, or completion summary while
active child agents remain open. Use `get_command_or_subagent_output` cycles with growing timeouts: start short (~30s) and double up to ~5 minutes.
After two silent waits send `TASK STILL ACTIVE: return <deliverable> or
BLOCKED: <reason>`. After four silent or ack-only checks, close the lane as
inconclusive, record that it is not approval, and respawn smaller only
if the deliverable is still required.

# Verification gate (TRIGGERED, NOT OPTIONAL)

Trigger when ANY apply:
- Tier is HEAVY.
- User demanded strict, rigorous, or proper review.
LIGHT tier records a self-review in the notepad instead: re-read the
diff, run diagnostics, confirm each criterion's evidence, and state in
one line why the tier held.

Procedure (NON-NEGOTIABLE):
1. Spawn a child with `background: true` and a self-contained reviewer
   assignment in `message`.    TOML-backed reviewer role, so paste the reviewer requirements into
   the message.
   Pass: goal, success-criteria, scenario evidence, full diff, notepad
   path.
2. Verify each reviewer concern yourself. A concern blocks only when
   it names a success criterion the evidence fails; record concerns
   that cite no criterion as notes with a one-line reason — fixed or
   declined at your judgment.
3. Fix every criterion-cited blocker. Re-run ONLY the scenario QA
   affected by the fix; capture fresh evidence for the delta. Update
   notepad.
4. Re-submit to the SAME reviewer at most twice, passing only the
   delta diff, the blockers it cited, and the already-approved criteria
   marked out-of-scope. An approval whose only remaining items are
   notes counts as approval.
5. On approval, declare done. If criterion-cited blockers remain after
   two re-reviews, stop and surface them to the user (mirroring the
   2-attempt stop rule below) — do not loop further.

# Commits
Commit frequently: one atomic commit per verified increment (RED→GREEN
+ its evidence), never one end-of-run omnibus; each commit builds +
tests green on its own; no WIP on the final branch.
BEFORE composing each message, read the history and mimic it: run
`git log --oneline -20` plus `git log -5 -- <touched paths>` and match
the observed convention — subject shape, scope names, message language,
body style, and typical commit size. Default to Conventional Commits
(`<type>(<scope>): <imperative>` — feat / fix / refactor / test / docs /
chore / build / ci / perf) only where history shows no stronger local
convention. If a plan file exists, final commit footer:
`Plan: .lazygrok/plans/<slug>.md`. Skip committing only when the user forbade
commits this session — then stage + draft the message instead.

# Constraints
- Every behavior change needs a failing-first proof captured BEFORE
  the production change, through the cheapest faithful channel (unit
  test at a seam; integration/e2e in wiring; the real-surface scenario
  when no test seam exists). If you typed production code first, STOP,
  revert, capture the proof failing, then redo the change. Exempt
  only: pure formatting, comment-only edits, dependency bumps with no
  behavior delta, rename-only moves — justify each in `## Findings`.
- A test that cannot fail for the regression it names is NOT
  evidence: mock-call assertions, pinned constants, a fixture equal
  to the default it must override, an expected value re-derived from
  the output under test. Prefer a real-surface proof with no new
  test over a tautological one.
- Refactors: characterization tests pinning current observable
  behavior FIRST, green against the old code, green throughout.
- Smallest correct change. No drive-by refactors.
- Never suppress lints / errors / test failures. Never delete, skip,
  `.only`, `.skip`, `xfail`, or comment out tests to green the suite.
- Never claim done from inference — only from captured evidence.

# Output discipline
- First line literally: `ULTRAWORK MODE ENABLED!`
- After bootstrap: 1-2 paragraph plan summary + notepad path.
- During execution: surface only state changes (RED captured, GREEN
  captured, scenario PASS/FAIL with evidence paths, reviewer verdict).
- Final message: outcome + success-criteria checklist with evidence
  refs + notepad path + reviewer approval (if gate triggered) + commit
  list (`<sha> <subject>`). No file-by-file changelog unless asked.

# Stop rules
- After each result, ask whether the user's core request can now be
  answered with useful evidence in hand. If yes, answer now — skip any
  remaining retrieval, ceremony, or verification that adds no evidence.
- The STOP GOAL: every scenario PASSES with captured evidence, every
  cleanup receipt is recorded, notepad is current, and (if gate
  triggered) reviewer approved unconditionally. Above ALL of that, the
  decisive test — outranking every other consideration — is: are the
  completion conditions FUNDAMENTALLY fulfilled, is the user's problem
  ACTUALLY SOLVED in observable behavior? If no, you are NOT done,
  whatever the ledger says. If yes, deliver the final message and STOP
  — no hesitation, no extra verification pass, no polish loop. Work
  past the stop goal is scope creep, not diligence.
- Leftover QA state (live process, `tmux` session, browser context,
  bound port, temp file / dir) means NOT done. Tear it down, record
  the receipt, then continue.
- After 2 identical failed attempts at one step, surface what was tried
  and ask the user before another retry.
- After 2 parallel exploration waves yield no new useful facts, stop
  exploring and act.

</ultrawork-mode>
