#!/usr/bin/env bash
# Ralph loop: workspace from GROK_WORKSPACE_ROOT when Stop stdin omits workspaceRoot.
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=test-support.sh
source "${HOOKS_DIR}/test-support.sh"

export GROK_HOME="${GROK_HOME:-$(resolve_grok_home)}"
export GROK_PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-$(plugin_root)}"
export GROK_WORKSPACE_ROOT="$(mktemp -d)"
export GROK_SESSION_ID="test-ralph-env-$$"
trap 'rm -rf "$GROK_WORKSPACE_ROOT"' EXIT

# Start loop without workspaceRoot in JSON (harness env only).
printf '%s\n' '{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","prompt":"/ralph-loop env workspace test"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" user-prompt >/dev/null

test -f "${GROK_WORKSPACE_ROOT}/.lazygrok/ralph-loop.local.md" || {
  echo "expected ralph-loop.local.md under GROK_WORKSPACE_ROOT"
  exit 1
}

# Stop with sessionId only — workspace from env.
out="$(printf '%s\n' '{"hookEventName":"Stop","sessionId":"'"$GROK_SESSION_ID"'","stopReason":"EndTurn","last_assistant_message":"still working"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" stop)"
echo "$out" | rg -q '"decision":"block"' || {
  echo "expected block when workspace comes from env, got: $out"
  exit 1
}

# completed must still block (Composer may send this instead of EndTurn).
out2="$(printf '%s\n' '{"hookEventName":"Stop","sessionId":"'"$GROK_SESSION_ID"'","stopReason":"completed","last_assistant_message":"still working"}' \
  | bash "${HOOKS_DIR}/run-hook.sh" stop)"
echo "$out2" | rg -q '"decision":"block"' || {
  echo "expected block for stopReason=completed, got: $out2"
  exit 1
}

echo "ralph-stop-env: OK"