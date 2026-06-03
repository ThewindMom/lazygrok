#!/usr/bin/env bash
# Hashline read cache + PreToolUse stale LINE#ID guard (omo hashline-core compatible).

_hashline_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HASHLINE_PY="${_hashline_lib_dir}/hashline.py"
export HASHLINE_PY

hashline_enabled() {
  case "${OMG_HASHLINE:-1}" in
    0|false|no|off) return 1 ;;
    *) return 0 ;;
  esac
}

hashline_cache_dir() {
  printf '%s/state/hashline/%s' "$GROK_HOME" "${GROK_SESSION_ID:-unknown}"
}

hashline_cache_path() {
  local file_path="$1"
  local digest
  digest="$(printf '%s' "$file_path" | sha256sum | awk '{print $1}')"
  mkdir -p "$(hashline_cache_dir)"
  printf '%s/%s.json' "$(hashline_cache_dir)" "$digest"
}

update_cache_from_read() {
  hashline_enabled || return 0
  local read_path="${1:-}"
  [ -n "$read_path" ] || return 0
  if path_is_skill_file "$read_path" 2>/dev/null; then
    return 0
  fi

  HASHLINE_PY="$HASHLINE_PY" GROK_WORKSPACE_ROOT="${GROK_WORKSPACE_ROOT:-}" \
    python3 - "$read_path" <<'PY'
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

lib_dir = Path(os.environ["HASHLINE_PY"]).parent
sys.path.insert(0, str(lib_dir))
from hashline import compute_line_hash  # noqa: E402

read_path = sys.argv[1]
workspace = os.environ.get("GROK_WORKSPACE_ROOT", "").strip()

def resolve_path(raw: str) -> Path | None:
    if not raw:
        return None
    candidate = Path(raw)
    if not candidate.is_absolute() and workspace:
        candidate = Path(workspace) / raw
    try:
        return candidate.resolve()
    except OSError:
        return None


abs_path = resolve_path(read_path)
if abs_path is None or not abs_path.is_file():
    raise SystemExit(0)

if workspace:
    try:
        rel = abs_path.relative_to(Path(workspace).resolve())
        rel_path = str(rel).replace("\\", "/")
    except ValueError:
        raise SystemExit(0)
else:
    rel_path = str(abs_path)

if rel_path.endswith("SKILL.md") or "/SKILL.md" in f"/{rel_path}":
    raise SystemExit(0)

try:
    text = abs_path.read_text(encoding="utf-8")
except (OSError, UnicodeDecodeError):
    raise SystemExit(0)

lines = text.splitlines()
line_hashes = {
    str(index): compute_line_hash(index, line)
    for index, line in enumerate(lines, start=1)
}

payload = {
    "path": str(abs_path),
    "rel_path": rel_path,
    "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
    "lines": line_hashes,
}

grok_home = os.environ.get("GROK_HOME", os.path.expanduser("~/.grok"))
session_id = os.environ.get("GROK_SESSION_ID", "unknown")
cache_dir = Path(grok_home) / "state" / "hashline" / session_id
cache_dir.mkdir(parents=True, exist_ok=True)
digest = hashlib.sha256(str(abs_path).encode("utf-8")).hexdigest()
cache_file = cache_dir / f"{digest}.json"
cache_file.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
}

collect_hashline_context() {
  hashline_enabled || return 0
  local cache_dir
  cache_dir="$(hashline_cache_dir)"
  [ -d "$cache_dir" ] || return 0

  HASHLINE_CONTEXT_MAX_FILES="${HASHLINE_CONTEXT_MAX_FILES:-5}" \
    python3 - "$cache_dir" <<'PY'
import json
import os
import sys
from pathlib import Path

cache_dir = Path(sys.argv[1])
max_files = int(os.environ.get("HASHLINE_CONTEXT_MAX_FILES", "5"))
entries = []
for path in cache_dir.glob("*.json"):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        continue
    if not isinstance(data, dict):
        continue
    rel = data.get("rel_path") or data.get("path") or path.stem
    lines = data.get("lines") or {}
    if not isinstance(lines, dict) or not lines:
        continue
    samples = []
    for line_no in sorted(lines, key=lambda value: int(value)):
        samples.append(f"{line_no}#{lines[line_no]}")
        if len(samples) >= 4:
            break
    try:
        mtime = path.stat().st_mtime
    except OSError:
        mtime = 0
    entries.append((mtime, rel, samples, len(lines)))

if not entries:
    raise SystemExit(0)

entries.sort(key=lambda item: item[0], reverse=True)
entries = entries[:max_files]

out = ["<HASHLINE_CACHE>", "Hash-anchored edits: copy LINE#ID tags from Read output; PreToolUse blocks stale tags.", ""]
for _mtime, rel, samples, total in entries:
    sample_text = ", ".join(samples)
    extra = f" (+{total - len(samples)} more)" if total > len(samples) else ""
    out.append(f"- {rel}: {sample_text}{extra}")
out.append("")
out.append("Re-read a file before StrReplace if its content changed since cache.")
out.append("</HASHLINE_CACHE>")
print("\n".join(out))
PY
}

