---
name: ulw-evidence
description: >
  Use the ulw-loop CLI to create goals with binding success criteria, record
  evidence per criterion, and checkpoint goal completion during an ultrawork
  loop. This makes ultrawork evidence-driven rather than promise-driven.
  Use when running an ultrawork/ulw-loop task and the agent needs to track
  structured goals and evidence.
---

# ULW-Loop Evidence System

The vendored `ulw-loop` CLI (`vendor/lazygrok-hooks/ulw-loop/dist/cli.js`)
provides structured goal tracking with evidence recording. Use it during
ultrawork loops to make completion evidence-driven.

## Why this matters on Grok

Grok often does **not** inject host tools `update_goal` / `create_goal`
(especially when background workflows are on). That is normal — not a
plugin bug. On Grok:

1. Bind the turn with a `# Goal` markdown block (required by ultrawork).
2. Use **this CLI** for durable criteria + evidence that survive compaction.
3. If `update_goal` happens to appear in the tool list, you may also call it;
   never block work waiting for it, and never narrate its absence.

`omo ulw-loop …` is equivalent when `omo` is on PATH and has the subcommand.

## CLI location

```bash
# Prefer plugin-root path (always works when lazygrok is installed)
ULW_CLI="node ${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js"
# Or: omo ulw-loop …
```

Prefer Grok-facing state under `.lazygrok/ulw-loop/` and evidence under
`.lazygrok/evidence/`. If the CLI already created `.omo/ulw-loop/`, keep
using that run's root (do not fork state mid-run).

## Create goals with success criteria

At the start of an ultrawork task, create structured goals:

```bash
$ULW_CLI create-goals --brief "Add user authentication" --json <<'EOF'
[
  {
    "objective": "Implement login endpoint",
    "successCriteria": [
      {
        "description": "POST /login returns 200 with valid credentials",
        "userModel": "happy"
      },
      {
        "description": "POST /login returns 401 with invalid credentials",
        "userModel": "adversarial"
      }
    ]
  }
]
EOF
```

Each criterion has a `description` (the scenario) and a `userModel`
(`happy`, `edge`, `adversarial`, `regression`).

## Record evidence per criterion

After running each scenario, record the result:

```bash
# PASS
$ULW_CLI record-evidence --goal-id <id> --criterion-id <id> --status pass --evidence "pytest test_login.py::test_valid_login PASSED"

# FAIL
$ULW_CLI record-evidence --goal-id <id> --criterion-id <id> --status fail --evidence "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login returned 500"

# BLOCKED
$ULW_CLI record-evidence --goal-id <id> --criterion-id <id> --status blocked --evidence "Server failed to start: port 3000 in use" --notes "Need to kill stale process"
```

Also write human-readable artifacts under `.lazygrok/evidence/` when useful.

## Checkpoint goal completion

When all criteria for a goal pass, checkpoint it:

```bash
$ULW_CLI checkpoint --goal-id <id> --status complete --evidence "All 3 criteria passed with captured evidence"
```

## Check status

```bash
$ULW_CLI status --json
```

Returns the full plan with goal progress, criterion pass/fail counts, and
evidence trails.

## Integration with ultrawork

The ultrawork skill's execution loop (PIN → RED → GREEN → SURFACE → CLEAN)
maps to this system:

1. **Create goals** at bootstrap → binding success criteria
2. **Record evidence** after each RED/GREEN/SURFACE step
3. **Checkpoint** when all criteria for a goal pass
4. **Status** check before emitting `<promise>DONE</promise>`

This replaces the ad-hoc boulder.json approach with structured, auditable
evidence tracking.
