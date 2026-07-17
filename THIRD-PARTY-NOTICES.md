# Third-Party Notices

This file documents every third-party component redistributed within the
lazygrok plugin, its license, upstream source, and the exact version or
commit pinned.

lazygrok is MIT-licensed (see `LICENSE`), but it redistributes components
under other licenses. This file preserves the notices required by each.

---

## 1. obra/superpowers (skills)

- **Path**: `vendor/superpowers/`
- **Upstream**: https://github.com/obra/superpowers.git
- **Version**: v5.1.0 (pinned in `vendor/superpowers/VERSION`)
- **Source URL**: recorded in `vendor/superpowers/SOURCE`
- **License**: MIT — `vendor/superpowers/LICENSE`
- **Copyright**: (c) 2025 Jesse Vincent
- **Contents**: skill markdown files only (no executable code)
- **Modifications**: none

---

## 2. spf13/cobra (Go library)

- **Path**: `vendor/github.com/spf13/cobra/`
- **Upstream**: https://github.com/spf13/cobra
- **Version**: v1.8.1 (pinned in `go.mod`)
- **License**: Apache License 2.0 — `vendor/github.com/spf13/cobra/LICENSE.txt`
- **Use**: CLI command dispatch for the `lazygrok-hook` binary

## 3. spf13/pflag (Go library)

- **Path**: `vendor/github.com/spf13/pflag/`
- **Upstream**: https://github.com/spf13/pflag
- **Version**: v1.0.5 (pinned in `go.mod`)
- **License**: BSD 3-Clause — `vendor/github.com/spf13/pflag/LICENSE`
- **Copyright**: (c) 2012 Alex Ogier; (c) 2012 The Go Authors
- **Use**: flag parsing (transitive dependency of cobra)

## 4. inconshreveable/mousetrap (Go library)

- **Path**: `vendor/github.com/inconshreveable/mousetrap/`
- **Upstream**: https://github.com/inconshreveable/mousetrap
- **Version**: v1.1.0 (pinned in `go.mod`)
- **License**: Apache License 2.0 — `vendor/github.com/inconshreveable/mousetrap/LICENSE`
- **Use**: Windows console detection (transitive dependency of cobra)

---

## 5. oh-my-openagent MIT-licensed skills and agents

The following components are from the oh-my-openagent repository and are
MIT-licensed by Yeongyu Kim. Each carries its own LICENSE file.

- **Upstream**: https://github.com/code-yeongyu/oh-my-openagent
- **Source commit**: 48c58e63465ca214b0dcc7f2ef92016f052e9a44
- **License**: MIT — `vendor/omo-skills/*/LICENSE`
- **Copyright**: (c) 2026 Yeongyu Kim

### Skills copied (MIT):

| Skill | Path |
|-------|------|
| ast-grep | `vendor/omo-skills/ast-grep/` |
| lsp | `vendor/omo-skills/lsp/` |
| comment-checker | `vendor/omo-skills/comment-checker/` |
| ulw-plan | `vendor/omo-skills/ulw-plan/` |
| ulw-loop | `vendor/omo-skills/ulw-loop/` |
| rules | `vendor/omo-skills/rules/` |
| init-deep | `vendor/omo-skills/init-deep/` |
| teammode | `vendor/omo-skills/teammode/` |

### Skill copied (Apache-2.0):

| Skill | Path |
|-------|------|
| frontend | `vendor/omo-skills/frontend/` |

### Agent definitions copied (MIT, TOML format):

| Agent | Path |
|-------|------|
| librarian | `vendor/omo-agents/librarian.toml` |
| explorer | `vendor/omo-agents/explorer.toml` |
| momus | `vendor/omo-agents/momus.toml` |
| metis | `vendor/omo-agents/metis.toml` |
| plan | `vendor/omo-agents/plan.toml` |
| lazycodex-executor | `vendor/omo-agents/lazycodex-executor.toml` |
| lazycodex-code-reviewer | `vendor/omo-agents/lazycodex-code-reviewer.toml` |
| lazycodex-qa-executor | `vendor/omo-agents/lazycodex-qa-executor.toml` |
| lazycodex-gate-reviewer | `vendor/omo-agents/lazycodex-gate-reviewer.toml` |
| lazycodex-clone-fidelity-reviewer | `vendor/omo-agents/lazycodex-clone-fidelity-reviewer.toml` |

---

## Removed components

The following were present in earlier releases and have been removed for
licensing or provenance reasons:

- **ast-grep-mcp**: previously vendored from oh-my-openagent. The upstream
  package carries no per-file license and falls under the Sustainable Use
  License (SUL 1.0), which is incompatible with this MIT-licensed fork.
  Removed entirely. Structural search is not bundled.
- **lsp-tools-mcp**: previously vendored from oh-my-openagent. Although
  MIT-licensed upstream, the vendored copy lacked LICENSE, NOTICE, package.json,
  and SOURCE pins, and the build script was broken against the current OMO
  layout. Removed. LSP integration is documented as not bundled.

---

## oh-my-openagent (reference, not redistributed)

lazygrok is inspired by [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)
but does **not** redistribute its source, prompts, skills, or documentation.
Most OMO content is licensed under the Sustainable Use License 1.0, which is
incompatible with this fork. All OMO-like behavior is independently implemented
against documented behavior and public Grok interfaces.

---

## License summary

| Component | License | Redistributed |
|-----------|---------|---------------|
| lazygrok (this plugin) | MIT | — |
| obra/superpowers skills | MIT | yes (`vendor/superpowers/`) |
| spf13/cobra | Apache 2.0 | yes (`vendor/github.com/spf13/cobra/`) |
| spf13/pflag | BSD 3-Clause | yes (`vendor/github.com/spf13/pflag/`) |
| inconshreveable/mousetrap | Apache 2.0 | yes (`vendor/github.com/inconshreveable/mousetrap/`) |
| oh-my-openagent | SUL 1.0 | **no** (reference only) |
