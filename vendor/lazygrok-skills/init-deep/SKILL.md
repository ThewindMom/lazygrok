---
name: init-deep
description: "(builtin) Initialize hierarchical AGENTS.md knowledge base"
---
## Grok Harness Tool Compatibility

This skill may include examples copied from other harnesses. On Grok, use native tools:

| Foreign example | Grok tool to use |
| --- | --- |
| `Task(...)` / `task(...)` | `spawn_subagent(...)` |
| `TodoWrite(...)` | `todo_write(...)` |
| `Bash` / `bash(...)` | `run_terminal_command(...)` |
| `Write` / `Edit` / `StrReplace` | `write` / `search_replace` |
| `Read` | `read_file` |
| `background_output(...)` | `get_command_or_subagent_output(...)` |
| `team_*(...)` | **n/a on Grok** — parallel `spawn_subagent` + orchestrator journal |

Role-specific behavior must be described in a self-contained `prompt`. Use `background: true` when available so the child starts with only the initial prompt. Include required context, files, diffs, and skill names in the spawned agent's `prompt`. Prefer agent types: `explore`, `librarian`, `plan`, `momus`, `metis`, `lazygrok-code-reviewer`, `lazygrok-qa-executor`, `lazygrok-gate-reviewer` — pass matching `subagent_type` (e.g. `lazygrok:explore`). Prefer `.lazygrok/` over `.omo/` for Grok-facing state. If a code block below conflicts with this section, this section wins.

For work likely to exceed one wait cycle, require the child to send `WORKING: <task> - <current phase>` before long passes and `BLOCKED: <reason>` only when progress stops. Poll with `get_command_or_subagent_output`. Treat a running child as alive.

# /init-deep

Generate hierarchical AGENTS.md files. Root + complexity-scored subdirectories.

## Usage

```
/init-deep                      # Update mode: modify existing + create new where warranted
/init-deep --create-new         # Read existing → remove all → regenerate from scratch
/init-deep --max-depth=2        # Limit directory depth (default: 3)
```

---

## Workflow (High-Level)

1. **Discovery + Analysis** (concurrent)
   - Fire background explore agents immediately
   - Main session: structure via `run_terminal_command` + LSP/codegraph code map + read existing AGENTS.md
2. **Score & Decide** - Determine AGENTS.md locations from merged findings
3. **Generate** - Root first, then subdirs in parallel
4. **Review** - Deduplicate, trim, validate

<critical>
**todo_write ALL phases. Mark in_progress → completed in real-time.**
```
todo_write([
  { id: "discovery", content: "Fire explore agents + LSP/codegraph map + read existing", status: "pending" },
  { id: "scoring", content: "Score directories, determine locations", status: "pending" },
  { id: "generate", content: "Generate AGENTS.md files (root + subdirs)", status: "pending" },
  { id: "review", content: "Deduplicate, validate, trim", status: "pending" }
])
```
</critical>

---

## Phase 1: Discovery + Analysis (Concurrent)

**Mark "discovery" as in_progress.**

### Fire Background Explore Agents IMMEDIATELY

Don't wait—these run async while main session works. **Equip every agent with the code graph**: any task touching structure, entry points, dependencies, or hotspots MUST query `codegraph_*` (explore/search/callers/callees/impact) and `lsp_symbols` when present, and ground its claims in that data instead of guessing from conventions.

```
// Fire all at once, collect results later
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Project structure. DELIVERABLE: map real layout via codegraph_explore/codegraph_files → REPORT deviations from standard patterns. VERIFY: absolute paths.")
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Entry points. DELIVERABLE: FIND main files, trace reach via codegraph_callees + lsp_symbols → REPORT non-standard organization.")
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Conventions. DELIVERABLE: FIND config files (.eslintrc, pyproject.toml, .editorconfig) → REPORT project-specific rules.")
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Anti-patterns. DELIVERABLE: FIND 'DO NOT', 'NEVER', 'ALWAYS', 'DEPRECATED' comments → LIST forbidden patterns.")
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Build/CI. DELIVERABLE: FIND .github/workflows, Makefile → REPORT non-standard patterns.")
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Test patterns. DELIVERABLE: FIND test configs/structure; codegraph_callers on core modules → REPORT unique conventions.")
```

