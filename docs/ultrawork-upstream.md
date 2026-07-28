# Ultrawork upstream

| Field | Value |
| --- | --- |
| Upstream | https://github.com/code-yeongyu/lazycodex |
| Path | `plugins/omo/skills/ultrawork/SKILL.md` + `plugins/omo/components/ultrawork/` |
| Version | **4.19.3** (tag `v4.19.3`, commit `895b70cb8cc66ebb5b0390571bc65a858e4e6303`) |
| Port | Mechanical Grok renames + §1 ledger (`create-goals`) as `create_goal` equivalent |
| Activation | Grok native skill matching → full `skills/ultrawork/SKILL.md`; `/ulw` and `/ultrawork` are deterministic command entries |
| Hook compatibility | `vendor/lazygrok-hooks/ultrawork/src/skill-pointer.ts` (diagnostic/bootstrap compatibility; passive stdout is not Grok model context) |
| Rebuild | `scripts/rebuild-ulw-components.sh` |

Do not reinvent ultrawork process text. Re-sync from upstream on LazyCodex releases, then re-apply harness renames. `prompts/ultrawork/grok.md` is the canonical Grok hook directive; `scripts/sync-prompts.sh grok` regenerates the vendored copy without losing Grok workflow adapters.
