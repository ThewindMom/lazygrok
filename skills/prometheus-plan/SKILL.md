---
name: prometheus-plan
description: >
  Strategic planning mode (/plan): interview, gap analysis, write work plans under
  .lazygrok/plans/, optional review, then /start-work to activate boulder execution.
user_invocable: true
---

# Prometheus Plan (`/plan`)

## Purpose

Use `/plan` (or `/prometheus`) when you need a **work plan before implementation**. Planning mode blocks non-markdown writes outside `.lazygrok/` until `/start-work`.

---

## 5-Step Workflow

### Step 1 — Interview

- Classify intent (trivial, refactor, greenfield, architecture, etc.).
- Ask focused questions; record decisions in `.lazygrok/drafts/<topic>.md`.
- Do **not** implement product code in plan mode.

### Step 2 — Research (parallel)

- `Task(subagent_type="explore", ...)` for codebase patterns, references, tests.
- `Task(subagent_type="librarian", ...)` for external docs when needed.
- Do not duplicate the same search after delegating.

### Step 3 — Metis gap analysis

- `Task(subagent_type="metis-consultant", prompt="Review draft + requirements; list gaps and blocking questions.")`
- Resolve gaps with the user before writing the final plan.

### Step 4 — Write the plan

- Single plan file: `.lazygrok/plans/<name>.md`
- Use skeleton Write + Edit batches for large TODO lists (see prometheus-planner agent).
- Include waves, dependencies, QA scenarios, and Final Verification Wave.

### Step 5 — Momus review (optional) → start work

- `Task(subagent_type="momus-reviewer", prompt="Review .lazygrok/plans/<name>.md; verdict OKAY or NEEDS_REVISION.")`
- Fix revisions until OKAY or user accepts risk.
- User runs `/start-work .lazygrok/plans/<name>.md` to write `.lazygrok/boulder.json` and exit plan mode.

---

## Commands

| Command | Effect |
|---------|--------|
| `/plan` | Enable plan mode + planning instructions |
| `/cancel-plan` | Disable plan mode |
| `/start-work <plan.md>` | Write `boulder.json` (schema v2), disable plan mode |

---

## Constraints (enforced by hooks)

- **Allowed writes in plan mode:** `.lazygrok/**/*.md` only
- **Forbidden:** source edits, deletes outside that pattern
- **Execution:** only after `/start-work`