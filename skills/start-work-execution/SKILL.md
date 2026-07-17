---
name: start-work-execution
description: >
  Execute an approved plan: map tasks to specialists, launch parallel work,
  integrate results, verify completion. Use when running /start-work on an
  approved plan.
---

# Start-Work Execution

Turn an approved plan into completed work.

## Step 1: Load plan

Read the plan from `.lazygrok/plans/<name>.md`. Parse the TODOs and dependencies.

## Step 2: Initialize boulder state

Create a work record in `.lazygrok/boulder.json`:
- Work ID (stable identifier)
- Objective (from plan)
- Plan path
- Task list (from plan TODOs)
- Status: active
- Started timestamp

## Step 3: Map tasks to specialists

For each task:
- Identify the specialist agent needed
- Identify dependencies (which tasks must complete first)
- Identify parallelizable tasks (no dependencies)

## Step 4: Execute

- Launch independent tasks concurrently using `spawn_subagent`.
- Use `hephaestus` for implementation tasks.
- Use `explore` for codebase investigation.
- Use `oracle` for architecture decisions.
- Collect results from each specialist.
- Update boulder state with task status.

## Step 5: Verify

- Run all tests.
- Spawn `momus` for final review.
- Address all blockers.

## Step 6: Complete

- Mark all tasks complete in boulder state.
- Report summary.
- If work remains, support session continuation.

## Safety

- Never ask leaf agents to spawn subagents.
- Track all subagent IDs.
- If a subagent fails, record and retry or report.
