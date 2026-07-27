#!/usr/bin/env python3
"""
Audit LazyGrok hooks: inventory plugin vs user bridge, dry-run each command,
optionally parse a grok --debug-file for live fires, and inspect session dirs.

Usage:
  python3 scripts/audit-hooks.py inventory
  python3 scripts/audit-hooks.py dry-run
  python3 scripts/audit-hooks.py parse-debug /tmp/grok-debug.log
  python3 scripts/audit-hooks.py session --id <session-id>
  python3 scripts/audit-hooks.py full   # inventory + dry-run + latest probe
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path

HOME = Path.home()
PLUGIN = Path(
    os.environ.get(
        "GROK_PLUGIN_ROOT",
        str(HOME / ".grok/installed-plugins/lazygrok-85b8f856"),
    )
)
PLUGIN_HOOKS = PLUGIN / "hooks/hooks.json"
USER_HOOKS = HOME / ".grok/hooks/lazygrok.json"
RUNNER = HOME / ".grok/hooks/lazygrok-run.sh"
STATE = HOME / ".grok/state/lazygrok"
SESSIONS = HOME / ".grok/sessions"


def load_plugin_hooks():
    raw = json.loads(PLUGIN_HOOKS.read_text())
    events = raw.get("hooks", raw)
    rows = []
    for event, groups in events.items():
        if not isinstance(groups, list):
            continue
        for i, g in enumerate(groups):
            for j, hh in enumerate(g.get("hooks") or []):
                rows.append(
                    {
                        "event": event,
                        "group": i,
                        "slot": j,
                        "matcher": g.get("matcher"),
                        "command": hh.get("command", ""),
                        "timeout": hh.get("timeout"),
                        "statusMessage": hh.get("statusMessage"),
                    }
                )
    return rows


def load_user_hooks():
    if not USER_HOOKS.exists():
        return None, []
    raw = json.loads(USER_HOOKS.read_text())
    meta = raw.get("_lazygrokUserHooks")
    rows = []
    for event, groups in (raw.get("hooks") or {}).items():
        for i, g in enumerate(groups):
            for j, hh in enumerate(g.get("hooks") or []):
                rows.append(
                    {
                        "event": event,
                        "group": i,
                        "slot": j,
                        "matcher": g.get("matcher"),
                        "command": hh.get("command", ""),
                    }
                )
    return meta, rows


def cmd(inventory):
    print(f"PLUGIN={PLUGIN}")
    print(f"plugin_hooks_file={PLUGIN_HOOKS} exists={PLUGIN_HOOKS.exists()}")
    print(f"user_bridge={USER_HOOKS} exists={USER_HOOKS.exists()}")
    print(f"runner={RUNNER} exists={RUNNER.exists()}")
    rows = load_plugin_hooks()
    print(f"\nPLUGIN_TOTAL={len(rows)}")
    by_ev = defaultdict(int)
    for r in rows:
        by_ev[r["event"]] += 1
    for ev, n in sorted(by_ev.items()):
        print(f"  {ev}: {n}")

    meta, urows = load_user_hooks()
    print(f"\nBRIDGE_META={meta}")
    print(f"BRIDGE_TOTAL={len(urows)}")
    uby = defaultdict(int)
    for r in urows:
        uby[r["event"]] += 1
    for ev, n in sorted(uby.items()):
        print(f"  {ev}: {n}")

    # coverage: same event counts?
    missing_events = set(by_ev) - set(uby)
    extra_events = set(uby) - set(by_ev)
    print(f"\nMISSING_EVENTS_IN_BRIDGE={sorted(missing_events) or 'none'}")
    print(f"EXTRA_EVENTS_IN_BRIDGE={sorted(extra_events) or 'none'}")
    count_mismatch = {ev: (by_ev[ev], uby.get(ev, 0)) for ev in by_ev if by_ev[ev] != uby.get(ev, 0)}
    print(f"COUNT_MISMATCH={count_mismatch or 'none'}")

    full = (
        meta
        and meta.get("fullMirror")
        and meta.get("version", 0) >= 4
        and not missing_events
        and not count_mismatch
        and RUNNER.exists()
    )
    print(f"\nFULL_MIRROR_OK={bool(full)}")
    return 0 if full else 1


def dry_run():
    """Smoke each run-hook subcommand and a sample of shims (no full Grok)."""
    if not RUNNER.exists():
        print("FAIL: runner missing — run install-user-hooks.mjs first")
        return 2
    env = os.environ.copy()
    env["GROK_PLUGIN_ROOT"] = str(PLUGIN)
    env["GROK_WORKSPACE_ROOT"] = str(HOME / ".grok")
    env["GROK_SESSION_ID"] = "audit-dry-run"
    env["GROK_HOOK_EVENT"] = "session_start"

    results = []
    # Parse bridge commands and run each once with empty/minimal stdin
    meta, urows = load_user_hooks()
    if not urows:
        print("FAIL: no user bridge hooks")
        return 2

    seen = set()
    for r in urows:
        cmd_s = r["command"]
        if cmd_s in seen:
            continue
        seen.add(cmd_s)
        # Build minimal stdin per event family
        event = r["event"]
        stdin_obj = {
            "hookEventName": _snake(event),
            "sessionId": "audit-dry-run",
            "cwd": str(HOME / ".grok"),
            "workspaceRoot": str(HOME / ".grok"),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        if event == "UserPromptSubmit":
            stdin_obj["prompt"] = "ulw audit dry-run"
        if event == "PreToolUse":
            stdin_obj["toolName"] = "search_replace"
            stdin_obj["toolUseId"] = "t1"
            stdin_obj["toolInput"] = {"file_path": "/tmp/x", "old_string": "a", "new_string": "b"}
            stdin_obj["toolInputTruncated"] = False
        if event == "PostToolUse":
            stdin_obj["toolName"] = "read_file"
            stdin_obj["toolUseId"] = "t1"
            stdin_obj["toolInput"] = {"target_file": "/tmp/x"}
            stdin_obj["toolResult"] = {"ok": True}
            stdin_obj["toolInputTruncated"] = False
            stdin_obj["toolResultTruncated"] = False
            stdin_obj["isBackgrounded"] = False
        if event == "Stop":
            stdin_obj["reason"] = "completed"
        if event == "SessionStart":
            stdin_obj["source"] = "startup"

        try:
            p = subprocess.run(
                cmd_s,
                shell=True,
                input=json.dumps(stdin_obj).encode(),
                capture_output=True,
                timeout=25,
                env=env,
                cwd=str(HOME / ".grok"),
            )
            ok = p.returncode == 0
            results.append(
                {
                    "event": event,
                    "command": cmd_s[:100],
                    "exit": p.returncode,
                    "stdout_bytes": len(p.stdout),
                    "stderr_bytes": len(p.stderr),
                    "ok": ok,
                    "stderr_preview": p.stderr[:200].decode("utf-8", "replace"),
                }
            )
            status = "PASS" if ok else "FAIL"
            print(f"{status} {event:18} exit={p.returncode} out={len(p.stdout)} err={len(p.stderr)} {cmd_s[:70]}")
        except subprocess.TimeoutExpired:
            results.append({"event": event, "command": cmd_s[:100], "ok": False, "error": "timeout"})
            print(f"FAIL {event:18} timeout {cmd_s[:70]}")
        except Exception as e:
            results.append({"event": event, "command": cmd_s[:100], "ok": False, "error": str(e)})
            print(f"FAIL {event:18} {e}")

    out = STATE / "hook-audit-dry-run.json"
    STATE.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"at": time.time(), "results": results}, indent=2))
    failed = [x for x in results if not x.get("ok")]
    print(f"\nDRY_RUN_TOTAL={len(results)} FAIL={len(failed)} report={out}")
    return 1 if failed else 0


def _snake(pascal: str) -> str:
    # UserPromptSubmit -> user_prompt_submit
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", pascal)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def parse_debug(path: Path):
    if not path.exists():
        print(f"FAIL missing {path}")
        return 2
    text = path.read_text(errors="replace")
    # hook completed lines
    fires = re.findall(
        r"hook (?:completed|allowed|denied) hook_name=(\S+).*?elapsed_ms=(\d+)",
        text,
    )
    loaded = re.findall(r"loaded hooks hook_count=(\d+)", text)
    discovery = re.findall(
        r"hooks: discovery complete total_hooks=(\d+).*?user_prompt_submit=(\d+)",
        text,
    )
    plugin = re.findall(
        r"plugin discovered name=(\S+).*?has_hooks=(true|false)",
        text,
    )
    print(f"debug_file={path}")
    print(f"loaded_hooks_counts={loaded}")
    print(f"discovery_totals={discovery}")
    print(f"plugins={plugin}")
    by_prefix = defaultdict(int)
    lazy = []
    for name, ms in fires:
        by_prefix[name.split(":")[0] if ":" in name else name] += 1
        if "lazygrok" in name:
            lazy.append((name, ms))
    print(f"hook_completed_total={len(fires)}")
    print(f"lazygrok_completed={len(lazy)}")
    for name, ms in lazy:
        print(f"  FIRE {name} elapsed_ms={ms}")
    # group by event token in name
    by_event = defaultdict(int)
    for name, _ in lazy:
        # global/lazygrok:user_prompt_submit[1].hooks[0]
        m = re.search(r":([a-z_]+)\[", name)
        if m:
            by_event[m.group(1)] += 1
    print(f"lazygrok_by_event={dict(by_event)}")
    out = STATE / "hook-audit-debug.json"
    out.write_text(
        json.dumps(
            {
                "loaded": loaded,
                "discovery": discovery,
                "lazygrok_fires": lazy,
                "by_event": dict(by_event),
            },
            indent=2,
        )
    )
    print(f"report={out}")
    # success if we saw any lazygrok fires
    return 0 if lazy else 1


def session_inspect(session_id: str | None):
    # find session dir
    found = []
    for p in SESSIONS.rglob("summary.json"):
        try:
            s = json.loads(p.read_text())
            sid = s.get("info", {}).get("id") or p.parent.name
            if session_id and session_id not in sid:
                continue
            found.append((p.stat().st_mtime, sid, p.parent, s))
        except Exception:
            continue
    found.sort(reverse=True)
    if not found:
        print("no sessions")
        return 1
    if session_id:
        hits = [x for x in found if session_id in x[1]]
        if not hits:
            print(f"session not found: {session_id}")
            return 1
        items = hits[:1]
    else:
        items = found[:3]
    for mtime, sid, directory, summary in items:
        print(f"\n=== session {sid} ===")
        print(f"dir={directory}")
        print(f"title={summary.get('generated_title') or summary.get('session_summary')}")
        print(f"messages={summary.get('num_messages')} updated={summary.get('updated_at')}")
        # events types
        ev = directory / "events.jsonl"
        types = defaultdict(int)
        if ev.exists():
            for line in ev.read_text().splitlines():
                try:
                    o = json.loads(line)
                    types[o.get("type") or o.get("event") or "?"] += 1
                except Exception:
                    pass
        print(f"event_types={dict(sorted(types.items(), key=lambda x: -x[1])[:15])}")
        # chat markers
        ch = directory / "chat_history.jsonl"
        markers = {"ulw": 0, "ULTRAWORK": 0, "skill": 0}
        if ch.exists():
            blob = ch.read_text(errors="replace")
            for k in markers:
                markers[k] = blob.count(k)
        print(f"chat_markers={markers}")
    # probe
    probe = STATE / "ups-probe-latest.json"
    if probe.exists():
        j = json.loads(probe.read_text())
        print(f"\nups-probe at={j.get('at')} injectOk={j.get('injectOk')} hook={j.get('env',{}).get('GROK_HOOK_NAME')}")
    return 0


def full():
    rc = 0
    print("======== INVENTORY ========")
    rc |= cmd(True)
    print("\n======== DRY-RUN ========")
    rc |= dry_run()
    print("\n======== PROBE / LAST RESULT ========")
    for name in ("ups-probe-latest.json", "last-ups-result.json", "hook-audit-dry-run.json"):
        p = STATE / name
        if p.exists():
            print(f"{name}: mtime={time.ctime(p.stat().st_mtime)} size={p.stat().st_size}")
    print(f"\nOVERALL_RC={rc}")
    return rc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "action",
        choices=["inventory", "dry-run", "parse-debug", "session", "full"],
    )
    ap.add_argument("path", nargs="?")
    ap.add_argument("--id", dest="session_id")
    args = ap.parse_args()
    if args.action == "inventory":
        sys.exit(cmd(True))
    if args.action == "dry-run":
        sys.exit(dry_run())
    if args.action == "parse-debug":
        sys.exit(parse_debug(Path(args.path or "/tmp/grok-hook-audit.log")))
    if args.action == "session":
        sys.exit(session_inspect(args.session_id))
    if args.action == "full":
        sys.exit(full())


if __name__ == "__main__":
    main()
