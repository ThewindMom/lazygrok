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

test -f "$TEST_HOME/.grok/hooks/lazygrok-heal.json"

cat > "$TEST_HOME/.grok/hooks/lazygrok.json" <<'JSON'
{
  "_lazygrokUserHooks": {
    "version": 4,
    "dynamicPluginRoot": true,
    "fullMirror": true
  },
  "hooks": {}
}
JSON

HOME="$TEST_HOME" GROK_PLUGIN_ROOT="$ROOT" \
  bash "$TEST_HOME/.grok/hooks/lazygrok-run.sh" heal >/dev/null

HOME="$TEST_HOME" python3 "$ROOT/scripts/audit-hooks.py" inventory |
  grep -q '^FULL_MIRROR_OK=True$'

node - "$TEST_HOME/.grok/hooks/lazygrok-heal.json" <<'NODE'
const fs = require("node:fs");
const healer = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const commands = healer.hooks.SessionStart.flatMap((group) => group.hooks);
if (commands.length !== 1 || !commands[0].command.endsWith(" heal")) {
  throw new Error("durable SessionStart healer is missing");
}
NODE

echo "user-hook durable update heal: OK"
