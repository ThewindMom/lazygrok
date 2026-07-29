#!/usr/bin/env python3
"""Port LazyCodex/OmO skill and agent text to Grok-native LazyGrok tooling.

Transforms are mechanical + a few structural rewrites. Goal of this script:
bring content from lazycodex-ai@4.19.3 into LazyGrok while mapping Codex-only
APIs to Grok equivalents and preserving Grok goal fallbacks (# Goal, ulw-evidence,
todo_write, spawn_subagent, .lazygrok/).
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

# Order matters for some replacements.
REPLACEMENTS: list[tuple[str, str]] = [
    (r"code-yeongyu/lazycodex", r"ThewindMom/lazygrok"),
    (r"openai/codex", r"xai-org/grok-build"),
    (r"LAZYCODEX_SOURCE_ROOT", r"LAZYGROK_SOURCE_ROOT"),
    (r"openai-codex-source", r"grok-build-source"),
    # State roots — prefer LazyGrok; keep .omo as accepted legacy mid-run root
    (r"\.omo/ulw-loop", r".lazygrok/ulw-loop"),
    (r"\.omo/evidence", r".lazygrok/evidence"),
    (r"\.omo/plans", r".lazygrok/plans"),
    (r"\.omo/drafts", r".lazygrok/drafts"),
    (r"\.omo/teams", r".lazygrok/teams"),
    (r"\.omo/boulder\.json", r".lazygrok/boulder.json"),
    (r"\.omo/start-work", r".lazygrok/start-work"),
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
    (r"\bcodex:<session_id>", r"grok:<session_id>"),
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
    (
        r"Directly open the screenshots with the available image-viewing tool "
        r"\(`view_image`, `look_at`, or browser inspection\) before judging\.",
        "Inspect rendered web captures through Grok Build's Playwright/browser "
        "surface before judging. If a capture exists only as a local raster path "
        "and no rendered browser surface is available, return INCONCLUSIVE and "
        "request an inspectable attachment instead of claiming visual review.",
    ),
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

GROK_WORKTREE_BOUNDARY = """
# Worktree boundary

Ordinary ULW does not create a worktree solely because `ulw` was requested.
Use a task-owned worktree when the user requests isolation, when work will be
delivered as a PR/branch, or when parallel writers could conflict.

- Whole-session isolation must be selected before Grok starts. Hooks cannot
  change the cwd of an already-running host process.
- Grok Build `0.2.114` parses `--worktree` in headless `-p` mode but does not
  materialize it. For a headless isolated run, the reliable host sequence is
  `git worktree add --detach <absolute-path> HEAD`, then
  `grok --cwd <absolute-path> -p "ulw <task>"`.
- If an active session reaches an isolation boundary, create or select the
  task-owned worktree first, verify it with `git worktree list --porcelain`,
  record its absolute path in the notepad/Boulder state, and run every later
  edit, shell command, test, and evidence capture inside it.
- Never claim worktree isolation merely because a flag was present. Prove the
  effective cwd is listed as a worktree and that the source checkout stayed
  unchanged.
""".strip()

GROK_TEAMMODE_SKILL = """---
name: teammode
description: >
  Grok: durable team orchestration is unavailable. Use parallel
  spawn_subagent workers instead. Trigger when user asks for a team of agents
  so you route to fan-out (not a separate team transport).
---

# Parallel agents on Grok (not durable teams)

> **Status:** Grok Build has no durable multi-member team transport. Use parallel one-shot subagents.

## What to do

| Need | Tool |
| --- | --- |
| Parallel research | Same-turn `spawn_subagent` for `lazygrok:explore` and/or `lazygrok:librarian` |
| Parallel implementation | One `spawn_subagent` per independent slice (`lazygrok:lazygrok-worker-*` / `hephaestus`) |
| Wait | `get_command_or_subagent_output({ task_ids, timeout_ms })` |
| Stop | `kill_command_or_subagent` |
| Fixed multi-lane research | Host `workflow` tool when appropriate |

### Spawn contract

```
spawn_subagent({
  subagent_type: "lazygrok:explore",
  prompt: "TASK: …\\nDELIVERABLE: …\\nSCOPE: …\\nVERIFY: …\\nSTOP WHEN: …",
  background: true
})
```

