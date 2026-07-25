#!/usr/bin/env bash
# Bundled superpowers: plugin.json skill dirs + using-superpowers path + catalog discovery.
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HOOKS_DIR}/.." && pwd)"
# shellcheck source=test-support.sh
source "${HOOKS_DIR}/test-support.sh"

export GROK_HOME="${GROK_HOME:-$(resolve_grok_home)}"
export GROK_PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-$ROOT}"
export GROK_WORKSPACE_ROOT="$ROOT"
export GROK_SESSION_ID="test-bundled-sp-$$"
trap 'rm -rf "${GROK_HOME}/state/skill-gate/${GROK_SESSION_ID}" "${GROK_HOME}/state/using-superpowers/${GROK_SESSION_ID}"' EXIT

bundled="${ROOT}/vendor/superpowers/skills/using-superpowers/SKILL.md"
test -f "$bundled" || {
  echo "missing bundled using-superpowers; run: task vendor:superpowers"
  exit 1
}

grok plugin validate "$ROOT" | rg -q '5 skill dir' || {
  echo "plugin.json should declare 5 skill directories"
  grok plugin validate "$ROOT"
  exit 1
}

printf '%s\n' '{"hookEventName":"SessionStart","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$ROOT"'"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" session-start >/dev/null

rg -q 'using-superpowers' "${GROK_HOME}/state/skill-gate/${GROK_SESSION_ID}/all-skills.json" || {
  echo "catalog missing bundled using-superpowers"
  head -c 500 "${GROK_HOME}/state/skill-gate/${GROK_SESSION_ID}/all-skills.json"
  exit 1
}

out="$(printf '%s\n' '{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$ROOT"'","prompt":"hello"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" user-prompt)"
echo "$out" | rg -q 'USING_SUPERPOWERS_FIRST_PROMPT' || {
  echo "first prompt should inject bundled using-superpowers"
  exit 1
}

echo "bundled-superpowers: OK"
