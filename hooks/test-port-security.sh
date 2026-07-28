#!/usr/bin/env bash
set -euo pipefail

ROOT="${GROK_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  find "$TMP_DIR" -depth -delete
}
trap cleanup EXIT

cp -a "$ROOT/." "$TMP_DIR/lg"
mkdir -p "$TMP_DIR/lcx" "$TMP_DIR/outside"

printf '%s\n' \
  '---' \
  'name: outside' \
  'description: Must remain outside the LazyGrok root.' \
  'user_invocable: false' \
  '---' \
  >"$TMP_DIR/outside/SKILL.md"
cp "$TMP_DIR/outside/SKILL.md" "$TMP_DIR/outside.before"
ln -s "$TMP_DIR/outside" "$TMP_DIR/lg/skills/security-escape"

normal_skill="$TMP_DIR/lg/skills/hashline-edit/SKILL.md"
sed -i 's/^user-invocable:/user_invocable:/' "$normal_skill"

python3 "$TMP_DIR/lg/scripts/port-lazycodex-to-grok.py" \
  --lg-root "$TMP_DIR/lg" \
  --lcx-plugin "$TMP_DIR/lcx" \
  >/dev/null

cmp "$TMP_DIR/outside.before" "$TMP_DIR/outside/SKILL.md"
grep -q '^user-invocable: false$' "$normal_skill"
if grep -q '^user_invocable:' "$normal_skill"; then
  echo "normal in-root skill retained legacy user_invocable metadata" >&2
  exit 1
fi

echo "port security: OK"
