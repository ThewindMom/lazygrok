#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
tmpdir="$(mktemp -d "${HOME:?}/lazygrok-codegraph-test.XXXXXX")"
cli="${PLUGIN_ROOT}/vendor/lazygrok-hooks/codegraph/dist/cli.js"
workers_before=" $(pgrep -f -- "${cli} hook session-start-worker" | tr '\n' ' ' || true) "

if [ ! -x "$cli" ]; then
	echo "expected CodeGraph package bin to be executable" >&2
	exit 1
fi

cleanup() {
	local worker_pids
	worker_pids="$(pgrep -f -- "${cli} hook session-start-worker" || true)"
	for pid in $worker_pids; do
		case "$workers_before" in
			*" ${pid} "*) ;;
			*) kill "$pid" 2>/dev/null || true ;;
		esac
	done
	rm -rf "$tmpdir"
}
trap cleanup EXIT

ancestor="${tmpdir}/workspace"
project="${ancestor}/apps/server"
home_dir="${tmpdir}/home"
mkdir -p "${ancestor}/.codegraph" "$project" "$home_dir"
printf 'fixture\n' >"${ancestor}/.codegraph/codegraph.db"
mkdir -p "${home_dir}/.omo"
printf '{ "codegraph": { "enabled": true } }\n' >"${home_dir}/.omo/config.jsonc"

payload='{"hook_event_name":"SessionStart","cwd":"'"${project}"'"}'
output="$(printf '%s\n' "$payload" | HOME="$home_dir" "$cli" hook session-start)"

if [ -n "$output" ]; then
	printf 'expected ancestor-covered project to skip bootstrap, got: %s\n' "$output" >&2
	exit 1
fi

outcomes="${home_dir}/.omo/codegraph/session-start.jsonl"
if [ ! -f "$outcomes" ]; then
	echo "expected skipped-nested-root outcome log" >&2
	exit 1
fi
rg -q '"action":"skipped-nested-root"' "$outcomes"
rg -Fq '"ancestorRoot":"'"${ancestor}"'"' "$outcomes"

if [ ! -f "${home_dir}/.omo/config.jsonc" ] || [ -e "${home_dir}/.omo/omo.jsonc" ]; then
	echo "expected LazyGrok CodeGraph hook to leave Codex config migration untouched" >&2
	exit 1
fi

echo "codegraph hooks: OK"
