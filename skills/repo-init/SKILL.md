---
name: repo-init
description: >
  Initialize a repository for Grok: discover AGENTS.md files, understand
  project structure, identify build and test commands. Use when starting
  work in a new or unfamiliar repository.
---

# Repository Initialization

When entering a new repository, establish context first.

## Step 1: Discover project instructions

- Look for `AGENTS.md` at the repository root.
- Look for `AGENTS.md` in subdirectories (scoped rules).
- Look for `.grok/config.toml` for project configuration.
- Look for `README.md`, `CONTRIBUTING.md`, and `CLAUDE.md` (alias).

## Step 2: Understand structure

- List the top-level directories.
- Identify the language(s) and framework(s).
- Find the build system (Makefile, Taskfile, package.json, go.mod, Cargo.toml).
- Find the test runner and test directories.

## Step 3: Identify commands

- Build command
- Test command
- Lint/format command
- Run command

## Step 4: Check for lazygrok state

- Look for `.lazygrok/` directory (boulder state, plans, handoffs).
- Look for `.lazygrok/config.jsonc` (workspace configuration).
- Check for active continuation loops.

## Output

Report:
- Project type and language
- Build/test/lint commands
- AGENTS.md locations and key rules
- Active lazygrok state (if any)
