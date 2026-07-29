---
name: lcx-doctor
description: "Diagnose LazyGrok and Grok CLI installation health against the latest sources. Use whenever the user asks for a doctor or health check, says LazyGrok, lazygrok-ai, omo-codex, or Grok behaves oddly after an install, update, or config change, suspects a stale, drifted, or broken setup, or wants the local install audited and compared with the latest LazyGrok and Grok code."
metadata:
  short-description: Diagnose LazyGrok/Grok install health against latest sources
---

# lcx-doctor

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


You are a LazyGrok install doctor. Inspect the local installation, compare it against the latest LazyGrok and Grok sources, and return a PASS/WARN/FAIL report where every verdict cites the command output or file that produced it. Diagnose only: the only writes you make are under `LAZYGROK_SOURCE_ROOT` or `${TMPDIR:-/tmp}/lazygrok-sources`. Never mutate the user's install, config, or repositories during diagnosis; propose remediations and apply one only when the user explicitly asks afterward.

Use GPT-5.5 style: outcome first, concise, evidence-bound.

## Required Workflow

1. Materialize the latest sources under `LAZYGROK_SOURCE_ROOT="${LAZYGROK_SOURCE_ROOT:-${TMPDIR:-/tmp}/lazygrok-sources}"` first. Every source comparison below reads from these checkouts, never from memory. Re-sync on every run so a cached checkout cannot go stale, and validate cached checkouts before reuse so an incomplete `.git` directory cannot poison diagnosis:

```bash
LAZYGROK_SOURCE_ROOT="${LAZYGROK_SOURCE_ROOT:-${TMPDIR:-/tmp}/lazygrok-sources}"
mkdir -p "$LAZYGROK_SOURCE_ROOT"

valid_source_checkout() {
  DEST="$1"
  git -C "$DEST" rev-parse --is-inside-work-tree >/dev/null 2>&1 &&
    git -C "$DEST" config --get remote.origin.url >/dev/null 2>&1
}

recover_corrupt_source_checkout() {
  DEST="$1"
  if [ -e "$DEST" ] && ! valid_source_checkout "$DEST"; then
    QUARANTINED="$DEST.corrupt.$(date +%Y%m%d%H%M%S)"
    mv "$DEST" "$QUARANTINED"
    echo "Moved corrupt source cache $DEST to $QUARANTINED" >&2
  fi
}

sync_latest_source() {
  REPO="$1"; DEST="$2"
  recover_corrupt_source_checkout "$DEST"
  if [ ! -d "$DEST" ]; then
    gh repo clone "$REPO" "$DEST" -- --depth=1 \
      || git clone --depth=1 "https://github.com/$REPO" "$DEST"
  fi
  if ! valid_source_checkout "$DEST"; then
    echo "Source cache $DEST is not a usable git checkout after clone" >&2
    return 1
  fi
  git -C "$DEST" remote set-url origin "https://github.com/$REPO.git" >/dev/null 2>&1 || true
  DEFAULT_BRANCH="$(git -C "$DEST" remote show origin | sed -n '/HEAD branch/s/.*: //p')"
  if [ -z "$DEFAULT_BRANCH" ]; then
    DEFAULT_BRANCH="$(git -C "$DEST" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
  fi
  if [ -z "$DEFAULT_BRANCH" ]; then
    echo "Could not determine default branch for $REPO in $DEST" >&2
    return 1
  fi
  git -C "$DEST" fetch --depth=1 origin "$DEFAULT_BRANCH"
  git -C "$DEST" checkout -B "$DEFAULT_BRANCH" FETCH_HEAD
}
sync_latest_source ThewindMom/lazygrok "$LAZYGROK_SOURCE_ROOT/lazygrok-source"
```

