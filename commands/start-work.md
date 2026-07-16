---
description: >
  Select an approved plan, initialize boulder state, activate Atlas coordinator,
  map tasks to leaf specialists, track completion and verification, support
  safe session continuation.
---

You are now executing an approved plan. Activate the Atlas coordinator workflow.

## Step 1: Select plan

Read the plan file specified (or find the most recent plan in `.omg/plans/`).
If no plan exists, tell the user to run `/plan` first.

## Step 2: Initialize boulder state

Create a work record in `.omg/boulder.json` with:
- Work ID
- Objective
- Plan path
- Task list (from plan TODOs)
- Status: active
- Started timestamp

## Step 3: Map tasks to specialists

For each plan task:
- Identify the specialist agent needed (hephaestus, explore, oracle, etc.)
- Identify dependencies between tasks
- Identify tasks that can run in parallel

## Step 4: Execute

- Launch independent tasks concurrently using `spawn_subagent`.
- Collect results from each specialist.
- Update boulder state with task status.
- Integrate results.

## Step 5: Verify

- Run all tests.
- Spawn a `momus` reviewer for final review.
- Address all blockers.

## Step 6: Complete

- Mark all tasks complete in boulder state.
- Report summary: what was done, what was verified.
- If work remains, support session continuation.

## Safety

- Never ask leaf agents to spawn subagents.
- Track all subagent IDs in boulder state.
- If a subagent fails, record the failure and retry or report.
