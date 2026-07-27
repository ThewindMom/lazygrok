# Ultrawork upstream

| Field | Value |
| --- | --- |
| Upstream | https://github.com/code-yeongyu/lazycodex |
| Path | `plugins/omo/skills/ultrawork/SKILL.md` + `plugins/omo/components/ultrawork/` |
| Version | **4.19.2** (tag `v4.19.2`) |
| Port | Mechanical Grok renames + §1 ledger (`create-goals`) as `create_goal` equivalent |
| Bootstrap | `vendor/lazygrok-hooks/ultrawork/src/skill-pointer.ts` (LCX 3-step shape + ledger) |
| Rebuild | `scripts/rebuild-ulw-components.sh` |

Do not reinvent ultrawork process text. Re-sync from upstream on LazyCodex releases, then re-apply harness renames.