hashline_validate_pre_tool() {
  hashline_enabled || return 0
  local stdin_file="${1:-}"
  [ -n "$stdin_file" ] && [ -s "$stdin_file" ] || return 0

  HASHLINE_PY="$HASHLINE_PY" GROK_HOME="$GROK_HOME" GROK_SESSION_ID="${GROK_SESSION_ID:-unknown}" \
    GROK_WORKSPACE_ROOT="${GROK_WORKSPACE_ROOT:-}" \
    python3 - "$stdin_file" <<'PY'
import hashlib
import json
import os
import re
import sys
from pathlib import Path

lib_dir = Path(os.environ["HASHLINE_PY"]).parent
sys.path.insert(0, str(lib_dir))
from hashline import compute_line_hash  # noqa: E402

HASH_REF_RE = re.compile(r"([0-9]+)#([ZPMQVRWSNKTXJBYH]{2})")
MUTATION_TOOLS = {
    "strreplace",
    "str_replace",
    "edit",
    "multiedit",
    "multi_edit",
}


def dig(obj, *keys):
    for key in keys:
        if not isinstance(obj, dict) or key not in obj:
            return None
        obj = obj[key]
    return obj


def resolve_path(raw: str, workspace: str) -> Path | None:
    if not raw:
        return None
    candidate = Path(raw)
    if not candidate.is_absolute() and workspace:
        candidate = Path(workspace) / raw
    try:
        return candidate.resolve()
    except OSError:
        return None


stdin_path = sys.argv[1]
with open(stdin_path, encoding="utf-8") as handle:
    data = json.load(handle)

tool = (data.get("toolName") or data.get("tool_name") or "").strip().lower()
if tool not in MUTATION_TOOLS:
    raise SystemExit(0)

block = data.get("toolInput") or data.get("tool_input") or data.get("input") or {}
if not isinstance(block, dict):
    raise SystemExit(0)

file_path = (
    block.get("path")
    or block.get("file_path")
    or block.get("filePath")
    or block.get("target_file")
    or block.get("targetFile")
    or ""
)
if not isinstance(file_path, str) or not file_path.strip():
    raise SystemExit(0)

old_string = block.get("old_string") or block.get("oldString") or ""
if not isinstance(old_string, str) or not old_string:
    raise SystemExit(0)

refs = HASH_REF_RE.findall(old_string)
if not refs:
    raise SystemExit(0)

workspace = os.environ.get("GROK_WORKSPACE_ROOT", "").strip()
abs_path = resolve_path(file_path.strip(), workspace)
if abs_path is None:
    raise SystemExit(0)

grok_home = os.environ.get("GROK_HOME", os.path.expanduser("~/.grok"))
session_id = os.environ.get("GROK_SESSION_ID", "unknown")
digest = hashlib.sha256(str(abs_path).encode("utf-8")).hexdigest()
cache_file = Path(grok_home) / "state" / "hashline" / session_id / f"{digest}.json"
if not cache_file.is_file():
    print(
        "Hashline: LINE#ID anchors in old_string but no read cache for this file. "
        f"Read {file_path} first, then retry with current tags."
    )
    raise SystemExit(2)

try:
    cache = json.loads(cache_file.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    print("Hashline: corrupt read cache; re-read the file before editing.")
    raise SystemExit(2)

cached_lines = cache.get("lines") if isinstance(cache, dict) else None
if not isinstance(cached_lines, dict):
    print("Hashline: empty read cache; re-read the file before editing.")
    raise SystemExit(2)

stale = []
for line_s, expected in refs:
    cached = cached_lines.get(line_s)
    if cached is None:
        stale.append((int(line_s), expected, None))
        continue
    if cached != expected:
        stale.append((int(line_s), expected, cached))

if not stale:
    raise SystemExit(0)

try:
    live_text = abs_path.read_text(encoding="utf-8")
    live_lines = live_text.splitlines()
except (OSError, UnicodeDecodeError):
    live_lines = []

rel = cache.get("rel_path") or str(abs_path)
parts = [
    f"Hashline: stale LINE#ID in StrReplace for {rel}. "
    "File changed since last Read — re-read and copy fresh tags."
]
for line_no, expected, cached in stale:
    if cached is not None:
        parts.append(f"  line {line_no}: used {line_no}#{expected}, cache has {line_no}#{cached}")
    else:
        parts.append(f"  line {line_no}: used {line_no}#{expected}, not in cache")
    if 1 <= line_no <= len(live_lines):
        actual = compute_line_hash(line_no, live_lines[line_no - 1])
        parts.append(f"    current: {line_no}#{actual}")

print("\n".join(parts))
raise SystemExit(2)
PY
}