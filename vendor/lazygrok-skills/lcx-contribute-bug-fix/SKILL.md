---
name: lcx-contribute-bug-fix
description: "Contribute a verified bug fix for LazyGrok, bundled Grok skills, or upstream Grok Build bugs. Route LazyGrok fixes to ThewindMom/lazygrok and host fixes to xai-org/grok-build. Use when the user asks to fix a bug, contribute a bug fix, open a PR, or debug and deliver a LazyGrok/Grok defect."
metadata:
  short-description: Contribute verified LazyGrok or Grok bug fixes
---

# lcx-contribute-bug-fix

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


Use this skill to debug a concrete LazyGrok or Grok defect, implement the smallest correct fix in a fresh temporary workspace, and deliver it. Work in English, keep the body short, and support every claim with runtime or source evidence.

Route ownership the same way as `$lcx-report-bug`, but the deliverable differs by target:

- `ThewindMom/lazygrok` for LazyGrok bundled skills, hooks, MCP wiring, installer behavior, docs, or packaging. Deliverable: a verified PR when the user requested code contribution; otherwise a verified-fix issue.
- `xai-org/grok-build` for upstream Grok CLI bugs that reproduce without LazyGrok or come from Grok core behavior. Deliverable: a PR from a fork.

## Required Outcome

For `xai-org/grok-build`, create a fork PR that includes:

- a focused branch from a fresh `${TMPDIR:-/tmp}` clone/worktree
- reproduction logs from before the fix
- the smallest implementation that fixes the defect
- verification logs from after the fix
- apply `lazygrok-generated` when label management is available
- the required LazyGrok footer tag `Tag: lazygrok-generated`
- cleanup of temporary worktrees and clones

For `ThewindMom/lazygrok`, create the requested PR or issue with:

- reproduction logs from before the fix
- the root cause with source evidence
- the verified patch as a unified diff, produced and tested in a fresh `${TMPDIR:-/tmp}` clone/worktree
- verification logs from after the fix
- the `lazygrok-generated` label and the footer tag `Tag: lazygrok-generated`
- cleanup of temporary worktrees and clones

## Required Workflow

1. Read the user's bug report and identify the affected surface.
2. Invoke `$omo:debugging` for the investigation. If only unqualified skill names are exposed, invoke `$debugging` and state that it is the OMO debugging skill.
3. Materialize the latest sources under `LAZYGROK_SOURCE_ROOT="${LAZYGROK_SOURCE_ROOT:-${TMPDIR:-/tmp}/lazygrok-sources}"`, then decide the target repository. Sync both checkouts on every run and compare them before choosing. Validate cached checkouts before reuse so an incomplete `.git` directory cannot route the fix to the wrong repo:

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
4. Create a fresh temporary clone and branch under `${TMPDIR:-/tmp}`. Do not modify the user's current repository for the target fix unless the current repository is itself the requested target and the user explicitly asked for local edits.

```bash
TARGET_REPO="ThewindMom/lazygrok" # or xai-org/grok-build
WORK_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/lazygrok-fix-XXXXXX")"
gh repo clone "$TARGET_REPO" "$WORK_ROOT/repo" -- --depth=1
cd "$WORK_ROOT/repo"
BASE_BRANCH="$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')"
git fetch origin "$BASE_BRANCH" --depth=1
BRANCH_NAME="lazygrok/bug-fix-<short-slug>"
git worktree add "$WORK_ROOT/worktree" -b "$BRANCH_NAME" "origin/$BASE_BRANCH"
cd "$WORK_ROOT/worktree"
```

If `gh` cannot clone, use `git clone --depth=1 "https://github.com/$TARGET_REPO" "$WORK_ROOT/repo"` and continue with the same worktree flow.

5. Reproduce the bug in the worktree through the real surface. Save exact command output to `${TMPDIR:-/tmp}/lazygrok-fix-<short-slug>-repro.log`.
6. Write or update a failing regression test before production changes. Confirm it fails for the bug, not for a missing fixture or typo.
7. Implement the smallest correct fix. Avoid refactors unless the fix cannot be made safely without one.
8. Run the regression test, adjacent tests, and the smallest real-surface QA command that proves the user-visible behavior changed.
9. Commit the verified fix in the worktree. Inspect the status first so the delivered diff cannot be empty or stale:

```bash
git status --short
git add -A
git commit -m "fix: <short bug-fix summary>"
git log --oneline "origin/$BASE_BRANCH..HEAD"
```

10. Build the delivery body for the target:
   - `xai-org/grok-build`: generate the PR body with `scripts/create-pr-body.mjs`.
   - `ThewindMom/lazygrok`: export the verified patch and write the issue body from the Verified-Fix Issue Template below:

```bash
PATCH_FILE="${TMPDIR:-/tmp}/lazygrok-fix-<short-slug>.patch"
git diff "origin/$BASE_BRANCH"..HEAD > "$PATCH_FILE"
```

11. Ensure the generated label exists when the target repo allows label management. Keep the footer tag even when label creation is unavailable:

```bash
LABEL_ARGS=()
if gh label create lazygrok-generated --repo "$TARGET_REPO" --color "7C3AED" --description "Created by LazyGrok" --force; then
  LABEL_ARGS=(--label lazygrok-generated)
else
  echo "Label management unavailable for $TARGET_REPO; keeping the footer tag only."
fi
```

