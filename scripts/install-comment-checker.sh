#!/usr/bin/env bash
# Install the @code-yeongyu/comment-checker native binary package.
# The comment-checker PostToolUse hook spawns this binary to detect AI-slop comments.
# Without it, the hook silently no-ops (status === "missing").
#
# Run after cloning the repo or after `grok plugin install`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CC_DIR="$ROOT/vendor/lazygrok-hooks/comment-checker"

echo "install-comment-checker: installing @code-yeongyu/comment-checker..."

cd "$CC_DIR"

# If already installed and binary exists, skip.
PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac
BIN_PATH="node_modules/@code-yeongyu/comment-checker/vendor/${PLATFORM}-${ARCH}/comment-checker"

if [ -x "$BIN_PATH" ]; then
  echo "install-comment-checker: binary already present at $BIN_PATH"
  exit 0
fi

# Install the package (postinstall downloads platform-specific binaries).
npm install @code-yeongyu/comment-checker --ignore-scripts 2>/dev/null || {
  echo "install-comment-checker: npm install failed, trying with scripts..." >&2
  npm install @code-yeongyu/comment-checker
}

# Run postinstall manually to download the binary.
if [ ! -x "$BIN_PATH" ]; then
  echo "install-comment-checker: running postinstall to download binary..."
  node node_modules/@code-yeongyu/comment-checker/postinstall.js || {
    echo "install-comment-checker: postinstall failed" >&2
    exit 1
  }
fi

if [ -x "$BIN_PATH" ]; then
  echo "install-comment-checker: success — binary at $BIN_PATH"
else
  echo "install-comment-checker: WARNING — binary not found at $BIN_PATH" >&2
  exit 1
fi
