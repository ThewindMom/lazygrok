---
name: init-deep
description: >
  Deep repository initialization: discover all AGENTS.md files, understand
  project structure, identify build/test/lint commands, check for lazygrok
  state, and report a comprehensive project overview. Use when entering a
  new or unfamiliar repository.
---

# Deep Repository Initialization

When entering a new repository, establish comprehensive context.

## Step 1: Discover all project instructions

Walk from workspace root to current directory:
- `AGENTS.md` at every level (scoped rules)
- `.grok/AGENTS.md` and `.agents/AGENTS.md` at every level
- `.grok/config.toml` for project configuration
- `README.md`, `CONTRIBUTING.md`
- `CLAUDE.md` (alias for AGENTS.md)

## Step 2: Understand the full structure

- List all top-level directories
- Identify the primary language(s) and framework(s)
- Find the module/package definition files:
  - `go.mod` (Go)
  - `package.json` (Node/TypeScript)
  - `Cargo.toml` (Rust)
  - `pyproject.toml` / `setup.py` (Python)
  - `Makefile`, `Taskfile.yml`
- Identify the test directory structure
- Check for CI/CD configuration (`.github/workflows/`)

## Step 3: Identify all commands

- **Build**: how to build the project
- **Test**: how to run tests (unit, integration, e2e)
- **Lint**: how to run linters and formatters
- **Run**: how to run the project locally
- **Deploy**: how to deploy (if applicable)

## Step 4: Check for lazygrok state

- `.lazygrok/` directory existence
- `.lazygrok/boulder.json` — active work records
- `.lazygrok/plans/` — approved plans
- `.lazygrok/handoff.md` — handoff documents
- `.lazygrok/config.jsonc` — workspace configuration
- Active continuation loops

## Step 5: Check for vendored dependencies

- `vendor/` directory (Go)
- `node_modules/` (Node)
- Check for license compliance

## Output

Report:
- Project type, language, and framework
- All build/test/lint/run commands
- All AGENTS.md locations and key rules
- Active lazygrok state (if any)
- CI/CD configuration
- Any potential issues (missing licenses, broken builds, etc.)
