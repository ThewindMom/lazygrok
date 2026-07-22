# lazygrok

A Grok-native productivity plugin for Grok Build CLI, ported from [Oh My OpenAgent (OMO/lazycodex)](https://github.com/code-yeongyu/oh-my-openagent) v4.19.1 and adapted to Grok's APIs, tool names, and agent system.

## Parity with lazycodex v4.19.1

All 14 OMO components are vendored at **v4.19.1** (the latest release). The plugin tracks upstream lazycodex and is kept in sync through systematic gap analysis.

| Area | OMO (lazycodex) | lazygrok |
|------|-----------------|----------|
| Components | 14 at v4.19.1 | ✅ 14 at v4.19.1 |
| Hooks | 23 lifecycle hooks | ✅ 40 hook entries (all equivalents + Grok-native additions) |
| Skills | 25 skills | ✅ 27 native + 22 vendored + 9 omo-skills + 14 superpowers = 72 total |
| Agents | 12 agent roles | ✅ 19 agent definitions (12 ported + 7 Grok-native) |
| MCP servers | 5 (codegraph, git_bash, lsp, grep_app, context7) | ✅ 9 (all 5 + hashline, lazygrok-lsp, lazygrok-lsp-tools, lazygrok-lsp-daemon) |
| Slash commands | 4 | ✅ 8 |
| ulw-loop dist | v4.19.1 | ✅ v4.19.1 |

## What it provides

### Agents (19)

**Ported from OMO:** Sisyphus (coordinator), Atlas (plan executor), Hephaestus (implementer), Prometheus (planner), Metis (gap analyst), Momus (reviewer), Oracle (judgment), Librarian (research), Explore (search), Explorer (codebase search)

**Grok-native:** lazygrok-executor, lazygrok-code-reviewer, lazygrok-qa-executor, lazygrok-gate-reviewer, lazygrok-clone-fidelity-reviewer, lazygrok-plan, lazygrok-librarian, lazygrok-metis, lazygrok-momus

### Skills (72 total)

**27 Grok-native skills** in `skills/`:
- **Workflows:** ultrawork, ulw-loop, ulw-plan, ulw-evidence, ralph-loop, prometheus-plan, start-work-execution, init-deep, repo-init, handoff
- **Code quality:** code-review, review-work, disciplined-implementation, systematic-debugging, test-driven, refactoring, remove-ai-slops, git-master, git-workflow
- **Tools:** hashline-edit, lsp, programming-references, agent-skill-gate, cancel-ralph, research
- **Web:** ultimate-browsing (agent-browser + playwright MCP routing)
- **Sessions:** coding-agent-sessions (cross-platform session finder with Grok scanner)

**22 vendored OMO skills** in `vendor/lazygrok-skills/` (full copies with `agents/` and `references/`):
- programming, debugging, visual-qa, ultraresearch, start-work, lsp-setup, refactor, teammode, frontend, ast-grep, comment-checker, rules, ulw-plan, ulw-loop, ulw-research, lcx-doctor, lcx-report-bug, lcx-contribute-bug-fix, git-master, init-deep, review-work, remove-ai-slops

**9 stripped OMO skills** in `vendor/omo-skills/` (lightweight, no `agents/`)

**14 superpowers skills** in `vendor/superpowers/skills/` (from obra/superpowers v5.1.0)

### MCP Servers (9)

| Server | Purpose |
|--------|---------|
| `hashline` | Line-anchored file reading and editing with stale-anchor detection |
| `lazygrok-codegraph` | SQLite knowledge graph of symbols, edges, and files |
| `lazygrok-lsp` | Language Server Protocol diagnostics (ruff, pyright, etc.) |
| `lazygrok-lsp-tools` | LSP tools (navigation, symbols, rename) |
| `lazygrok-lsp-daemon` | Persistent LSP daemon for fast diagnostics |
| `git_bash` | Git operations via MCP |
| `grep_app` | Search across public GitHub repos via grep.app |
| `context7` | Up-to-date library documentation |
| `lsp` | Bundled LSP MCP server |

### Hooks (40 entries across 12 lifecycle events)

**SessionStart:** Go binary (ralph/boulder/LSP stash/skill gate), rules loader, bootstrap provisioning, telemetry, codegraph bootstrap
**UserPromptSubmit:** Go binary (ultrawork/ulw trigger detection), ultrawork steering, ulw-loop steering, rules matching
**PreToolUse:** Go binary (spawn guard, plan mode gate), git-bash recommendation, ulw-loop goal budget enforcement, ulw-loop spawn guard
**PostToolUse:** LSP diagnostics (Go + Node), comment-checker (Go + Node), rules matching, codegraph guidance, teammode thread title hygiene
**Stop:** Go binary (ralph/ulw-loop continuation), start-work continuation, ulw-loop stop-resume
**PostCompact:** Go binary, rules cache reset, LSP cache reset, git-bash reminder
**Plus:** PostToolUseFailure, PermissionDenied, SubagentStart, SubagentStop, SessionEnd, Notification

### Slash Commands (8)

`/ultrawork` `/ulw-loop` `/ralph-loop` `/plan` `/start-work` `/handoff` `/stop-continuation` `/resume-continuation`

### Continuation Engine

- **Ralph Loop:** autonomous work-until-done via Stop-hook continuations with bounded iterations, cooldowns, and repeated-state detection
- **Ultrawork Loop:** Ralph loop + mandatory Oracle verification before exit (`<promise>VERIFIED</promise>` gate)
- **ulw-loop v4.19.1:** structured goals (`goals.json`), evidence ledger (`ledger.jsonl`), checkpoints, steering, spawn guard, stop-resume with `.stuck` marker
- **Bare `ulw <task>` trigger:** recognized alongside `/ulw-loop` and `/ultrawork`

### Go Binary Hooks

The plugin ships a compiled Go binary (`bin/lazygrok-hook-linux-amd64`) for performance-critical hooks:
- Ralph/Ultrawork loop state management
- Boulder state tracking
- LSP diagnostic stash
- Skill gate enforcement
- Spawn guard (per-session fan-out cap, default 60)
- ulw-loop stop bridge (incomplete goals check)
- Comment-checker integration

### Epistemic Instrumentation

The `ultraresearch` skill includes a data-flow-lock gate requiring ≥2 independent source domains, ≥2 observation groups, counter-search, primary source verification, and temporal evidence before non-code claims are accepted.

## Installation

```bash
grok plugin install mihazs/lazygrok --trust
```

Or from a local clone:

```bash
grok plugin install "$(pwd)" --trust
```

## Uninstall

```bash
grok plugin uninstall lazygrok --confirm
```

This removes only plugin-owned files. It does not delete unrelated Grok files.

## Configuration

Configuration is loaded with this precedence (highest first):

1. Environment variables (`LAZYGROK_*`)
2. Workspace config: `.lazygrok/config.jsonc`
3. User config: `~/.grok/lazygrok/config.jsonc`
4. Built-in defaults

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the full reference.

## Privacy

This plugin does **not** transmit any data to external services. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Licensing

MIT licensed. See [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Vendored OMO components are used under their respective licenses. See `vendor/lazygrok-hooks/*/AGENTS.md` and `vendor/lazygrok-skills/*/ATTRIBUTION.md` for attribution.

## Grok limitations

- Subagents are one level deep — leaf agents cannot spawn children
- Only `PreToolUse` hooks can block tool calls; all other hooks are passive
- Agent model IDs must exist in the user's Grok configuration
- No native output transformation (PostToolUse is passive)

## Acknowledgments

- [Oh My OpenAgent (OMO/lazycodex)](https://github.com/code-yeongyu/oh-my-openagent) by code-yeongyu — the primary upstream this plugin ports from
- [obra/superpowers](https://github.com/obra/superpowers) — vendored skills (brainstorming, TDD, code review workflows)
- [agent-browser](https://github.com/anthropics/agent-browser) — browser automation for ultimate-browsing skill
