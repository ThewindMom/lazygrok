# Prompt Variants

lazygrok supports prompt variants for different model families. Each variant
adjusts the agent's communication style and delegation patterns to match the
model's strengths.

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

### Claude-optimized
- Leverages Claude's long context
- More detailed analysis in delegation
- Optimized for Claude's reasoning depth

### Gemini-optimized
- Leverages Gemini's multimodal capabilities
- More visual verification steps
- Optimized for Gemini's speed

## Configuration

Set the model family in your config:

```jsonc
{
  // Override per-agent models in Grok config
  // Agents default to "inherit" (use parent session model)
}
```

Agents use `model: inherit` by default. To assign specific models, configure
them in your Grok configuration. Do not hard-code model names that may not
exist in the user's catalog.

## How variants work

Prompt variants are stored in `prompts/` and selected based on the active
model. The variant system is advisory — agents will work with any model,
but the prompts are tuned for the listed families.
