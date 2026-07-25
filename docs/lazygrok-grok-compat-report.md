# Lazygrok × Grok compatibility audit

## Executive summary (counts + top 5 actions)

**Plugin:** `lazygrok-85b8f856` at `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856`  
**Scope:** 83 audited surface items (skills, commands, agents) from parallel audits  
**Confirmed blockers preferred** where adversarial verification ran.

| Status | Count | Meaning |
|--------|------:|---------|
| **runnable** | 51 | Works on Grok as written |
| **needs_adjust** | 30 | Intent OK after renames/docs/fallbacks |
| **broken** | 1 | Host feature Grok lacks (no substitute) |
| **n_a / unchecked** | 1 | Product-meta only (LazyCodex doctor) |

**Rough readiness:** ~61% runnable as-is; ~36% doc/API rename work; 1 hard host-gap (`teammode`); 1 n_a.

**Not bugs on Grok:** Missing `update_goal` / `create_goal` is normal when workflows are on; use `# Goal` markdown + `ulw-loop` CLI / boulder. MCP `tasks` is scheduled reminders, not ultrawork goals.

### Top 5 actions

1. **`commands/ulw-loop.md` (high)** — Add `<promise>DONE</promise>` + verifier + `<promise>VERIFIED</promise>`; align cancel/max-iter with skill (500, `/cancel-ralph`). Stop hooks key off promise tags; command currently will not complete the contract.
2. **`skills/prometheus-plan/SKILL.md` (high, confirmed)** — Replace every `Task(subagent_type=…)` with `spawn_subagent`; map `metis-consultant`→`metis`, `momus-reviewer`→`momus`; `Write+Edit`→`write`/`search_replace`.
3. **Reviewer agents write gap (high ×3)** — `lazygrok-code-reviewer`, `lazygrok-gate-reviewer`, `lazygrok-clone-fidelity-reviewer` instruct writing `.omo/evidence/*.md` with read-only tools. Add `write` (and prefer `.lazygrok/evidence/`) or return report in message only.
4. **Vendor foreign APIs cluster (high/medium)** — `refactor`, `debugging` (+ refs), `visual-qa`, `ultraresearch`, `start-work` (vendor): rewrite `Task`/`task`/`TodoWrite`/`bash(...)`/`team_*`/`computer_use` to Grok natives; fix Codex “don’t call spawn_subagent” headers (spawn_subagent **is** native on Grok).
5. **`teammode` (broken)** — Codex-only transport (`multi_agent_v2` / `codex_app`); self-contradictory spawn rules. Gate off Grok catalog or mark `n_a` until a `spawn_subagent` transport exists.

---

## Runnable as-is (51)

### Core ultrawork / loops
| Kind | Name | Notes |
|------|------|--------|
| skill | **ultrawork** | Grok-native: `todo_write`, `spawn_subagent`, codegraph/LSP, playwright-first; goals optional |
| skill | **ulw-evidence** | Missing update_goal treated as normal; shell CLI + `# Goal` |
| skill | **ralph-loop** | State file + `<promise>DONE</promise>`; no foreign tools |
| skill | **cancel-ralph** | Meta cancel via slash path |
| skill | **start-work-execution** | `spawn_subagent` + `.lazygrok/boulder.json` |
| command | **ultrawork** | spawn + boulder + momus; lighter than skill, OK |
| command | **ralph-loop** | Promise protocol present |
| command | **plan** | `.lazygrok` paths; informal spawn maps to `spawn_subagent` |
| command | **start-work** | Atlas + boulder under `.lazygrok/` |
| command | **resume-continuation** | `GROK_*` env + markers |
| command | **stop-continuation** | Grok stop marker |
| command | **handoff** | Write `.lazygrok/handoff.md` |

### Process / methodology (no host lock-in)
| Kind | Name |
|------|------|
| skill | writing-plans, brainstorming, test-driven, test-driven-development |
| skill | refactoring, remove-ai-slops, programming-references |
| skill | code-review, review-work, receiving-code-review |
| skill | verification-before-completion |
| skill | systematic-debugging (`skills/` + `vendor/superpowers/`) |
| skill | research, disciplined-implementation |
| skill | init-deep, repo-init, handoff, coding-agent-sessions |

### Git / shell / browser
| Kind | Name | Notes |
|------|------|--------|
| skill | git-master, git-workflow | git CLI only |
| skill | using-git-worktrees | shell worktree fallback |
| skill | finishing-a-development-branch | git/gh + chat menus |
| skill | ast-grep | `sg` / helper scripts via shell |
| skill | ultimate-browsing | agent-browser → playwright MCP |
| skill | frontend | router + CLI/playwright |

### Agents (Grok-aligned frontmatter/body)
| Name | Role |
|------|------|
| **atlas**, **sisyphus** | Coordinators; `spawn_subagent` + one-level depth |
| **explore**, **hephaestus**, **prometheus** | Search / implement / plan under `.lazygrok/` |
| **lazygrok-executor**, **lazygrok-qa-executor** | Implementation / QA leaves |
| **lazygrok-metis**, **lazygrok-momus** | Gap analysis / plan review |
| **librarian**, **metis**, **momus**, **oracle** | Research / review / judgment leaves |

