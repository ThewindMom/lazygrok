#!/usr/bin/env bash
# Dispatch MCP server subcommands to the appropriate lazygrok-mcp platform binary.
set -euo pipefail
if [ $# -lt 1 ]; then
  echo "run-mcp.sh: missing server name" >&2
  exit 1
fi
SERVER="$1"
shift

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-$ROOT}"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$arch" in
  x86_64|amd64) arch=amd64 ;;
  aarch64|arm64) arch=arm64 ;;
  *)
    echo "run-mcp.sh: unsupported arch: $(uname -m)" >&2
    exit 1
    ;;
esac
case "$os" in
  linux) bin="${PLUGIN_ROOT}/bin/lazygrok-mcp-linux-${arch}" ;;
  darwin) bin="${PLUGIN_ROOT}/bin/lazygrok-mcp-darwin-${arch}" ;;
  mingw*|msys*|cygwin*|windows*)
    bin="${PLUGIN_ROOT}/bin/lazygrok-mcp-windows-amd64.exe"
    ;;
  *)
    echo "run-mcp.sh: unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac
if [ ! -x "$bin" ]; then
  echo "run-mcp.sh: missing MCP binary: $bin" >&2
  echo "run-mcp.sh: run scripts/build-mcp.sh from the plugin root" >&2
  exit 1
fi
exec "$bin" "$SERVER" "$@"
