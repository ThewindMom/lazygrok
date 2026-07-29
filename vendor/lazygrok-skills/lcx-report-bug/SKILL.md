---
name: lcx-report-bug
description: "Create a high-signal bug issue or PR in the repo that owns the defect. Use this whenever the user asks to report, file, open, or triage a LazyGrok, lazygrok-ai, omo-codex, Grok plugin, or upstream Grok CLI bug, especially when they need source-backed root cause, reproduction steps, fix guidance, and GitHub routing."
metadata:
  short-description: Route LazyGrok or Grok bugs with source evidence
---

# lcx-report-bug

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


You are a LazyGrok bug router and reporter. Produce one useful GitHub issue or PR in English, backed by runtime evidence and source evidence rather than guesses. Route it to the repository that owns the defect:

- `ThewindMom/lazygrok` for LazyGrok plugin, bundled skill, hook, MCP, installer, documentation, or packaging bugs.
- `xai-org/grok-build` for Grok Build host bugs that reproduce without LazyGrok or are caused by Grok core behavior.

Use GPT-5.5 style: outcome first, concise, evidence-bound. Keep the workflow moving, but do not file an issue until the root cause and reproduction path are concrete enough for a maintainer to act.

## Goal

Create or prepare a GitHub issue or PR that includes:

- clear title
- target repository decision
- environment
- reproducible steps
- expected behavior
- actual behavior
- confirmed or strongly evidenced root cause
- fix approach, including files or components likely involved
- verification plan
- `lazygrok-generated` label and footer tag

## Required Workflow

1. Read the user's bug report and identify the affected surface: LazyGrok installer, Grok plugin, skill, hook, MCP, CLI alias, GitHub marketplace sync, or web/docs.
2. Invoke `$omo:debugging` for the investigation. If Grok exposes only unqualified skill names in the current session, invoke `$debugging` and state that it is the OMO debugging skill.
3. Materialize the latest LazyGrok and upstream Grok sources under `LAZYGROK_SOURCE_ROOT="${LAZYGROK_SOURCE_ROOT:-${TMPDIR:-/tmp}/lazygrok-sources}"` before deciding ownership. Re-sync on every run so a cached checkout cannot go stale, and validate cached checkouts before reuse so an incomplete `.git` directory cannot produce wrong routing and dead line references:

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
sync_latest_source xai-org/grok-build "$LAZYGROK_SOURCE_ROOT/grok-build-source"
```
4. Follow the debugging skill far enough to gather runtime evidence:
   - form at least three plausible hypotheses
   - run the smallest reproduction that exercises the real surface
   - confirm the root cause by observing the failing state
   - identify the minimal fix path or maintainer action
5. Compare runtime evidence with both `$LAZYGROK_SOURCE_ROOT/lazygrok-source` and `$LAZYGROK_SOURCE_ROOT/grok-build-source` before choosing the target repo. Cite exact files, commands, logs, or source paths that support the routing decision.
6. Choose the target repo:
   - Use `ThewindMom/lazygrok` when the bug is in LazyGrok integration, distribution, bundled plugin code, skills, hooks, MCP wiring, installer behavior, aliases, marketplace sync, docs, or any behavior that disappears in clean upstream Grok.
   - Use `xai-org/grok-build` when the bug reproduces in clean upstream Grok without LazyGrok, or the failing behavior comes from Grok CLI core, plugin API contracts, sandboxing, approvals, config loading, or built-in tool behavior.
   - If ownership remains ambiguous after evidence gathering, do not guess. Prepare the issue body with the uncertainty and ask one narrow routing question.
7. Search for an existing issue in the selected repo before creating a new one. Search the other repo too when the ownership boundary is close:

```bash
TARGET_REPO="ThewindMom/lazygrok" # or xai-org/grok-build
gh issue list --repo "$TARGET_REPO" --search "<short error or symptom>" --state open
```

8. If a matching open issue exists, add a comment with the new evidence instead of creating a duplicate.
9. Ensure the generated label exists in repositories you control:

```bash
LABEL_ARGS=()
if gh label create lazygrok-generated --repo "$TARGET_REPO" --color "7C3AED" --description "Created by LazyGrok" --force; then
  LABEL_ARGS=(--label lazygrok-generated)
else
  echo "Label management unavailable for $TARGET_REPO; keeping the footer tag only."
fi
```

If the selected repo is `xai-org/grok-build` and label management is not available, still include the footer tag in the body and continue without claiming label creation succeeded.
10. If no matching issue exists, create the issue with `gh` and apply the `lazygrok-generated` label.
11. Create a PR against either confirmed owner only when the user asked for a PR and the fix is already implemented and verified on a branch. Otherwise create an issue with fix guidance. Apply the `lazygrok-generated` label to every artifact when label management is available.

## Required Label And Footer

Every issue body, evidence comment, and PR body created by this skill must use the GitHub label `lazygrok-generated` when the artifact supports labels. It must also end with this footer. Do not put content after it.

```markdown
---
This issue or PR was generated by LazyGrok.
Tag: lazygrok-generated
```

## Issue Body Template

Write the issue body in English and keep it direct:

```markdown
## Summary
[One or two sentences describing the user-visible failure.]

