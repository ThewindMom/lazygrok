---
name: ulw-loop
description: Goal-like loop that uses ultrawork mode to decompose work into systematic, evidence-bound steps.
user_invocable: true
metadata:
  short-description: Goal-like ultrawork loop for systematic decomposition
---

# ulw-loop

> **OmO-style goal ledger ultrawork** for Grok (LazyCodex port).
> For Ralph promise+verifier only, see skill `ulw-ralph-loop`.
> For host-goal + evidence CLI details, see skill `ulw-evidence`.

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



## Required First Steps

1. Open `references/full-workflow.md`.
2. Read through **Bootstrap** (including its tier triage), **Execution Loop**, the **Manual-QA channels** table, and the **Stop Rules** before running any ULW command or recording evidence.
3. If the task has code edits, tests, QA, or commit work, follow the full workflow's delegation and evidence rules. Tests alone never prove done.

## Non-Negotiables

- Use the ulw-loop CLI state under `.lazygrok/ulw-loop`; do not hand-edit goal state.
- Register goals up front (`ulw create-goals` / `omo ulw-loop create-goals`, then host `create_goal` only if present — else `# Goal`) and mirror every atomic step into the live `todo_write` checklist: one ultra-granular step per action, exactly one in_progress, transitions marked the instant they happen.
- After any compaction or context loss, re-read brief + goals + ledger FIRST plus `omo ulw-loop status --json`, then resume; never re-plan from scratch.
- If `omo ulw-loop create-goals` says the existing aggregate is already complete, start unrelated new work with a fresh `--session-id <new-id>` instead of steering or forcing the completed default state. Use `--force` only to intentionally overwrite completed evidence.
- Every success criterion needs observable evidence from a real surface: a channel (terminal/TUI via the xterm.js web terminal, HTTP, browser, computer-use) or, for CLI- or data-shaped criteria, an auxiliary surface (CLI stdout, DB diff, parsed config dump).
- Evidence is bound to the tree it was captured at (`git rev-parse --short "HEAD^{tree}"`); it goes stale only when tracked content changes — a rebase or amend that keeps the tree identical keeps it valid. When the tree differs, re-run at the current HEAD and re-record, never relabel or regenerate. Record only after cleanup receipts exist.
- Delegate code edits, test writes, fixes, and QA execution to right-sized Grok subagents when the workflow requires it.
- Every `spawn_subagent` message starts with `TASK:`, then names `DELIVERABLE`, `SCOPE`, and `VERIFY`; put role and specialty instructions inside `message`; use `background: true` (v1: `background: true`) unless full history is truly required.
- Plan and reviewer agents may run for a long time; spawn them in the background and keep doing independent root work. Between `get_command_or_subagent_output` calls, back off — double the timeout up to ~5 minutes — instead of spinning short cycles.
- For work likely to exceed one wait cycle, require the child to send `WORKING: <task> - <current phase>` before long reading, testing, or review passes, and `BLOCKED: <reason>` only when it cannot progress.
- Track spawned agent names locally. Use `get_command_or_subagent_output` for mailbox signals, not proof of completion. A timeout only means no new mailbox update arrived. Treat a running child as alive.
- While children run, surface the active subagent count, agent names, and latest `WORKING:` phase.
- Fallback only when the child is completed without the deliverable, ack-only after `spawn_subagent (re-task: new prompt to same role)`, explicitly `BLOCKED:`, or no longer running. Then record inconclusive and respawn a smaller `background: true` task with the missing deliverable.
- Use `git-master` for git-tracked edits: inspect recent and touched-path commit history, then commit each verified work unit atomically in the repository's observed language, scope, and message style with only that unit's files staged. Never carry verified units into a later omnibus commit.

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

### Skill paths + reviewer spawn payload (Grok)

There is **no Skill tool**. LazyGrok skills live under `GROK_PLUGIN_ROOT`
(or `$HOME/.grok/installed-plugins/lazygrok-*`), **not** workspace `skills/`.

- Load skills with `read_file` on **absolute** catalog paths only.
- A UI chip `Skill <name>` without a successful absolute `read_file` does not count.
- Before spawning `lazygrok-code-reviewer` / `lazygrok-gate-reviewer` / QA
  reviewers, the **parent** must:
  1. Write the full base…HEAD diff to disk (`git diff … > /tmp/ulw-review.diff`).
  2. Resolve `PLUGIN_ROOT` and paste absolute skill paths into the child prompt:
     `$PLUGIN_ROOT/skills/remove-ai-slops/SKILL.md` and
     `$PLUGIN_ROOT/vendor/lazygrok-skills/programming/SKILL.md`.
  3. Pass goal, criteria, evidence paths, changed files, notepad path, and
     report path under `.lazygrok/evidence/`.
- Reviewer agents include `run_terminal_command` for read-only git fallback;
  never tell them to use MCP `bash`/`Shell`.

If an example uses a foreign tool name, use the Grok tools table above instead.


