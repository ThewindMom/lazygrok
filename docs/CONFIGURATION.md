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
  "nativeMutationStrict": false,

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
  "lspStopEnforcement": true,

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
| `LAZYGROK_LSP_ENFORCE` | Enable LSP stop enforcement (`0`/`false` disables it) | `true` |
| `LAZYGROK_MAX_CONTINUATIONS` | Max continuation iterations | `25` |
| `LAZYGROK_COOLDOWN_SECONDS` | Continuation cooldown | `10` |
| `LAZYGROK_RALPH` | Compatibility-reserved; parsed and reported, while Grok hook registration controls the Ralph runtime | `true` |
| `LAZYGROK_ULTRAWORK` | Compatibility-reserved; parsed and reported, while Grok hook registration controls the Ultrawork runtime | `true` |
| `LAZYGROK_CONTINUATION` | Enable continuation | `true` |

## Unknown keys

Unknown configuration keys produce diagnostics rather than silently changing behavior. Check the doctor output or diagnostic logs for unknown key warnings.

## Invalid values

Invalid values fail validation with a precise message. Use `lazygrok-hook doctor` to check configuration validity.

## Grok Build host limits

The controls currently wired into runtime behavior are `hashlineMode`,
`nativeMutationStrict`, `intentGateEnabled`, `lspEnabled`,
`lspStopEnforcement`, `continuationEnabled`, `maxContinuations`,
`cooldownSeconds`, and `repeatedStateThreshold`. Environment overrides for
these controls take precedence over JSONC.

Some schema fields are retained for LazyCodex configuration compatibility but
cannot directly control the Grok Build host or do not yet have a Grok runtime
adapter:

- `worktreeIsolation` is informational. Grok Build does not expose a hook API
  that can move the active conversation into a newly created worktree.
  LazyGrok therefore instructs ULW to verify an existing detached worktree; the
  caller must start Grok in that worktree when isolation is required.
- `subagentConcurrency` is reserved. Runtime fan-out is bounded by
  `OMO_SPAWN_FANOUT_LIMIT`, because Grok Build owns subagent scheduling.
- `context.sectionBytes` and `context.maxBytes` are reserved for a future
  unified context compositor. Current hook surfaces enforce their own fixed,
  bounded payload limits.
- `disabledHooks`, `disabledAgents`, `disabledCommands`, `disabledSkills`,
  `ralphEnabled`, `ultraworkEnabled`, `todoEnforcement`,
  `boulderEnforcement`, `planEnforcement`, `skillGateEnabled`,
  `commentPolicy`, `projectRuleInjection`, `stateRetention`, `logLevel`, and
  `logPath` are compatibility-reserved. The active Grok plugin manifest and
  component-specific controls remain authoritative for those surfaces.

These fields are parsed and reported by the doctor, but changing them does not
currently alter runtime behavior.
