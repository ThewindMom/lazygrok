#!/usr/bin/env bash
# Proactive skill gate on UserPromptSubmit (catalog refresh + matched paths).
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=test-support.sh
source "${HOOKS_DIR}/test-support.sh"

export GROK_HOME="${GROK_HOME:-$(resolve_grok_home)}"
export GROK_PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-$(plugin_root)}"
export GROK_WORKSPACE_ROOT="$(cd "${HOOKS_DIR}/.." && pwd)"
export GROK_SESSION_ID="test-skill-proactive-$$"
trap 'rm -rf "${GROK_HOME}/state/skill-gate/${GROK_SESSION_ID}"' EXIT

payload='{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$GROK_WORKSPACE_ROOT"'","prompt":"design and implement a new hook feature"}'

out="$(printf '%s\n' "$payload" | bash "${HOOKS_DIR}/run-hook.sh" user-prompt)"
echo "$out" | rg -q 'AGENT_SKILL_GATE_PROACTIVE' || {
  echo "missing AGENT_SKILL_GATE_PROACTIVE"
  echo "$out"
  exit 1
}
echo "$out" | rg -q 'Read tool|skill_information' || {
  echo "missing Grok Composer guidance"
  exit 1
}
test -s "${GROK_HOME}/state/skill-gate/${GROK_SESSION_ID}/all-skills.json" || {
  echo "catalog not created on user-prompt"
  exit 1
}

echo "skill-proactive: OK"