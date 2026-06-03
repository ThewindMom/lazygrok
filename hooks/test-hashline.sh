#!/usr/bin/env bash
set -euo pipefail
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HASHLINE_PY="${HOOKS_DIR}/lib/hashline.py"
NIBBLE='[ZPMQVRWSNKTXJBYH]'

# Golden from omo hashline-core: computeLineHash(1, "  hello  ") -> ST
result="$(python3 "$HASHLINE_PY" compute 1 "  hello  ")"
test "$result" = "1#ST" || { echo "golden hash mismatch: got $result want 1#ST"; exit 1; }

# Trailing whitespace ignored (trimEnd)
h1="$(python3 "$HASHLINE_PY" compute 1 "function hello() {")"
h2="$(python3 "$HASHLINE_PY" compute 1 "function hello() {  ")"
test "$h1" = "$h2" || { echo "trimEnd mismatch: $h1 vs $h2"; exit 1; }

# Non-significant lines mix line number into seed
p1="$(python3 "$HASHLINE_PY" compute 1 "{}")"
p2="$(python3 "$HASHLINE_PY" compute 2 "{}")"
test "$p1" != "$p2" || { echo "expected different hashes for {} on lines 1 and 2"; exit 1; }

# format_hash_line via python -c
formatted="$(python3 -c "
import sys
sys.path.insert(0, '${HOOKS_DIR}/lib')
from hashline import format_hash_line
print(format_hash_line(42, 'const x = 42'))
")"
echo "$formatted" | rg -q '^42#'"${NIBBLE}"'{2}\|const x = 42$' || {
  echo "format_hash_line mismatch: $formatted"
  exit 1
}

# HASHLINE_DICT length and charset
python3 -c "
import sys
sys.path.insert(0, '${HOOKS_DIR}/lib')
from hashline import HASHLINE_DICT, NIBBLE_STR
assert len(NIBBLE_STR) == 16
assert len(HASHLINE_DICT) == 256
for entry in HASHLINE_DICT:
    assert len(entry) == 2
    assert all(c in NIBBLE_STR for c in entry)
"

# --- Task 7: read cache + PreToolUse stale guard ---
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${HOOKS_DIR}/lib/common.sh"
# shellcheck source=lib/hashline.sh
source "${HOOKS_DIR}/lib/hashline.sh"

export GROK_HOME="${GROK_HOME:-$(resolve_grok_home)}"
export GROK_SESSION_ID="test-hashline-hook-$$"
export OMG_HASHLINE=1

ws="$(mktemp -d)"
export GROK_WORKSPACE_ROOT="$ws"
trap 'rm -rf "$ws" "$(hashline_cache_dir)"' EXIT

printf 'hello world\n' >"${ws}/foo.ts"
update_cache_from_read "${ws}/foo.ts"

good_hash="$(python3 "$HASHLINE_PY" compute 1 "hello world")"
good_tag="${good_hash#*#}"

# Stale anchor -> deny
printf '%s\n' '{"hookEventName":"PreToolUse","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$GROK_WORKSPACE_ROOT"'","toolName":"StrReplace","toolInput":{"path":"foo.ts","old_string":"1#ZZ\nhello world","new_string":"hi\nhello world"}}' \
  | GROK_HOOK_EVENT=pre_tool_use bash "${HOOKS_DIR}/run-hook.sh" pre-tool-mutate.sh >"${ws}/deny.json" || true
rg -q '"decision":"deny"' "${ws}/deny.json" || { echo "expected deny for stale hash"; cat "${ws}/deny.json"; exit 1; }
rg -q 'stale LINE#ID' "${ws}/deny.json" || { echo "expected stale message"; cat "${ws}/deny.json"; exit 1; }

# Matching anchor -> allow (skill gate satisfied)
reset_session_state
mark_skill_loaded "agent-skill-gate"
printf '%s\n' '{"hookEventName":"PreToolUse","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$GROK_WORKSPACE_ROOT"'","toolName":"StrReplace","toolInput":{"path":"foo.ts","old_string":"1#'"${good_tag}"'\nhello world","new_string":"hi\nhello world"}}' \
  | GROK_HOOK_EVENT=pre_tool_use bash "${HOOKS_DIR}/run-hook.sh" pre-tool-mutate.sh >"${ws}/allow.json"
rg -q '"decision":"allow"' "${ws}/allow.json" || { echo "expected allow for fresh hash"; cat "${ws}/allow.json"; exit 1; }

# UserPrompt surfaces HASHLINE_CACHE
printf '%s\n' '{"hookEventName":"UserPromptSubmit","sessionId":"'"$GROK_SESSION_ID"'","workspaceRoot":"'"$GROK_WORKSPACE_ROOT"'","prompt":"continue"}' \
  | GROK_HOOK_EVENT=user_prompt_submit bash "${HOOKS_DIR}/run-hook.sh" user-prompt.sh >"${ws}/prompt.json"
rg -q 'HASHLINE_CACHE' "${ws}/prompt.json" || { echo "missing HASHLINE_CACHE"; cat "${ws}/prompt.json"; exit 1; }
rg -q 'foo.ts' "${ws}/prompt.json" || { echo "missing cached path in prompt"; cat "${ws}/prompt.json"; exit 1; }

echo "hashline: OK"