#!/usr/bin/env bash
# Sync prompt variants into hook component directive files.
# Usage: bash scripts/sync-prompts.sh [variant]
# Default variant: grok
set -euo pipefail
VARIANT="${1:-grok}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Syncing prompt variant: $VARIANT"

# Ultrawork directive
if [ -f "$ROOT/prompts/ultrawork/$VARIANT.md" ]; then
  cp "$ROOT/prompts/ultrawork/$VARIANT.md" "$ROOT/vendor/lazygrok-hooks/ultrawork/directive.md"
  echo "  ultrawork: synced ($VARIANT.md → directive.md)"
elif [ -f "$ROOT/prompts/ultrawork/default.md" ]; then
  cp "$ROOT/prompts/ultrawork/default.md" "$ROOT/vendor/lazygrok-hooks/ultrawork/directive.md"
  echo "  ultrawork: fallback (default.md → directive.md)"
else
  echo "  ultrawork: no variant found, keeping existing directive.md"
fi

# Start-work-continuation directive
if [ -f "$ROOT/prompts/start-work-continuation/$VARIANT.md" ]; then
  cp "$ROOT/prompts/start-work-continuation/$VARIANT.md" "$ROOT/vendor/lazygrok-hooks/start-work-continuation/directive.md"
  echo "  start-work-continuation: synced"
fi

# Lazygrok-executor-verify directive
if [ -f "$ROOT/prompts/lazygrok-executor-verify/$VARIANT.md" ]; then
  cp "$ROOT/prompts/lazygrok-executor-verify/$VARIANT.md" "$ROOT/vendor/lazygrok-hooks/lazygrok-executor-verify/directive.md"
  echo "  lazygrok-executor-verify: synced"
fi

echo "Done."
