---
name: review-work
description: "Post-implementation review orchestrator. Launches 5 parallel background sub-agents: Oracle (goal/constraint verification), Oracle (code quality), Oracle (security), QA executor (hands-on QA), context miner (GitHub/git/Slack/Notion). All must pass for review to pass. MUST USE after completing any significant implementation work. Triggers: 'review work', 'review my work', 'review changes', 'QA my work', 'verify implementation', 'check my work', 'validate changes', 'post-implementation review'."
---
## Grok Harness Tool Compatibility

This skill may include examples copied from other harnesses. On Grok, use native tools. `spawn_subagent` **is** native on Grok — use it directly.

| Foreign example | Grok tool to use |
| --- | --- |
| `Task(...)` / `task(...)` | `spawn_subagent(...)` |
| `TodoWrite(...)` | `todo_write(...)` |
| `background_output(...)` | `get_command_or_subagent_output(...)` |
| `team_*(...)` | **n/a on Grok** — parallel `spawn_subagent` + orchestrator journal |
| `Bash` / `bash(...)` | `run_terminal_command(...)` |

Role-specific behavior must be described in a self-contained `prompt`. Prefer `background: true` so the child starts with only the initial prompt. Include required context, files, diffs, and skill names in the prompt. Prefer agent types: `lazygrok:oracle`, `lazygrok:lazygrok-code-reviewer`, `lazygrok:lazygrok-qa-executor`, `lazygrok:lazygrok-gate-reviewer`, `lazygrok:explore`. If a code block below conflicts with this section, this section wins.

For work likely to exceed one wait cycle, require the child to send `WORKING: <task> - <current phase>` before long passes and `BLOCKED: <reason>` only when progress stops. Poll with `get_command_or_subagent_output`. Treat a running child as alive. Fallback only when the child is completed without the deliverable, ack-only after followup, explicitly `BLOCKED:`, or no longer running.

## Subagent Reliability

Every `spawn_subagent` prompt must be self-contained. Start with
`TASK: <imperative assignment>`, then name `DELIVERABLE`, `SCOPE`, and
`VERIFY`. State that it is an executable assignment, not a context
handoff. Use `background: true` unless full history is truly required.

Plan and reviewer agents may run for a long time; spawn them in the background, keep doing independent root work, and poll with short `get_command_or_subagent_output` cycles. Never use a single long blocking wait, and never spin on tiny timeouts as a failure budget.

# Review Work - 5-Agent Parallel Review Orchestrator

Launch 5 specialized sub-agents in parallel to review completed implementation work from every angle. All 5 must pass for the review to pass. If even ONE fails, the review fails.

When `review-work` is used as a final implementation, PR, or `$start-work`
gate, it is blocking. A timeout, missing deliverable, ack-only response,
explicit `BLOCKED:`, or inconclusive lane is not a pass. Treat that lane as
failed, investigate with the `debugging` skill when runtime behavior may be
wrong, fix with evidence, and rerun the affected lane before claiming
completion or handing off a PR.

Review evidence must be safe to share. Redact or mask secrets and sensitive
user data before including evidence in logs, PR bodies, or handoffs.

The 5 agents cover complementary concerns:

| # | Agent | Type | Role | Focus Level |
|---|-------|------|------|-------------|
| 1 | Goal Verifier | `lazygrok:oracle` | Did we build what was asked? | MAIN |
| 2 | QA Executor | `lazygrok:lazygrok-qa-executor` | Does it actually work? | MAIN |
| 3 | Code Reviewer | `lazygrok:lazygrok-code-reviewer` | Is the code well-written? | MAIN |
| 4 | Security Auditor | `lazygrok:oracle` | Is it secure? | SUB |
| 5 | Context Miner | `lazygrok:explore` | Did we miss any context? | MAIN |

---

## Phase 0: Gather Review Context

Before launching agents, collect these inputs. Extract from conversation history first. Only ask if truly missing.

<required_inputs>

- **GOAL**: The original objective.
- **CONSTRAINTS**: Rules, requirements, or limitations.
- **BACKGROUND**: Why this work was needed.
- **CHANGED_FILES**: Auto-collect via `git diff --name-only HEAD~1` or against the appropriate base.
- **DIFF**: Auto-collect via `git diff HEAD~1` or against the appropriate base.
- **FILE_CONTENTS**: Read the full content of each changed file (not just the diff). Prompt-only reviewers need full context in the prompt.
- **RUN_COMMAND**: How to start/run the application.

</required_inputs>

**NEVER CHECKOUT A PR BRANCH IN THE MAIN WORKTREE. ALWAYS CREATE A NEW GIT WORKTREE (`git worktree add`) AND WORK THERE.**

**Auto-collection sequence:**

```bash
git diff --name-only HEAD~1  # or: git diff --name-only main...HEAD
git diff HEAD~1  # or: git diff main...HEAD
# Detect run command from package.json / Makefile / docker-compose.yml
```

---

## Phase 1: Launch 5 Agents

Launch ALL 5 in a single turn with `background: true`. No sequential launches.

**Oracle / code-reviewer agents receive everything in the prompt** (include DIFF + FILE_CONTENTS).
**QA executor and explore agents are autonomous** — give goals and pointers, not raw content dumps.

### Agent 1: Goal & Constraint Verification — MAIN

