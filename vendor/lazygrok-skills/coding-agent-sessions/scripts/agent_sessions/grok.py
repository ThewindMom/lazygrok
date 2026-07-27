from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from .jsonio import as_map, read_json, text
from .timeparse import file_time
from .transcript import existing, recent
from .types import Session


def scan_grok(extra_roots: tuple[Path, ...], workers: int) -> list[Session]:
    """Scan Grok Build sessions at ~/.grok/sessions/<encoded-cwd>/<session-id>/.

    Each session directory contains:
      - summary.json  (id, cwd, session_summary, created_at, updated_at, current_model_id)
      - events.jsonl  (turn_started, tool_started, tool_completed, ...)
      - prompt_context.json
    """
    grok_home = Path.home() / ".grok"
    roots = existing([grok_home / "sessions", *extra_roots])
    session_dirs: list[Path] = []
    for root in roots:
        for cwd_dir in root.iterdir():
            if not cwd_dir.is_dir():
                continue
            for sid_dir in cwd_dir.iterdir():
                if sid_dir.is_dir() and (sid_dir / "summary.json").exists():
                    session_dirs.append(sid_dir)
    if not session_dirs:
        return []
    sessions: list[Session] = []
    with ThreadPoolExecutor(max_workers=min(workers, max(len(session_dirs), 1))) as pool:
        futures = [pool.submit(_grok_session, path) for path in recent(session_dirs)]
        for future in as_completed(futures):
            session = future.result()
            if session is not None:
                sessions.append(session)
    return sessions


def _grok_session(path: Path) -> Session | None:
    summary = as_map(read_json(path / "summary.json"))
    if not summary:
        return None
    info = as_map(summary.get("info")) or {}
    sid = text(info.get("id")) or path.name
    cwd = text(info.get("cwd"))
    # Decode the URL-encoded cwd from the parent directory name
    if not cwd:
        from urllib.parse import unquote
        cwd = unquote(path.parent.name)
    first_msg = text(summary.get("session_summary")) or ""
    created = text(summary.get("created_at")) or file_time(path)
    updated = text(summary.get("updated_at")) or created
    model = text(summary.get("current_model_id"))
    provider = None
    if model:
        # Split "grok-4.5" → provider="grok"
        parts = model.split("-", 1)
        provider = parts[0] if parts else None
    return Session(
        "grok",
        sid,
        str(path / "summary.json"),
        cwd,
        created,
        updated,
        provider,
        model,
        first_msg,
        {},
        None,
        None,
        first_msg,
    )
