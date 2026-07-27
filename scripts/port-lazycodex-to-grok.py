#!/usr/bin/env python3
"""Port LazyCodex/OmO skill and agent text to Grok-native LazyGrok tooling.

Transforms are mechanical + a few structural rewrites. Goal of this script:
bring content from lazycodex-ai@4.19.2 into LazyGrok while mapping Codex-only
APIs to Grok equivalents and preserving Grok goal fallbacks (# Goal, ulw-evidence,
todo_write, spawn_subagent, .lazygrok/).
"""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

# Order matters for some replacements.
REPLACEMENTS: list[tuple[str, str]] = [
    # State roots — prefer LazyGrok; keep .omo as accepted legacy mid-run root
    (r"\.omo/ulw-loop", r".lazygrok/ulw-loop"),
    (r"\.omo/evidence", r".lazygrok/evidence"),
    (r"\.omo/plans", r".lazygrok/plans"),
    (r"\.omo/teams", r".lazygrok/teams"),
    (r"`\.omo/`", r"`.lazygrok/` (or `.omo/` if that run already started there)"),
    (r"under `\.omo`", r"under `.lazygrok` (accept `.omo` if the CLI already used it)"),
    # Branding
    (r"\blazycodex-worker-", r"lazygrok-worker-"),
    (r"\blazycodex-code-reviewer\b", r"lazygrok-code-reviewer"),
    (r"\blazycodex-gate-reviewer\b", r"lazygrok-gate-reviewer"),
    (r"\blazycodex-qa-executor\b", r"lazygrok-qa-executor"),
    (r"\blazycodex-clone-fidelity-reviewer\b", r"lazygrok-clone-fidelity-reviewer"),
    (r"\blazycodex-executor\b", r"lazygrok-executor"),
    (r"\blazycodex\b", r"lazygrok"),
    (r"\bLazyCodex\b", r"LazyGrok"),
    (r"\bCodex App\b", r"Grok"),
    (r"\bCodex\b", r"Grok"),
    (r"\bCODEX_HOME\b", r"GROK_HOME"),
    (r"\$HOME/\.codex", r"$HOME/.grok"),
    (r"~/\.codex", r"~/.grok"),
    (r"sisyphuslabs/omo", r"lazygrok"),
    # Tools
    (r"\bupdate_plan\b", r"todo_write"),
    (r"\bTodoWrite\b", r"todo_write"),
    (r"\bspawn_agent\b", r"spawn_subagent"),
    (r"\bwait_agent\b", r"get_command_or_subagent_output"),
    (r"\bfollowup_task\b", r"spawn_subagent (re-task: new prompt to same role)"),
    (r"\blist_agents\(\)", r"track spawned agent ids locally"),
    (r"\binterrupt_agent\b", r"kill_command_or_subagent"),
    (r"\bclose_agent\b", r"kill_command_or_subagent"),
    (r"\bsend_message\b", r"spawn_subagent (message-only follow-up)"),
    (r'fork_turns:\s*"none"', r"background: true"),
    (r"fork_turns:\s*'none'", r"background: true"),
    (r"\bfork_context:\s*false\b", r"background: true"),
    (r"\bfork_context\b", r"background"),
    (r"\bagent_type:\s*\"", r'subagent_type: "lazygrok:'),
    (r"\bmulti_agent_v1\.\*", r"spawn_subagent"),
    (r"\bmulti_agent_v1\b", r"spawn_subagent"),
    (r"\bMultiAgentV2\b", r"Grok spawn_subagent"),
    (r"\bmulti_agent_v2\b", r"spawn_subagent"),
    (r"\bapply_patch\b", r"search_replace/write"),
    (r"\bStrReplace\b", r"search_replace"),
    (r"\bEditNotebook\b", r"search_replace"),
    (r"\bMultiEdit\b", r"search_replace"),
    (r"\bmultiedit\b", r"search_replace"),
    (r"`Bash`", r"`run_terminal_command`"),
    (r"\bBash tool\b", r"run_terminal_command tool"),
    (r"browser:control-in-app-browser", r"playwright MCP tools"),
    (r"control-in-app-browser", r"playwright"),
    # Skill renames
    (r"\bulw-research\b", r"ulw-research"),  # keep name; we also alias ultraresearch
    (r"npx lazycodex-ai install", r"grok plugin install/update (lazygrok)"),
    (r"lazycodex-ai install", r"grok plugin update lazygrok"),
]