12. Deliver the fix.
   - `ThewindMom/lazygrok`: create the requested verified-fix issue, or fork,
     push, and open a PR when the user requested a code contribution:

```bash
ISSUE_BODY="${TMPDIR:-/tmp}/lazygrok-fix-<short-slug>-issue.md"
gh issue create --repo ThewindMom/lazygrok --title "<short fix title>" "${LABEL_ARGS[@]}" --body-file "$ISSUE_BODY"

PR_INPUT="${TMPDIR:-/tmp}/lazygrok-fix-<short-slug>-pr.json"
PR_BODY="${TMPDIR:-/tmp}/lazygrok-fix-<short-slug>-pr.md"
node "<skill-root>/scripts/create-pr-body.mjs" "$PR_INPUT" "$PR_BODY"
gh repo fork ThewindMom/lazygrok --remote --remote-name fork
GH_USER="$(gh api user --jq .login)"
git push -u fork "$BRANCH_NAME"
gh pr create --repo ThewindMom/lazygrok --base "$BASE_BRANCH" --head "$GH_USER:$BRANCH_NAME" --title "<short fix title>" "${LABEL_ARGS[@]}" --body-file "$PR_BODY"
```

   - `xai-org/grok-build`: fork, push the branch to the fork, and create the PR:

```bash
gh repo fork xai-org/grok-build --remote --remote-name fork
GH_USER="$(gh api user --jq .login)"
git push -u fork "$BRANCH_NAME"
gh pr create --repo xai-org/grok-build --base "$BASE_BRANCH" --head "$GH_USER:$BRANCH_NAME" --title "<short fix title>" "${LABEL_ARGS[@]}" --body-file "$PR_BODY"
```

13. Clean up:

```bash
cd /
git -C "$WORK_ROOT/repo" worktree remove "$WORK_ROOT/worktree"
find "$WORK_ROOT" -mindepth 1 -maxdepth 1 -exec rm -r -- {} +
rmdir "$WORK_ROOT"
```

Return the PR or issue URL, the reproduction command, the verification command, and the cleanup receipt.

## Verified-Fix Issue Template (ThewindMom/lazygrok)

Write the issue body in English. Embed the patch verbatim so a maintainer can apply it to the source tree:

````markdown
## Problem Situation
[What failed for the user.]

## Reproduction Logs
[Exact failing command and relevant log excerpt.]

## Root Cause
[Confirmed cause with runtime and source evidence.]

## Verified Fix
[What changed and why this is the smallest correct fix.]

```diff
[Contents of $PATCH_FILE.]
```

## Verification
- [RED test output or repro before the fix]
- [GREEN test output after the fix]
- [Manual QA command and result]

---
This fix was debugged, implemented, and verified with [LazyGrok](https://github.com/ThewindMom/lazygrok).
Tag: lazygrok-generated
````

## PR Body Generator

For a PR to either supported repository, use the bundled script to generate
the PR body. Create a JSON file with this shape, setting `targetRepository` to
`ThewindMom/lazygrok` or `xai-org/grok-build`:

```json
{
  "title": "Fix short user-visible failure",
  "targetRepository": "xai-org/grok-build",
  "problem": "What is broken for the user.",
  "reproductionLogs": "Exact failing command, log excerpt, or trace.",
  "approach": "What changed and why this is the smallest correct fix.",
  "confidence": "Why the diagnosis and fix are strongly supported.",
  "risks": "Risk level and what could regress.",
  "userVisibleBehaviorChanges": "What changes for the user after the PR.",
  "verification": ["failing test before fix", "passing test after fix", "manual QA command"]
}
```

Run:

```bash
PR_INPUT="${TMPDIR:-/tmp}/lazygrok-fix-<short-slug>-pr.json"
PR_BODY="${TMPDIR:-/tmp}/lazygrok-fix-<short-slug>-pr.md"
node "<skill-root>/scripts/create-pr-body.mjs" "$PR_INPUT" "$PR_BODY"
```

## PR Body Template (xai-org/grok-build)

The generated body must follow this structure:

```markdown
## Problem Situation
[What failed for the user.]

## Reproduction Logs
[Exact failing command and relevant log excerpt.]

## Approach
[What changed and why.]

## Why I Am Confident
[Evidence that proves the root cause and fix.]

## Risks
[Risk level and possible regressions.]

## User-Visible Behavior Changes
[What users experience after this PR.]

## Verification
- [RED test output or repro before the fix]
- [GREEN test output after the fix]
- [Manual QA command and result]

---
This PR was debugged, implemented, and created with [LazyGrok](https://github.com/ThewindMom/lazygrok).
Tag: lazygrok-generated
```

## Stop Conditions

Stop and ask one narrow question only when:

- the bug cannot be reproduced from available information
- target repository ownership remains ambiguous after comparing LazyGrok and upstream Grok evidence
- authentication is missing for creating the issue or pushing and creating the PR
- the fix requires a product decision rather than a technical correction

Do not open:

- a PR or pushed branch without explicit user authorization, or against a
  repository other than the confirmed owner
- a PR or verified-fix issue without a failing-before and passing-after test
- a PR or verified-fix issue without a real-surface QA command
- a PR or issue without the `Tag: lazygrok-generated` footer
- a verified-fix issue without the patch embedded in a `diff` block
- a vague fix that does not identify the root cause
- a broad refactor disguised as a bug fix
