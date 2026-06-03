#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/prometheus.sh
source "${SCRIPT_DIR}/lib/prometheus.sh"
# shellcheck source=lib/hashline.sh
source "${SCRIPT_DIR}/lib/hashline.sh"

stdin_tmp="$(mktemp)"
trap 'rm -f "$stdin_tmp"' EXIT
cat >"$stdin_tmp" || true
apply_hook_env_from_stdin "$stdin_tmp"

prometheus_deny=""
prometheus_rc=0
set +e
prometheus_deny="$(evaluate_prometheus_pre_tool "$stdin_tmp" 2>&1)"
prometheus_rc=$?
set -e
if [ "$prometheus_rc" -eq 2 ]; then
  emit_deny "${prometheus_deny:-Prometheus plan mode: only .omg/**/*.md writes allowed.}"
fi

hashline_deny=""
hashline_rc=0
set +e
hashline_deny="$(hashline_validate_pre_tool "$stdin_tmp" 2>&1)"
hashline_rc=$?
set -e
if [ "$hashline_rc" -eq 2 ]; then
  emit_deny "${hashline_deny:-Hashline: stale LINE#ID in edit; re-read the file.}"
fi

ensure_skill_catalog

count="$(catalog_count)"
loaded_count=0
if [ -f "$(skills_loaded_file)" ]; then
  loaded_count="$(loaded_ids | wc -l | tr -d ' ')"
fi

if [ "$loaded_count" -gt 0 ]; then
  emit_allow
fi

if [ "$count" -eq 0 ]; then
  emit_allow
fi

unloaded="$(list_unloaded_ids | head -15 | tr '\n' ', ' | sed 's/,$//')"
emit_deny "Read at least one applicable skill from the grok inspect catalog before mutating files. Rules: ${RULES_PATH}. Unloaded examples: ${unloaded}"