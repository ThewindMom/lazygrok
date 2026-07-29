# Prompt Variants

LazyGrok keeps prompt variants for maintainers to select during a
manual build-time sync. Runtime hooks do not inspect the active model and do not
automatically switch prompt files.

## Available variants

### Default (all models)
- Standard orchestration instructions
- Balanced delegation and direct execution
- Works with any model

### Grok-optimized
- Leverages Grok's fast reasoning
- More direct delegation, less explanation
- Optimized for Grok's context window

### GPT-optimized
- Leverages GPT's structured output
- More explicit step-by-step planning
- Optimized for GPT's instruction following

### Codex-optimized
- Uses Codex-oriented tool and review terminology
- Emphasizes evidence-bound implementation
- Available as `codex.md`

### Gemini-optimized
- Leverages Gemini's multimodal capabilities
- More visual verification steps
- Optimized for Gemini's speed

### GLM-optimized
- Uses concise delegation and verification language
- Available as `glm.md`

### Planner
- Planning-only orchestration variant
- Available as `planner.md`

## Manual build-time selection

Choose a variant while preparing a build:

```bash
bash scripts/sync-prompts.sh grok
```

The command copies the selected `prompts/ultrawork/<variant>.md` into the
vendored directive. If the requested file is absent, the script uses
`default.md`. LazyGrok releases select `grok` explicitly.

This selection is independent of agent model assignment. Agents use
`model: inherit` by default; users may configure agent models in Grok without
changing the shipped prompt variant.

The variant names describe tuning targets, not active-model automation.