---

## Needs adjustment (rename/docs/fallback) (30)

Grouped by theme. Prefer **confirmed** (✓) items first.

### A. Loop / plan contract (behavioral)
| Item | Sev | Issue | Fix |
|------|-----|--------|-----|
| **command `ulw-loop`** | **high** | No `<promise>DONE` / `VERIFIED`; cancel = `/stop-continuation`, max 25 vs skill’s `/cancel-ralph`, max 500 | Align body with `skills/ulw-loop`; require promise tags + verifier spawn |
| skill **ulw-loop** | medium | Default verifier `code-reviewer` ≠ installed `lazygrok-code-reviewer` | Rename default; show `spawn_subagent(subagent_type=…)` |
| skill **ulw-plan** | low | Parallel research + “boulder state” without tool/path | Document `spawn_subagent`, `todo_write`, `.lazygrok/boulder.json` / ulw-loop CLI |

### B. Claude Task / TodoWrite / Write renames (✓ confirmed where noted)
| Item | Sev | Issue | Fix |
|------|-----|--------|-----|
| skill **prometheus-plan** ✓ | **high** + medium | `Task(explore\|librarian\|metis-consultant\|momus-reviewer)`; skeleton Write+Edit | `spawn_subagent` + names `metis`/`momus`; `write`/`search_replace` |
| skill **executing-plans** ✓ | medium | `Create TodoWrite` | → `todo_write` |
| skill **refactor** ✓ | medium×4 + high | TodoWrite, Task, bash(), edit(), team_*, background_output; confusable Codex header | Full Grok rewrite; mark team path n_a; spawn_subagent is native |
| skill **subagent-driven-development** | medium | TodoWrite + Task in prompts | → `todo_write` / `spawn_subagent` |
| skill **requesting-code-review** | medium | Task tool + template header | → `spawn_subagent` (+ `lazygrok-code-reviewer`) |
| skill **dispatching-parallel-agents** | medium | `Task("...")` examples | → parallel `spawn_subagent` |
| skill **writing-skills** | medium | Checklist forces TodoWrite | → `todo_write` |
| skill **using-superpowers** | **high** | Mandates Skill tool + TodoWrite | Grok path: `read_file` SKILL.md (agent-skill-gate already overrides); rename todos |
| skill **hashline-edit** | medium/low | StrReplace / Read | → `search_replace` / `read_file` (hashline MCP optional) |
| skill **lsp** | medium | Write/StrReplace; CallMcpTool `lsp` | → write/search_replace; lazygrok-lsp / lsp tools |
| skill **agent-skill-gate** | medium/low | Mutating list Write/StrReplace/Shell/task() | → write, search_replace, run_terminal_command, spawn_subagent |

### C. Vendor Codex framing / wrong state roots
| Item | Sev | Issue | Fix |
|------|-----|--------|-----|
| skill **start-work** (vendor) | **high** + medium | `.omo/` plans/boulder/ledger; `codex:` session; computer_use QA ✓; confused compat table | Remap → `.lazygrok/`; Grok session ids; playwright/agent-browser; spawn_subagent native |
| skill **visual-qa** | **high** + medium | Body still `task(oracle, load_skills)`; view_image/look_at; lazycodex agent name; Codex header bans spawn_subagent | spawn_subagent + get_command_or_subagent_output; read_file images / playwright; retitle for Grok |
| skill **ultraresearch** | medium/low | Body `task()` + load_skills; header mislabels spawn_subagent | spawn_subagent workers; drop team_mode preference |
| skill **debugging** | **high** | Phase 3/4 refs: team_* + task(oracle) | Parallel spawn_subagent; no team_* |
| skill **lsp-setup** | medium/low | Config only Codex/OpenCode paths | Add `.lazygrok/lsp.json` |
| skill **programming** | low | `Read` tool + “load skill” | read_file; open SKILL.md paths |
| skill **comment-checker**, **rules** | low | Codex branding / env names | Rebrand; document CODEX_RULES_* still apply if true |
| skill **lcx-report-bug**, **lcx-contribute-bug-fix** | medium/low | Computer Use / Browser Use / `$omo:debugging` | playwright MCP; read_file debugging skill |

### D. Agents
| Item | Sev | Issue | Fix |
|------|-----|--------|-----|
| **lazygrok-code-reviewer** | **high** + medium | Write `.omo/evidence/…` without `write`; Skill load | Add write + `.lazygrok/evidence/` or message-only; inline criteria |
| **lazygrok-gate-reviewer** | **high** + medium | Same write + skill-load pattern | Same |
| **lazygrok-clone-fidelity-reviewer** | **high** | Write evidence without write tool | Same |
| **lazygrok-plan** | **high** + medium | Must spawn + write plan; tools omit write/spawn; intro forbids spawn; foreign names + computer-use | Align tools vs phases; parent-orchestrate **or** allow spawn+write; drop computer-use |
| **lazygrok-librarian** | medium | `webfetch`/`read`/`rg`; web tools not listed | web_fetch/open_page + web_search; read_file/grep |
| **explorer** | medium/low | Body `read`/`rg`/`glob`; omo sparkshell; Codex description | read_file/grep/list_dir + run_terminal_command |

