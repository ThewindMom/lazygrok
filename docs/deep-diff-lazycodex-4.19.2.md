# Deep Diff: LazyGrok 0.3.0 vs LazyCodex/OmO 4.19.2

## Skills inventory
- LazyGrok skill dirs found: **55**
- LazyCodex skill dirs found: **25**

### Paired skills: 29
### LazyGrok-only: 26
### LazyCodex-only: 0

## Skill-by-skill content diff

| Skill (LG→LCX) | LG files | LCX files | only LG | only LCX | content-diff | SKILL.md same | body ΔB | goal tools |
|---|---:|---:|---:|---:|---:|---|---:|---|
| `ast-grep` | 18 | 17 | 1 | 0 | 0 | YES | +0 | — |
| `coding-agent-sessions` | 24 | 23 | 2 | 1 | 5 | NO | +388 | — |
| `comment-checker` | 2 | 2 | 0 | 0 | 1 | NO | -9 | — |
| `debugging` | 20 | 21 | 0 | 1 | 5 | NO | +297 | — |
| `frontend` | 167 | 172 | 0 | 5 | 97 | NO | +8496 | — |
| `git-master` | 1 | 2 | 0 | 1 | 1 | NO | +3337 | — |
| `init-deep` | 1 | 2 | 0 | 1 | 1 | NO | +13758 | — |
| `lcx-contribute-bug-fix` | 3 | 3 | 0 | 0 | 2 | NO | +1366 | — |
| `lcx-doctor` | 2 | 2 | 0 | 0 | 2 | NO | +2910 | — |
| `lcx-report-bug` | 2 | 2 | 0 | 0 | 2 | NO | +1597 | — |
| `lsp` | 1 | 2 | 0 | 1 | 1 | NO | -633 | — |
| `lsp-setup` | 26 | 26 | 0 | 0 | 1 | NO | -361 | — |
| `programming` | 74 | 75 | 0 | 1 | 2 | NO | +5702 | — |
| `prometheus-plan→ulw-plan` | 1 | 6 | 0 | 5 | 1 | NO | +11439 | — |
| `refactor` | 2 | 2 | 0 | 0 | 1 | NO | +3112 | todo_write:4→0 |
| `refactoring→refactor` | 1 | 2 | 0 | 1 | 1 | NO | +28226 | — |
| `remove-ai-slops` | 1 | 2 | 0 | 1 | 1 | NO | +23878 | — |
| `review-work` | 1 | 2 | 0 | 1 | 1 | NO | +29360 | — |
| `rules` | 2 | 2 | 0 | 0 | 1 | NO | -176 | — |
| `start-work` | 2 | 2 | 0 | 0 | 1 | NO | +5783 | create_goal:0→1; # Goal:0→1 |
| `start-work-execution→start-work` | 1 | 2 | 0 | 1 | 1 | NO | +21344 | create_goal:0→1; # Goal:0→1 |
| `systematic-debugging→debugging` | 1 | 21 | 0 | 20 | 1 | NO | +10176 | — |
| `teammode` | 6 | 7 | 0 | 1 | 4 | NO | +10788 | — |
| `ultimate-browsing` | 2 | 46 | 0 | 44 | 1 | NO | -190 | — |
| `ultraresearch→ulw-research` | 3 | 3 | 0 | 0 | 2 | NO | +4337 | — |
| `ultrawork` | 3 | 2 | 1 | 0 | 2 | NO | +763 | create_goal:1→2; update_goal:2→0; # Goal:3→2; todo_write:6→0; update_plan:0→6 |
| `ulw-loop` | 2 | 4 | 0 | 2 | 2 | NO | +4032 | create_goal:0→1; update_plan:0→1 |
| `ulw-plan` | 5 | 6 | 0 | 1 | 4 | NO | +10925 | todo_write:3→0 |
| `visual-qa` | 13 | 13 | 0 | 0 | 2 | NO | +13773 | — |

### LazyGrok-only skills
- `agent-skill-gate` @ `skills/agent-skill-gate` (1801 B)
- `brainstorming` @ `vendor/superpowers/skills/brainstorming` (10634 B)
- `cancel-ralph` @ `skills/cancel-ralph` (574 B)
- `code-review` @ `skills/code-review` (1205 B)
- `disciplined-implementation` @ `skills/disciplined-implementation` (1378 B)
- `dispatching-parallel-agents` @ `vendor/superpowers/skills/dispatching-parallel-agents` (6566 B)
- `executing-plans` @ `vendor/superpowers/skills/executing-plans` (2481 B)
- `finishing-a-development-branch` @ `vendor/superpowers/skills/finishing-a-development-branch` (7061 B)
- `git-workflow` @ `skills/git-workflow` (1239 B)
- `handoff` @ `skills/handoff` (1386 B)
- `hashline-edit` @ `skills/hashline-edit` (2060 B)
- `programming-references` @ `skills/programming-references` (2242 B)
- `ralph-loop` @ `skills/ralph-loop` (1730 B)
- `receiving-code-review` @ `vendor/superpowers/skills/receiving-code-review` (6314 B)
- `repo-init` @ `skills/repo-init` (1275 B)
- `requesting-code-review` @ `vendor/superpowers/skills/requesting-code-review` (2870 B)
- `research` @ `skills/research` (1193 B)
- `subagent-driven-development` @ `vendor/superpowers/skills/subagent-driven-development` (12552 B)
- `test-driven` @ `skills/test-driven` (1253 B)
- `test-driven-development` @ `vendor/superpowers/skills/test-driven-development` (9867 B)
- `ulw-evidence` @ `skills/ulw-evidence` (3694 B)
- `using-git-worktrees` @ `vendor/superpowers/skills/using-git-worktrees` (7983 B)
- `using-superpowers` @ `vendor/superpowers/skills/using-superpowers` (5835 B)
- `verification-before-completion` @ `vendor/superpowers/skills/verification-before-completion` (4201 B)
- `writing-plans` @ `vendor/superpowers/skills/writing-plans` (6100 B)
- `writing-skills` @ `vendor/superpowers/skills/writing-skills` (22625 B)

### LazyCodex-only skills

## Skill file-level churn (paired, sorted by content-diff)

### `frontend` — churn=102, SKILL.md=NO, bodyΔ=+8496B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/frontend`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/frontend`
- **LCX-only files (5):** `references/design/aside.md`, `references/design/clone-from-url.md`, `references/design/layout-skill.md`, `references/design/lazyweb.md`, `references/design/stitch-design-example.md`
- **Changed files (97):**
  - `ATTRIBUTION.md`: LG 6355B → LCX 12144B (Δ+5789)
  - `SKILL.md`: LG 9983B → LCX 18184B (Δ+8201)
  - `references/design/README.md`: LG 16631B → LCX 24662B (Δ+8031)
  - `references/design/_INDEX.md`: LG 14068B → LCX 14650B (Δ+582)
  - `references/design/airbnb.md`: LG 29405B → LCX 29511B (Δ+106)
  - `references/design/airtable.md`: LG 3556B → LCX 3665B (Δ+109)
  - `references/design/apple.md`: LG 17678B → LCX 17780B (Δ+102)
  - `references/design/binance.md`: LG 18806B → LCX 18912B (Δ+106)
  - `references/design/bmw.md`: LG 9809B → LCX 9915B (Δ+106)
  - `references/design/bugatti.md`: LG 26648B → LCX 26758B (Δ+110)
  - `references/design/cal.md`: LG 17798B → LCX 17906B (Δ+108)
  - `references/design/claude.md`: LG 20293B → LCX 20391B (Δ+98)
  - `references/design/clay.md`: LG 17329B → LCX 17432B (Δ+103)
  - `references/design/clickhouse.md`: LG 15391B → LCX 15494B (Δ+103)
  - `references/design/cohere.md`: LG 14754B → LCX 14852B (Δ+98)
  - `references/design/coinbase.md`: LG 5005B → LCX 5110B (Δ+105)
  - `references/design/composio.md`: LG 20911B → LCX 21013B (Δ+102)
  - `references/design/cursor.md`: LG 19078B → LCX 19171B (Δ+93)
  - `references/design/design-system-architecture.md`: LG 9106B → LCX 12710B (Δ+3604)
  - `references/design/elevenlabs.md`: LG 15189B → LCX 15278B (Δ+89)
  - … +77 more