## Environment
- LazyGrok version:
- Grok version:
- OS:
- Install method:
- Relevant config:

## Repository Decision
- Target repository:
- Why this belongs there:
- LazyGrok evidence (runtime + `$LAZYGROK_SOURCE_ROOT/lazygrok-source`):
- Upstream Grok source evidence from `$LAZYGROK_SOURCE_ROOT/grok-build-source`:

## Reproduction
1. [Exact command or UI action]
2. [Exact next step]
3. [Observed failure trigger]

## Expected Behavior
[What should have happened.]

## Actual Behavior
[What happened instead, including exact error text or output.]

## Evidence
[Commands, logs, screenshots, traces, or links used to confirm the failure.]

## Root Cause
[Confirmed cause. If not fully confirmed, say what evidence supports it and what remains uncertain.]

## Proposed Fix
[Concrete implementation or operational fix. Include likely files, components, or commands.]

## Verification Plan
- [Check that reproduces the original failure]
- [Check that proves the fix]
- [Regression check for adjacent LazyGrok/Grok plugin behavior]

---
This issue or PR was generated by LazyGrok.
Tag: lazygrok-generated
```

## PR Body Template

Use this only when a PR is the right artifact for the confirmed owner:

```markdown
## Summary
[One or two sentences describing the fix and the user-visible failure it resolves.]

## Repository Decision
- Target repository:
- Why this belongs there:
- LazyGrok evidence (runtime + `$LAZYGROK_SOURCE_ROOT/lazygrok-source`):
- Upstream Grok source evidence from `$LAZYGROK_SOURCE_ROOT/grok-build-source`:

## Root Cause
[Confirmed cause. Cite runtime evidence and source paths.]

## Fix
[What changed and why.]

## Verification
- [Check that reproduced the original failure before the fix]
- [Check that passes after the fix]
- [Regression check for adjacent behavior]

---
This issue or PR was generated by LazyGrok.
Tag: lazygrok-generated
```

## GitHub Creation Path

Prefer `gh`:

```bash
ISSUE_BODY="${TMPDIR:-/tmp}/lcx-report-bug-$(date +%Y%m%d-%H%M%S).md"
$EDITOR "$ISSUE_BODY"
gh issue create --repo "$TARGET_REPO" --title "<clear title>" "${LABEL_ARGS[@]}" --body-file "$ISSUE_BODY"
```

If `$EDITOR` is not usable, write the file with the available file-editing tool, then run the same `gh issue create` command.

For an existing issue:

```bash
COMMENT_BODY="${TMPDIR:-/tmp}/lcx-report-bug-comment-$(date +%Y%m%d-%H%M%S).md"
gh issue comment "<issue-number>" --repo "$TARGET_REPO" --body-file "$COMMENT_BODY"
if [ "${#LABEL_ARGS[@]}" -gt 0 ]; then
  gh issue edit "<issue-number>" --repo "$TARGET_REPO" --add-label lazygrok-generated
fi
```

For a PR from a branch pushed to a fork:

```bash
PR_BODY="${TMPDIR:-/tmp}/lcx-report-bug-pr-$(date +%Y%m%d-%H%M%S).md"
gh pr create --repo xai-org/grok-build --title "<clear title>" "${LABEL_ARGS[@]}" --body-file "$PR_BODY"
```

After creating or commenting, return the issue or PR URL and a short summary of the evidence used.

## Browser use fallback

If `gh` is unavailable, unauthenticated, or blocked, use Browser Use against the real GitHub page:

1. Open the new issue page for the selected repo: `https://github.com/ThewindMom/lazygrok/issues/new` or `https://github.com/xai-org/grok-build/issues/new`.
2. Fill the title and body from the template.
3. Submit the issue only after visually confirming the repo, title, and body.
4. Capture the resulting issue URL.

## Computer use fallback

If Browser Use is unavailable but a desktop browser is open and authenticated, use Computer Use:

1. Navigate to the new issue page for the selected repo: `https://github.com/ThewindMom/lazygrok/issues/new` or `https://github.com/xai-org/grok-build/issues/new`.
2. Fill the title and body.
3. Verify the target repository and final text before submission.
4. Submit and capture the issue URL.

## Stop Conditions

Stop and ask one narrow question only when the missing fact changes the issue materially, such as the affected version, a private log the agent cannot access, or whether the user wants a duplicate filed despite an existing matching issue.

Do not file:

- a PR or pushed branch without explicit user authorization, or against a
  repository other than the confirmed owner
- a vague issue without reproduction steps
- an issue that claims a root cause not supported by runtime evidence
- a duplicate when commenting on an existing issue is enough
- an issue without checking the latest `$LAZYGROK_SOURCE_ROOT/lazygrok-source` and `$LAZYGROK_SOURCE_ROOT/grok-build-source` checkouts
- a LazyGrok issue when the bug is proven to reproduce in clean upstream Grok
- a fix PR without a concrete branch, implemented fix, and verification result
