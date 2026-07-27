#!/usr/bin/env bash
# First prompt injects LazyGrok skill-gate (not superpowers pack).
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${HOOKS_DIR}/.." && pwd)"
source "${HOOKS_DIR}/test-support.sh"

export GROK_HOME="${GROK_HOME:-$(resolve_grok_home)}"
export GROK_PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-$ROOT}"
export GROK_WORKSPACE_ROOT="$ROOT"
export GROK_SESSION_ID="test-first-prompt-$$"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir" "${GROK_HOME}/state/using-superpowers/${GROK_SESSION_ID}" "${GROK_HOME}/state/skill-gate/${GROK_SESSION_ID}"' EXIT

printf '%s\n' '{"hookEventName":"SessionStart","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$ROOT"'"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" session-start >/dev/null

printf '%s\n' '{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$ROOT"'","prompt":"hello"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" user-prompt > "${tmpdir}/first.json"
rg -q 'LAZYGROK_FIRST_PROMPT|agent-skill-gate' "${tmpdir}/first.json" || {
  echo "first prompt missing LazyGrok inject"; cat "${tmpdir}/first.json"; exit 1
}

printf '%s\n' '{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$ROOT"'","prompt":"hello again"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" user-prompt > "${tmpdir}/second.json"
if rg -q 'LAZYGROK_FIRST_PROMPT' "${tmpdir}/second.json"; then
  echo "second prompt must not re-inject first prompt block"
  exit 1
fi

echo "first-prompt skill-gate hook: OK"
