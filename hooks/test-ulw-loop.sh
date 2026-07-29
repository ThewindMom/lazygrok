#!/usr/bin/env bash
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=test-support.sh
source "${HOOKS_DIR}/test-support.sh"

export GROK_HOME="${GROK_HOME:-$(resolve_grok_home)}"
export GROK_SESSION_ID="test-ulw-split-$$"

tmpdir="$(mktemp -d)"
export GROK_WORKSPACE_ROOT="$tmpdir"
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/.lazygrok"

# Given: a ULW goal-ledger command reaches the merged UserPromptSubmit hook.
printf '%s\n' '{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$GROK_WORKSPACE_ROOT"'","prompt":"/ulw-loop \"ship feature\""}' \
  | GROK_HOOK_EVENT=user_prompt_submit bash "${HOOKS_DIR}/run-hook.sh" user-prompt \
  >"${tmpdir}/ulw.json"

# Then: the legacy Ralph runtime does not claim it or create Ralph state.
test ! -f "${tmpdir}/.lazygrok/ralph-loop.local.md" \
  || { echo "/ulw-loop created legacy Ralph state"; cat "${tmpdir}/.lazygrok/ralph-loop.local.md"; exit 1; }

# When: the legacy Ralph command reaches the same hook.
printf '%s\n' '{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$GROK_WORKSPACE_ROOT"'","prompt":"/ralph-loop \"ship feature\" --max-iterations=5"}' \
  | GROK_HOOK_EVENT=user_prompt_submit bash "${HOOKS_DIR}/run-hook.sh" user-prompt \
  >"${tmpdir}/ralph.json"

# Then: Ralph still owns its continuation state and injects non-empty context.
jq -e '.additionalContext | type == "string" and length > 0' "${tmpdir}/ralph.json" >/dev/null \
  || { echo "ralph start failed:"; cat "${tmpdir}/ralph.json"; exit 1; }
test -f "${tmpdir}/.lazygrok/ralph-loop.local.md" \
  || { echo "Ralph state file missing"; exit 1; }
rg -q 'ultrawork: false' "${tmpdir}/.lazygrok/ralph-loop.local.md" \
  || { cat "${tmpdir}/.lazygrok/ralph-loop.local.md"; exit 1; }

echo "ulw/Ralph split hooks: OK"