- Depth max **1**
- Parent is the only orchestrator
- Only call tools from this session's tool list (`rules/15-grok-tools-only.md`)

If the user asked for "teammode", say once that Grok uses parallel `spawn_subagent` for independent scopes, then fan out.
"""

GROK_RESEARCH_SWARM = """## Run the swarm with parallel Grok subagents

Saturation research on Grok uses parallel `spawn_subagent` workers. Grok Build
does not expose the upstream durable team transport, mailbox, or thread lifecycle,
so the parent remains the only orchestrator and synthesizes every worker result.
Use one worker per independent research axis and launch expansion waves when a
result creates a new axis.

- **One worker per axis — by part, ownership, or perspective, never a job title.**
  Each Phase 0 axis owns one concrete slice: a codebase part, a source territory,
  or a question lens. No two workers share an angle.
- **Many workers when the axes justify it.** Prefer 5-8 distinct workers for a
  genuinely broad search. Add a skeptic or red-team axis for
  hyperdebate/ultradebate.
- **Workers return evidence to the parent.** Each result includes leads,
  contradictions, and dead ends. Workers never write shared session files.
- **The parent expands leads.** Journal each returned lead and launch its
  expansion in the next wave; do not depend on peer-to-peer messaging.
"""

UNSUPPORTED_GROK_TOOL_ROUTE = re.compile(
    r"\bcodex_app\."
    r"|\bteam_mode\b"
    r"|\bmulti_agent_v[12]\b"
    r"|\bteam_(?:create|task_create|status|list|delete|shutdown_request|"
    r"approve_shutdown|send_message)\b"
)

REVIEW_WORK_ISOLATION_GATE = """
## Phase -1: Mandatory branch-review isolation gate

For every PR or branch review, complete this gate before reading the changed
branch, collecting its diff or files, running tests, or spawning reviewers:

```bash
# List trusted local refs first, then copy only the object ID from the matching
# row. Never interpolate a user-supplied ref into shell syntax.
git for-each-ref --format='%(refname)%09%(objectname)' refs/heads refs/remotes
REVIEW_HEAD='<hex-object-id-from-the-matching-row>'
case "$REVIEW_HEAD" in
  ''|*[!0-9a-f]*) echo "invalid review object ID" >&2; exit 1 ;;
esac
git cat-file -e "${REVIEW_HEAD}^{commit}" || exit 1
REVIEW_ROOT="$(mktemp -d)" || exit 1
REVIEW_WT="${REVIEW_ROOT}/review"
if ! git worktree add --detach --no-checkout "$REVIEW_WT" "$REVIEW_HEAD"; then
  rmdir "$REVIEW_ROOT" 2>/dev/null || true
  exit 1
fi
if ! REVIEW_GIT_DIR="$(git -C "$REVIEW_WT" rev-parse --absolute-git-dir)"; then
  git worktree remove --force "$REVIEW_WT"
  rmdir "$REVIEW_ROOT" 2>/dev/null || true
  exit 1
fi
printf 'REVIEW_HEAD=%s\nREVIEW_ROOT=%s\nREVIEW_WT=%s\nREVIEW_GIT_DIR=%s\n' \
  "$REVIEW_HEAD" "$REVIEW_ROOT" "$REVIEW_WT" "$REVIEW_GIT_DIR"
```

`git worktree add --no-checkout` registers an empty worktree without
materializing reviewed files. Materialization can invoke Git filters, so run
the following command inside the same effective sandbox required for tests,
with cwd set to the printed `REVIEW_WT`. Grok terminal calls may use separate
shells: copy the four exact printed values into every later command and never
assume shell variables persist. Never run this on the unsandboxed host:

```bash
REVIEW_HEAD='<literal-printed-hex-object-id>'
git -c core.hooksPath=/dev/null checkout --detach "$REVIEW_HEAD" || exit 1
git rev-parse HEAD
git worktree list --porcelain
```

