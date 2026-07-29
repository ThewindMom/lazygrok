#!/usr/bin/env bash
# Report whether a reviewed native comment-checker binary is already present.
#
# LazyGrok does not fetch or execute mutable third-party installers from this
# helper. The built-in Go PostToolUse checker remains active when no reviewed
# native binary was provisioned with the plugin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CC_DIR="$ROOT/vendor/lazygrok-hooks/comment-checker"

PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac
BIN_PATH="node_modules/@code-yeongyu/comment-checker/vendor/${PLATFORM}-${ARCH}/comment-checker"

if [ -x "$BIN_PATH" ]; then
  echo "install-comment-checker: reviewed binary present at $CC_DIR/$BIN_PATH"
  exit 0
fi

echo "install-comment-checker: remote bootstrap is disabled; using the built-in Go checker"