# Blocks that need smarter rewrites after naive replace
GOAL_PROTOCOL = """
## Grok goal registration (host tools optional)

Grok often does **not** inject `create_goal` / `update_goal` / `get_goal`
(especially when background workflows are enabled). That is normal.

Silent priority — never narrate missing tools:
1. If `update_goal` or `create_goal` is in the tool list → call with `objective` only (no status/budget).
2. Else bind the turn with a markdown `# Goal` block (objective + success criteria).
3. Always prefer durable structured goals via the ulw-loop CLI (`ulw-evidence` skill):
   `node "${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" create-goals ...`
   Prefer state under `.lazygrok/ulw-loop/`; if the CLI already created `.omo/ulw-loop/`, keep that run's root.
4. Live checklist: `todo_write` (exactly one `in_progress`, mark completed immediately).
5. Host `/goal` slash command is optional extra; do not block on it.

When Codex/OmO docs say "call get_goal / create_goal / update_goal", translate to this protocol.
""".strip()

GROK_TOOL_MAPPING = """
## Grok Tool Mapping

| Intent | Grok tool |
| --- | --- |
| Spawn a worker | `spawn_subagent({subagent_type:"lazygrok:<role>", prompt:"TASK: ...", background:true})` |
| Wait for background result | `get_command_or_subagent_output({task_ids:[...]})` |
| Stop a runaway | `kill_command_or_subagent({task_id:"..."})` |
| Live checklist | `todo_write` |
| Edit files | `search_replace` / `write` |
| Shell | `run_terminal_command` |
| Read files | `read_file` |
| Binding goal | `# Goal` block + ulw-loop CLI (`ulw-evidence`); host `create_goal`/`update_goal` only if present |
| Worker tiers | `lazygrok:lazygrok-worker-low` / `-medium` / `-high` (or `lazygrok-executor`) |
| Reviewers | `lazygrok:lazygrok-code-reviewer`, `lazygrok-qa-executor`, `lazygrok-gate-reviewer` |
| Explorer / librarian / plan | `lazygrok:explore` / `lazygrok:librarian` / `lazygrok:prometheus` or `lazygrok-plan` |

Every `spawn_subagent` prompt must start with `TASK:`, then `DELIVERABLE`, `SCOPE`, `VERIFY`, `STOP WHEN`.
""".strip()

ULW_CLI_BOOTSTRAP = """
### Resolve ulw-loop CLI (Grok)
```sh
GROK_PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-}"
ULW_NODE="$(command -v node 2>/dev/null || true)"
ULW_CLI=
if [ -n "$GROK_PLUGIN_ROOT" ] && [ -f "$GROK_PLUGIN_ROOT/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" ]; then
  ULW_CLI="$GROK_PLUGIN_ROOT/vendor/lazygrok-hooks/ulw-loop/dist/cli.js"
elif [ -f "$HOME/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" ]; then
  ULW_CLI="$HOME/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-hooks/ulw-loop/dist/cli.js"
fi
# Convenience wrapper (optional):
ulw() { "$ULW_NODE" "$ULW_CLI" "$@"; }
# Prefer: ulw create-goals | ulw status --json | ulw record-evidence | ulw checkpoint
# `omo ulw-loop …` is also fine when omo is installed with the Codex ulw-loop subcommand.
```
State root: `.lazygrok/ulw-loop/` (or existing `.omo/ulw-loop/` for mid-run continuity).
""".strip()