The `git worktree list --porcelain` output must contain the exact
`$REVIEW_WT` path at `$REVIEW_HEAD`. Run every changed-branch read, diff, test,
QA command, and filesystem-capable review lane from `$REVIEW_WT`; tell every
subagent that this exact path is its required cwd. The original checkout is
read-only context.

`git archive`, `git show`, copied files, and extracted temporary trees are not
substitutes for this gate. A detached review worktree does not modify either
branch. If the worktree cannot be created or verified, return a blocking review
failure instead of continuing in the original checkout.

A worktree isolates Git checkout state; it does not sandbox processes. Treat
reviewed code as untrusted. Both the checkout that materializes reviewed files
and every repository-provided command require the user's applicable
permissions and an effective host/container sandbox that denies credentials,
network, and writes outside `$REVIEW_WT`, except for the exact printed
`REVIEW_GIT_DIR` that Git must update for this linked worktree. No other part of
the parent repository or host is writable. If safe materialization or execution
is not available, clean the empty worktree, perform static review, and report
hands-on QA as blocking or `INCONCLUSIVE`.

Once `$REVIEW_ROOT` is allocated, cleanup is a mandatory invariant. Before
**every** blocking or successful return, including verification failure,
collection failure, reviewer timeout, or interruption, preserve any evidence
worth retaining and then run:

```bash
if git worktree list --porcelain | grep -Fqx "worktree $REVIEW_WT"; then
  git worktree remove --force "$REVIEW_WT"
fi
rmdir "$REVIEW_ROOT" 2>/dev/null || true
```

Do not rely on a shell `trap`: Grok terminal calls may use separate shells.
Set `REVIEW_WT` and `REVIEW_ROOT` to their exact printed literal values, then
run the cleanup block explicitly on every exit path after allocation. Any
artifact path cited in the final report must still resolve after cleanup; copy
worktree-local evidence to a registered stable path outside `$REVIEW_ROOT` and
cite that preserved path before removing the worktree.
""".strip()

ULW_CLI_BOOTSTRAP = """
### Resolve ulw-loop CLI (Grok)
```sh
GROK_PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-}"
ULW_NODE="$(command -v node 2>/dev/null || true)"
ULW_CLI=
if [ -n "$GROK_PLUGIN_ROOT" ] && [ -f "$GROK_PLUGIN_ROOT/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" ]; then
  ULW_CLI="$GROK_PLUGIN_ROOT/vendor/lazygrok-hooks/ulw-loop/dist/cli.js"
else
  for candidate in "$HOME"/.grok/installed-plugins/lazygrok-*/vendor/lazygrok-hooks/ulw-loop/dist/cli.js; do
    [ -f "$candidate" ] || continue
    ULW_CLI="$candidate"
    break
  done
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

    if "\nname: teammode\n" in out:
        return GROK_TEAMMODE_SKILL

    if "## Run the swarm as a cooperating team" in out:
        out, substitutions = re.subn(
            r"## Run the swarm as a cooperating team[\s\S]*?(?=## Worker ground rules)",
            GROK_RESEARCH_SWARM + "\n\n",
            out,
            count=1,
        )
        if substitutions != 1:
            raise ValueError(
                "ulw-research port changed shape: cooperating-team section "
                "could not be replaced"
            )

    if "\nname: refactor\n" in out:
        template_marker = "export const REFACTOR_TEMPLATE = `"
        team_marker = "\n`\n\nexport const REFACTOR_TEAM_MODE_ADDENDUM = `"
        frontmatter = out.split("---", 2)
        if template_marker in out and len(frontmatter) == 3:
            template = out.split(template_marker, 1)[1]
            template = template.split(team_marker, 1)[0]
            out = f"---{frontmatter[1]}---\n\n{template.rstrip()}\n"
        elif team_marker in out:
            out = out.split(team_marker, 1)[0].rstrip() + "\n"

    if "# Phase 2 + 3 — Hypothesis Formation & Parallel Investigation" in out:
        out = re.sub(
            r"### Path A: Team mode ENABLED[\s\S]*?(?=### Path B: Team mode DISABLED)",
            "",
            out,
            count=1,
        )
        out = out.replace(
            "### Path B: Team mode DISABLED",
            "### Grok parallel investigation",
            1,
        )
        out = out.replace(
            "Fan out async explore/deep subagents instead.",
            "Grok has no durable `team_*` transport. Fan out async explore/deep subagents with `spawn_subagent`.",
            1,
        )

    out = out.replace(
        "**Parallel investigation** — team mode `debug-squad` when enabled, async subagents otherwise",
        "**Parallel investigation** — one hypothesis per Grok `spawn_subagent`, with the parent synthesizing results",
    )

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
    out = out.replace(
        '"$GROK_HOME"/plugins/cache/lazygrok/*/components/ulw-loop/dist/cli.js',
        '"$GROK_HOME"/installed-plugins/lazygrok-*/vendor/lazygrok-hooks/ulw-loop/dist/cli.js '
        '"$GROK_HOME"/plugins/cache/lazygrok/*/components/ulw-loop/dist/cli.js',
    )

    if "\nname: review-work\n" in out:
        out = out.replace(
            "Review PRs and branches from a dedicated review worktree only: "
            "create or attach one with `git worktree add <path> <branch>` "
            "before collecting changed files, diff, file contents, or running "
            "checks. The main worktree is read-only context; never checkout, "
            "test, or edit the review branch there.",
            "Review PRs and branches only through the mandatory Phase -1 "
            "isolation gate above. Do not create, attach, or materialize a "
            "review worktree through any alternate command. The main worktree "
            "is read-only context; never checkout, test, or edit the review "
            "branch there.",
        )
        isolation_marker = "## Phase -1: Mandatory branch-review isolation gate"
        review_heading = "# Review Work - 5-Agent Parallel Review Orchestrator"
        if isolation_marker not in out:
            if review_heading not in out:
                raise ValueError(
                    "review-work port changed shape: isolation gate insertion "
                    "heading is missing"
                )
            out = out.replace(
                review_heading,
                REVIEW_WORK_ISOLATION_GATE + "\n\n" + review_heading,
                1,
            )

    return out