```
spawn_subagent(
  subagent_type="lazygrok:oracle",
  background=true,
  prompt="""
TASK: Verify implementation against original goal and constraints
DELIVERABLE: verdict PASS/FAIL with goal_breakdown + constraint_compliance
SCOPE: review only (no product edits)
VERIFY: every sub-requirement marked ACHIEVED/MISSED/PARTIAL with evidence

GOAL: {GOAL}
CONSTRAINTS: {CONSTRAINTS}
BACKGROUND: {BACKGROUND}
CHANGED_FILES: {CHANGED_FILES}
FILE_CONTENTS: {FILE_CONTENTS}
DIFF: {DIFF}

OUTPUT: <verdict>, <confidence>, <summary>, <goal_breakdown>, <constraint_compliance>, <findings>, <blocking_issues>
""")
```

### Agent 2: QA via App Execution — MAIN

```
spawn_subagent(
  subagent_type="lazygrok:lazygrok-qa-executor",
  background=true,
  prompt="""
TASK: Hands-on QA by running the application
DELIVERABLE: scenario matrix with PASS/FAIL + artifact paths under .lazygrok/evidence/
SCOPE: run real scenarios only (no product edits unless assigned)
VERIFY: every P0 scenario executed with evidence

GOAL: {GOAL}
CONSTRAINTS: {CONSTRAINTS}
CHANGED_FILES: {CHANGED_FILES}
RUN_COMMAND: {RUN_COMMAND}

Process: brainstorm 15-30 scenarios → augment → todo_write list → execute P0 first → compile results.
Web: playwright/agent-browser. CLI: real commands. API: curl/httpie.
""")
```

### Agent 3: Code Quality Review — MAIN

```
spawn_subagent(
  subagent_type="lazygrok:lazygrok-code-reviewer",
  background=true,
  prompt="""
TASK: Code quality review
DELIVERABLE: recommendation APPROVE/REQUEST_CHANGES + report under .lazygrok/evidence/
SCOPE: read-only product code; write report only
VERIFY: CRITICAL/HIGH findings force REQUEST_CHANGES

CHANGED_FILES: {CHANGED_FILES}
FILE_CONTENTS: {FILE_CONTENTS}
DIFF: {DIFF}
BACKGROUND: {BACKGROUND}
""")
```

### Agent 4: Security Review — SUB

```
spawn_subagent(
  subagent_type="lazygrok:oracle",
  background=true,
  prompt="""
TASK: Security-focused review of the diff
DELIVERABLE: verdict PASS/FAIL + severity + findings (CRITICAL/HIGH block)
SCOPE: security only (ignore style unless it creates risk)
VERIFY: input validation, authz, secrets, data exposure, deps, crypto, path traversal, CORS/TLS, error leakage, supply chain

CHANGED_FILES: {CHANGED_FILES}
FILE_CONTENTS: {FILE_CONTENTS}
DIFF: {DIFF}
""")
```

### Agent 5: Context Mining — MAIN

```
spawn_subagent(
  subagent_type="lazygrok:explore",
  background=true,
  prompt="""
TASK: Mine accessible contexts for missed requirements
DELIVERABLE: discovered_context with IMPACT BLOCKING/IMPORTANT/FYI
SCOPE: git history, gh issues/PRs if available, codebase cross-refs, docs
VERIFY: list sources searched/skipped; blocking_issues only for BLOCKING items

GOAL: {GOAL}
CONSTRAINTS: {CONSTRAINTS}
CHANGED_FILES: {CHANGED_FILES}
BACKGROUND: {BACKGROUND}
""")
```

---

## Phase 2: Wait & Collect

After launching all 5 agents in one turn, wait for completions in bounded
cycles. Do not treat a timeout, ack-only reply, or empty child result as PASS.

Collect via `get_command_or_subagent_output`. Preserve completed lane results
immediately. Store each verdict independently:

| Agent | Verdict |
|-------|---------|
| 1. Goal Verification | pending/PASS/FAIL/INCONCLUSIVE |
| 2. QA Execution | pending/PASS/FAIL/INCONCLUSIVE |
| 3. Code Quality | pending/PASS/FAIL/INCONCLUSIVE |
| 4. Security | pending/PASS/FAIL/INCONCLUSIVE |
| 5. Context Mining | pending/PASS/FAIL/INCONCLUSIVE |

Do NOT deliver the final report until ALL 5 lanes have a terminal state.
If a lane remains silent after reliability followup, record INCONCLUSIVE and
respawn a smaller reviewer/worker for that exact lane. Kill residual workers
with `kill_command_or_subagent` when safe.

---

## Phase 3: Deliver Verdict

ALL 5 agents returned PASS → **REVIEW PASSED**
ANY agent returned FAIL → **REVIEW FAILED - criteria not met**
ANY lane is INCONCLUSIVE and none failed → **REVIEW INCONCLUSIVE - not approved**

```markdown
# Review Work - Final Report

## Overall Verdict: PASSED / FAILED / INCONCLUSIVE

| # | Review Area | Agent Type | Verdict | Confidence |
|---|------------|------------|---------|------------|
| 1 | Goal & Constraint Verification | oracle | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 2 | QA Execution | lazygrok-qa-executor | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 3 | Code Quality | lazygrok-code-reviewer | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 4 | Security (supplementary) | oracle | PASS/FAIL/INCONCLUSIVE | Severity |
| 5 | Context Mining | explore | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |

## Blocking Issues
[Aggregated from all agents - deduplicated, prioritized]

## Key Findings
[Top 5-10 most important findings across all agents]

## Recommendations
[If FAILED: exactly what to fix, in priority order]
[If PASSED: non-blocking suggestions worth considering]
```

If FAILED - be specific (problem, file, fix). If PASSED - keep it short.
