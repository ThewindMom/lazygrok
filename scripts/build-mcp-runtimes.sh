#!/usr/bin/env bash
# Vendor ast-grep-mcp and lsp-tools-mcp from oh-my-openagent into vendor/, then build dist/.
# Requires: node, npm; bun recommended for ast-grep-mcp (falls back to npx bun).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OMO_REF="${OMO_SRC:-/tmp/omo-research}"
VENDOR="$ROOT/vendor"

ensure_omo_src() {
  if [[ -d "$OMO_REF/packages/ast-grep-mcp" ]]; then
    return 0
  fi
  echo "Cloning oh-my-openagent into $OMO_REF ..."
  git clone --depth 1 -b dev https://github.com/code-yeongyu/oh-my-openagent.git "$OMO_REF"
}

ensure_lsp_submodule() {
  if [[ -f "$OMO_REF/packages/lsp-tools-mcp/package.json" ]]; then
    return 0
  fi
  echo "Initializing lsp-tools-mcp submodule in $OMO_REF ..."
  (cd "$OMO_REF" && git submodule update --init --recursive packages/lsp-tools-mcp)
}

copy_pkg() {
  local name="$1"
  local src="$OMO_REF/packages/$name"
  local dest="$VENDOR/$name"
  if [[ ! -d "$src" ]]; then
    echo "error: missing package at $src" >&2
    exit 1
  fi
  rm -rf "$dest"
  cp -a "$src" "$dest"
}

patch_ast_grep_deps() {
  local mcp_pkg="$VENDOR/ast-grep-mcp/package.json"
  if [[ ! -f "$mcp_pkg" ]]; then
    return 0
  fi
  # workspace:* is not valid outside the omo monorepo
  sed -i 's|"@oh-my-opencode/ast-grep-core": "workspace:\*"|"@oh-my-opencode/ast-grep-core": "file:../ast-grep-core"|' "$mcp_pkg"
}

build_lsp_tools_mcp() {
  local dest="$VENDOR/lsp-tools-mcp"
  (cd "$dest" && npm ci && npm run build)
}

build_ast_grep_mcp() {
  local dest="$VENDOR/ast-grep-mcp"
  (cd "$dest" && npm install && npm run build)
}

main() {
  command -v node >/dev/null || { echo "error: node required" >&2; exit 1; }
  command -v npm >/dev/null || { echo "error: npm required" >&2; exit 1; }

  ensure_omo_src
  ensure_lsp_submodule
  mkdir -p "$VENDOR"

  copy_pkg ast-grep-core
  copy_pkg ast-grep-mcp
  copy_pkg lsp-tools-mcp
  patch_ast_grep_deps

  build_lsp_tools_mcp
  build_ast_grep_mcp

  for required in \
    "$VENDOR/ast-grep-mcp/dist/cli.js" \
    "$VENDOR/lsp-tools-mcp/dist/cli.js"; do
    if [[ ! -f "$required" ]]; then
      echo "error: expected build output missing: $required" >&2
      exit 1
    fi
  done

  echo "Built MCP runtimes under $VENDOR"
}

main "$@"