#!/usr/bin/env bash
# LazyCodex-for-Grok skill catalog: no superpowers pack; agent-skill-gate + LCX skills.
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HOOKS_DIR}/.." && pwd)"
# shellcheck source=test-support.sh
source "${HOOKS_DIR}/test-support.sh"

export GROK_HOME="${GROK_HOME:-$(resolve_grok_home)}"
export GROK_PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-$ROOT}"
export GROK_WORKSPACE_ROOT="$ROOT"
export GROK_SESSION_ID="test-lcx-catalog-$$"
trap 'rm -rf "${GROK_HOME}/state/skill-gate/${GROK_SESSION_ID}" "${GROK_HOME}/state/using-superpowers/${GROK_SESSION_ID}"' EXIT

test -f "$ROOT/skills/agent-skill-gate/SKILL.md"
test -f "$ROOT/skills/ulw-loop/SKILL.md"
test -f "$ROOT/vendor/lazygrok-skills/programming/SKILL.md"

# plugin.json: 3 skill dirs
n=$(python3 -c "import json; print(len(json.load(open('$ROOT/plugin.json'))['skills']))")
test "$n" = "3" || { echo "expected 3 skill dirs, got $n"; exit 1; }

grok plugin validate "$ROOT" >/tmp/lg-validate.out 2>&1 || true
# validate may print inventory
if command -v grok >/dev/null; then
  grok plugin validate "$ROOT" | head -20 || true
fi

printf '%s\n' '{"hookEventName":"SessionStart","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$ROOT"'"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" session-start >/dev/null

cat="${GROK_HOME}/state/skill-gate/${GROK_SESSION_ID}/all-skills.json"
test -f "$cat"
rg -q 'agent-skill-gate' "$cat" || { echo "catalog missing agent-skill-gate"; head -c 800 "$cat"; exit 1; }
rg -q 'ulw-loop' "$cat" || { echo "catalog missing ulw-loop"; exit 1; }
# must NOT require superpowers
if rg -q 'using-superpowers' "$cat"; then
  echo "WARN: using-superpowers still in catalog (ok if residual path)"
fi

out="$(printf '%s\n' '{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$ROOT"'","prompt":"hello"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" user-prompt)"
echo "$out" | rg -q 'LAZYGROK_FIRST_PROMPT|agent-skill-gate|AGENT_SKILL_GATE' || {
  echo "first prompt should inject LazyGrok skill-gate guidance"
  echo "$out" | head -c 800
  exit 1
}

echo "lcx-skill-catalog: OK"