def transform_text(text: str) -> str:
    out = text
    for pat, repl in REPLACEMENTS:
        out = re.sub(pat, repl, out)

    # Collapse accidental double brand
    out = out.replace("LazyGrok LazyGrok", "LazyGrok")
    out = out.replace("Grok Grok", "Grok")

    # Replace "Codex Tool Mapping" sections header leftovers
    out = out.replace("## Grok Tool Mapping", "## Grok Tool Mapping")  # no-op keep
    out = re.sub(r"##\s*Grok Tool Mapping\b", "## Grok Tool Mapping", out)
    # If a large MultiAgent table remains under a mapping header, leave it —
    # replacements already rewrote tool names.

    # get_goal / create_goal table language → Grok protocol pointer
    out = re.sub(
        r"You MUST call `create_goal`[^.]*\.",
        "Register the binding goal via the Grok goal protocol (`# Goal` + ulw-loop CLI; host create_goal only if present).",
        out,
    )
    out = re.sub(
        r"Call `get_goal`[^.]*\.",
        "Inspect host goal state if `get_goal` exists; otherwise use `ulw status --json` / goals.json.",
        out,
    )
    out = re.sub(
        r"call `update_goal\(\{status:\s*\"complete\"\}\)[^`]*",
        "mark the host goal complete only if `update_goal` exists; always checkpoint via ulw-loop CLI",
        out,
    )

    # ulw-research rename in titles that still say ULTRARESEARCH after ultraresearch ports
    out = out.replace("# ULTRARESEARCH", "# ULW-RESEARCH")
    out = out.replace("Ultraresearch", "ULW-Research")
    out = out.replace("ultraresearch", "ulw-research")

    return out


def inject_front_matter_sections(text: str, *, inject_goal: bool, inject_tools: bool) -> str:
    """After frontmatter, ensure Grok sections exist once."""
    if "---" not in text[:20]:
        body = text
        prefix = ""
    else:
        parts = text.split("---", 2)
        if len(parts) >= 3:
            prefix = "---" + parts[1] + "---"
            body = parts[2]
        else:
            prefix = ""
            body = text

    inserts = []
    if inject_goal and "Grok goal registration" not in body:
        inserts.append("\n\n" + GOAL_PROTOCOL + "\n")
    if inject_tools and "## Grok Tool Mapping" not in body and "Grok Tool Mapping" not in body[:2000]:
        # Replace leftover multi-agent mapping headers
        if re.search(r"##\s+.*Tool Mapping", body):
            body = re.sub(
                r"##\s+.*Tool Mapping[\s\S]*?(?=\n## |\Z)",
                GROK_TOOL_MAPPING + "\n\n",
                body,
                count=1,
            )
        else:
            inserts.append("\n\n" + GROK_TOOL_MAPPING + "\n")

    if inserts:
        # Insert after first H1 if present
        m = re.search(r"^# .+$", body, re.M)
        if m:
            idx = m.end()
            body = body[:idx] + "".join(inserts) + body[idx:]
        else:
            body = "".join(inserts) + body

    if inject_tools and "Resolve ulw-loop CLI" not in body and "ulw-loop" in (prefix + body)[:500].lower():
        # Prefer injecting CLI bootstrap near Bootstrap if present
        if "## Bootstrap" in body and "Resolve ulw-loop CLI" not in body:
            body = body.replace("## Bootstrap", "## Bootstrap\n\n" + ULW_CLI_BOOTSTRAP + "\n", 1)

    return prefix + body if prefix else body


def copy_tree_transformed(src: Path, dst: Path, *, inject_goal: bool = False) -> int:
    """Copy files from src→dst applying transform to text files. Returns file count."""
    if dst.exists():
        shutil.rmtree(dst)
    count = 0
    for path in src.rglob("*"):
        if not path.is_file():
            continue
        if any(p in path.parts for p in ("node_modules", ".git")):
            continue
        rel = path.relative_to(src)
        out = dst / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix.lower() in {".md", ".mjs", ".ts", ".js", ".json", ".toml", ".txt", ".yaml", ".yml"} or path.name in {
            "SKILL.md",
            "AGENTS.md",
            "README.md",
        }:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                shutil.copy2(path, out)
                count += 1
                continue
            text = transform_text(text)
            if path.name == "SKILL.md":
                text = inject_front_matter_sections(
                    text, inject_goal=inject_goal or "ulw" in src.name, inject_tools=True
                )
            # frontmatter name for renamed skills
            if src.name == "ulw-research" or (src.name == "ultraresearch"):
                text = re.sub(r"(?m)^name:\s*.*$", "name: ulw-research", text, count=1)
            out.write_text(text, encoding="utf-8")
        else:
            shutil.copy2(path, out)
        count += 1
    return count