- desc LG: MUST USE for ANY frontend, web UI, UX, or visual work — building, styling, or redesigning pages/components, React projec…
- desc LCX: MUST USE for frontend/web UI/UX/visual work: building, styling, redesigning pages/components, React setup, performance a…

### `ultimate-browsing` — churn=45, SKILL.md=NO, bodyΔ=-190B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/ultimate-browsing`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ultimate-browsing`
- **LCX-only files (44):** `agents/openai.yaml`, `engine/__init__.py`, `engine/__main__.py`, `engine/bias_check.py`, `engine/curl_probe.py`, `engine/executor.py`, `engine/fetch_chain.py`, `engine/referers.py`, `engine/result_schema.py`, `engine/summary.py`, `engine/templates/package.json`, `engine/templates/playwright_mobile_chrome.js`, `engine/templates/playwright_real_chrome.js`, `engine/tests/test_fetch_chain.py`, `engine/tests/test_playwright_templates.py` …
- **Changed files (1):**
  - `SKILL.md`: LG 10321B → LCX 10251B (Δ-70)
- desc LG: >…
- desc LCX: Escalation skill for blocked or hard-to-reach web access — load it when a normal browse/fetch is blocked (WAF, 403, Clou…

### `systematic-debugging→debugging` — churn=21, SKILL.md=NO, bodyΔ=+10176B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/systematic-debugging`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/debugging`
- **LCX-only files (20):** `agents/openai.yaml`, `references/methodology/00-setup.md`, `references/methodology/02-investigate.md`, `references/methodology/03-flaky-triage.md`, `references/methodology/04-oracle-triple.md`, `references/methodology/05-escalate.md`, `references/methodology/06-fix.md`, `references/methodology/08-qa.md`, `references/methodology/09-cleanup.md`, `references/methodology/partial-runtime-evidence.md`, `references/runtimes/bundled-js-binary.md`, `references/runtimes/go.md`, `references/runtimes/native-binary.md`, `references/runtimes/node.md`, `references/runtimes/python.md` …
- **Changed files (1):**
  - `SKILL.md`: LG 1455B → LCX 12453B (Δ+10998)
- desc LG: >…
- desc LCX: MUST USE for any real runtime debugging across ANY language or binary — crashes, silent failures, wrong responses, stuck…

### `coding-agent-sessions` — churn=8, SKILL.md=NO, bodyΔ=+388B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/coding-agent-sessions`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/coding-agent-sessions`
- **LCX-only files (1):** `scripts/agent_sessions/pi_family.py`
- **LG-only files (2):** `references/grok.md`, `scripts/agent_sessions/grok.py`
- **Changed files (5):**
  - `SKILL.md`: LG 10648B → LCX 11072B (Δ+424)
  - `agents/openai.yaml`: LG 236B → LCX 232B (Δ-4)
  - `references/all-platforms.md`: LG 5337B → LCX 5518B (Δ+181)
  - `references/senpi.md`: LG 769B → LCX 1717B (Δ+948)
  - `scripts/agent_sessions/scanners.py`: LG 3366B → LCX 3205B (Δ-161)
- desc LG: MUST USE when asked to find, read, list, search, inspect, fetch, export, or reconstruct coding-agent sessions across Gro…
- desc LCX: MUST USE when asked to find, read, list, search, inspect, fetch, export, or reconstruct coding-agent sessions across Cod…

### `debugging` — churn=6, SKILL.md=NO, bodyΔ=+297B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/debugging`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/debugging`
- **LCX-only files (1):** `references/methodology/03-flaky-triage.md`
- **Changed files (5):**
  - `SKILL.md`: LG 12133B → LCX 12453B (Δ+320)
  - `references/methodology/02-investigate.md`: LG 7480B → LCX 7648B (Δ+168)
  - `references/methodology/04-oracle-triple.md`: LG 7035B → LCX 6734B (Δ-301)
  - `references/methodology/06-fix.md`: LG 5529B → LCX 6544B (Δ+1015)
  - `references/methodology/partial-runtime-evidence.md`: LG 10775B → LCX 10697B (Δ-78)

### `prometheus-plan→ulw-plan` — churn=6, SKILL.md=NO, bodyΔ=+11439B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/prometheus-plan`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-plan`
- **LCX-only files (5):** `agents/openai.yaml`, `references/full-workflow.md`, `references/intent-clear.md`, `references/intent-unclear.md`, `scripts/scaffold-plan.mjs`
- **Changed files (1):**
  - `SKILL.md`: LG 2211B → LCX 14356B (Δ+12145)
- desc LG: >…
- desc LCX: MUST USE for planning before coding when design uncertainty remains after discovery: ambiguous scope, competing decompos…

### `teammode` — churn=5, SKILL.md=NO, bodyΔ=+10788B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/teammode`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/teammode`
- **LCX-only files (1):** `scripts/team-worktree.mjs`
- **Changed files (4):**
  - `SKILL.md`: LG 9694B → LCX 21054B (Δ+11360)
  - `scripts/team-guide.mjs`: LG 6223B → LCX 11357B (Δ+5134)
  - `scripts/team-state.mjs`: LG 10354B → LCX 18969B (Δ+8615)
  - `scripts/team.mjs`: LG 8501B → LCX 15681B (Δ+7180)
- desc LG: Grok: n/a — use parallel spawn_subagent. Codex-only team orchestration (NOT runnable on Grok Build): run a named team of…
- desc LCX: Codex-only team orchestration: run a named team of cooperating Codex workers with durable, script-managed state. MUST US…

### `ulw-plan` — churn=5, SKILL.md=NO, bodyΔ=+10925B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/ulw-plan`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-plan`
- **LCX-only files (1):** `agents/openai.yaml`
- **Changed files (4):**
  - `SKILL.md`: LG 2748B → LCX 14356B (Δ+11608)
  - `references/full-workflow.md`: LG 24158B → LCX 25177B (Δ+1019)
  - `references/intent-clear.md`: LG 4639B → LCX 4685B (Δ+46)
  - `scripts/scaffold-plan.mjs`: LG 13468B → LCX 13393B (Δ-75)
- desc LG: >…
- desc LCX: MUST USE for planning before coding when design uncertainty remains after discovery: ambiguous scope, competing decompos…

### `ulw-loop` — churn=4, SKILL.md=NO, bodyΔ=+4032B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/ulw-loop`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-loop`
- **LCX-only files (2):** `.gitkeep`, `agents/openai.yaml`
- **Changed files (2):**
  - `SKILL.md`: LG 1444B → LCX 5389B (Δ+3945)
  - `references/full-workflow.md`: LG 14197B → LCX 32739B (Δ+18542)
- desc LG: >…
- desc LCX: Goal-like loop that uses ultrawork mode to decompose work into systematic, evidence-bound steps.…

### `programming` — churn=3, SKILL.md=NO, bodyΔ=+5702B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/programming`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/programming`
- **LCX-only files (1):** `references/logging.md`
- **Changed files (2):**
  - `SKILL.md`: LG 33457B → LCX 39264B (Δ+5807)
  - `scripts/typescript/check-no-excuse-rules.ts`: LG 10231B → LCX 12813B (Δ+2582)

### `ultrawork` — churn=3, SKILL.md=NO, bodyΔ=+763B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/ultrawork`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ultrawork`
- **LG-only files (1):** `directive.md`
- **Changed files (2):**
  - `SKILL.md`: LG 26114B → LCX 26868B (Δ+754)
  - `agents/openai.yaml`: LG 50B → LCX 44B (Δ-6)
- desc LG: Binding ultrawork mode directive for lazygrok on Grok. When a prompt contains ultrawork or ulw, the lazygrok UserPromptS…
- desc LCX: Binding ultrawork mode directive for omo on Codex. When a prompt contains ultrawork or ulw, the omo UserPromptSubmit hoo…

### `git-master` — churn=2, SKILL.md=NO, bodyΔ=+3337B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/git-master`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/git-master`
- **LCX-only files (1):** `agents/openai.yaml`
- **Changed files (1):**
  - `SKILL.md`: LG 2113B → LCX 5570B (Δ+3457)
- desc LG: >…
- desc LCX: MUST USE whenever a task needs a commit or git-history investigation. Covers atomic commits, staging, commit-message sty…

### `init-deep` — churn=2, SKILL.md=NO, bodyΔ=+13758B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/init-deep`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/init-deep`
- **LCX-only files (1):** `agents/openai.yaml`
- **Changed files (1):**
  - `SKILL.md`: LG 2063B → LCX 15624B (Δ+13561)
- desc LG: >…
- desc LCX: (builtin) Initialize hierarchical AGENTS.md knowledge base…

### `lcx-contribute-bug-fix` — churn=2, SKILL.md=NO, bodyΔ=+1366B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/lcx-contribute-bug-fix`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/lcx-contribute-bug-fix`
- **Changed files (2):**
  - `SKILL.md`: LG 9963B → LCX 11329B (Δ+1366)
  - `agents/openai.yaml`: LG 656B → LCX 667B (Δ+11)

### `lcx-doctor` — churn=2, SKILL.md=NO, bodyΔ=+2910B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/lcx-doctor`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/lcx-doctor`
- **Changed files (2):**
  - `SKILL.md`: LG 6098B → LCX 9008B (Δ+2910)
  - `agents/openai.yaml`: LG 588B → LCX 643B (Δ+55)

### `lcx-report-bug` — churn=2, SKILL.md=NO, bodyΔ=+1597B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/lcx-report-bug`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/lcx-report-bug`
- **Changed files (2):**
  - `SKILL.md`: LG 10471B → LCX 12068B (Δ+1597)
  - `agents/openai.yaml`: LG 643B → LCX 691B (Δ+48)

### `lsp` — churn=2, SKILL.md=NO, bodyΔ=-633B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/lsp`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/lsp`
- **LCX-only files (1):** `agents/openai.yaml`
- **Changed files (1):**
  - `SKILL.md`: LG 1902B → LCX 1213B (Δ-689)
- desc LG: >…
- desc LCX: Use when Codex needs language-server diagnostics, definitions, references, symbols, or rename safety checks in the curre…

### `refactoring→refactor` — churn=2, SKILL.md=NO, bodyΔ=+28226B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/refactoring`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/refactor`
- **LCX-only files (1):** `agents/openai.yaml`
- **Changed files (1):**
  - `SKILL.md`: LG 1167B → LCX 29331B (Δ+28164)
- desc LG: >…
- desc LCX: Intelligent refactor command. Triggers: refactor, refactoring, cleanup, restructure, extract, simplify, modernize.…

### `remove-ai-slops` — churn=2, SKILL.md=NO, bodyΔ=+23878B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/remove-ai-slops`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/remove-ai-slops`
- **LCX-only files (1):** `agents/openai.yaml`
- **Changed files (1):**
  - `SKILL.md`: LG 1819B → LCX 26284B (Δ+24465)
- desc LG: >…
- desc LCX: Remove AI-generated code smells (slop) from branch changes or an explicit file list. Locks behavior with regression test…

### `review-work` — churn=2, SKILL.md=NO, bodyΔ=+29360B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/review-work`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/review-work`
- **LCX-only files (1):** `agents/openai.yaml`
- **Changed files (1):**
  - `SKILL.md`: LG 1370B → LCX 31087B (Δ+29717)
- desc LG: >…
- desc LCX: Post-implementation review orchestrator. Launches 5 parallel background sub-agents: Oracle (goal/constraint verification…

### `start-work-execution→start-work` — churn=2, SKILL.md=NO, bodyΔ=+21344B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/start-work-execution`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/start-work`
- **LCX-only files (1):** `agents/openai.yaml`
- **Changed files (1):**
  - `SKILL.md`: LG 1471B → LCX 22917B (Δ+21446)
- desc LG: >…
- desc LCX: Execute a Prometheus work plan in Codex with Boulder state, evidence ledger updates, worktree discipline, parallel subag…

### `ultraresearch→ulw-research` — churn=2, SKILL.md=NO, bodyΔ=+4337B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/ultraresearch`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-research`
- **Changed files (2):**
  - `SKILL.md`: LG 25029B → LCX 29391B (Δ+4362)
  - `agents/openai.yaml`: LG 48B → LCX 47B (Δ-1)

### `visual-qa` — churn=2, SKILL.md=NO, bodyΔ=+13773B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/visual-qa`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/visual-qa`
- **Changed files (2):**
  - `SKILL.md`: LG 17248B → LCX 30651B (Δ+13403)
  - `references/agent-browser-setup.md`: LG 1647B → LCX 1760B (Δ+113)
- desc LG: Rigorous visual QA for any UI you built or changed, across BOTH web/page UIs and TUI/terminal UIs. MUST USE after buildi…
- desc LCX: MUST USE after building/changing any UI or when asked whether a page, component, or TUI looks right. Rigorous visual QA …

### `ast-grep` — churn=1, SKILL.md=YES, bodyΔ=+0B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/ast-grep`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ast-grep`
- **LG-only files (1):** `.gitignore`

### `comment-checker` — churn=1, SKILL.md=NO, bodyΔ=-9B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/comment-checker`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/comment-checker`
- **Changed files (1):**
  - `SKILL.md`: LG 648B → LCX 640B (Δ-8)
- desc LG: Use when Grok needs to understand or respond to automatic comment-checker feedback emitted after an edit-like PostToolUs…
- desc LCX: Use when Codex needs to understand or respond to automatic comment-checker feedback emitted after an edit-like PostToolU…

### `lsp-setup` — churn=1, SKILL.md=NO, bodyΔ=-361B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/lsp-setup`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/lsp-setup`
- **Changed files (1):**
  - `SKILL.md`: LG 6694B → LCX 6317B (Δ-377)

### `refactor` — churn=1, SKILL.md=NO, bodyΔ=+3112B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/refactor`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/refactor`
- **Changed files (1):**
  - `SKILL.md`: LG 26219B → LCX 29331B (Δ+3112)

### `rules` — churn=1, SKILL.md=NO, bodyΔ=-176B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/rules`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/rules`
- **Changed files (1):**
  - `SKILL.md`: LG 1251B → LCX 1076B (Δ-175)
- desc LG: Use when the user asks about Grok Rules behavior, injected project rules, supported rule file locations, matching, or en…
- desc LCX: Use when the user asks about Codex Rules behavior, injected project rules, supported rule file locations, matching, or e…

### `start-work` — churn=1, SKILL.md=NO, bodyΔ=+5783B
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/start-work`
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/start-work`
- **Changed files (1):**
  - `SKILL.md`: LG 17138B → LCX 22917B (Δ+5779)
- desc LG: Execute a Prometheus work plan in Grok with Boulder state, evidence ledger updates, worktree discipline, parallel subage…
- desc LCX: Execute a Prometheus work plan in Codex with Boulder state, evidence ledger updates, worktree discipline, parallel subag…


---

# Hooks deep diff

## LazyGrok hooks.json entries: **39** across events: ['Notification', 'PermissionDenied', 'PostCompact', 'PostToolUse', 'PostToolUseFailure', 'PreCompact', 'PreToolUse', 'SessionEnd', 'SessionStart', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit']
## LazyCodex hook JSON files: **23**

### LazyCodex hook files (event / matcher / command summary)

| File | Event | Matcher | Command (truncated) |
|---|---|---|---|
| `post-compact-resetting-git-bash-mcp-reminder.json` | PostCompact | `manual|auto` | `node "${PLUGIN_ROOT}/components/git-bash/dist/cli.js" hook post-compact` |
| `post-compact-resetting-lsp-diagnostics-cache.json` | PostCompact | `manual|auto` | `node "${PLUGIN_ROOT}/components/lsp/dist/cli.js" hook post-compact` |
| `post-compact-resetting-project-rule-cache.json` | PostCompact | `manual|auto` | `node "${PLUGIN_ROOT}/components/rules/dist/cli.js" hook post-compact` |
| `post-tool-use-checking-codegraph-init-guidance.json` | PostToolUse | `^(codegraph[._].*|mcp__codegraph__.*)$` | `node "${PLUGIN_ROOT}/components/codegraph/dist/cli.js" hook post-tool-use` |
| `post-tool-use-checking-comments.json` | PostToolUse | `^(apply_patch|write|Write|edit|Edit|multi_edit|multiedit|MultiEdit)$` | `node "${PLUGIN_ROOT}/components/comment-checker/dist/cli.js" hook post-tool-use` |
| `post-tool-use-checking-lsp-diagnostics.json` | PostToolUse | `^(apply_patch|write|Write|edit|Edit|multi_edit|multiedit|MultiEdit)$` | `node "${PLUGIN_ROOT}/components/lsp/dist/cli.js" hook post-tool-use` |
| `post-tool-use-checking-thread-title-hygiene.json` | PostToolUse | `^(create_thread|codex_app\.create_thread)$` | `node "${PLUGIN_ROOT}/components/teammode/dist/cli.js" hook post-tool-use` |
| `post-tool-use-matching-project-rules.json` | PostToolUse | `^apply_patch$` | `node "${PLUGIN_ROOT}/components/rules/dist/cli.js" hook post-tool-use` |
| `pre-tool-use-enforcing-unlimited-goal-budget.json` | PreToolUse | `^create_goal$` | `node "${PLUGIN_ROOT}/components/ulw-loop/dist/cli.js" hook pre-tool-use` |
| `pre-tool-use-guarding-ulw-loop-spawns.json` | PreToolUse | `^(spawn_agent|collaborationspawn_agent|collaboration\.spawn_agent)$` | `node "${PLUGIN_ROOT}/components/ulw-loop/dist/cli.js" hook pre-tool-use-spawn` |
| `pre-tool-use-recommending-git-bash-mcp.json` | PreToolUse | `^Bash$` | `node "${PLUGIN_ROOT}/components/git-bash/dist/cli.js" hook pre-tool-use` |
| `session-start-checking-auto-update.json` | SessionStart | `^startup$` | `node "${PLUGIN_ROOT}/scripts/auto-update.mjs" hook session-start` |
| `session-start-checking-bootstrap-provisioning.json` | SessionStart | `` | `node "${PLUGIN_ROOT}/components/bootstrap/dist/cli.js" hook session-start` |
| `session-start-checking-codegraph-bootstrap.json` | SessionStart | `` | `node "${PLUGIN_ROOT}/components/codegraph/dist/cli.js" hook session-start` |
| `session-start-loading-project-rules.json` | SessionStart | `` | `node "${PLUGIN_ROOT}/components/rules/dist/cli.js" hook session-start` |
| `session-start-recording-session-telemetry.json` | SessionStart | `` | `node "${PLUGIN_ROOT}/components/telemetry/dist/cli.js" hook session-start` |
| `stop-checking-start-work-continuation.json` | Stop | `` | `node "${PLUGIN_ROOT}/components/start-work-continuation/dist/cli.js" hook stop` |
| `stop-checking-ulw-loop-resume.json` | Stop | `` | `node "${PLUGIN_ROOT}/components/ulw-loop/dist/cli.js" hook stop` |
| `subagent-stop-checking-start-work-continuation.json` | SubagentStop | `` | `node "${PLUGIN_ROOT}/components/start-work-continuation/dist/cli.js" hook subagent-stop` |
| `subagent-stop-verifying-lazycodex-executor-evidence.json` | SubagentStop | `^lazycodex-worker-(low|medium|high)$` | `node "${PLUGIN_ROOT}/components/lazycodex-executor-verify/dist/cli.js" hook subagent-stop` |
| `user-prompt-submit-checking-ultrawork-trigger.json` | UserPromptSubmit | `` | `node "${PLUGIN_ROOT}/components/ultrawork/dist/cli.js" hook user-prompt-submit` |
| `user-prompt-submit-checking-ulw-loop-steering.json` | UserPromptSubmit | `` | `node "${PLUGIN_ROOT}/components/ulw-loop/dist/cli.js" hook user-prompt-submit` |
| `user-prompt-submit-loading-project-rules.json` | UserPromptSubmit | `` | `node "${PLUGIN_ROOT}/components/rules/dist/cli.js" hook user-prompt-submit` |

### LazyGrok hook entries

| Event | Matcher | Command (truncated) | Status |
|---|---|---|---|
| SessionStart | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" session-start` |  |
| SessionStart | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" rules session-start` | (OmO) Loading Project Rules |
| SessionStart | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" bootstrap session-start` | (OmO) Checking Bootstrap Provisioning |
| SessionStart | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" telemetry session-start` | (OmO) Recording Session Telemetry |
| SessionStart | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" codegraph session-start` | (OmO) Checking CodeGraph Bootstrap |
| UserPromptSubmit | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" user-prompt` |  |
| UserPromptSubmit | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" ultrawork user-prompt-submit` | (OmO) Checking Ultrawork Trigger |
| UserPromptSubmit | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" ulw-loop user-prompt-submit` | (OmO) Checking Ulw-Loop Steering |
| UserPromptSubmit | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" rules user-prompt-submit` | (OmO) Loading Project Rules |
| PreToolUse | `Write|StrReplace|EditNotebook|Delete|search_replace|write|spawn_subagent|spawn_agent|task` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" pre-tool-use` |  |
| PreToolUse | `^run_terminal_command$|^Bash$` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" git-bash pre-tool-use` | (OmO) Recommending Git Bash MCP |
| PreToolUse | `^update_goal$|^create_goal$` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" ulw-loop pre-tool-use` | (OmO) Enforcing Unlimited Goal Budget |
| PreToolUse | `^spawn_subagent$|^spawn_agent$|^task$` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" ulw-loop pre-tool-use-spawn` | (lazygrok) Guarding Ulw-Loop Spawns |
| PostToolUse | `Read|read_file` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" post-tool-read` |  |
| PostToolUse | `TodoWrite|todo_write` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" post-tool-todo-write` |  |
| PostToolUse | `Write|StrReplace|search_replace|write` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" post-tool-lsp` |  |
| PostToolUse | `Write|StrReplace|search_replace|write` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" post-tool-comment-check` |  |
| PostToolUse | `Write|StrReplace|search_replace|write|apply_patch|edit|multi_edit` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" comment-checker post-tool-use` | (OmO) Checking Comments |
| PostToolUse | `Write|StrReplace|search_replace|write|apply_patch|edit|multi_edit` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" lsp post-tool-use` | (OmO) Checking LSP Diagnostics |
| PostToolUse | `Write|StrReplace|search_replace|write|apply_patch` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" rules post-tool-use` | (OmO) Matching Project Rules |
| PostToolUse | `create_thread|codex_app\.create_thread` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" teammode post-tool-use` | (OmO) Checking Thread Title Hygiene |
| PostToolUse | `codegraph[._].*|mcp__codegraph__.*` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" codegraph post-tool-use` | (OmO) Checking CodeGraph Init Guidance |
| PostToolUseFailure | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" post-tool-failure` |  |
| PermissionDenied | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" permission-denied` |  |
| Stop | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" stop` |  |
| Stop | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" start-work-continuation stop` | (OmO) Checking Start-Work Continuation |
| Stop | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" ulw-loop stop` | (lazygrok) Checking Ulw-Loop Resume |
| StopFailure | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" stop-failure` |  |
| Notification | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" notification` |  |
| SubagentStart | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" subagent-start` |  |
| SubagentStop | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" subagent-stop` |  |
| SubagentStop | `` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" start-work-continuation subagent-stop` | (OmO) Checking Start-Work Continuation |
| SubagentStop | `^lazygrok-executor$|^lazycodex-executor$` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" lazygrok-executor-verify subagent-stop` | (OmO) Verifying LazyCodex Executor Evide |
| PreCompact | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" pre-compact` |  |
| PostCompact | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" post-compact` |  |
| PostCompact | `manual|auto` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" rules post-compact` | (OmO) Resetting Project Rule Cache |
| PostCompact | `manual|auto` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" lsp post-compact` | (OmO) Resetting LSP Diagnostics Cache |
| PostCompact | `manual|auto` | `node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" git-bash post-compact` | (OmO) Resetting Git Bash MCP Reminder |
| SessionEnd | `` | `bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" session-end` |  |

### Conceptual hook parity

| Concept | LCX file | LG present? | Evidence |
|---|---|---|---|
| session-start rules | `session-start-loading-project-rules` | ✅ | needle=`rules session-start` |
| session-start telemetry | `session-start-recording-session-telemetry` | ✅ | needle=`telemetry session-start` |
| session-start bootstrap | `session-start-checking-bootstrap-provisioning` | ✅ | needle=`bootstrap session-start` |
| session-start codegraph | `session-start-checking-codegraph-bootstrap` | ✅ | needle=`codegraph session-start` |
| session-start auto-update | `session-start-checking-auto-update` | ❌ MISSING | needle=`auto-update` |
| UPS ultrawork | `user-prompt-submit-checking-ultrawork-trigger` | ✅ | needle=`ultrawork user-prompt-submit` |
| UPS ulw-loop steer | `user-prompt-submit-checking-ulw-loop-steering` | ✅ | needle=`ulw-loop user-prompt-submit` |
| UPS rules | `user-prompt-submit-loading-project-rules` | ✅ | needle=`rules user-prompt-submit` |
| PreTU git-bash | `pre-tool-use-recommending-git-bash-mcp` | ✅ | needle=`git-bash pre-tool-use` |
| PreTU goal budget | `pre-tool-use-enforcing-unlimited-goal-budget` | ✅ | needle=`ulw-loop pre-tool-use` |
| PreTU spawn guard | `pre-tool-use-guarding-ulw-loop-spawns` | ✅ | needle=`pre-tool-use-spawn` |
| PostTU comments | `post-tool-use-checking-comments` | ✅ | needle=`comment-checker post-tool-use` |
| PostTU lsp | `post-tool-use-checking-lsp-diagnostics` | ✅ | needle=`lsp post-tool-use` |
| PostTU rules | `post-tool-use-matching-project-rules` | ✅ | needle=`rules post-tool-use` |
| PostTU codegraph | `post-tool-use-checking-codegraph-init-guidance` | ✅ | needle=`codegraph post-tool-use` |
| PostTU thread title | `post-tool-use-checking-thread-title-hygiene` | ✅ | needle=`teammode post-tool-use` |
| PostCompact rules | `post-compact-resetting-project-rule-cache` | ✅ | needle=`rules post-compact` |
| PostCompact lsp | `post-compact-resetting-lsp-diagnostics-cache` | ✅ | needle=`lsp post-compact` |
| PostCompact git-bash | `post-compact-resetting-git-bash-mcp-reminder` | ✅ | needle=`git-bash post-compact` |
| Stop start-work | `stop-checking-start-work-continuation` | ✅ | needle=`start-work-continuation stop` |
| Stop ulw-loop | `stop-checking-ulw-loop-resume` | ✅ | needle=`ulw-loop stop` |
| SubagentStop start-work | `subagent-stop-checking-start-work-continuation` | ✅ | needle=`start-work-continuation subagent-stop` |
| SubagentStop executor-verify | `subagent-stop-verifying-lazycodex-executor-evidence` | ✅ | needle=`executor-verify` |
| LG skill-gate/session-start Go | `—` | ✅ LG-native | needle=`run-hook.sh" session-start` |
| LG user-prompt Go | `—` | ✅ LG-native | needle=`run-hook.sh" user-prompt` |
| LG pre-tool-use Go | `—` | ✅ LG-native | needle=`run-hook.sh" pre-tool-use` |
| LG stop Go | `—` | ✅ LG-native | needle=`run-hook.sh" stop` |
| LG post-tool-read hashline | `—` | ✅ LG-native | needle=`post-tool-read` |
| LG post-tool-todo | `—` | ✅ LG-native | needle=`post-tool-todo-write` |
| LG post-tool-lsp bash | `—` | ✅ LG-native | needle=`post-tool-lsp` |
| LG post-tool-comment bash | `—` | ✅ LG-native | needle=`post-tool-comment-check` |

## Hook component dist/source parity

| Component | LG ver | LCX ver | LG main | LCX main | same hash? | size Δ |
|---|---|---|---|---|---|---:|
| `bootstrap` | 4.19.1 | 4.19.2 | cli.js/145860 | cli.js/145851 | **NO** | -9 |
| `codegraph` | 4.19.1 | 4.19.2 | cli.js/149747 | cli.js/152429 | **NO** | +2682 |
| `comment-checker` | 4.12.1 | 4.19.2 | cli.js/19402 | cli.js/19402 | YES | +0 |
| `git-bash` | 4.12.1 | 4.19.2 | cli.js/5750 | cli.js/5750 | YES | +0 |
| `lazygrok-executor-verify` | 4.19.1 | 4.19.2 | cli.js/8333 | cli.js/8333 | YES | +0 |
| `lsp` | 4.19.1 | 4.19.2 | cli.js/209557 | cli.js/209557 | YES | +0 |
| `rules` | 4.19.1 | 4.19.2 | cli.js/154938 | cli.js/154938 | YES | +0 |
| `start-work-continuation` | 4.19.1 | 4.19.2 | cli.js/13992 | cli.js/13992 | YES | +0 |
| `teammode` | 4.19.1 | 4.19.2 | cli.js/4221 | cli.js/4221 | YES | +0 |
| `telemetry` | 4.19.1 | 4.19.2 | cli.js/204582 | cli.js/204582 | YES | +0 |
| `ultrawork` | 4.19.1 | 4.19.2 | cli.js/7546 | cli.js/7444 | **NO** | -102 |
| `ulw-loop` | 4.19.1 | 4.19.2 | cli.js/153435 | cli.js/153333 | **NO** | -102 |

**LCX-only components:** ['lcx']
**LG-extra hook dirs:** []

---

# Agents deep diff

- LG `agents/*.md`: ['atlas.md', 'explore.md', 'explorer.md', 'hephaestus.md', 'lazygrok-clone-fidelity-reviewer.md', 'lazygrok-code-reviewer.md', 'lazygrok-executor.md', 'lazygrok-gate-reviewer.md', 'lazygrok-librarian.md', 'lazygrok-metis.md', 'lazygrok-momus.md', 'lazygrok-plan.md', 'lazygrok-qa-executor.md', 'librarian.md', 'metis.md', 'momus.md', 'oracle.md', 'prometheus.md', 'sisyphus.md']
- LG `vendor/omo-agents/*.toml`: ['explorer.toml', 'lazycodex-clone-fidelity-reviewer.toml', 'lazycodex-code-reviewer.toml', 'lazycodex-executor.toml', 'lazycodex-gate-reviewer.toml', 'lazycodex-qa-executor.toml', 'librarian.toml', 'metis.toml', 'momus.toml', 'plan.toml']
- LG `vendor/lazygrok-agents/*.toml`: ['explorer.toml', 'lazygrok-clone-fidelity-reviewer.toml', 'lazygrok-code-reviewer.toml', 'lazygrok-executor.toml', 'lazygrok-gate-reviewer.toml', 'lazygrok-qa-executor.toml', 'librarian.toml', 'metis.toml', 'momus.toml', 'plan.toml']
- LG ultrawork agents toml: ['explorer.toml', 'lazycodex-clone-fidelity-reviewer.toml', 'lazycodex-code-reviewer.toml', 'lazycodex-executor.toml', 'lazycodex-gate-reviewer.toml', 'lazycodex-qa-executor.toml', 'lazycodex-worker-high.toml', 'lazycodex-worker-low.toml', 'lazycodex-worker-medium.toml', 'librarian.toml', 'metis.toml', 'momus.toml', 'plan.toml']
- LCX ultrawork agents toml: ['explorer.toml', 'lazycodex-clone-fidelity-reviewer.toml', 'lazycodex-code-reviewer.toml', 'lazycodex-gate-reviewer.toml', 'lazycodex-qa-executor.toml', 'lazycodex-worker-high.toml', 'lazycodex-worker-low.toml', 'lazycodex-worker-medium.toml', 'librarian.toml', 'metis.toml', 'momus.toml', 'plan.toml']

### Role-level agent matrix

| Role (normalized) | LG md | LG toml | LCX toml | content same? | notes |
|---|---|---|---|---|---|
| `atlas` | ✅ | — | — | — | Grok-native md agent |
| `clone-fidelity-reviewer` | ✅ | ✅ | ✅ | **NO** | model gpt-5.5→gpt-5.6-terra; size 2122→2128 |
| `code-reviewer` | ✅ | ✅ | ✅ | **NO** | model gpt-5.5→gpt-5.6-terra; size 2446→2788 |
| `executor` | ✅ | ✅ | — | — | Grok-native md agent |
| `explore` | ✅ | — | — | — | Grok-native md agent |
| `explorer` | ✅ | ✅ | ✅ | **NO** | model gpt-5.4-mini→gpt-5.6-luna; size 3883→3104 |
| `gate-reviewer` | ✅ | ✅ | ✅ | **NO** | model gpt-5.5→gpt-5.6-sol; size 2440→3289 |
| `hephaestus` | ✅ | — | — | — | Grok-native md agent |
| `librarian` | ✅ | ✅ | ✅ | **NO** | model gpt-5.4-mini→gpt-5.6-luna; size 7362→6460 |
| `metis` | ✅ | ✅ | ✅ | **NO** | model gpt-5.5→gpt-5.6-sol; size 3407→2774 |
| `momus` | ✅ | ✅ | ✅ | **NO** | model gpt-5.5→gpt-5.6-terra; size 4185→3140 |
| `oracle` | ✅ | — | — | — | Grok-native md agent |
| `plan` | ✅ | ✅ | ✅ | **NO** | model gpt-5.5→gpt-5.6-sol; size 8955→8761 |
| `prometheus` | ✅ | — | — | — | Grok-native md agent |
| `qa-executor` | ✅ | ✅ | ✅ | **NO** | model gpt-5.5→gpt-5.6-luna; size 1515→1897 |
| `sisyphus` | ✅ | — | — | — | Grok-native md agent |
| `worker-high` | — | ✅ | ✅ | YES | — |
| `worker-low` | — | ✅ | ✅ | YES | — |
| `worker-medium` | — | ✅ | ✅ | YES | — |

### Agent TOML content diffs (paired)

#### `clone-fidelity-reviewer` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/lazygrok-clone-fidelity-reviewer.toml` (2122B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-clone-fidelity-reviewer.toml` (2128B)
- **name:**
  - LG: `lazygrok-clone-fidelity-reviewer`
  - LCX: `lazycodex-clone-fidelity-reviewer`
- **model:**
  - LG: `gpt-5.5`
  - LCX: `gpt-5.6-terra`
- **model_reasoning_effort:**
  - LG: `xhigh`
  - LCX: `high`

#### `code-reviewer` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/lazygrok-code-reviewer.toml` (2446B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-code-reviewer.toml` (2788B)
- **name:**
  - LG: `lazygrok-code-reviewer`
  - LCX: `lazycodex-code-reviewer`
- **model:**
  - LG: `gpt-5.5`
  - LCX: `gpt-5.6-terra`
- **model_reasoning_effort:**
  - LG: `xhigh`
  - LCX: `medium`

#### `explorer` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/explorer.toml` (3883B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/explorer.toml` (3104B)
- **model:**
  - LG: `gpt-5.4-mini`
  - LCX: `gpt-5.6-luna`

#### `gate-reviewer` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/lazygrok-gate-reviewer.toml` (2440B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-gate-reviewer.toml` (3289B)
- **name:**
  - LG: `lazygrok-gate-reviewer`
  - LCX: `lazycodex-gate-reviewer`
- **model:**
  - LG: `gpt-5.5`
  - LCX: `gpt-5.6-sol`
- **model_reasoning_effort:**
  - LG: `xhigh`
  - LCX: `low`

#### `librarian` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/librarian.toml` (7362B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/librarian.toml` (6460B)
- **model:**
  - LG: `gpt-5.4-mini`
  - LCX: `gpt-5.6-luna`

#### `metis` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/metis.toml` (3407B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/metis.toml` (2774B)
- **model:**
  - LG: `gpt-5.5`
  - LCX: `gpt-5.6-sol`

#### `momus` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/momus.toml` (4185B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/momus.toml` (3140B)
- **description:**
  - LG: `Plan reviewer. Verifies a work plan is executable: references exist, tasks are startable, QA scenarios are concrete. Issues OKAY, ITERATE, or REJECT. Read-only.`
  - LCX: `Deep plan reviewer. Verifies a work plan is executable: references exist, tasks are startable, QA scenarios are concrete. Runs at High and may take a long time; callers must wait for its terminal resu`
- **model:**
  - LG: `gpt-5.5`
  - LCX: `gpt-5.6-terra`
- **model_reasoning_effort:**
  - LG: `xhigh`
  - LCX: `high`

#### `plan` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/plan.toml` (8955B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/plan.toml` (8761B)
- **description:**
  - LG: `Strategic planning consultant. Produces a single executable work plan from a vague or large request. Planner only - never implements. Writes the plan to .omo/plans/<slug>.md.`
  - LCX: `Strategic planning consultant for work with unresolved design uncertainty after discovery. Produces one executable plan; never implements. Writes the plan to .omo/plans/<slug>.md.`
- **model:**
  - LG: `gpt-5.5`
  - LCX: `gpt-5.6-sol`
- **model_reasoning_effort:**
  - LG: `xhigh`
  - LCX: `high`

#### `qa-executor` DIFF
- LG: `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-agents/lazygrok-qa-executor.toml` (1515B)
- LCX: `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/agents/lazycodex-qa-executor.toml` (1897B)
- **name:**
  - LG: `lazygrok-qa-executor`
  - LCX: `lazycodex-qa-executor`
- **model:**
  - LG: `gpt-5.5`
  - LCX: `gpt-5.6-luna`
- **model_reasoning_effort:**
  - LG: `medium`
  - LCX: `high`

- `worker-high`: **identical**
- `worker-low`: **identical**
- `worker-medium`: **identical**
### LazyGrok MD agents (Grok spawn_subagent surface)

- `atlas.md`:  | tools: spawn_subagent | 1853 chars
- `explore.md`:  | tools: read_file | 1226 chars
- `explorer.md`: # Goal | tools: read_file | 3545 chars
- `hephaestus.md`:  | tools: spawn_subagent, read_file, hashline | 1587 chars
- `lazygrok-clone-fidelity-reviewer.md`:  | tools: read_file | 2244 chars
- `lazygrok-code-reviewer.md`:  | tools: read_file | 2459 chars
- `lazygrok-executor.md`:  | tools: read_file | 1450 chars
- `lazygrok-gate-reviewer.md`:  | tools: read_file | 2523 chars
- `lazygrok-librarian.md`: # THE LIBRARIAN | tools: read_file | 7536 chars
- `lazygrok-metis.md`: # Goal | tools: read_file | 3404 chars
- `lazygrok-momus.md`: # Goal | tools: read_file | 4190 chars
- `lazygrok-plan.md`: # Identity constraint (NON-NEGOTIABLE) | tools: read_file | 8505 chars
- `lazygrok-qa-executor.md`:  | tools: read_file | 1569 chars
- `librarian.md`:  | tools: read_file | 1507 chars
- `metis.md`:  | tools: read_file | 1404 chars
- `momus.md`:  | tools: read_file | 1384 chars
- `oracle.md`:  | tools: read_file | 1390 chars
- `prometheus.md`:  | tools: read_file | 1703 chars
- `sisyphus.md`:  | tools: spawn_subagent | 2263 chars

---

# Workflows deep diff (OmO / LazyCodex)

LazyCodex does **not** ship Grok Rhai workflows. Its 'workflows' are skill+hook+CLI orchestration loops.

## Workflow inventory & parity

| Workflow | LCX surfaces | LG surfaces | Status | Grok notes |
|---|---|---|---|---|
| **ultrawork mode** | ultrawork, ultrawork | ultrawork, ultrawork | ✅ both | create_goal often missing; LG skill uses # Goal + ulw-evidence CLI fallback |
| **ulw-loop** | ulw-loop, ulw-loop | ulw-loop, ulw-loop, ulw-evidence | ✅ both | Ledger under .lazygrok/ulw-loop; host goals optional |
| **ulw-plan** | ulw-plan | ulw-plan, ulw-plan, prometheus-plan | ✅ both | Also /plan + prometheus agent |
| **ulw-research** | ulw-research | ultraresearch | ✅ both | Renamed ultraresearch on LG; content stale |
| **start-work / boulder** | start-work, start-work-continuation | start-work, start-work-execution, start-work-continuation, start-work.md | ✅ both | State .lazygrok/ boulder; Go + node stop chain |
| **ralph-loop** | — | ralph-loop, ralph-loop.md | LG-only | LG-native Stop continuation |
| **teammode** | teammode, teammode | teammode, teammode | ✅ both | multi_agent_v2 N/A; thread-title hook mostly no-op on Grok |
| **executor-verify** | lazycodex-executor-verify | lazygrok-executor-verify | ✅ both | Matcher includes lazygrok-executor |
| **bootstrap / auto-update** | bootstrap | bootstrap | ✅ both | Auto-update for npm install not applicable; bootstrap may still run |
| **rules injection** | rules | rules, rules | ✅ both | Plus LG rules/*.md always-on |
| **lsp diagnostics** | lsp, lsp-daemon | lsp, lsp-daemon, lsp | ✅ both | MCP names lazygrok-lsp* |
| **codegraph** | codegraph | codegraph | ✅ both | MCP lazygrok-codegraph |
| **comment-checker** | comment-checker | comment-checker | ✅ both | Also bash post-tool-comment-check |
| **git-bash MCP recommend** | git-bash, git-bash-mcp | git-bash, git-bash-mcp | ✅ both | MCP handshake currently flaky in session |
| **lcx doctor/report/contribute** | lcx, lcx-doctor | lcx-doctor, lcx-report-bug, lcx-contribute-bug-fix | ✅ both | Skills present; component folder not named lcx |

## ULW workflow document diffs (full-workflow.md / directive / skill-pointer)

### ulw-loop full-workflow
- LG `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/ulw-loop/references/full-workflow.md` 14167 chars / 14197B hash=8d8b948a3fe6008b
- LCX `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-loop/references/full-workflow.md` 32637 chars / 32739B hash=0d094ce88f4fb2f9
- identical: **NO**
- `create_goal`: LG=4 LCX=3
- `update_goal`: LG=5 LCX=2
- `get_goal`: LG=0 LCX=6
- `# Goal`: LG=7 LCX=2
- `todo_write`: LG=2 LCX=0
- `update_plan`: LG=0 LCX=2
- `spawn_subagent`: LG=7 LCX=0
- `spawn_agent`: LG=1 LCX=4
- `omo ulw-loop`: LG=3 LCX=19
- `lazygrok`: LG=40 LCX=0
- `ulw-evidence`: LG=2 LCX=0
- `Manual-QA`: LG=5 LCX=7
- `.omo/`: LG=3 LCX=12
- `.lazygrok/`: LG=11 LCX=0
- headings only LG: ['# Or: omo ulw-loop … when available', '### 2. Refine success criteria + QA and parallelism plan per goal']
- headings only LCX: ['### 2. Refine success criteria + a Prometheus-grade QA and parallelism plan per goal', '## Dynamic Steering']

### ulw-plan full-workflow
- LG `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/ulw-plan/references/full-workflow.md` 11423 chars / 11423B hash=bc9911fd762bac96
- LCX `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-plan/references/full-workflow.md` 25165 chars / 25177B hash=b4499c364a41b2e9
- identical: **NO**
- `spawn_agent`: LG=1 LCX=2
- `.omo/`: LG=5 LCX=16
- headings only LG: ['### High-accuracy review (dual Momus)']
- headings only LCX: ['## Plan artifact producer contract', '### Handoff explanation (the mandatory shape of every plan summary)', '### High-accuracy review (dual review)']

### ultrawork directive.md
- LG `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-hooks/ultrawork/directive.md` 19631 chars / 19747B hash=9e4f7922c882b59a
- LCX `/tmp/lcx-cmp/package/packages/omo-codex/plugin/components/ultrawork/directive.md` 26376 chars / 26518B hash=e00b53308651435b
- identical: **NO**
- `create_goal`: LG=1 LCX=2
- `update_goal`: LG=2 LCX=0
- `# Goal`: LG=3 LCX=2
- `todo_write`: LG=5 LCX=0
- `update_plan`: LG=0 LCX=6
- `spawn_subagent`: LG=3 LCX=0
- `spawn_agent`: LG=0 LCX=5
- `lazygrok`: LG=1 LCX=0
- `ulw-evidence`: LG=1 LCX=0
- `.omo/`: LG=0 LCX=1
- `.lazygrok/`: LG=1 LCX=0
- headings only LG: ['## 0. Survey the skills, then size the work', '## 1. Register the binding goal (Grok-native channels)', '## 3. Register obsessive todos via `todo_write`', '# Finding things (lead with these, parallel-flood the first wave)']
- headings only LCX: ['## 0. Survey the skills, gather context, then size the work', '## 1. Create the goal with binding success criteria', '## 3. Register obsessive todos via `update_plan`', '# Finding things (lead with these, code-mode the first wave)', '# Waiting discipline (a poll costs a full model round)']

### ultrawork SKILL.md
- LG `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/ultrawork/SKILL.md` 25970 chars / 26114B hash=01ecf64fd0bf9add
- LCX `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ultrawork/SKILL.md` 26726 chars / 26868B hash=b34d334c37ba4ebe
- identical: **NO**
- `create_goal`: LG=1 LCX=2
- `update_goal`: LG=2 LCX=0
- `# Goal`: LG=3 LCX=2
- `todo_write`: LG=6 LCX=0
- `update_plan`: LG=0 LCX=6
- `spawn_subagent`: LG=2 LCX=0
- `spawn_agent`: LG=0 LCX=5
- `lazygrok`: LG=8 LCX=0
- `ulw-evidence`: LG=1 LCX=0
- `.omo/`: LG=0 LCX=1
- `.lazygrok/`: LG=1 LCX=0
- headings only LG: ['## 1. Register the binding goal (Grok-native channels)', '## 3. Register obsessive todos via `todo_write`', '# Subagent reliability', '# Subagent routing']
- headings only LCX: ['## 1. Create the goal with binding success criteria', '## 3. Register obsessive todos via `update_plan`', '# Codex subagent reliability', '# TOML-backed subagent routing compatibility']

### ulw-loop SKILL.md (top)
- LG `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/skills/ulw-loop/SKILL.md` 1436 chars / 1444B hash=655d2e52e2d6a347
- LCX `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-loop/SKILL.md` 5375 chars / 5389B hash=d5701f4826eae8ed
- identical: **NO**
- `create_goal`: LG=0 LCX=1
- `update_plan`: LG=0 LCX=1
- `spawn_subagent`: LG=1 LCX=0
- `spawn_agent`: LG=0 LCX=3
- `omo ulw-loop`: LG=0 LCX=3
- `lazygrok`: LG=5 LCX=0
- `Manual-QA`: LG=0 LCX=1
- `.omo/`: LG=0 LCX=1
- `.lazygrok/`: LG=1 LCX=0
- headings only LG: ['# ULTRAWORK Loop', '## Start', '## Flow', '## If verification fails', '## Cancel', '## State']
- headings only LCX: ['# ulw-loop', '## Required First Steps', '## Non-Negotiables', '## Codex Tool Mapping']

### ulw-loop vendor SKILL
- LG `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/ulw-loop/SKILL.md` 4273 chars / 4273B hash=250003b46cae5109
- LCX `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-loop/SKILL.md` 5375 chars / 5389B hash=d5701f4826eae8ed
- identical: **NO**
- `create_goal`: LG=0 LCX=1
- `update_plan`: LG=0 LCX=1
- `spawn_subagent`: LG=5 LCX=0
- `spawn_agent`: LG=0 LCX=3
- `omo ulw-loop`: LG=2 LCX=3
- `.omo/`: LG=2 LCX=1

### start-work SKILL
- LG `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/start-work/SKILL.md` 17102 chars / 17138B hash=a29c0f534dbbb634
- LCX `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/start-work/SKILL.md` 22877 chars / 22917B hash=adcdbe2eb45981b1
- identical: **NO**
- `create_goal`: LG=0 LCX=1
- `# Goal`: LG=0 LCX=1
- `spawn_subagent`: LG=9 LCX=0
- `spawn_agent`: LG=0 LCX=11
- `lazygrok`: LG=21 LCX=0
- `.omo/`: LG=0 LCX=15
- `.lazygrok/`: LG=13 LCX=0
- headings only LG: ['## Grok Harness Tool Compatibility', '## Grok Subagent Reliability']
- headings only LCX: ['## Codex Harness Tool Compatibility', '### Delegation by difficulty (Codex tier workers)', '## Codex Subagent Reliability', '## Goal and todo discipline (MANDATORY)']

### ulw-research / ultraresearch
- LG `/home/thewind/.grok/installed-plugins/lazygrok-85b8f856/vendor/lazygrok-skills/ultraresearch/SKILL.md` 24839 chars / 25029B hash=0e8d7b51e10aae61
- LCX `/tmp/lcx-cmp/package/packages/omo-codex/plugin/skills/ulw-research/SKILL.md` 29182 chars / 29391B hash=f2c4a590c161a2dd
- identical: **NO**
- `spawn_subagent`: LG=15 LCX=0
- `spawn_agent`: LG=0 LCX=9
- `lazygrok`: LG=12 LCX=0
- `.omo/`: LG=0 LCX=1
- `.lazygrok/`: LG=1 LCX=0
- headings only LG: ['## Grok Harness Tool Compatibility', '# ULTRARESEARCH — Maximum-Saturation Research', '## Run the swarm with parallel spawn_subagent', '# Ultraresearch Synthesis: <query>']
- headings only LCX: ['## Codex Harness Tool Compatibility', '# ULW-RESEARCH — Maximum-Saturation Research', '## Run the swarm as a cooperating team', '# ULW-Research Synthesis: <query>']

## Ultrawork skill-pointer source (hook injection)
### LCX skill-pointer.ts (2208B)
  L7: ULTRAWORK MODE IS ACTIVE FOR THIS TASK.
  L12: \`ULTRAWORK MODE ENABLED!\`
  L14: 2. Call \`create_goal\` NOW with \`objective\` set to the user's request.
  L15: Send \`objective\` only: no \`status\`, no budget fields. If the
  L16: \`create_goal\` tool is unavailable, open your reply with a binding
  L17: \`# Goal\` block instead. Never skip this step.
  L36: const ULTRAWORK_SKILL_FILE_URL = new URL("../../../skills/ultrawork/SKILL.md", import.meta.url);

### LCX dist cli.js excerpt (7444B)
  L19: ULTRAWORK MODE IS ACTIVE FOR THIS TASK.
  L24: \`ULTRAWORK MODE ENABLED!\`
  L26: 2. Call \`create_goal\` NOW with \`objective\` set to the user's request.
  L27: Send \`objective\` only: no \`status\`, no budget fields. If the
  L28: \`create_goal\` tool is unavailable, open your reply with a binding
  L29: \`# Goal\` block instead. Never skip this step.
  L47: var ULTRAWORK_SKILL_FILE_URL = new URL("../../../skills/ultrawork/SKILL.md", import.meta.url);

### LG dist cli.js (7546B)
  L19: ULTRAWORK MODE IS ACTIVE FOR THIS TASK.
  L24: \`ULTRAWORK MODE ENABLED!\`
  L27: If host tool \`update_goal\` or \`create_goal\` is in your tool list,
  L28: call it with \`objective\` only (no status/budget). Otherwise open with
  L29: a binding \`# Goal\` block — that is the normal Grok path, not a defect.
  L48: var ULTRAWORK_SKILL_FILE_URL = new URL("../../../skills/ultrawork/SKILL.md", import.meta.url);

## LazyGrok-native Go hook pipeline (no LCX equivalent)
internal/cmd: ['comment_check_hook.go', 'doctor.go', 'lifecycle_hooks.go', 'post_tool_lsp.go', 'post_tool_read.go', 'post_tool_todo.go', 'pre_tool_use.go', 'resume_continuation_cmd.go', 'root.go', 'session_end.go', 'session_start.go', 'start_loop_cmd.go', 'stop.go', 'stop_continuation_cmd.go', 'user_prompt.go']
- `skillgate/`: ['prompt.go', 'prompt_test.go', 'catalog.go', 'gate.go']
- `ralph/`: ['loop.go', 'user_prompt.go']
- `hashline/`: ['hash.go', 'hash_test.go', 'validate.go', 'cache.go', 'context.go', 'env.go']
- `intentgate/`: ['detect.go']
- `prometheus/`: ['plan_test.go', 'user_prompt.go', 'plan.go']
- `boulder/`: ['state.go', 'todos.go', 'prompt.go', 'plan.go', 'stop.go', 'stop_test.go', 'continuation.go']
- `ulwbridge/`: ['ulwbridge.go']
- `spawnguard/`: ['spawnguard.go']
- `stoppending/`: ['planmd.go']

## Commands / slash entrypoints
LG commands: ['handoff.md', 'plan.md', 'ralph-loop.md', 'resume-continuation.md', 'start-work.md', 'stop-continuation.md', 'ultrawork.md', 'ulw-loop.md']
LCX: no commands/ dir — skills are entrypoints; CLI: `omo ulw-loop`, install agents

## LCX CLI surfaces vs LG
- exists /tmp/lcx-cmp/package/dist/cli/codex-ulw-loop.d.ts: True
- exists /tmp/lcx-cmp/package/dist/cli/boulder: True
- ulw-loop cli.js same: False (LG 153435 vs LCX 153333)
  - LG mentions `create-goals`: 7
  - LG mentions `checkpoint`: 37
  - LG mentions `steer`: 56
  - LG mentions `status`: 172
  - LG mentions `record-evidence`: 5
  - LG mentions `resume`: 11
  - LG mentions `with-ultrawork`: 2
  - LCX mentions `create-goals`: 6
  - LCX mentions `checkpoint`: 37
  - LCX mentions `steer`: 56
  - LCX mentions `status`: 172
  - LCX mentions `record-evidence`: 5
  - LCX mentions `resume`: 11
  - LCX mentions `with-ultrawork`: 2