# LazyCodex 4.19.2 → 4.19.3 LazyGrok delta receipt

**Date:** 2026-07-28

**LazyGrok version:** unchanged; release-please owns the version bump

**Upstream base:** `v4.19.2` (`8ec16c5129df7b9778959e8367657d0e79c2c3bb`)

**Upstream target:** `v4.19.3` (`895b70cb8cc66ebb5b0390571bc65a858e4e6303`)
**Upstream commit:** `895b70c chore: sync Codex marketplace v4.19.3`

## Applied

| Area | LazyGrok port |
| --- | --- |
| ULW loop | Adapted the upstream team-mode decision to Grok’s real transport: parallel one-shot subagents for independent units; sequential parent ownership for overlapping units |
| CodeGraph | Synced the shipped 4.19.3 CLI/server runtime, including ancestor database discovery, per-project startup locks, stale-lock recovery, outcome logging, and failure cooldowns; the Grok bundle neutralizes the Codex-only startup migration while retaining compatible config reads |
| CodeGraph dependency | Updated the bundled component pin from `@colbymchenry/codegraph` 1.4.1 to 1.5.0 |
| Frontend | Added `interaction-skill.md`, routing/index entries, and beui.dev attribution |
| Metadata | Updated component package versions and LazyCodex provenance references to 4.19.3 |
| ULW activation | Kept native Grok skill selection + full `read_file` as the real keyword path, added deterministic `/ulw`, corrected `user-invocable` metadata, and made the Grok prompt the regeneration source |

## Intentionally not applied

| Upstream change | Reason |
| --- | --- |
| `shared/src/config-loader.ts` and `config-migration.ts` | Codex-specific `~/.omo/omo.jsonc` migration and `omo-config-core` startup contract; LazyGrok owns separate Grok configuration |
| Root/component hook status-message version changes | Version-only Codex UI text; LazyGrok owns `hooks/hooks.json` and its Grok lifecycle bridge |
| Generated dists outside CodeGraph | Their source behavior did not change; copying release-wide bundle churn would overwrite Grok adapters without adding behavior |
| LazyGrok plugin version | Repository policy reserves version changes for release-please |
| `git_bash` MCP registration | Unsupported on Grok/Linux; vendored upstream compatibility components remain, but LazyGrok does not register or promise this server |

## Verification

The port adds `hooks/test-codegraph.sh` for nested-project ancestor coverage. Full verification commands:

```bash
GROK_PLUGIN_ROOT="$PWD" bash hooks/test-codegraph.sh
GROK_PLUGIN_ROOT="$PWD" bash hooks/test-ulw-loop.sh
task default
grok plugin validate .
```

Live Grok checks also cover both a plain `ulw` prompt and the deterministic `/ulw` command, including the exact `ULTRAWORK MODE ENABLED!` first line and full Ultrawork skill read.

Upstream source tests could not run from the published cache or the SHA-pinned repository because both layouts omit the `utils/src/` sibling imported by the CodeGraph tests. LazyGrok therefore verifies the shipped dist through its own Grok adapter and full plugin surface.