def remove_unsupported_hook_routes(hooks_path: Path) -> int:
    data = json.loads(hooks_path.read_text(encoding="utf-8"))
    removed = 0
    for event, groups in data.get("hooks", {}).items():
        if not isinstance(groups, list):
            continue
        kept = []
        for group in groups:
            matcher = str(group.get("matcher", ""))
            commands = [
                str(hook.get("command", ""))
                for hook in group.get("hooks", [])
                if isinstance(hook, dict)
            ]
            unsupported = (
                "create_thread" in matcher
                or "codex_app" in matcher
                or any("teammode post-tool-use" in command for command in commands)
                or any("telemetry session-start" in command for command in commands)
            )
            if unsupported:
                removed += 1
            else:
                kept.append(group)
        data["hooks"][event] = kept
    if removed:
        hooks_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    return removed


def prune_unsupported_runtime(plugin_root: Path) -> list[str]:
    targets = [
        plugin_root / "vendor" / "lazygrok-hooks" / "teammode",
        plugin_root / "vendor" / "lazygrok-hooks" / "telemetry",
        plugin_root / "vendor" / "lazygrok-skills" / "teammode" / "agents",
        plugin_root / "vendor" / "lazygrok-skills" / "teammode" / "scripts",
    ]
    removed: list[str] = []
    for target in targets:
        if not target.exists():
            continue
        shutil.rmtree(target)
        removed.append(str(target.relative_to(plugin_root)))
    return removed


def find_unsupported_active_tool_routes(plugin_root: Path) -> list[str]:
    manifest = json.loads((plugin_root / "plugin.json").read_text(encoding="utf-8"))
    skill_files: set[Path] = set()
    hook_files: set[Path] = {plugin_root / "hooks" / "hooks.json"}
    teammode_runtime_files: set[Path] = set()
    for configured_root in manifest["skills"]:
        active_root = plugin_root / configured_root
        skill_files.update(active_root.rglob("SKILL.md"))
        hook_files.update(active_root.rglob("hooks.json"))
        teammode_root = active_root / "teammode"
        if teammode_root.exists():
            teammode_runtime_files.update(
                path for path in teammode_root.rglob("*") if path.is_file()
            )

    offenders: list[str] = []
    for path in sorted(skill_files | hook_files | teammode_runtime_files):
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), 1
        ):
            if UNSUPPORTED_GROK_TOOL_ROUTE.search(line) or (
                path.name == "hooks.json"
                and (
                    "create_thread" in line
                    or "teammode post-tool-use" in line
                    or "telemetry session-start" in line
                )
            ):
                offenders.append(
                    f"{path.relative_to(plugin_root)}:{line_number}: {line.strip()}"
                )

    return offenders


