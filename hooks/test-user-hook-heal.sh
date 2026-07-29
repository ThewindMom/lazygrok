#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_HOME="$(mktemp -d /tmp/lazygrok-user-hook-heal.XXXXXX)"
trap 'rm -rf -- "$TEST_HOME"' EXIT

mkdir -p "$TEST_HOME/.grok/hooks"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' > "$TEST_HOME/.grok/hooks/lazygrok-run.sh"
chmod 0755 "$TEST_HOME/.grok/hooks/lazygrok-run.sh"
cat > "$TEST_HOME/.grok/hooks/lazygrok.json" <<'JSON'
{
  "_lazygrokUserHooks": {
    "version": 4,
    "dynamicPluginRoot": true,
    "fullMirror": true
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash stale-runner shim bootstrap session-start"
          }
        ]
      }
    ]
  }
}
JSON

printf '%s' '{}' |
  HOME="$TEST_HOME" GROK_PLUGIN_ROOT="$ROOT" \
    bash "$ROOT/hooks/run-hook.sh" session-start >/dev/null

node - "$TEST_HOME/.grok/hooks/lazygrok.json" <<'NODE'
const fs = require("node:fs");
const bridge = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const commands = Object.values(bridge.hooks)
  .flatMap((groups) => groups)
  .flatMap((group) => group.hooks)
  .map((hook) => hook.command);
if (commands.length !== 34) throw new Error(`expected 34 hooks, got ${commands.length}`);
if (commands.some((command) => command.includes("bootstrap session-start"))) {
  throw new Error("stale bootstrap hook survived SessionStart healing");
}
NODE

echo "user-hook update heal: OK"
