# Configuration Reference

lazygrok uses typed JSONC configuration with documented precedence.

## Precedence (highest first)

1. **Environment overrides** (`LAZYGROK_*` variables)
2. **Workspace config**: `.lazygrok/config.jsonc` in the workspace root
3. **User config**: `~/.grok/lazygrok/config.jsonc` (or `$GROK_HOME/lazygrok/config.jsonc`)
4. **Built-in defaults**

## File format

Configuration files use JSONC (JSON with comments and trailing commas):

```jsonc
{
  // Hashline enforcement mode
  "hashlineMode": "prefer",  // off | prefer | strict

  // Continuation
  "continuationEnabled": true,
  "maxContinuations": 25,
  "cooldownSeconds": 10,
  "repeatedStateThreshold": 3,

  // Loops
  "ralphEnabled": true,
  "ultraworkEnabled": true,

  // Enforcement
  "todoEnforcement": true,
  "boulderEnforcement": true,
  "planEnforcement": true,
  "skillGateEnabled": true,
  "intentGateEnabled": true,

  // LSP
  "lspEnabled": true,
  "lspStopEnforcement": false,

  // Policies
  "commentPolicy": "allow",  // allow | warn | deny
  "projectRuleInjection": true,

  // Context limits (bytes)
  "context": {
    "sectionBytes": 4096,
    "maxBytes": 32768
  },

  // Orchestration
  "subagentConcurrency": 4,
  "worktreeIsolation": false,

  // State and logging
  "stateRetention": "7d",
  "logLevel": "info",  // error | warn | info | debug
  "logPath": "",

  // Disabled components
  "disabledHooks": [],
  "disabledAgents": [],
  "disabledCommands": [],
  "disabledSkills": []
}
```

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LAZYGROK_HASHLINE` | Hashline mode (`off`, `prefer`, `strict`) | `prefer` |
| `LAZYGROK_INTENT_GATE` | Enable intent gate | `true` |
| `LAZYGROK_LSP_ENFORCE` | Enable LSP stop enforcement | `false` |
| `LAZYGROK_MAX_CONTINUATIONS` | Max continuation iterations | `25` |
| `LAZYGROK_COOLDOWN_SECONDS` | Continuation cooldown | `10` |
| `LAZYGROK_RALPH` | Enable Ralph loop | `true` |
| `LAZYGROK_ULTRAWORK` | Enable Ultrawork | `true` |
| `LAZYGROK_CONTINUATION` | Enable continuation | `true` |

## Unknown keys

Unknown configuration keys produce diagnostics rather than silently changing behavior. Check the doctor output or diagnostic logs for unknown key warnings.

## Invalid values

Invalid values fail validation with a precise message. Use `lazygrok-hook doctor` to check configuration validity.
