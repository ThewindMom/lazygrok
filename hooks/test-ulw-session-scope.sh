#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT
TEST_HOME="$TEST_ROOT/home"
WORKSPACE="$TEST_ROOT/workspace"
mkdir -p "$TEST_HOME" "$WORKSPACE"
GROK_HOME="$TEST_HOME/configured-grok-home"
STATE="$GROK_HOME/state/lazygrok"
mkdir -m 700 "$GROK_HOME"
OUTPUT="$(
	(
		umask 022
		HOME="$TEST_HOME" GROK_HOME="$GROK_HOME" GROK_SESSION_ID="grok-session-scope-test" \
	node "$ROOT/hooks/lazygrok-ups-probe.mjs" ultrawork user-prompt-submit <<EOF
{"hookEventName":"user_prompt_submit","sessionId":"grok-session-scope-test","cwd":"$WORKSPACE","workspaceRoot":"$WORKSPACE","prompt":"secret=do-not-persist; verify ulw session scope"}
EOF
	)
)"
node -e '
const output = JSON.parse(process.argv[1]);
const context = output.hookSpecificOutput.additionalContext;
if (!context.includes("Exact Grok hook session ID for this turn: \"grok-session-scope-test\"")) process.exit(1);
if (!context.includes("--session-id \"grok-session-scope-test\"")) process.exit(1);
' "$OUTPUT"
test "$(stat -c '%a' "$STATE")" = "700"
BINDING_DIR="$STATE/session-bindings"
test "$(stat -c '%a' "$BINDING_DIR")" = "700"
mapfile -t BINDINGS < <(find "$BINDING_DIR" -maxdepth 1 -type f -name '*.json')
test "${#BINDINGS[@]}" -eq 1
test "$(stat -c '%a' "${BINDINGS[0]}")" = "600"
if rg -F --quiet "secret=do-not-persist" "$STATE"; then
	echo "secret prompt was retained in session state" >&2
	exit 1
fi
(
	cd "$WORKSPACE"
	HOME="$TEST_HOME" GROK_HOME="$GROK_HOME" node "$ROOT/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" \
		create-goals --brief "session binding check" --json >/dev/null
)
test -f "$WORKSPACE/.lazygrok/ulw-loop/grok-session-scope-test/goals.json"
if (
	cd "$WORKSPACE"
	HOME="$TEST_HOME" GROK_HOME="$GROK_HOME" node "$ROOT/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" \
		status --session-id "invented-session" --json >/dev/null 2>&1
); then
	echo "ulw-loop accepted a session ID that conflicts with the current Grok binding" >&2
	exit 1
fi
if (
	cd "$WORKSPACE"
	HOME="$TEST_HOME" GROK_HOME="$GROK_HOME" node "$ROOT/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" \
		status --session-id "grok-session-scope-test-child" --json >/dev/null 2>&1
); then
	echo "ulw-loop accepted a distinct session ID sharing the current binding prefix" >&2
	exit 1
fi
BEFORE_COUNT="$(find "$STATE" -type f | wc -l)"
head -c 11534336 /dev/zero \
	| tr '\0' x \
	| HOME="$TEST_HOME" GROK_HOME="$GROK_HOME" GROK_SESSION_ID="oversized-session" \
		node "$ROOT/hooks/lazygrok-ups-probe.mjs" ultrawork user-prompt-submit \
		>"$TEST_ROOT/oversized.out" 2>"$TEST_ROOT/oversized.err"
test ! -s "$TEST_ROOT/oversized.out"
rg -F --quiet "exceeds 10 MiB" "$TEST_ROOT/oversized.err"
test "$(find "$STATE" -type f | wc -l)" -eq "$BEFORE_COUNT"
echo "ulw-session-scope: OK"
