# lazygrok

A Grok-native productivity plugin for Grok Build CLI, inspired by [Oh My OpenAgent](https://github.com/code-yeongyu/oh-my-openagent) but implemented independently against documented Grok Build APIs.

## What it provides

- **9 specialist agents**: Sisyphus (coordinator), Atlas (plan executor), Hephaestus (implementer), Prometheus (planner), Metis (gap analyst), Momus (reviewer), Oracle (judgment), Librarian (research), Explore (search)
- **Hashline MCP**: line-anchored file reading and editing with stale-anchor detection, overlap rejection, atomic writes, and unified diffs
- **Deterministic hooks**: 14 lifecycle event handlers with ordered pipelines
- **Continuation engine**: Ralph and Ultrawork loops with bounded iterations, cooldowns, and repeated-state detection
- **Structured configuration**: typed JSONC with env/workspace/user/default precedence
- **8 slash commands**: /ultrawork, /ulw-loop, /ralph-loop, /plan, /start-work, /handoff, /stop-continuation, /resume-continuation
- **10 original skills**: disciplined implementation, debugging, code review, git workflow, and more

## Installation

```bash
grok plugin install "$(pwd)" --trust
```

Or from GitHub:

```bash
grok plugin install mihazs/lazygrok --trust
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

This plugin is inspired by but does not redistribute SUL-covered Oh My OpenAgent source.

## Grok limitations

- Subagents are one level deep — leaf agents cannot spawn children
- Only `PreToolUse` hooks can block tool calls; all other hooks are passive
- Agent model IDs must exist in the user's Grok configuration
- No native output transformation (PostToolUse is passive)
