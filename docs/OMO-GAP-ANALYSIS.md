# Historical OMO Parity Gap Analysis

> **Archived baseline:** The inventory below predates the LazyCodex 4.19.3
> parity port and is retained only to explain the project’s original gap
> assessment. It is not a description of the current plugin.
>
> For the shipped state, use the
> [4.19.3 delta receipt](lazycodex-4.19.3-port-receipt.md), its
> [verification record](verification/lazycodex-4.19.3-final.md), and the
> [README harness map](../README.md#grok-harness-map).

## Current 4.19.3 status

LazyGrok now exposes 22 agents and ships Grok-adapted comment-checker, scoped
rules/AGENTS handling, durable boulder/start-work/ULW evidence state, model
catalog/config surfaces, prompt variants, LSP core/daemon/tools, CodeGraph,
executor verification, and review gates.

The remaining differences are host boundaries rather than unfinished ports:
Grok Build has no LazyCodex durable team mailbox/task bus, Grok/Linux does not
provide `git_bash`, and Grok has no native local-raster `view_image` surface.
Worktree isolation is used for PR/branch review, conflicting parallel edits,
or explicitly isolated children; ordinary `ulw` work stays in the current
checkout when isolation adds no safety.

---

## Archived pre-4.19.3 baseline

The following sections record what LazyGrok lacked when this analysis was
originally written. Items marked as gaps or recommended work may now be
implemented; they must not be used as current product claims.

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
| Cross-platform builds | ⚠️ binaries build on 5 targets; descriptor-anchored state/evidence and LSP mutations are Linux-only and fail closed elsewhere |
| LSP integration | ✅ v4.19.3 LSP core, daemon, and tools MCP; in-flight JSON-RPC cancellation rebuilt and tested |
| LazyCodex skill surface | ✅ Registered Grok-adapted programming, debugging, frontend, review, start-work, ULW, LSP, and research skills |
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

6. **Prompt variants** — OMO has model-specific prompt variants (atlas/gemini,
   atlas/glm, atlas/gpt, ultrawork/codex, etc.). We use `model: inherit`.

### Medium-impact gaps (partially achievable)

7. **Team mode** — OMO has `team-core` with tmux-based multi-pane team
   orchestration, team mailbox, team tasklist, team worktree management.
   Grok doesn't support tmux or multi-pane, but we could approximate
   team coordination via subagent orchestration.

8. **Model core** — OMO has 60 source files for model catalog management,
    model routing, capability detection. We just use `model: inherit`.

9. **MCP stdio core** — OMO has a reusable MCP stdio server framework.
    We have a hand-rolled one in `internal/mcp/hashline/server.go`.

### Low-impact gaps (not achievable within Grok APIs)

10. **tmux-core** — OMO uses tmux for team member panes. Grok doesn't
    support tmux integration.

11. **Web dashboard** — OMO has a Next.js web app. Out of scope.

12. **Telemetry core** — OMO has telemetry. We explicitly don't add telemetry.

13. **Platform binaries** — OMO ships pre-built platform binaries. We build
    from Go source which is better for reproducibility.

## Historical recommendations

1. Implement comment checker (blocks AI-generated comments)
2. Upgrade boulder state to support multiple work records with full metadata
3. Add scoped AGENTS.md injection with nearest-file precedence
4. Add delegate core with retry guidance for subagent failures
5. Add model selection guidance (without hard-coding model names)
6. Add prompt variants for different model families
