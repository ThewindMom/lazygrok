# Installation

## Requirements

- [Grok Build CLI](https://github.com/xai-org/grok) with plugin support (`grok plugin install`, `grok plugin enable`)
- Network access to GitHub for `github:mihazs/lazygrok`

Hooks ship as prebuilt **`bin/lazygrok-hook-*`** binaries (no Python required). **superpowers** skills are bundled under `vendor/superpowers/skills/` — no separate superpowers install required. Optional: **`grok`** for skill catalog refresh (`grok inspect --json`); **`node`** for LSP post-edit diagnostics when using the bundled LSP MCP.

## Install from GitHub

```bash
grok plugin install github:mihazs/lazygrok --trust
grok plugin enable lazygrok
```

Pinned to a release (see [Releases](https://github.com/mihazs/lazygrok/releases)):

```bash
grok plugin install github:mihazs/lazygrok@v0.1.0 --trust
grok plugin enable lazygrok
```

## Local development

```bash
git clone https://github.com/mihazs/lazygrok.git
cd lazygrok
grok plugin install "$(pwd)" --trust
grok plugin enable lazygrok
```

After hook or skill changes:

```bash
bash scripts/build-hook.sh   # maintainers: refresh bin/lazygrok-hook-*
grok plugin update lazygrok
# or: grok plugin install "$(pwd)" --trust
```

Start a **new Grok session** or reload hooks in the TUI (`Ctrl+L` → Hooks). Hooks do not always hot-reload mid-session.

## Migrate from global copies

If you previously copied hooks or skills into `~/.grok/hooks/` or `~/.grok/rules/`:

```bash
bash scripts/remove-global-overlays.sh
grok plugin install github:mihazs/lazygrok --trust
grok plugin enable lazygrok
```

Removed files are archived under `~/.grok/archive/removed-global-lazygrok-<date>/`.

## Verify install

```bash
grok plugin validate .
grok inspect   # should list lazygrok skills
```

Hook smoke tests (from a clone):

```bash
export GROK_PLUGIN_ROOT="$(pwd)"
for t in hooks/test-*.sh; do
  case "$(basename "$t")" in test-inline-skill-gate.sh|test-support.sh) continue ;; esac
  bash "$t"
done
```