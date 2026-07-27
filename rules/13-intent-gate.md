# Intent Gate (Phase 0)

Modeled on [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) Sisyphus **Phase 0 — Intent Gate**. The `user-prompt.sh` hook may inject `<INTENT_GATE>` banners from keyword detection (`LAZYGROK_INTENT_GATE=0` disables).

## Step 0: Verbalize intent (before acting)

Map surface form → true intent, then state routing out loud:

| Surface form | True intent | Routing |
|--------------|-------------|---------|
| "explain X", "how does Y work" | Research / understanding | Explore → synthesize → answer (no implementation) |
| "implement X", "add Y", "create Z" | Implementation (explicit) | Plan → **delegate wave or execute** |
| "look into X", "check Y", "investigate" | Investigation | Explore → report findings |
| "what do you think about X?" | Evaluation | Evaluate → propose → **wait for confirmation** |
| "I'm seeing error X" / "Y is broken" | Fix needed | Diagnose → fix minimally |
| "refactor", "improve", "clean up" | Open-ended change | Assess codebase → propose approach |

Verbalize before proceeding:

> "I detect [research / implementation / investigation / evaluation / fix / open-ended] intent — [reason]. My approach: [explore → answer / plan → delegate / clarify first / …]."

Verbalization does **not** commit you to implementation — only an explicit user request does.

## Step 1: Classify request type

- **Trivial** (one known file, typo, one-liner) → direct tools; no fan-out
- **Explicit coding** (implement / fix / refactor across unfamiliar or multi-file area) → **coding multi-agent wave** (below) then execute
- **Exploratory** → parallel `spawn_subagent` discovery first (no edits until findings return)
- **Open-ended** → assess codebase before changing code
- **Ambiguous** → ask **one** clarifying question

## Coding multi-agent (Grok — LazyCodex feel)

Use **only** this session’s tools (see `rules/15-grok-tools-only.md`):

| Action | Tool |
|--------|------|
| Spawn | `spawn_subagent({ subagent_type, prompt, background: true })` |
| Wait | `get_command_or_subagent_output({ task_ids, timeout_ms })` |
| Stop | `kill_command_or_subagent({ task_id })` |

**Roles (prefer plugin-qualified names):**

- Codebase map → `lazygrok:explore` (or `explore`)
- External docs / libs → `lazygrok:librarian` (or `librarian`)
- Implementation slice → `lazygrok:lazygrok-worker-medium` / `-high` / `hephaestus`
- Review → `lazygrok:lazygrok-code-reviewer`

**Rules:**

1. **Same turn:** fire every independent child for the current wave first; do not serialize discovery that could run in parallel.
2. **Prompt shape:** `TASK:` + `DELIVERABLE` + `SCOPE` + `VERIFY` + `STOP WHEN` (self-contained; no parent history required).
3. **Depth 1:** never ask a child to spawn subagents.
4. **Barrier:** do not implement / edit product code until discovery children for that wave are terminal or recorded inconclusive.
5. **Trivial exception:** single-file known fix with no design risk → parent may work alone.

## Step 2: Ambiguity

- Single valid reading → proceed
- Similar-effort alternatives → proceed with a stated assumption
- 2×+ effort difference → **must ask**
- Missing file/error/context → **must ask**

## Step 3: Before mutating

- Confirm search scope
- Prefer parallel `spawn_subagent` for broad exploration; use read-only tools until intent is clear
- **Do not implement** on explain/how/research prompts unless the user explicitly asked for code changes

## Hook keyword modes

When keywords appear **outside** fenced code blocks, the hook may emit:

| Mode | Behavior |
|------|----------|
| SEARCH | Read-only exploration first; cite paths; no edits until intent is clear |
| ANALYZE | Report/investigate first; minimal diffs until root cause is confirmed |
| TEAM | Fan out independent work via **parallel `spawn_subagent`** |
| HYPERPLAN | Load hyperplan skill before writing plans |
| HYPERPLAN ULTRAWORK | Hyperplan + ultrawork execution |

Keywords inside ``` fences are ignored (sample code, not user intent).