---

## Broken / host-gap (no Grok substitute) (1)

| Item | Why broken | Viable substitute? |
|------|------------|-------------------|
| skill **teammode** (`vendor/lazygrok-skills/teammode`) | Transport only `multi_agent_v2` / `codex_app`; state under `.omo/teams/`; SKILL says create members with `spawn_subagent` **and** never substitute spawn_subagent — incoherent. Durable team threads need Codex APIs Grok lacks. | **No.** Parallel `spawn_subagent` + orchestrator journal is a **different** model (document as fallback in ultraresearch/debugging, not as teammode). **Gate off Grok** or mark `n_a` until a real Grok transport. |

---

## Commands & agents

### Commands (8)
| Status | Names |
|--------|--------|
| **runnable (7)** | ultrawork, ralph-loop, plan, start-work, resume-continuation, stop-continuation, handoff |
| **needs_adjust (1)** | **ulw-loop** — promise/verification contract missing (high); cancel/defaults drift (low) |

Commands are in good shape overall. **Only critical command fix: `ulw-loop`.**

### Agents (19)
| Status | Names |
|--------|--------|
| **runnable (13)** | atlas, explore, hephaestus, lazygrok-executor, lazygrok-metis, lazygrok-momus, lazygrok-qa-executor, librarian, metis, momus, oracle, prometheus, sisyphus |
| **needs_adjust (6)** | explorer; lazygrok-clone-fidelity-reviewer; lazygrok-code-reviewer; lazygrok-gate-reviewer; lazygrok-librarian; lazygrok-plan |

**Pattern:** Reviewer/plan agents still require **artifact writes under `.omo/evidence` or `.omo/plans` without write (and sometimes without spawn) in tools** — highest agent priority.

### n_a (unchecked)
| Item | Why |
|------|-----|
| skill **lcx-doctor** | LazyCodex/Codex CLI install doctor — wrong product surface for Grok Build coding. |

---

## Recommended fix order

### P0 — Correctness under Grok Stop / orchestration
1. `commands/ulw-loop.md` — promise DONE/VERIFIED + verifier agent + max-iter/cancel alignment with skill.
2. `skills/ulw-loop/SKILL.md` — default verifier → `lazygrok-code-reviewer`.
3. `skills/prometheus-plan/SKILL.md` — Task→spawn_subagent; agent name map; Write/Edit→write/search_replace.

### P1 — Agents that lie about tools
4. Reviewer trio: add `write` **or** message-only reports; `.omo`→`.lazygrok/evidence`; drop Skill-tool “load skill”.
5. `agents/lazygrok-plan.md` — resolve spawn/write vs frontmatter/intro; Grok tool names; no computer-use.
6. `agents/lazygrok-librarian.md` + `agents/explorer.md` — tool names + whitelist.

### P2 — High-traffic vendor skills
7. `vendor/.../refactor/SKILL.md` — TodoWrite/bash/Task/edit/team_* + Grok-native header.
8. `vendor/.../debugging/` + methodology refs — team_*/task(oracle)→spawn_subagent.
9. `vendor/.../visual-qa/SKILL.md` + `ultraresearch` — kill residual task(); fix Codex anti-spawn header.
10. `vendor/.../start-work/SKILL.md` — `.omo`→`.lazygrok`; computer_use caveat; session id wording.  
    Note: first-party `commands/start-work.md` + `start-work-execution` already Grok-OK.

### P3 — Bulk renames (mechanical)
11. TodoWrite→todo_write: executing-plans, subagent-driven-development, writing-skills, using-superpowers.
12. Task→spawn_subagent: requesting-code-review (+ template), dispatching-parallel-agents.
13. Read/StrReplace/Write/CallMcpTool: hashline-edit, lsp, agent-skill-gate, programming.
14. Branding: comment-checker, rules, lcx-*; lsp-setup `.lazygrok/lsp.json`.

### P4 — Host gap
15. **teammode** — exclude from Grok skill catalog / mark broken→n_a; document parallel spawn_subagent as the only multi-worker model.

### Explicit non-goals
- Do not treat missing `update_goal` as a plugin defect.
- Do not invent Skill tool support; agent-skill-gate + `read_file` is the Grok model.
- Prefer confirmed blockers when triaging PRs; medium “Codex branding only” items can wait.

---

## Counts

| Category | Count |
|----------|------:|
| runnable | 51 |
| needs_adjust | 30 |
| broken | 1 |
| unchecked (n_a) | 1 |
| **total** | **83** |
