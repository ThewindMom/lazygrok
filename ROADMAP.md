# Roadmap

lazygrok targets **Grok Build CLI** only. It **complements** [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (OpenCode / Codex / multi-harness) — do not treat this repo as a fork or replacement.

## Shipped

- Plugin-only install (hooks, skills, rules, bundled MCP)
- Skill gate, Ralph / ultrawork loops, todo + boulder continuation, handoff
- **IntentGate** — keyword modes on UserPromptSubmit (`LAZYGROK_INTENT_GATE`)
- **Hashline** — read cache + PreToolUse stale `LINE#ID` guard (`LAZYGROK_HASHLINE`)
- **Prometheus** — `/plan`, plan-mode md-only guard, `/start-work` boulder bootstrap
- **LSP** — post-edit diagnostics stash + Stop enforcement (`LAZYGROK_LSP_ENFORCE`)
- **ast-grep MCP** — vendored `vendor/ast-grep-mcp` (structural search skill)
- **Todo enforcer** — 5s continuation cooldown + 3s abort window on Stop
- `.lazygrok/` workspace state (parallel to omo `.omo/`)
- Merged `UserPromptSubmit`, unified Stop chain
- CI hook smoke tests + release-please

## Near term

- [ ] Complete first GitHub Release via release-please Release PR
- [ ] Optional: `grok plugin validate` in CI when Grok CLI is available on runners
- [ ] Oracle / verifier subagent polish for `/ulw-loop` (documented defaults)
- [ ] GitHub Pages or docs site (homepage URL in repo settings)

## Mid term

- [ ] Additional skills (user-contributed patterns)
- [ ] Richer `plugin.json` discovery fields when Grok schema stabilizes
- [ ] Migration guide artifact for users with legacy `.grok/` workspace folders

## How to contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Areas:

| Area | Path |
|------|------|
| Hooks / stop order | `hooks/`, `hooks/lib/stop-chain.sh` |
| Slash commands | `hooks/lib/*.sh`, `hooks/user-prompt.sh` |
| Agent workflows | `skills/<name>/SKILL.md` |
| Always-on rules | `rules/*.md` |
| Docs | `docs/`, `README.md` |

PRs that change Stop priority must update `hooks/README.md` and tests.