def normalize_skill_user_invocable(path: Path, *, add_if_missing: bool = False) -> bool:
    if not path.exists():
        return False

    text = path.read_text(encoding="utf-8")
    updated = re.sub(
        r"(?m)^user_invocable:\s*(true|false)$",
        r"user-invocable: \1",
        text,
        count=1,
    )
    if add_if_missing and "user-invocable:" not in updated[:800]:
        updated = updated.replace(
            "metadata:\n  short-description:",
            "user-invocable: true\nmetadata:\n  short-description:",
            1,
        )
    path.write_text(updated, encoding="utf-8")
    return updated != text


def synchronize_tree_copies(canonical: Path, copies: list[Path]) -> int:
    changed = 0
    canonical_files = {
        path.relative_to(canonical): path.read_bytes()
        for path in canonical.rglob("*")
        if path.is_file()
    }
    for destination in copies:
        destination_files = (
            {
                path.relative_to(destination): path.read_bytes()
                for path in destination.rglob("*")
                if path.is_file()
            }
            if destination.exists()
            else {}
        )
        if destination_files == canonical_files:
            continue
        if destination.exists():
            shutil.rmtree(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(canonical, destination)
        changed += 1
    return changed


def safe_top_level_skill_files(skill_root: Path, allowed_root: Path) -> list[Path]:
    if skill_root.is_symlink() or not skill_root.is_dir():
        return []

    try:
        resolved_allowed_root = allowed_root.resolve(strict=True)
        resolved_skill_root = skill_root.resolve(strict=True)
        resolved_skill_root.relative_to(resolved_allowed_root)
    except (FileNotFoundError, RuntimeError, ValueError):
        return []

    safe_files = []
    for skill_dir in sorted(skill_root.iterdir()):
        if skill_dir.is_symlink() or not skill_dir.is_dir():
            continue
        skill_file = skill_dir / "SKILL.md"
        if skill_file.is_symlink() or not skill_file.is_file():
            continue
        try:
            resolved_skill_file = skill_file.resolve(strict=True)
            resolved_skill_file.relative_to(resolved_skill_root)
            resolved_skill_file.relative_to(resolved_allowed_root)
        except (FileNotFoundError, RuntimeError, ValueError):
            continue
        safe_files.append(skill_file)
    return safe_files


def normalize_ultrawork_skill(path: Path) -> bool:
    if not path.exists():
        return False

    text = path.read_text(encoding="utf-8")
    updated = re.sub(
        r"description: >\n(?:  .*\n)+?metadata:",
        "description: >\n"
        "  Binding ultrawork mode directive for LazyGrok (omo) on Grok. When a prompt\n"
        "  contains ultrawork or ulw, Grok's native skill matching selects this skill;\n"
        "  Before any tool call or other assistant text, output exactly\n"
        "  `ULTRAWORK MODE ENABLED!` as the first line; do not announce the skill read.\n"
        "  Then read this file completely and follow every rule for the rest of the task.\n"
        "  UserPromptSubmit hooks remain compatibility support only; passive hook stdout\n"
        "  is not the Grok activation path.\n"
        "  Upstream: code-yeongyu/lazycodex plugins/omo@4.19.3 (Grok harness renames only).\n"
        "metadata:",
        text,
        count=1,
    )
    updated = updated.replace(
        '1. Always: `node "${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" '
        'create-goals --brief "<objective>" --json`\n'
        "   Prefer `.lazygrok/ulw-loop/`; keep `.omo/ulw-loop/` if that run already uses it.",
        "1. Always: copy `CURRENT_GROK_SESSION_ID` from this turn's injected hook context and run\n"
        '   `node "${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" '
        'create-goals --session-id "<CURRENT_GROK_SESSION_ID>" --brief "<objective>" --json`.\n'
        "   Use that value exactly: do not generate, rename, timestamp, or suffix it. Pass the same\n"
        "   `--session-id` on every later ulw-loop CLI call. Only if `create-goals` explicitly\n"
        "   rejects an already-complete aggregate may a continued conversation derive\n"
        "   `<CURRENT_GROK_SESSION_ID>-<short-purpose>` for the new run. Never derive Grok scope\n"
        "   from ambient `CODEX_SESSION_ID` or `CODEX_THREAD_ID`. Prefer `.lazygrok/ulw-loop/`;\n"
        "   keep `.omo/ulw-loop/` if that run already uses it.",
    )
    if "# Worktree boundary" not in updated:
        marker = "# CODING MULTI-AGENT"
        if marker not in updated:
            raise ValueError(
                "ultrawork port changed shape: coding multi-agent heading is missing"
            )
        updated = updated.replace(
            marker,
            GROK_WORKTREE_BOUNDARY + "\n\n" + marker,
            1,
        )
    path.write_text(updated, encoding="utf-8")
    metadata_changed = normalize_skill_user_invocable(path, add_if_missing=True)
    return updated != text or metadata_changed


def inject_front_matter_sections(
    text: str, *, inject_goal: bool, inject_tools: bool
) -> str:
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
    if (
        inject_tools
        and "## Grok Tool Mapping" not in body
        and "Grok Tool Mapping" not in body[:2000]
    ):
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

    if (
        inject_tools
        and "Resolve ulw-loop CLI" not in body
        and "ulw-loop" in (prefix + body)[:500].lower()
    ):
        # Prefer injecting CLI bootstrap near Bootstrap if present
        if "## Bootstrap" in body and "Resolve ulw-loop CLI" not in body:
            body = body.replace(
                "## Bootstrap", "## Bootstrap\n\n" + ULW_CLI_BOOTSTRAP + "\n", 1
            )

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
        if path.suffix.lower() in {
            ".md",
            ".mjs",
            ".ts",
            ".js",
            ".json",
            ".toml",
            ".txt",
            ".yaml",
            ".yml",
        } or path.name in {
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
                    text,
                    inject_goal=inject_goal or "ulw" in src.name,
                    inject_tools=True,
                )
            # frontmatter name for renamed skills
            if src.name == "ulw-research" or (src.name == "ultraresearch"):
                text = re.sub(r"(?m)^name:\s*.*$", "name: ulw-research", text, count=1)
            out.write_text(text, encoding="utf-8")
        else:
            shutil.copy2(path, out)
        count += 1
    return count


def skill_destination(name: str, vendor_skills: Path, top_skills: Path) -> Path:
    if name == "start-work":
        return top_skills / "start-work-execution"
    return vendor_skills / name


def canonical_skill_path(name: str, top_skills: Path) -> Path | None:
    if name == "ulw-loop":
        return top_skills / "ulw-loop"
    if name == "start-work":
        return top_skills / "start-work-execution"
    return None


def write_worker_agents(agents_dir: Path, workers_src: Path) -> None:
    """Create Grok .md agents from LCX worker tomls (already transformed text body)."""
    tiers = {
        "low": ("lazygrok-worker-low", "lazycodex-worker-low.toml", "SMALL"),
        "medium": (
            "lazygrok-worker-medium",
            "lazycodex-worker-medium.toml",
            "MID-SIZED",
        ),
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
        dst = skill_destination(name, vendor_skills, top_skills)
        canonical = canonical_skill_path(name, top_skills)
        if canonical is not None and canonical.exists():
            report.append(
                f"preserved canonical Grok {name}: {canonical.relative_to(lg)}"
            )
            continue
        if args.dry_run:
            report.append(f"WOULD port {name} → {dst}")
            continue
        n = copy_tree_transformed(
            src,
            dst,
            inject_goal=name.startswith("ulw") or name in {"start-work", "ultrawork"},
        )
        report.append(f"ported {name}: {n} files → {dst.relative_to(lg)}")

    stale_start_work = vendor_skills / "start-work"
    if not args.dry_run and stale_start_work.exists():
        shutil.rmtree(stale_start_work)
        report.append("removed stale duplicate vendor/lazygrok-skills/start-work")

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
                    "---\n\n> **Alias of `ulw-research`** (LazyCodex 4.19.3 name). Prefer `ulw-research`.\n\n",
                    1,
                )
            sk.write_text(t, encoding="utf-8")
        report.append("aliased ulw-research → vendor/lazygrok-skills/ultraresearch")

    # Top-level skills that should mirror vendor OmO cores (catalog-priority)
    top_mirrors = {
        "ulw-loop": False,  # REAL OmO goal conductor (replaces Ralph stub)
        "ulw-plan": False,
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
user-invocable: true
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
        report.append(
            "wrote skills/ulw-ralph-loop (Ralph VERIFIED split out of ulw-loop)"
        )

        # Update top-level ulw-loop frontmatter for discoverability
        ulw_skill = top_skills / "ulw-loop" / "SKILL.md"
        if ulw_skill.exists():
            t = ulw_skill.read_text(encoding="utf-8")
            if "user-invocable" not in t[:400]:
                t = t.replace(
                    "metadata:\n  short-description:",
                    "user-invocable: true\nmetadata:\n  short-description:",
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

- `/cancel-ralph` stops Ralph-family promise loops, including the explicit `/ulw-ralph-loop` variant; it does not cancel this ULW goal ledger.
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
                text2 = text.replace('name = "lazycodex-', 'name = "lazygrok-')
                text2 = text2.replace("name = 'lazycodex-", "name = 'lazygrok-")
                (v_agents / lg_name).write_text(text2, encoding="utf-8")
            report.append(
                "synced worker tomls under vendor/lazygrok-hooks/ultrawork/agents"
            )

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
        removed_hooks = remove_unsupported_hook_routes(hooks)
        report.append(
            "removed "
            f"{removed_hooks} unsupported teammode/telemetry hook registration(s)"
        )

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
                    report.append(
                        "patched ultrawork skill-pointer for ulw-evidence mention"
                    )
                else:
                    report.append("ultrawork pointer already Grok-aware")
            else:
                report.append("ultrawork pointer already Grok-aware")

        grok_prompt = lg / "prompts" / "ultrawork" / "grok.md"
        hook_directive = lg / "vendor" / "lazygrok-hooks" / "ultrawork" / "directive.md"
        lcx_dir = lcx / "components" / "ultrawork" / "directive.md"
        if grok_prompt.exists():
            hook_directive.write_text(
                grok_prompt.read_text(encoding="utf-8"), encoding="utf-8"
            )
            report.append(
                "synced vendor ultrawork/directive.md from canonical Grok prompt"
            )
        elif lcx_dir.exists():
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
            hook_directive.write_text(d, encoding="utf-8")
            report.append("synced vendor ultrawork/directive.md from 4.19.3 fallback")

        hook_ultrawork_skill = (
            lg
            / "vendor"
            / "lazygrok-hooks"
            / "ultrawork"
            / "skills"
            / "ultrawork"
            / "SKILL.md"
        )
        ultrawork_skill_paths = [
            hook_ultrawork_skill,
            top_skills / "ultrawork" / "SKILL.md",
            vendor_skills / "ultrawork" / "SKILL.md",
        ]
        normalize_ultrawork_skill(hook_ultrawork_skill)
        canonical_ultrawork = hook_ultrawork_skill.read_text(encoding="utf-8")
        normalized = 0
        for path in ultrawork_skill_paths[1:]:
            if (
                not path.exists()
                or path.read_text(encoding="utf-8") != canonical_ultrawork
            ):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(canonical_ultrawork, encoding="utf-8")
                normalized += 1
        report.append(
            f"synchronized native Grok ultrawork skill into {normalized} changed copies"
        )

        canonical_ulw_loop = top_skills / "ulw-loop"
        ulw_loop_skill_copies = [
            vendor_skills / "ulw-loop",
            lg
            / "vendor"
            / "lazygrok-hooks"
            / "ulw-loop"
            / "skills"
            / "ulw-loop",
        ]
        normalize_skill_user_invocable(
            canonical_ulw_loop / "SKILL.md", add_if_missing=True
        )
        normalized = synchronize_tree_copies(
            canonical_ulw_loop, ulw_loop_skill_copies
        )
        report.append(
            f"synchronized canonical Grok ulw-loop tree into {normalized} changed copies"
        )

        canonical_ulw_plan = top_skills / "ulw-plan"
        ulw_plan_skill_copies = [
            vendor_skills / "ulw-plan",
            lg
            / "vendor"
            / "lazygrok-hooks"
            / "ultrawork"
            / "skills"
            / "ulw-plan",
        ]
        normalized = synchronize_tree_copies(
            canonical_ulw_plan, ulw_plan_skill_copies
        )
        report.append(
            f"synchronized canonical Grok ulw-plan tree into {normalized} changed copies"
        )

        normalized = sum(
            normalize_skill_user_invocable(path)
            for path in safe_top_level_skill_files(top_skills, lg)
        )
        report.append(
            f"normalized legacy Grok skill metadata in {normalized} changed files"
        )

        removed_teammode_runtime = prune_unsupported_runtime(lg)
        report.extend(
            f"removed unsupported Grok teammode runtime: {path}"
            for path in removed_teammode_runtime
        )
        tm = vendor_skills / "teammode" / "SKILL.md"
        tm.parent.mkdir(parents=True, exist_ok=True)
        if not tm.exists() or tm.read_text(encoding="utf-8") != GROK_TEAMMODE_SKILL:
            tm.write_text(GROK_TEAMMODE_SKILL, encoding="utf-8")
            report.append(f"wrote Grok-native teammode routing: {tm.relative_to(lg)}")

        unsupported_routes = find_unsupported_active_tool_routes(lg)
        if unsupported_routes:
            raise ValueError(
                "generated active Grok surfaces still expose unsupported tool "
                "routes:\n" + "\n".join(unsupported_routes)
            )
        report.append("verified active skills and hooks use only Grok team routing")

        # Copy shared-skills ultimate-browsing fully if plugin skill was thin
        # (already handled via sync list)

        # Update plugin.json description version note
        pj = lg / "plugin.json"
        data = pj.read_text(encoding="utf-8")
        if "4.19.3" not in data:
            data = data.replace(
                "22 skills",
                "skills (LazyCodex 4.19.3 port)",
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
        receipt = lg / "docs" / "lazycodex-4.19.3-port-receipt.md"
        receipt.write_text(
            "# LazyCodex 4.19.3 → LazyGrok port receipt\n\n"
            "Generated by `scripts/port-lazycodex-to-grok.py`.\n\n"
            "## Report\n\n"
            + "\n".join(f"- {line}" for line in report)
            + "\n\n## Grok limitations preserved\n\n"
            "- No multi_agent_v2 / teammode transport\n"
            "- Host create_goal/update_goal optional; # Goal + ulw-loop CLI + todo_write\n"
            "- No npm auto-update SessionStart\n"
            "- spawn_subagent / todo_write / search_replace / run_terminal_command\n"
            "- State under `.lazygrok/` (accept mid-run `.omo/`)\n"
            "- New ULW plans scaffold under `.lazygrok/`; an existing same-slug `.omo/` run remains legacy-rooted\n"
            "- ULW state uses the exact hook session ID; a private workspace-hash binding resolves it when Grok terminal commands omit hook environment\n"
            "- Inherited Codex session/thread variables are stripped before vendored hook CLIs run\n"
            "- Linux state/evidence and LSP mutations remain descriptor-bound across parent swaps; sensitive operations fail closed elsewhere\n"
            "- Local state and hook diagnostics use 0700/0600; diagnostics retain metadata only and no prompt payloads\n"
            "- Upstream telemetry runtime is removed and has no active hook registration\n"
            "- Ralph VERIFIED loop split to `ulw-ralph-loop`; `ulw-loop` is OmO goal ledger\n",
            encoding="utf-8",
        )
        report.append(f"wrote {receipt.relative_to(lg)}")

    print("\n".join(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