<dynamic-agents>
**DYNAMIC AGENT SPAWNING**: After structure analysis, spawn ADDITIONAL explore agents based on project scale:

| Factor | Threshold | Additional Agents |
|--------|-----------|-------------------|
| **Total files** | >100 | +1 per 100 files |
| **Total lines** | >10k | +1 per 10k lines |
| **Directory depth** | ≥4 | +2 for deep exploration |
| **Large files (>500 lines)** | >10 files | +1 for complexity hotspots |
| **Monorepo** | detected | +1 per package/workspace |
| **Multiple languages** | >1 | +1 per language |

```bash
# Measure project scale first
total_files=$(find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | wc -l)
total_lines=$(find . -type f \( -name "*.ts" -o -name "*.py" -o -name "*.go" \) -not -path '*/node_modules/*' -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
large_files=$(find . -type f \( -name "*.ts" -o -name "*.py" \) -not -path '*/node_modules/*' -exec wc -l {} + 2>/dev/null | awk '$1 > 500 {count++} END {print count+0}')
max_depth=$(find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | awk -F/ '{print NF}' | sort -rn | head -1)
```

Example spawning:
```
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Large file analysis. DELIVERABLE: FIND files >500 lines, REPORT complexity hotspots.")
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Deep modules at depth 4+. DELIVERABLE: FIND hidden patterns, internal conventions.")
spawn_subagent(subagent_type="lazygrok:explore", background=true, prompt="TASK: Shared utilities. DELIVERABLE: FIND cross-cutting concerns across directories.")
```
</dynamic-agents>

### Main Session: Concurrent Analysis

**While background agents run**, main session does:

#### 1. Structural Analysis (`run_terminal_command`)
```bash
# Directory depth + file counts
find . -type d -not -path '*/\.*' -not -path '*/node_modules/*' -not -path '*/venv/*' -not -path '*/dist/*' -not -path '*/build/*' | awk -F/ '{print NF-1}' | sort -n | uniq -c

# Files per directory (top 30)
find . -type f -not -path '*/\.*' -not -path '*/node_modules/*' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -30

# Code concentration by extension
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.go" -o -name "*.rs" \) -not -path '*/node_modules/*' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20

# Existing AGENTS.md / CLAUDE.md
find . -type f \( -name "AGENTS.md" -o -name "CLAUDE.md" \) -not -path '*/node_modules/*' 2>/dev/null
```

#### 2. Read Existing AGENTS.md
```
For each existing file found:
  read_file(filePath=file)
  Extract: key insights, conventions, anti-patterns
  Store in EXISTING_AGENTS map
```

If `--create-new`: Read all existing first (preserve context) → then delete all → regenerate.

#### 3. Code Map - drive LSP AND codegraph (do NOT skip)

Highest-signal source for the CODE MAP and the Symbol/Export/Reference scoring rows. Complementary, not alternatives - run BOTH when present, alongside the explore agents.

**LSP** - check `lsp_status`; model-facing names are `lsp_status`/`lsp_symbols`/`lsp_find_references`/`lsp_goto_definition` (some harnesses drop the `lsp_` prefix):
- `lsp_symbols` scope="document" on each entry point -> file outline.
- `lsp_symbols` scope="workspace", query by kind (class/interface/function) -> symbol inventory.
- `lsp_find_references` on top exports (line/character from the symbols result) -> reference centrality.

**codegraph** - when `codegraph_*` tools exist (check `codegraph_status`); a first-class peer to LSP, NOT a last resort:
- `codegraph_explore` -> overview; `codegraph_callers`/`codegraph_callees`/`codegraph_impact` -> centrality + blast radius for the scoring matrix; `codegraph_search`/`codegraph_files` -> symbol/file inventory.

Only if NEITHER exists: explore agents + the ast-grep skill (`sg`), and mark centrality unmeasured in the CODE MAP.

### Collect Background Results

```
// After main session analysis done, collect all task results
for each background task: get_command_or_subagent_output(...)
```

**Merge: structure analysis + LSP/codegraph + existing + explore findings. Mark "discovery" as completed.**

---

## Phase 2: Scoring & Location Decision

