#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/hashline.sh
source "${SCRIPT_DIR}/lib/hashline.sh"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
read_hook_stdin_to_file "$tmp"
apply_hook_env_from_stdin "$tmp"
ensure_skill_catalog

read_path=""
if read_path="$(extract_read_path_from_hook_input "$tmp" 2>/dev/null)"; then
  :
else
  exit 0
fi

if ! path_is_skill_file "$read_path"; then
  exit 0
fi

skill_id="$(skill_id_for_path "$read_path" 2>/dev/null || true)"
if [ -n "$skill_id" ]; then
  mark_skill_loaded "$skill_id"
fi

update_cache_from_read "$read_path" 2>/dev/null || true

exit 0