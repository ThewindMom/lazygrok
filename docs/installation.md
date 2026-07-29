# Installation

## Requirements

- [Grok Build CLI](https://github.com/xai-org/grok) with plugin support (`grok plugin install`, `grok plugin enable`)
- Network access to GitHub for `ThewindMom/lazygrok`

Hooks ship as prebuilt **`bin/lazygrok-hook-*`** binaries (no Python required).
The inactive upstream superpowers source tree is not registered in
`plugin.json`. Node is required for the bundled LazyCodex hook components and
LSP MCP servers.

Full ULW state/evidence persistence and LSP workspace mutation are supported on
Linux. macOS and Windows builds fail those sensitive mutations closed until
equivalent descriptor/handle anchoring is available.

## Install from GitHub

The current plugin release is **0.4.4**. Grok's verified GitHub shorthand is
`owner/repository[@ref]`:

```bash
grok plugin install ThewindMom/lazygrok@v0.4.4 --trust
grok plugin enable lazygrok
```

To follow the repository default branch instead:

```bash
grok plugin install ThewindMom/lazygrok --trust
grok plugin enable lazygrok
```

## Local development

```bash
git clone https://github.com/ThewindMom/lazygrok.git
cd lazygrok
grok plugin install "$(pwd)" --trust
grok plugin enable lazygrok
```

## First-install bootstrap

Run this once after the first install. It creates the user-hook bridge needed
by Grok 0.2.x load ordering and copies the two ULW workflow panels:

```bash
PLUGIN="$(find "$HOME/.grok/installed-plugins" -maxdepth 1 -type d -name 'lazygrok-*' -print | sort | tail -1)"
test -n "$PLUGIN"
node "$PLUGIN/scripts/install-user-hooks.mjs"
mkdir -p "$HOME/.grok/workflows"
cp -f "$PLUGIN/docs/examples/ulw-discover.rhai" "$HOME/.grok/workflows/"
cp -f "$PLUGIN/docs/examples/ulw-review.rhai" "$HOME/.grok/workflows/"
```

The bridge resolves the current installed snapshot dynamically, so routine
`grok plugin update lazygrok` does not require reinstalling it. Re-copy the
workflow files after an update when their shipped contents change.

After hook or skill changes:

```bash
bash scripts/build-hook.sh   # maintainers: refresh bin/lazygrok-hook-*
grok plugin update lazygrok
# or: grok plugin install "$(pwd)" --trust
```

Start a **new Grok session** or reload hooks in the TUI (`Ctrl+L` → Hooks). Hooks do not always hot-reload mid-session.

## Migrate from global copies

If you need to replace LazyGrok's user-hook bridge:

```bash
bash scripts/remove-global-overlays.sh
grok plugin install ThewindMom/lazygrok@v0.4.4 --trust
grok plugin enable lazygrok
PLUGIN="$(find "$HOME/.grok/installed-plugins" -maxdepth 1 -type d -name 'lazygrok-*' -print | sort | tail -1)"
test -n "$PLUGIN"
node "$PLUGIN/scripts/install-user-hooks.mjs"
```

Removed files are archived under `~/.grok/archive/removed-global-lazygrok-<date>/`.

## Verify install

```bash
grok plugin validate .
grok plugin details lazygrok
grok inspect
python3 scripts/audit-hooks.py full
```

Hook smoke tests (from a clone):

```bash
export GROK_PLUGIN_ROOT="$(pwd)"
for t in hooks/test-*.sh; do
  case "$(basename "$t")" in test-inline-skill-gate.sh|test-support.sh) continue ;; esac
  bash "$t"
done
```
