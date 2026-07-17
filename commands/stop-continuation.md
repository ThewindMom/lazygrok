---
description: >
  Disable Ralph, disable Ultrawork continuation, pause active boulder
  continuation, suppress todo stop enforcement for the current session,
  persist the explicit user stop. Takes effect immediately.
---

**STOP CONTINUATION — ACTIVE**

You must immediately stop all continuation behavior. To make this stop
durable and visible to the hook system, write the stop marker file and
update the continuation state file now.

## Step 1: Write the stop marker

Create the stop-continuation marker file so the next session and all
hooks respect the stop:

```bash
mkdir -p "${GROK_HOME:-$HOME/.grok}/state/stop-continuation/${GROK_SESSION_ID}"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "${GROK_HOME:-$HOME/.grok}/state/stop-continuation/${GROK_SESSION_ID}/stopped"
```

## Step 2: Pause the continuation loop

If `.lazygrok/continuation.json` exists in the workspace root, update it to
set `paused: true` and `pauseReason: "explicit stop by user"`:

```bash
if [ -f ".lazygrok/continuation.json" ]; then
  # Use a tool edit or write the file with paused: true
fi
```

## Step 3: Invoke the stop-continuation hook (optional, belt-and-suspenders)

You may also trigger the hook binary directly to ensure the marker and
state are written atomically:

```bash
echo '{"hookEventName":"user_prompt_submit","sessionId":"'"${GROK_SESSION_ID}"'","workspaceRoot":"'"${GROK_WORKSPACE_ROOT}"'","cwd":"'"${GROK_WORKSPACE_ROOT}"'","prompt":"stop"}' \
  | bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" stop-continuation
```

## What this stops

1. **Disable Ralph**: Clear the ralph loop state. Do not continue on Stop.
2. **Disable Ultrawork**: Clear the ultrawork loop state. Do not continue on Stop.
3. **Pause boulder**: Mark active boulder work as paused. Do not continue on Stop.
4. **Suppress todo enforcement**: Do not block Stop for incomplete todos this session.
5. **Persist the stop**: The marker file ensures the next session also respects this.

This takes effect **immediately**. Do not attempt to continue working. Acknowledge the stop and wait for the user's next instruction.

The user can resume continuation later with `/resume-continuation`.
