# Agent Catalog

lazygrok provides 9 specialist agents, all discovered as real Grok plugin agents.

## Coordinators (can spawn subagents)

### Sisyphus
- **Role**: Primary outcome-focused coordinator
- **Capabilities**: Repository reading, search, test execution, subagent spawning, planning/state tools
- **Use**: Complex tasks requiring parallel delegation

### Atlas
- **Role**: Plan execution coordinator
- **Capabilities**: Coordinator-level subagent spawning, state tools, test execution
- **Use**: Executing approved plans with parallel specialist work

## Leaf agents (cannot spawn subagents)

### Hephaestus
- **Role**: Autonomous implementation specialist
- **Capabilities**: Read/search, hashline MCP, shell/build/test tools
- **Use**: Bounded code changes with tests

### Prometheus
- **Role**: Strategic read-only planner
- **Capabilities**: Read/search/research, plan-state tool
- **Use**: Creating decision-complete plans under `.lazygrok/plans/`

### Metis
- **Role**: Plan gap analyst
- **Capabilities**: Read/search, plan reading
- **Use**: Finding missing requirements and hidden assumptions

### Momus
- **Role**: Strict reviewer
- **Capabilities**: Read/search, diff inspection, test-output inspection
- **Use**: Verifying implementations with pass/blockers

### Oracle
- **Role**: Architecture, debugging, and judgment
- **Capabilities**: Read/search, diagnostics
- **Use**: High-impact decisions with competing explanations

### Librarian
- **Role**: External research
- **Capabilities**: Read/search, approved research tools
- **Use**: Finding authoritative documentation and versions

### Explore
- **Role**: Fast local codebase search
- **Capabilities**: Read-only local search
- **Use**: Finding symbols, callers, and ownership paths

## Model behavior

All agents default to `model: inherit`, meaning they use the parent session's model. To assign specific models, configure them in your Grok configuration. Do not hard-code model names that may not exist in the user's catalog.

## Subagent depth

Grok supports only one level of subagent depth. Sisyphus and Atlas spawn leaf specialists directly. Leaf agents never receive `spawn_subagent` capability.