def write_worker_agents(agents_dir: Path, workers_src: Path) -> None:
    """Create Grok .md agents from LCX worker tomls (already transformed text body)."""
    tiers = {
        "low": ("lazygrok-worker-low", "lazycodex-worker-low.toml", "SMALL"),
        "medium": ("lazygrok-worker-medium", "lazycodex-worker-medium.toml", "MID-SIZED"),
        "high": ("lazygrok-worker-high", "lazycodex-worker-high.toml", "LARGE"),
    }
    for tier, (name, toml_name, size) in tiers.items():
        src = workers_src / toml_name
        body = ""
        if src.exists():
            raw = transform_text(src.read_text(encoding="utf-8"))
            # extract developer_instructions triple-quoted block if present
            m = re.search(r'developer_instructions\s*=\s*"""(.*?)"""', raw, re.S)
            body = m.group(1).strip() if m else raw
            # Fix evidence path
            body = body.replace(".omo/evidence/", ".lazygrok/evidence/")
            body = body.replace("omo ulw-loop", "ulw-loop CLI")
        else:
            body = f"Role: {size} implementation worker for LazyGrok ultrawork tasks."
        md = f"""---
name: {name}
description: >
  LazyGrok {tier}-difficulty implementation worker, sized for {size} changes.
  Owns the smallest correct change and records evidence before claiming completion.
prompt_mode: full
model: inherit
permission_mode: default
agents_md: true
tools: ["read_file", "grep", "list_dir", "search_replace", "write", "run_terminal_command"]
---

{body}

Record evidence under `.lazygrok/evidence/` (or the active ulw-loop attempt dir).

Final response must be concise and must end with exactly:
EVIDENCE_RECORDED: <path>
"""
        (agents_dir / f"{name}.md").write_text(md, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lg-root", type=Path, required=True)
    ap.add_argument("--lcx-plugin", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    lg: Path = args.lg_root
    lcx: Path = args.lcx_plugin
    vendor_skills = lg / "vendor" / "lazygrok-skills"
    top_skills = lg / "skills"
    agents = lg / "agents"

    # Skills to fully re-sync from LCX plugin/skills
    sync_names = [
        "ulw-loop",
        "ulw-plan",
        "ulw-research",
        "start-work",
        "debugging",
        "programming",
        "frontend",
        "visual-qa",
        "git-master",
        "init-deep",
        "refactor",
        "remove-ai-slops",
        "review-work",
        "ultimate-browsing",
        "coding-agent-sessions",
        "lsp-setup",
        "lcx-doctor",
        "lcx-report-bug",
        "lcx-contribute-bug-fix",
        "ast-grep",
        "comment-checker",
        "rules",
        "lsp",
        "teammode",
        "ultrawork",
    ]

    report = []
    for name in sync_names:
        src = lcx / "skills" / name
        if not src.exists():
            report.append(f"SKIP missing LCX skill: {name}")
            continue
        dst_name = name
        dst = vendor_skills / dst_name
        if args.dry_run:
            report.append(f"WOULD port {name} → {dst}")
            continue
        n = copy_tree_transformed(src, dst, inject_goal=name.startswith("ulw") or name in {"start-work", "ultrawork"})
        report.append(f"ported {name}: {n} files → {dst.relative_to(lg)}")

    # Also publish ulw-research as alias path (catalog may still reference ultraresearch)
    if not args.dry_run and (vendor_skills / "ulw-research").exists():
        alias = vendor_skills / "ultraresearch"
        if alias.exists():
            shutil.rmtree(alias)
        shutil.copytree(vendor_skills / "ulw-research", alias)
        # restore name ultraresearch for alias discovery but description keeps ulw-research
        sk = alias / "SKILL.md"
        if sk.exists():
            t = sk.read_text(encoding="utf-8")
            t = re.sub(r"(?m)^name:\s*.*$", "name: ultraresearch", t, count=1)
            # add alias note
            if "Alias of ulw-research" not in t:
                t = t.replace(
                    "---\n\n",
                    "---\n\n> **Alias of `ulw-research`** (LazyCodex 4.19.2 name). Prefer `ulw-research`.\n\n",
                    1,
                )
            sk.write_text(t, encoding="utf-8")
        report.append("aliased ulw-research → vendor/lazygrok-skills/ultraresearch")

    # Top-level skills that should mirror vendor OmO cores (catalog-priority)
    top_mirrors = {
        "ulw-loop": True,  # REAL OmO goal conductor (replaces Ralph stub)
        "ulw-plan": True,
        "ultrawork": True,
        "start-work": False,  # keep start-work-execution separate; mirror into start-work under skills if absent
    }
    for name, replace in top_mirrors.items():
        src = vendor_skills / name
        if not src.exists():
            continue
        dst = top_skills / name
        if name == "start-work":
            # also update vendor-facing start-work only; top-level is start-work-execution
            continue
        if args.dry_run:
            report.append(f"WOULD mirror top-level skills/{name}")
            continue
        if replace or not dst.exists():
            n = copy_tree_transformed(src, dst, inject_goal=True)
            report.append(f"mirrored skills/{name}: {n} files")

    # Preserve Ralph VERIFIED loop as separate skill (was wrongly named ulw-loop)
    ralph_src_content = (lg / "commands" / "ulw-loop.md").read_text(encoding="utf-8") if (lg / "commands" / "ulw-loop.md").exists() else ""
    if not args.dry_run:
        ralph_dir = top_skills / "ulw-ralph-loop"
        ralph_dir.mkdir(parents=True, exist_ok=True)
        (ralph_dir / "SKILL.md").write_text(
            """---
name: ulw-ralph-loop
description: >
  Ralph-style ultrawork Stop continuation with mandatory verifier
  <promise>VERIFIED</promise> before exit. Use for /ulw-ralph-loop or when you
  want promise+verifier continuation without the full OmO goal ledger.
  For goal-ledger ultrawork prefer the `ulw-loop` skill (OmO create-goals / evidence).
user_invocable: true
---

# ULW Ralph Loop (promise + verifier)

This is the **Ralph continuation** variant of ultrawork — not the OmO goal-ledger
conductor. For durable multi-goal evidence loops, use skill **`ulw-loop`** +
**`ulw-evidence`**.

## Start

```text
/ulw-ralph-loop "task description" [--completion-promise=DONE] [--max-iterations=500]
```

Or use `/ralph-loop` for the non-ultrawork Ralph defaults (lower max iterations).

## Flow

1. Work until fully done → output `<promise>DONE</promise>` (not final).
2. Stop hook enters **verification** — spawn `lazygrok:lazygrok-code-reviewer` (or oracle).
3. Verifier must end with:
   ```text
   Agent: oracle
   <promise>VERIFIED</promise>
   ```
4. Only then does the loop clear.

## Cancel

`/cancel-ralph`

## State

`.lazygrok/ralph-loop.local.md` with `ultrawork: true` when started via ultrawork-style entry.

## Pair with ultrawork

Ultrawork mode (`ulw` keyword / skill `ultrawork`) still applies. Prefer binding
goals via `# Goal` + `ulw-evidence` even in Ralph mode so evidence survives compaction.
""",
            encoding="utf-8",
        )
        report.append("wrote skills/ulw-ralph-loop (Ralph VERIFIED split out of ulw-loop)")

        # Update top-level ulw-loop frontmatter for discoverability
        ulw_skill = top_skills / "ulw-loop" / "SKILL.md"
        if ulw_skill.exists():
            t = ulw_skill.read_text(encoding="utf-8")
            if "user_invocable" not in t[:400]:
                t = t.replace(
                    "metadata:\n  short-description:",
                    "user_invocable: true\nmetadata:\n  short-description:",
                    1,
                )
            if "OmO-style goal ledger" not in t:
                t = t.replace(
                    "# ulw-loop\n",
                    "# ulw-loop\n\n"
                    "> **OmO-style goal ledger ultrawork** for Grok (LazyCodex port).\n"
                    "> For Ralph promise+verifier only, see skill `ulw-ralph-loop`.\n"
                    "> For host-goal + evidence CLI details, see skill `ulw-evidence`.\n",
                    1,
                )
            ulw_skill.write_text(t, encoding="utf-8")

        # Commands: point /ulw-loop at OmO skill; keep ralph path documented
        cmd = lg / "commands" / "ulw-loop.md"
        cmd.write_text(
            """---
description: >
  Activate OmO-style ULW goal-ledger loop on Grok: create-goals, evidence
  criteria, Manual-QA channels, worker delegation via spawn_subagent, Stop
  resume. Prefer skill ulw-loop + ulw-evidence. For Ralph promise+verifier
  only, use /ulw-ralph-loop or skill ulw-ralph-loop.
---

You are now in **ulw-loop** (OmO goal-ledger ultrawork on Grok).

## Mandatory skill load

1. Read skill `ulw-loop` (`SKILL.md` + `references/full-workflow.md` as needed).
2. Read skill `ulw-evidence` for CLI create-goals / record-evidence / checkpoint.
3. If the prompt also contains `ultrawork`/`ulw`, follow skill `ultrawork` directive.

## Goal binding on Grok

Host `create_goal` / `update_goal` may be absent — that is normal.
- Open with a binding `# Goal` block.
- Create durable goals via the ulw-loop CLI (see `ulw-evidence`).
- Track live steps with `todo_write`.

## Workers

Delegate implementation/QA with `spawn_subagent` and:
- `lazygrok:lazygrok-worker-low|medium|high`
- `lazygrok:lazygrok-executor`
- reviewers: `lazygrok-code-reviewer`, `lazygrok-qa-executor`, `lazygrok-gate-reviewer`

## Cancel / related

- `/cancel-ralph` stops Ralph/ultrawork promise loops.
- `/stop-continuation` stops broader continuations.
- Ralph-only verifier loop: skill `ulw-ralph-loop`.
""",
            encoding="utf-8",
        )
        report.append("rewrote commands/ulw-loop.md → OmO goal ledger")

        # Optional ralph command
        (lg / "commands" / "ulw-ralph-loop.md").write_text(
            """---
description: >
  Ralph-style ultrawork Stop continuation requiring verifier
  <promise>VERIFIED</promise>. Not the OmO goal-ledger loop — use /ulw-loop for that.
---

Load skill `ulw-ralph-loop` and follow it. Prefer also loading `ultrawork` and
`ulw-evidence` so goals and evidence remain durable.
""",
            encoding="utf-8",
        )
        report.append("wrote commands/ulw-ralph-loop.md")

        # Workers
        workers_src = lcx / "components" / "ultrawork" / "agents"
        write_worker_agents(agents, workers_src)
        report.append("wrote agents/lazygrok-worker-{low,medium,high}.md")

        # Also copy transformed worker tomls into vendor ultrawork agents if present
        v_agents = lg / "vendor" / "lazygrok-hooks" / "ultrawork" / "agents"
        if v_agents.exists() and workers_src.exists():
            for p in workers_src.glob("lazycodex-worker-*.toml"):
                text = transform_text(p.read_text(encoding="utf-8"))
                # Keep lazycodex- names in toml for LCX parity AND write lazygrok- copies
                (v_agents / p.name).write_text(text, encoding="utf-8")
                lg_name = p.name.replace("lazycodex-", "lazygrok-")
                text2 = text.replace("name = \"lazycodex-", "name = \"lazygrok-")
                text2 = text2.replace("name = 'lazycodex-", "name = 'lazygrok-")
                (v_agents / lg_name).write_text(text2, encoding="utf-8")
            report.append("synced worker tomls under vendor/lazygrok-hooks/ultrawork/agents")

        # hooks.json: widen executor-verify matcher for workers
        hooks = lg / "hooks" / "hooks.json"
        h = hooks.read_text(encoding="utf-8")
        old = r"^lazygrok-executor$|^lazycodex-executor$"
        new = (
            r"^lazygrok-executor$|^lazycodex-executor$"
            r"|^lazygrok-worker-(low|medium|high)$"
            r"|^lazycodex-worker-(low|medium|high)$"
        )
        if "lazygrok-worker-" not in h:
            h2 = h.replace(old, new)
            if h2 == h:
                # try escaped form in JSON
                h2 = h.replace(
                    "^lazygrok-executor$|^lazycodex-executor$",
                    new,
                )
            hooks.write_text(h2, encoding="utf-8")
            report.append("widened SubagentStop executor-verify matcher for workers")
        else:
            report.append("hooks matcher already includes workers")

        # Patch ultrawork skill-pointer dist for Grok (keep goal fallback)
        pointer = lg / "vendor" / "lazygrok-hooks" / "ultrawork" / "dist" / "cli.js"
        if pointer.exists():
            pt = pointer.read_text(encoding="utf-8")
            # Ensure Grok path language is present
            if "normal Grok path" not in pt and "create_goal" in pt:
                # leave existing Grok-patched pointer; only ensure ulw-evidence mention
                if "ulw-loop create-goals" not in pt and "ulw-evidence" not in pt:
                    pt = pt.replace(
                        "# Goal` block",
                        "# Goal` block; also prefer ulw-loop create-goals / ulw-evidence when CLI available",
                    )
                    pointer.write_text(pt, encoding="utf-8")
                    report.append("patched ultrawork skill-pointer for ulw-evidence mention")
                else:
                    report.append("ultrawork pointer already Grok-aware")
            else:
                report.append("ultrawork pointer already Grok-aware")

        # Sync ultrawork directive from LCX with transform into vendor component
        lcx_dir = lcx / "components" / "ultrawork" / "directive.md"
        if lcx_dir.exists():
            d = transform_text(lcx_dir.read_text(encoding="utf-8"))
            # Force Grok goal section name
            d = d.replace(
                "## 1. Create the goal with binding success criteria",
                "## 1. Register the binding goal (Grok-native channels)",
            )
            d = d.replace(
                "## 3. Register obsessive todos via `todo_write`",
                "## 3. Register obsessive todos via `todo_write`",
            )
            # Ensure goal protocol near section 1
            if "Grok often does **not** inject" not in d:
                d = d.replace(
                    "## 1. Register the binding goal (Grok-native channels)",
                    "## 1. Register the binding goal (Grok-native channels)\n\n"
                    + GOAL_PROTOCOL
                    + "\n",
                    1,
                )
            (lg / "vendor" / "lazygrok-hooks" / "ultrawork" / "directive.md").write_text(
                d, encoding="utf-8"
            )
            # Mirror into skills/ultrawork if body is the skill
            report.append("synced vendor ultrawork/directive.md from 4.19.2 (Grok-transformed)")

        # teammode: ensure n/a banner on Grok
        for tm in [
            vendor_skills / "teammode" / "SKILL.md",
            lg / "vendor" / "omo-skills" / "teammode" / "SKILL.md",
        ]:
            if tm.exists():
                t = tm.read_text(encoding="utf-8")
                if "not available on Grok" not in t and "n/a" not in t[:800].lower():
                    t = t.replace(
                        "---\n\n",
                        "---\n\n"
                        "> **Grok: multi_agent_v2 / team mode transport is n/a.** "
                        "Use `spawn_subagent` + LazyGrok agents instead. "
                        "Thread-title hooks are no-ops without Codex create_thread.\n\n",
                        1,
                    )
                    tm.write_text(t, encoding="utf-8")
                    report.append(f"added teammode n/a banner: {tm.relative_to(lg)}")

        # Copy shared-skills ultimate-browsing fully if plugin skill was thin
        # (already handled via sync list)

        # Update plugin.json description version note
        pj = lg / "plugin.json"
        data = pj.read_text(encoding="utf-8")
        if "4.19.2" not in data:
            data = data.replace(
                "22 skills",
                "skills (LazyCodex 4.19.2 port)",
            )
            # bump description fragment
            data = re.sub(
                r'"version":\s*"[^"]+"',
                '"version": "0.4.0"',
                data,
                count=1,
            )
            pj.write_text(data, encoding="utf-8")
            report.append("bumped plugin.json version to 0.4.0")

        # Port receipt
        receipt = lg / "docs" / "lazycodex-4.19.2-port-receipt.md"
        receipt.write_text(
            "# LazyCodex 4.19.2 → LazyGrok port receipt\n\n"
            "Generated by `scripts/port-lazycodex-to-grok.py`.\n\n"
            "## Report\n\n"
            + "\n".join(f"- {line}" for line in report)
            + "\n\n## Grok limitations preserved\n\n"
            "- No multi_agent_v2 / teammode transport\n"
            "- Host create_goal/update_goal optional; # Goal + ulw-loop CLI + todo_write\n"
            "- No npm auto-update SessionStart\n"
            "- spawn_subagent / todo_write / search_replace / run_terminal_command\n"
            "- State under `.lazygrok/` (accept mid-run `.omo/`)\n"
            "- Ralph VERIFIED loop split to `ulw-ralph-loop`; `ulw-loop` is OmO goal ledger\n",
            encoding="utf-8",
        )
        report.append(f"wrote {receipt.relative_to(lg)}")

    print("\n".join(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
