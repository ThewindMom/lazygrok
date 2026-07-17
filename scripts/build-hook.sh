#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p bin
build() {
  local goos="$1" goarch="$2" out="$3"
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build -mod=mod -ldflags="-s -w" -o "bin/$out" ./cmd/lazygrok-hook
}
build linux amd64 lazygrok-hook-linux-amd64
build linux arm64 lazygrok-hook-linux-arm64
build darwin amd64 lazygrok-hook-darwin-amd64
build darwin arm64 lazygrok-hook-darwin-arm64
build windows amd64 lazygrok-hook-windows-amd64.exe
echo "Built bin/lazygrok-hook-*"