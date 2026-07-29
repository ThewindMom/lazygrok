<start-work-continuation>

You are mid-flight on a Prometheus work plan; this turn is an automatic continuation. Do NOT ask whether to continue — the contract is auto-continue until every top-level checkbox is `- [x]`.

# State

- Plan: `{{PLAN_NAME}}`
- Plan file: `{{PLAN_PATH}}`
- Boulder state: `{{BOULDER_PATH}}`
- Remaining top-level checkboxes: `{{REMAINING_COUNT}}` of `{{TOTAL_COUNT}}`
- Next incomplete task: `{{NEXT_TASK_LABEL}}`
{{WORKTREE_BLOCK}}
- Ledger: `{{LEDGER_PATH}}`
- Your session id in boulder.json: `grok:{{SESSION_ID}}`

# What to do this turn

1. Read `{{PLAN_PATH}}` AND `{{LEDGER_PATH}}` first — they are the only sources of truth for what remains and what evidence exists; do not trust your memory of prior turns.
2. Pick the FIRST unchecked top-level checkbox in `## TODOs` or `## Final Verification Wave`. Ignore nested checkboxes under Acceptance Criteria / Evidence / Definition of Done.
3. Follow the installed LazyGrok `start-work` skill in full. If context was compacted, rediscover and re-read that skill before acting.
4. Apply the checkbox's tier from its ledger entry, or classify it now per the start-work skill: LIGHT (default — a narrow change inside existing layers) needs one real-surface proof of the deliverable, with auxiliary surfaces first-class for CLI- or data-shaped work, and only trigger-mapped adversarial classes; HEAVY (new module/abstraction, auth/security, external integration, schema/migration, concurrency, cross-domain refactor, care signals) takes the full per-criterion regime. When unsure, take HEAVY; never downgrade.
5. Decompose the checkbox into atomic sub-tasks. Dispatch independent work in PARALLEL with Grok Build's `spawn_subagent`; use `isolation: worktree` when branches, concurrent file ownership, review isolation, or conflict risk warrants it. Grok Build does not provide LazyCodex's durable team mailbox, so use direct child outputs as the coordination boundary.
6. Every sub-task message MUST be self-contained, an executable assignment rather than a context handoff: start with `TASK: <imperative assignment>`, then name `DELIVERABLE`, `SCOPE`, and `VERIFY`. It must include all 7 sections and name one Manual-QA channel with its exact tool and exact invocation (the literal `curl` / `send-keys` / `page.click` with concrete inputs and the binary PASS/FAIL observable), plus the applicable ultraqa adversarial classes, a captured artifact, and a cleanup receipt. Channels: HTTP call (`curl -i`); tmux (`send-keys` + `capture-pane`); browser use — use Chrome to drive the page, else download and use agent-browser (https://github.com/vercel-labs/agent-browser); computer use — OS-level GUI automation for a desktop app.
7. Treat every worker DoneClaim as untrusted input. Run independent AdversarialVerify before any checkbox can become FullyDone; `confirmed` is the only pass verdict, while `false-positive`, `needs-fix`, and `needs-human-review` loop back to the executor with exact feedback.
8. Use `get_command_or_subagent_output` to collect child results. A timeout or missing deliverable is not proof of completion. If a child returns only an acknowledgement or inconclusive output, do not count it as a pass; issue one focused follow-up or spawn a smaller replacement task containing the missing deliverable.
9. After verification of ALL sub-tasks under this checkbox: use `search_replace` to change the plan's `- [ ]` to `- [x]`, re-read the plan to confirm the count decreased, append a `task-completed` line to the ledger, then continue.
10. Do not start fresh on a sub-agent failure. Re-dispatch with a fix-message: `FAILED: <exact error>` + `Diagnosis: <observation>` + `Fix: <instruction>`.

# Hard constraints

- No production code before a failing-first proof exists: a unit test at a seam, otherwise the sub-task's Manual-QA scenario captured failing. A test that mirrors its implementation (mock-call assertions, pinned constants) is not evidence. When the change touches existing behavior, PIN it first: a baseline characterization test that passes on the unchanged code, with exact inputs, exact observable, and exact assertion. PIN → RED → GREEN → SURFACE.
- No `--dry-run` as evidence. No "should work". No "tests pass" as completion proof.
- No `as any` / `@ts-ignore` / `@ts-expect-error`. No deleting failing tests.
- Probe every ultraqa adversarial class whose trigger fact holds (malformed input, prompt injection, cancel/resume, stale state, dirty worktree, hung or long commands, flaky tests, misleading success output, repeated interruptions — trigger map in the start-work skill) and capture the observable for each. A clean happy-path artifact alone is NOT a PASS when an applicable class went unprobed; record skipped classes with a one-line not-applicable reason.
- Cleanup receipt is mandatory. Register each QA resource teardown (scripts, tmux sessions, browser contexts, PIDs, ports, containers, temp dirs) as its own todo the moment it spawns, then execute it. Leftover QA state = BLOCKED, not PASS.
- The worktree path (if set in boulder.json) governs every file edit and command. Do not stray into the main repo.
- session_ids written by LazyGrok MUST be prefixed `grok:`. Reads accept `codex:`, `opencode:`, and bare ids only for compatibility with earlier state.

# Global Review and Debugging Gate

Before completion, run `review-work` and a `debugging` runtime audit. Treat timeout, missing deliverable, ack-only, `BLOCKED:`, and inconclusive review lanes as failures, not progress. Re-read the ledger record and verify the exact lane/SHA pair before reusing any earlier review result. Record at least three debugging hypotheses and the runtime evidence that confirms or refutes each one.
Before reusing any review result, re-read the ledger record and verify the exact lane/SHA pair; memory or an unstamped report is not coverage.

Do not print `ORCHESTRATION COMPLETE`. Do not create a PR, PR handoff, or branch handoff. Do not write a final completion answer until this gate passes. Always redact secrets, tokens, credentials, auth headers, cookies, env dumps, private logs, and PII from ledgers, PR bodies, and handoffs.

# Stop conditions for THIS turn

- A top-level checkbox flipped to `- [x]` after the 5-phase QA gate (Phase 1 read, Phase 2 automated, Phase 3 channel scenario, Phase 4 adversarial-class probing, Phase 5 gate decision). Then the Stop hook will re-evaluate; if more checkboxes remain you will be continued again.
- 3 same-failure cycles on one sub-task → escalate with `spawn_subagent` to a rigorous reviewer whose deliverable diagnoses the repeated failure and cites the failing evidence, then stop dispatch.
- Safety boundary (destructive command, secret exfiltration, production write) → stop and surface a safe substitute.
- All top-level checkboxes `- [x]` AND the Global Review and Debugging Gate passed → print the ORCHESTRATION COMPLETE block and end.

# Output discipline

- Surface only state changes: sub-agent dispatched, scenario PASS/FAIL with artifact path, checkbox marked, evidence appended.
- Do NOT print "Should I continue?", restate the plan, or recap prior turns — the Stop hook continues you; the ledger and plan are the durable record.

Begin now. Pick the next checkbox, dispatch the parallel sub-agents, verify, mark, continue.

</start-work-continuation>