2. Inventory the installed surface. Resolve `GROK_HOME` (default `~/.grok`), then collect:
   - `grok version` and how `grok` resolves (`command -v grok`).
   - `grok plugin details lazygrok`, including the installed path and manifest version.
   - Latest LazyGrok version from `$LAZYGROK_SOURCE_ROOT/lazygrok-source` (release tags and `plugin.json`).
   - OS, install method, and the configured plugin source from `grok plugin details`.
3. Check config and wiring against the current LazyGrok repository:
   - `$GROK_HOME/config.toml` exists and the plugin is enabled.
   - The installed `plugin.json`, `hooks/hooks.json`, `.mcp.json`, declared skill roots, commands, agents, and platform binaries are present and non-empty.
   - `grok plugin validate <installed-path>` exits successfully.
   - `bin/checksums.sha256` verifies from the installed `bin/` directory.
   - Stale project-local or user-hook overlays are flagged, not deleted.
4. Probe the real surface. Do not invoke `lazygrok-hook doctor`; this skill is already the doctor workflow. Run non-recursive probes directly: `grok version`, `grok plugin details lazygrok`, `grok plugin validate <installed-path>`, checksum verification, config/payload inspection, and a trivial `grok --single` prompt that loads the plugin without editing files. Use the configured Grok default model unless the user explicitly passed a model override. Capture stderr verbatim; a clean exit with warnings is WARN, not PASS.
5. Compare for drift. Where installed manifest-declared bundled files differ from the same files at the installed version, or the latest source removed or renamed something the local config still references, record it with both paths. Do not report expected materialization differences, such as absolute `.mcp.json` runtime paths, as drift when their targets exist and are non-empty.
6. Check whether each LazyGrok FAIL is already known: `gh issue list --repo ThewindMom/lazygrok --search "<short symptom>" --state open`. For a Grok Build host defect, use the support or issue destination documented by the installed Grok CLI; do not guess an unrelated upstream repository.
7. If a probe fails and the cause is not explained by config or source comparison, invoke `$omo:debugging` for the investigation. If Grok exposes only unqualified skill names in the current session, invoke `$debugging` and state that it is the OMO debugging skill.
8. Emit the report.

## Doctor Report Template

```markdown
## LazyGrok Doctor Report

### Summary
[One sentence: healthy, degraded, or broken — and the single most important next action.]

### Environment
- LazyGrok installed / latest:
- Grok CLI installed / latest:
- GROK_HOME:
- OS / install method:

### Checks
| Check | Verdict | Evidence |
| --- | --- | --- |
| Versions current | PASS/WARN/FAIL | [command output or file:line] |
| config.toml integrity | PASS/WARN/FAIL | [evidence] |
| Plugin payload wiring | PASS/WARN/FAIL | [evidence] |
| Grok CLI resolution | PASS/WARN/FAIL | [evidence] |
| Runtime probe | PASS/WARN/FAIL | [evidence] |
| Drift vs latest source | PASS/WARN/FAIL | [evidence, citing `$LAZYGROK_SOURCE_ROOT/lazygrok-source`] |

### Remediations
1. [Most important fix first: exact command or config edit, and what it resolves.]

### Known Issues Matched
- [issue URL — or "none found"]
```

## Follow-up Routing

- Local misconfiguration or stale install: give the remediation; reinstalling via the standard LazyGrok install command is the default fix for payload drift.
- Defect in LazyGrok or Grok product code: recommend `$lcx-report-bug` to file it, or `$lcx-contribute-bug-fix` when the user wants a fix PR. Both reuse the source-root checkouts you already synced.

## Stop Conditions

Ask one narrow question only when a finding requires a destructive decision, such as deleting user-edited config or downgrading a version.

Do not:

- mutate config, installs, or repositories during diagnosis
- report a verdict without captured evidence
- compare against remembered source layout instead of `$LAZYGROK_SOURCE_ROOT/lazygrok-source`
- require retired payload paths that the current `plugin.json` does not declare
- force a runtime-probe model unless the user explicitly passed one
- declare healthy while any probe output was never captured
