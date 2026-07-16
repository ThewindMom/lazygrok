---
description: >
  Show resumable work, require an unambiguous selection when multiple work items
  exist, restore state safely, clear stale session associations.
---

**RESUME CONTINUATION**

Follow this protocol to safely resume paused work:

## Step 1: Show resumable work

List all resumable work items:
- Active boulder work records (from `.omg/boulder.json`)
- Paused Ralph/Ultrawork loops
- Incomplete todos

For each item, show:
- Work ID
- Objective
- Status (paused/active/incomplete)
- Last updated

## Step 2: Require selection

If multiple work items exist, require the user to select one unambiguously.
Do not guess which one to resume.

## Step 3: Restore state

Once selected:
1. Clear the stop-continuation marker for this session.
2. Restore the selected work's active state.
3. Clear stale session associations (old session IDs that no longer apply).
4. Update the work record with the new session ID.

## Step 4: Resume

- If Ralph was active, restore the loop state.
- If Ultrawork was active, restore the loop state.
- If boulder work was paused, mark it active again.
- Continue from where the work left off.

## Safety

- Do not discard any state during restoration.
- Back up state before modifying.
- If state is corrupt, report and do not proceed.
