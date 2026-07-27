#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UW="$ROOT/vendor/lazygrok-hooks/ultrawork"
UL="$ROOT/vendor/lazygrok-hooks/ulw-loop"
command -v bun >/dev/null || { echo "bun required" >&2; exit 1; }

dedupe_shebang() {
  python3 - "$1" <<'PY'
import sys
from pathlib import Path
p=Path(sys.argv[1])
lines=p.read_text().splitlines(keepends=True)
out=[]; seen=False
for ln in lines:
    if ln.startswith("#!"):
        if seen: continue
        seen=True
    out.append(ln)
p.write_text("".join(out))
PY
}

echo "Building ultrawork..."
( cd "$UW" && bun build src/cli.ts --target node --format esm --outfile dist/cli.js && chmod +x dist/cli.js )
dedupe_shebang "$UW/dist/cli.js"
echo "Building ulw-loop..."
( cd "$UL" && bun build src/cli.ts --target node --format esm --outfile dist/cli.js && chmod +x dist/cli.js )
dedupe_shebang "$UL/dist/cli.js"
grep -q 'normal Grok path' "$UW/dist/cli.js"
grep -q 'normal Grok path' "$UL/dist/cli.js"
echo "OK ultrawork=$(wc -c <"$UW/dist/cli.js") ulw-loop=$(wc -c <"$UL/dist/cli.js")"
