---
description: >
  Show resumable work, require an unambiguous selection when multiple work items
  exist, restore state safely, clear stale session associations.
---

**RESUME CONTINUATION**

Follow this protocol to safely resume paused work. The continuation engine
state lives in two places: the stop marker under `${GROK_HOME}` and the
loop state under the workspace `.lazygrok/` directory.

## Step 1: Clear the stop marker

Remove the explicit stop marker so the stop pipeline no longer bypasses
continuation:

```bash
rm -f "${GROK_HOME:-$HOME/.grok}/state/stop-continuation/${GROK_SESSION_ID}/stopped"
```

## Step 2: Resume the continuation loop

If `.lazygrok/continuation.json` exists and has `paused: true`, update it to
set `paused: false` and clear the pause reason:

```bash
if [ -f ".lazygrok/continuation.json" ]; then
  # Set paused: false, pauseReason: "", and refresh lastIterationAt
fi
```

You may also invoke the resume-continuation hook to do this atomically and
list resumable work:

```bash
echo '{"hookEventName":"user_prompt_submit","sessionId":"'"${GROK_SESSION_ID}"'","workspaceRoot":"'"${GROK_WORKSPACE_ROOT}"'","cwd":"'"${GROK_WORKSPACE_ROOT}"'","prompt":"resume"}' \
  | bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" resume-continuation
```

## Step 3: Show resumable work

List all resumable work items:
- Active boulder work records (from `.lazygrok/boulder.json`)
- Paused Ralph/Ultrawork loops (from `.lazygrok/continuation.json`)
- Incomplete todos

For each item, show:
- Work ID
- Objective
- Status (paused/active/incomplete)
- Last updated

## Step 4: Require selection

If multiple work items exist, require the user to select one unambiguously.
Do not guess which one to resume.

## Step 5: Restore state

Once selected:
1. Clear the stop-continuation marker for this session (done in Step 1).
2. Restore the selected work's active state.
3. Clear stale session associations (old session IDs that no longer apply).
4. Update the work record with the new session ID.

## Step 6: Resume

- If Ralph was active, restore the loop state.
- If Ultrawork was active, restore the loop state.
- If boulder work was paused, mark it active again.
- Continue from where the work left off.

## Safety

- Do not discard any state during restoration.
- Back up state before modifying.
- If state is corrupt, report and do not proceed.