**Mark "scoring" as in_progress.**

### Scoring Matrix

| Factor | Weight | High Threshold | Source |
|--------|--------|----------------|--------|
| File count | 3x | >20 | shell |
| Subdir count | 2x | >5 | shell |
| Code ratio | 2x | >70% | shell |
| Unique patterns | 1x | Has own config | explore |
| Module boundary | 2x | Has index.ts/__init__.py | shell |
| Symbol density | 2x | >30 symbols | LSP/cg |
| Export count | 2x | >10 exports | LSP/cg |
| Reference centrality | 3x | >20 refs | LSP/cg |

### Decision Rules

| Score | Action |
|-------|--------|
| **Root (.)** | ALWAYS create |
| **>15** | Create AGENTS.md |
| **8-15** | Create if distinct domain |
| **<8** | Skip (parent covers) |

### Output
```
AGENTS_LOCATIONS = [
  { path: ".", type: "root" },
  { path: "src/hooks", score: 18, reason: "high complexity" },
  { path: "src/api", score: 12, reason: "distinct domain" }
]
```

**Mark "scoring" as completed.**

---

## Phase 3: Generate AGENTS.md

**Mark "generate" as in_progress.**

<critical>
**File Writing Rule**: If AGENTS.md already exists at the target path → use `search_replace`. If it does NOT exist → use `write`.
NEVER use write to overwrite an existing file blindly. ALWAYS check existence first via `read_file` or discovery results.
</critical>

### Root AGENTS.md (Full Treatment)

```markdown
# PROJECT KNOWLEDGE BASE

**Generated:** {TIMESTAMP}
**Commit:** {SHORT_SHA}
**Branch:** {BRANCH}

## OVERVIEW
{1-2 sentences: what + core stack}

## STRUCTURE
```
{root}/
├── {dir}/    # {non-obvious purpose only}
└── {entry}
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|

## CODE MAP
{From LSP/codegraph - skip only if neither exists or project <10 files}

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|

## CONVENTIONS
{ONLY deviations from standard}

## ANTI-PATTERNS (THIS PROJECT)
{Explicitly forbidden here}

## UNIQUE STYLES
{Project-specific}

## COMMANDS
```bash
{dev/test/build}
```

## NOTES
{Gotchas}
```

**Quality gates**: 50-150 lines, no generic advice, no obvious info.

### Subdirectory AGENTS.md (Parallel)

Launch writing tasks for each location:

```
for loc in AGENTS_LOCATIONS (except root):
  spawn_subagent(subagent_type="lazygrok:lazygrok-executor", background=false, prompt=`
    TASK: Generate AGENTS.md for: ${loc.path}
    DELIVERABLE: 30-80 lines max AGENTS.md
    SCOPE: reason=${loc.reason}; NEVER repeat parent content
    VERIFY: sections OVERVIEW (1 line), STRUCTURE (if >5 subdirs), WHERE TO LOOK, CONVENTIONS (if different), ANTI-PATTERNS
  `)
```

**Wait for all. Mark "generate" as completed.**

---

## Phase 4: Review & Deduplicate

**Mark "review" as in_progress.**

For each generated file:
- Remove generic advice
- Remove parent duplicates
- Trim to size limits
- Verify telegraphic style

**Mark "review" as completed.**

---

## Final Report

```
=== init-deep Complete ===

Mode: {update | create-new}

Files:
  [OK] ./AGENTS.md (root, {N} lines)
  [OK] ./src/hooks/AGENTS.md ({N} lines)

Dirs Analyzed: {N}
AGENTS.md Created: {N}
AGENTS.md Updated: {N}

Hierarchy:
  ./AGENTS.md
  └── src/hooks/AGENTS.md
```

---

## Anti-Patterns

- **Static agent count**: MUST vary agents based on project size/depth
- **Sequential execution**: MUST parallel (explore + LSP + codegraph concurrent)
- **Ignoring existing**: ALWAYS read existing first, even with --create-new
- **Over-documenting**: Not every dir needs AGENTS.md
- **Redundancy**: Child never repeats parent
- **Generic content**: Remove anything that applies to ALL projects
- **Verbose style**: Telegraphic or die
