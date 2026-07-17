# OMO Parity Gap Analysis

This document analyzes the gap between lazygrok and Oh My OpenAgent (OMO),
identifying what can be brought to parity within Grok's plugin API constraints.

## What lazygrok already has (implemented)

| Feature | Status |
|---------|--------|
| 9 specialist agents | ✅ Native Grok agents |
| Hashline MCP (read + edit) | ✅ Full implementation |
| Ralph loop | ✅ Bounded continuation |
| Ultrawork loop | ✅ Bounded continuation |
| Boulder state | ✅ Basic (single work record) |
| Todo continuation | ✅ Via existing hooks |
| Plan mode | ✅ Prometheus agent + /plan command |
| Start-work | ✅ Atlas agent + /start-work command |
| Handoff | ✅ /handoff command + skill |
| Stop/resume continuation | ✅ Explicit stop/resume |
| 14 lifecycle hooks | ✅ All Grok events registered |
| Typed config | ✅ JSONC with precedence |
| Atomic state | ✅ Versioned, locked, migrated |
| 10 original skills | ✅ No SUL-covered text |
| Agent validator | ✅ Frontmatter + policy checks |
| Doctor command | ✅ Diagnostics without secrets |
| Cross-platform builds | ✅ 5 platforms + checksums |
| No telemetry | ✅ Documented policy |
| License inventory | ✅ THIRD-PARTY-NOTICES + manifest |

## What OMO has that lazygrok lacks

### High-impact gaps (achievable within Grok APIs)

1. **Comment checker** — OMO has `comment-checker-core` that detects AI-generated
   comments ("Great function!", "This does X") and blocks them. We have a
   `commentPolicy` config field but no implementation.

2. **Delegate core** — OMO has `delegate-core` with model selection logic and
   retry patterns for subagent delegation. We delegate but don't have smart
   model routing or retry guidance.

3. **AGENTS.md injection** — OMO has `agents-md-core` that discovers and injects
   scoped AGENTS.md files from workspace root to target path with nearest-file
   precedence. We have `internal/workspace/rules.go` but it's basic.

4. **Rules engine** — OMO has a full `rules-engine` package with 44 source files.
   We have basic rules in `rules/` but no engine.

5. **Boulder state upgrade** — OMO's boulder supports multiple work records,
   task dependencies, task owners, child subagent IDs, attempt counts,
   verification evidence, completion reason, pause reason, failure reason.
   Ours is basic.

6. **More skills** — OMO has skills for: ast-grep, debugging (with runtime
   references), frontend, git-master, init-deep, lsp-setup, programming
   (Go/Python/Rust/TS references), refactor, remove-ai-slops, review-work,
   start-work, ultimate-browsing, ultraresearch, ulw-plan, visual-qa.
   We have 10 skills; OMO has ~20.

7. **Prompt variants** — OMO has model-specific prompt variants (atlas/gemini,
   atlas/glm, atlas/gpt, ultrawork/codex, etc.). We use `model: inherit`.

### Medium-impact gaps (partially achievable)

8. **Team mode** — OMO has `team-core` with tmux-based multi-pane team
   orchestration, team mailbox, team tasklist, team worktree management.
   Grok doesn't support tmux or multi-pane, but we could approximate
   team coordination via subagent orchestration.

9. **LSP integration** — OMO has full LSP core with 26+ source files, LSP
   daemon, and LSP tools MCP. We removed the vendored LSP (broken provenance).
   Could re-implement a Go-based LSP client.

10. **Model core** — OMO has 60 source files for model catalog management,
    model routing, capability detection. We just use `model: inherit`.

11. **MCP stdio core** — OMO has a reusable MCP stdio server framework.
    We have a hand-rolled one in `internal/mcp/hashline/server.go`.

### Low-impact gaps (not achievable within Grok APIs)

12. **tmux-core** — OMO uses tmux for team member panes. Grok doesn't
    support tmux integration.

13. **Web dashboard** — OMO has a Next.js web app. Out of scope.

14. **Telemetry core** — OMO has telemetry. We explicitly don't add telemetry.

15. **Platform binaries** — OMO ships pre-built platform binaries. We build
    from Go source which is better for reproducibility.

## Recommended next steps (priority order)

1. Implement comment checker (blocks AI-generated comments)
2. Upgrade boulder state to support multiple work records with full metadata
3. Add scoped AGENTS.md injection with nearest-file precedence
4. Add more skills (debugging with runtime refs, programming refs, review-work)
5. Add delegate core with retry guidance for subagent failures
6. Add model selection guidance (without hard-coding model names)
7. Re-implement LSP integration as a Go-based MCP (clean-room)
8. Add prompt variants for different model families
