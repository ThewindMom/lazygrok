# Grok-compat fix receipt

**Plugin:** `lazygrok-85b8f856`  
**Status:** complete — required gates clean (`verify.clean: true`)

## Summary counts

| Metric | Count |
|--------|------:|
| Shards | 9 (all `complete`) |
| Files changed | 41 |
| Skipped items | 6 (out of scope / intentional) |
| Residual hits | 12 (6 medium, 6 low) |
| Required-gate residuals | 0 |

**Gates satisfied:** `commands/ulw-loop` DONE→VERIFIED + `/cancel-ralph` + `lazygrok-code-reviewer`; `prometheus-plan` uses `spawn_subagent` + metis/momus + `.lazygrok`; reviewers write under `.lazygrok/evidence` with `write`; teammode n_a banner present.

## Files changed by shard

### p0-ulw-plan (3)
- `commands/ulw-loop.md`
- `skills/ulw-loop/SKILL.md`
- `skills/prometheus-plan/SKILL.md`

### p1-reviewers (3)
- `agents/lazygrok-code-reviewer.md`
- `agents/lazygrok-gate-reviewer.md`
- `agents/lazygrok-clone-fidelity-reviewer.md`

### p1-plan-lib-explorer (3)
- `agents/lazygrok-plan.md`
- `agents/lazygrok-librarian.md`
- `agents/explorer.md`

### p2-refactor-debug (5)
- `vendor/lazygrok-skills/refactor/SKILL.md`
- `vendor/lazygrok-skills/debugging/SKILL.md`
- `vendor/lazygrok-skills/debugging/references/methodology/02-investigate.md`
- `vendor/lazygrok-skills/debugging/references/methodology/04-oracle-triple.md`
- `vendor/lazygrok-skills/debugging/references/methodology/partial-runtime-evidence.md`

### p2-vqa-research-start (3)
- `vendor/lazygrok-skills/visual-qa/SKILL.md`
- `vendor/lazygrok-skills/ultraresearch/SKILL.md`
- `vendor/lazygrok-skills/start-work/SKILL.md`

### p3-superpowers (11)
- `vendor/superpowers/skills/executing-plans/SKILL.md`
- `vendor/superpowers/skills/dispatching-parallel-agents/SKILL.md`
- `vendor/superpowers/skills/requesting-code-review/SKILL.md`
- `vendor/superpowers/skills/requesting-code-review/code-reviewer.md`
- `vendor/superpowers/skills/subagent-driven-development/SKILL.md`
- `vendor/superpowers/skills/subagent-driven-development/implementer-prompt.md`
- `vendor/superpowers/skills/subagent-driven-development/spec-reviewer-prompt.md`
- `vendor/superpowers/skills/subagent-driven-development/code-quality-reviewer-prompt.md`
- `vendor/superpowers/skills/writing-skills/SKILL.md`
- `vendor/superpowers/skills/writing-skills/persuasion-principles.md`
- `vendor/superpowers/skills/using-superpowers/SKILL.md`

### p3-tools-gate (5)
- `skills/hashline-edit/SKILL.md`
- `skills/lsp/SKILL.md`
- `skills/agent-skill-gate/SKILL.md`
- `vendor/lazygrok-skills/lsp/SKILL.md`
- `vendor/lazygrok-skills/programming/SKILL.md`

### p3-branding-lcx (6)
- `vendor/lazygrok-skills/comment-checker/SKILL.md`
- `vendor/lazygrok-skills/rules/SKILL.md`
- `vendor/lazygrok-skills/lcx-report-bug/SKILL.md`
- `vendor/lazygrok-skills/lcx-contribute-bug-fix/SKILL.md`
- `vendor/lazygrok-skills/lsp-setup/SKILL.md`
- `skills/ulw-plan/SKILL.md`

### p4-teammode (2)
- `vendor/lazygrok-skills/teammode/SKILL.md`
- `vendor/omo-skills/teammode/SKILL.md`

### Skipped (out of scope / intentional)
- `skills/start-work-execution/SKILL.md` — already Grok-OK
- `using-superpowers/references/{copilot,codex,gemini}-tools.md` — platform mapping tables keep Claude names by design
- `writing-skills/anthropic-best-practices.md` — third-party docs
- Prose “Task N” / “Task 1” plan numbering (not Task tool)
- `skills/ulw-loop/SKILL.md` — already fixed in p0; residual only in references
- `vendor/lazygrok-hooks/teammode/skills/teammode/SKILL.md` — not in DETAIL scope

## Residual issues

| Severity | Path | Note |
|----------|------|------|
| medium | `skills/ulw-plan/references/full-workflow.md` | Still Codex MultiAgent + `.omo` plan paths; top-level SKILL prefers `.lazygrok` + `spawn_subagent` |
| medium | `skills/ulw-plan/scripts/scaffold-plan.mjs` | Scaffold hard-codes `.omo/` write root |
| medium | `vendor/lazygrok-skills/ulw-plan/SKILL.md` | Vendor still defaults to `.omo/` drafts/plans |
| medium | `vendor/lazygrok-skills/ulw-loop/references/full-workflow.md` | Vendor copy still Codex-native (`multi_agent_v1`, lazycodex reviewers) |
| medium | `prompts/mode/team.md` | OpenCode `team_*` tools; misleading without n_a gate |
| medium | `prompts/mode/hyperplan.md` | Orchestrates via `team_create`; Grok has no `team_*` transport |
| low | `vendor/lazygrok-hooks/ulw-loop/dist/cli.js` | Codex `create_goal` / `update_goal` handoff strings (ignore) |
| low | `vendor/lazygrok-skills/teammode/SKILL.md` | Body still docs `.omo/teams` under n_a banner (reference only) |
| low | `skills/ultrawork/SKILL.md` | Optional host `update_goal` / `create_goal` — OK |
| low | `vendor/superpowers/skills/using-superpowers/references/codex-tools.md` | Explicit Codex mapping reference |
| low | `hooks/hooks.json` | Foreign tool matchers for cross-harness intercept |
| low | `docs/lazygrok-grok-compat-report.md` | Historical audit inventory (ignore) |

**Follow-ups (medium):** Grok-align ulw-plan references + scaffold; gate or rewrite OpenCode `team_*` / hyperplan prompts; prefer catalog → `skills/` over vendor Codex copies for ulw-loop/ulw-plan.

## Recommended commit message

```
fix(grok-compat): align agent/skill tooling with Grok harness APIs

Replace foreign Task/TodoWrite/Write/StrReplace and Codex multi-agent
paths with spawn_subagent, todo_write, write/search_replace, and
.lazygrok across ulw-loop, prometheus-plan, reviewers, plan/lib/explorer,
vendor skills, and superpowers. Mark teammode n/a on Grok.

Required gates clean; residual medium items remain in ulw-plan
references/scaffold, vendor ulw copies, and OpenCode team/hyperplan prompts.
```
