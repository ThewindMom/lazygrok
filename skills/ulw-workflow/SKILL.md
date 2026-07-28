---
name: ulw-workflow
description: >
  AGENT-INTERNAL reference for LazyGrok ultrawork multi-agent panels on Grok.
  Users never invoke this — they only say ulw/ultrawork. Documents silent
  workflow-tool calls (ulw-discover / ulw-review) used under the ultrawork skill.
metadata:
  short-description: Internal ULW panel protocol (not user-facing)
user-invocable: false
---

# ulw-workflow (agent-internal)

**Users only say `ulw`.** This file is for the agent when executing ultrawork.
Do not tell the user to run `/workflow`, name panels, or “enable hybrid mode.”

## UX rule

| User does | Agent does |
|-----------|------------|
| Omits `ulw` | Normal chat — no ULW panels |
| Says `ulw` / `ultrawork` | Full ultrawork; auto discovery/review via Grok `workflow` when available |

## Ownership (three phases)

| Phase | Owner | Responsibilities |
|-------|-------|------------------|
| **Discover** | Internal **`ulw-discover`** panel (or explore spawn fallback) | Parallel explore (+ librarian if needed) → findings for notepad |
| **Implement** | **Parent ULW** + worker `spawn_subagent` | `# Goal` + ledger, notepad, RED→GREEN, SURFACE QA, cleanup, commits, done claim — **no implement workflow** |
| **Review** | Internal **`ulw-review`** panel after evidence (or code-reviewer spawn) | Dimension review + adversarial verify → blockers vs notes |

## Silent tool calls

### Discovery (before product edits when multi-file / unfamiliar)

```
workflow({
  name: "ulw-discover",
  args: { brief: "<objective>", scope: "<optional>", need_external: false },
  agent_budget: 16
})
```

Fallback: `script_path` → `${GROK_PLUGIN_ROOT}/docs/examples/ulw-discover.rhai`  
Then: `spawn_subagent` explore (+ librarian).

Barrier → append to notepad `## Findings` → still RED before GREEN.

### Review (HEAVY / rigorous, after evidence)

Parent prepares `diff_path` first, then:

```
workflow({
  name: "ulw-review",
  args: {
    goal, criteria, diff_path,
    stat_path?, changed_files?, evidence_paths?, notepad_path?,
    plugin_root: PLUGIN_ROOT
  },
  agent_budget: 24
})
```

Fallback: `docs/examples/ulw-review.rhai` or `lazygrok-code-reviewer` spawn.

## Anti-patterns

- Asking the user to run `/workflow` or open `/workflows`
- Naming “hybrid mode” / “ulw-workflow mode” in user-visible text
- Treating panel complete as product shipped
- Running review before RED→GREEN evidence

## Related

- Binding UX: skill `ultrawork`
- Ledger: `ulw-loop` / `ulw-evidence`
