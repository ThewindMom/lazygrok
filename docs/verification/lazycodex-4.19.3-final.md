# LazyCodex 4.19.3 port verification

Captured on 2026-07-29 from:

- repository: `<plugin-root>`
- base HEAD: `5377dad5a0246bd26c03f0c75d3cb24dbb8a7192`
- upstream LazyCodex v4.19.3: `895b70cb8cc66ebb5b0390571bc65a858e4e6303`
- upstream OmO component source: `614cc5358dc393153fc39acae74dc5bd9fb9fffc`
- Grok Build source inspected: `98c3b2438aa922fbbe6178a5c0a4c48f85edc8ce`
- Node: `v25.7.0`
- Bun: `1.3.14`
- Go: `go1.26.5 linux/amd64`
- Grok: `0.2.114 (0c78503879) [stable]`

Component dependencies were restored from their existing lockfile-backed local
installations for the checks below. Component `node_modules` directories were
moved back out of the plugin afterward and are not part of the payload.

## Automated results

| Surface | Command | Exit | Observed output |
| --- | --- | ---: | --- |
| Executor receipts | `npm --prefix vendor/lazygrok-hooks/lazygrok-executor-verify test` | 0 | 2 files, 44 tests passed, including descriptor-walk state creation, regular-file identity replacement and receipt swap/hard-link denial, and the three-block/fourth-release contract even when the primary attempt state is hard linked |
| Executor types/lint | `npm --prefix vendor/lazygrok-hooks/lazygrok-executor-verify run typecheck` and `run lint` | 0 | TypeScript clean; Biome checked 10 files |
| Ultrawork package | `npm --prefix vendor/lazygrok-hooks/ultrawork run check` and `npm test` | 0 | lockfile-backed self-contained Grok directive sync, TypeScript, Biome, standard package build, and 4 native `node:test` cases passed without the absent upstream `prompts-core` workspace |
| Start-work | `npm --prefix vendor/lazygrok-hooks/start-work-continuation test` | 0 | 3 files, 50 tests passed, including session-owning state selection, strict root binding, transcript-less final-gate continuation, descriptor-anchored bounded transcript/plan reads, and symlink/hard-link/oversized input denial |
| Start-work types/lint | `npm --prefix vendor/lazygrok-hooks/start-work-continuation run typecheck` and `run lint` | 0 | TypeScript clean; Biome checked 13 files |
| ULW loop | `npm --prefix vendor/lazygrok-hooks/ulw-loop test` | 0 | 42 files, 468 tests passed, including exact session rejection, transcript-less Stop continuation, cross-process plan/ledger journaling, atomic fail-closed auto-resume and spawn budgets, real Grok `spawn_subagent`/`task` reservation, descriptor-walk state creation, renamed-bundle relocation recovery without shell interpolation, symlink/hard-link denial, and Grok Stop re-fire enforcement |
| ULW types/lint/build | `npm --prefix vendor/lazygrok-hooks/ulw-loop run check` | 0 | TypeScript clean; Biome checked 94 files; the canonical build produced one 193,782-byte bundled `dist/cli.js` and no competing modular output |
| Deployed Stop concurrency | ten simultaneous `dist/cli.js hook stop` processes against one exact session | 0 | exactly two continuations blocked, persisted count remained 2, and the stuck marker was created; corrupt or negative counters are denied unchanged |
| Go continuation concurrency | ten simultaneous packaged `lazygrok-hook stop` processes against one active continuation | 0 | exactly one continuation blocked, nine allowed, and the persisted iteration remained 1 |
| LSP tools | `npm --prefix vendor/lazygrok-hooks/lsp-tools-mcp test` | 0 | 25 files, 95 tests passed |
| LSP tools types/lint/build | corresponding `typecheck`, `lint`, and `build` scripts | 0 | TypeScript clean; Biome checked 58 files; five entry bundles built |
| LSP core | `cd vendor/lazygrok-hooks/lsp-core && bun test src/*.test.ts src/**/*.test.ts` | 0 | 23 files, 100 tests passed, including request-cwd confinement, cache/config isolation, safe child environments, cancellation, and deterministic parent-swap denial |
| MCP stdio core | `npm --prefix vendor/lazygrok-hooks/mcp-stdio-core test` | 0 | 22 tests passed, including oversized Content-Length and newline-free buffer denial |
| LSP daemon | `npm --prefix vendor/lazygrok-hooks/lsp-daemon test` | 0 | 20 files, 152 tests passed, including bounded socket input |
| Clean LSP daemon package | fresh temp extraction of daemon + both local cores, then `npm ci --ignore-scripts`, `npm run build`, focused build test | 0 | lockfile install, clean dist rebuild, and 2 build-contract tests passed |
| LSP runtime | `npm --prefix vendor/lazygrok-hooks/lsp test` | 0 | 24 component tests and 9 source-sensitive build/runtime tests passed |
| Packaged LSP hooks | `npm --prefix vendor/lazygrok-hooks/lsp run check`, then installed-hook audit | 0 | `check` finishes with the bundled runtime rather than overwriting it with modular TypeScript output; all 35 mirrored hooks, including LSP PostToolUse and PostCompact, exited 0 |
| Runtime parity | `python3 scripts/test_runtime_parity.py -v` | 0 | 24 tests passed, including transcript-less deployed adapters, Grok-over-Codex session isolation, stripped ambient Codex IDs, packaged LSP cancellation, symlink/hard-link attacks, bounded hook/state denial, large-ledger movement, mixed-root receipts, and active-tool routing |
| Port generator/docs | `python3 scripts/test_port_lazycodex_to_grok.py -v` | 0 | 22 tests passed, including Ralph/ULW split, current installation/privacy claims, worktree-contract preservation, fail-closed review isolation, Grok fan-out, hook removal, and active-tool invariants |
| Go surface | `go test ./... -count=1` and `go vet ./...` | 0 | all packages passed, including descriptor-anchored hashline reads/edits, parent-swap and symlink/hard-link denial, bounded hook/MCP/state ingress, exact-session ULW bridging, and private-mode repair |
| Python static analysis | `basedpyright --level error scripts` | 0 | 0 errors |
| Built-hook private state | packaged Linux hook `start-loop`, then `stat` and content probe | 0 | objective persisted for resume under `.lazygrok` with directory `0700` and file `0600` |
| Installed hook mirror | `python3 scripts/audit-hooks.py full` | 0 | plugin 35, bridge 35, full mirror true, dry-run 35/35 |
| Hook scripts | every `hooks/test-*.sh` except helper-only `test-support.sh` | 0 | all passed, including a live headless Grok skill-gate write |
| Release checksums | `(cd bin && sha256sum -c checksums.sha256)` | 0 | all 10 platform hook/MCP binaries matched |
| Plugin manifest | `grok plugin validate .` | 0 | LazyGrok 0.4.4 manifest valid |
| Active Grok skill tools | generated manifest-root and hook invariant | 0 | no `codex_app`, `team_mode`, `multi_agent_v*`, durable `team_*`, thread-title, telemetry, or Git Bash hook routes remained |
| Patch hygiene | `git diff --check` | 0 | no whitespace errors |

## Exact-SHA evidence policy

Historical validation rounds established the port baseline, but their transient
terminal logs are not part of the distributed plugin. Each release handoff must
create a fresh evidence bundle for the exact reviewed commit. That bundle records
the source archive, a clean rebuild and checksum comparison, full validation,
publication and installed-plugin binding, a real Grok invocation, parent and child
transcripts, and exact-SHA reviewer verdicts. Review claims apply only to the SHA
and artifact digest named in that bundle.

## Real Grok results

- A fresh Grok `0.2.114` natural `ulw` run emitted
  `ULTRAWORK MODE ENABLED!`, created an exact-session goal ledger, spawned and
  waited for exactly one real `lazygrok:explore` child, integrated
  `MARKER=LAZYGROK_R66`, committed the verified marker locally, and completed
  its LIGHT gate in 17 turns. This run also reconfirmed that headless
  `--worktree` alone does not materialize isolation.
- The reliable host sequence was then exercised in a fresh repository: a
  detached worktree was pre-created and Grok was launched with
  `--cwd <detached-worktree> -p "ulw ..."`. Grok emitted the activation banner,
  correctly avoided fan-out for the atomic task, wrote and committed
  `LAZYGROK_DETACHED_R67`, proved the detached registration, and ended cleanly
  in 8 turns. The source checkout remained clean at
  `65d6ac7f95640ca5c6c4cbc74cb82e61cdae4a02`; only the worktree advanced to
  `d03802aed2bdcffdc5fc2190254fcfcc6b788a68`.
- The detached-worktree summary, Grok stream, and debug trace have SHA-256
  `da28805004f25e57d58b4b2a641fa07049282114bf49e53ef9f037d4c56dfe53`,
  `4e2416fafca81b2655fd297566743f9911d89addfb425408c6e3e2779c30718d`,
  and `9b6d8d8f1331b39648330750086b298da6cb5627050500533ae65f0074f9e229`.
- A fresh natural `ulw` prompt ran through Grok `0.2.114` in the registered
  detached worktree `<grok-qa-worktree>` and required
  exactly one edge-case subagent before implementation. Grok emitted
  `ULTRAWORK MODE ENABLED!` exactly once, invoked one real subagent
  (`019fad3a-9df7-7b11-8044-d76f9cda51b9`), integrated its result, followed
  RED→GREEN, and completed the LIGHT quality gate.
- Independent `node test.mjs` execution printed `ok`. The source checkout stayed
  clean; source and detached worktree remained at
  `38ead4e910c51991ed427f55d2ee3d81f8f823e6`, and only the worktree contained
  `.lazygrok/`, `slug.mjs`, and `test.mjs`. No commit or push occurred. The
  exact-session goal ledger reported 1/1 complete goal, 3/3 passing criteria,
  and complete aggregate status.
- The Grok output, implementation, test, `goals.json`, and `ledger.jsonl` have
  SHA-256
  `22e606a0254c1d21331751d58918c18886c98042446ac305763ae17bf58368b9`,
  `d63c3626507503aeb7c863151a71c002fc672122783b4666203c4fac39fc6bda`,
  `57c649fdacccb4cf74bd89276db15b1d70db4fc2e64ab69c83af2e1778717790`,
  `7024d2abbf87052288b36518f7948a2be6091f318cf6eec7ef6d3abdfdf5b4f9`,
  and `9863f226c078b1cde77d6a4fa11879f6ffe2133bd55f26b7752f68f96fb8b94d`.
- A post-fix fresh natural `ulw` prompt ran through Grok `0.2.114` in the
  registered detached worktree `<grok-qa-worktree>`.
  It emitted `ULTRAWORK MODE ENABLED!` exactly once, classified the task LIGHT,
  recorded `no fan-out: trivial`, followed RED→GREEN, and created one exact
  session ledger with one complete goal and 3/3 passing criteria.
- Independent `node test.mjs` execution printed `all tests passed`. The source
  checkout stayed clean; source and worktree remained at
  `1df67db8b1f7834bda7de8f838cff79868682f48`, and only the detached worktree
  contained `.lazygrok/`, `sum.mjs`, and `test.mjs`. No commit or push occurred.
  The Grok output, `goals.json`, implementation, and test have SHA-256
  `c4c759de24d3307e1fb8cb08a7fdfb4003de45d1812d266c494760cccd3956bf`,
  `f7546be6f9d529efed2375b3948be3c4fc1ce0c99d29b87c51c88622d758214b`,
  `af814f9ebe213b2700c48c3f177855a57a15d8c30f26668b88dbafb8ad8675fe`,
  and `43091022e0eceea5cb5ba6015abd2cdfb8c20c414dfe886ba4f10eed0b315833`.
- A fresh natural prompt containing `ulw`, executed by Grok `0.2.114` with
  `--cwd <grok-qa-worktree>`, emitted
  `ULTRAWORK MODE ENABLED!` before its goal block.
- The test repository registered that path as a detached Git worktree at
  `691069bee29c436d3f9c0521adb164a701f896ea`; the source checkout remained
  clean at the same commit while only the detached worktree gained product and
  `.lazygrok` files.
- The first Grok process was terminated immediately after creating one pending
  goal with 0/3 criteria and before product files existed. Resuming the same
  host session reused that single ledger, followed RED→GREEN, created
  `parse.mjs` and `test.mjs`, and independently reran both the full test and
  direct-import surface.
- The resumed real Grok session completed the goal and aggregate under the exact
  host UUID `.lazygrok/ulw-loop/eb8ec0aa-97c8-4388-9004-d3f7d542dad0`,
  produced a LIGHT approval, created no `.omo` or alternative ULW state, and
  correctly avoided subagent fan-out and additional worktree creation for a
  one-module task.
- The interrupted and resumed Grok outputs have SHA-256
  `f171261b167ef35285eeabf0b5088f7226192007489b56c0a216c6a50c4af23c`
  and `386336defe72743aac853c7db53753613557a5c3f839af3c360752cddbf54a0e`;
  `goals.json` has SHA-256
  `603c6c4769cb089e9e9afeb7130727f98bb905dd6f4cfb374244f3d186a125a1`.
  Together with the RED
  (`7ac8e1b80f5eec1437dea53ce677835bbfccb16ad0d358b7c83bd0b0582ddc6f`)
  and GREEN
  (`c9238cd8427d00f4c4d0a014b383a4086003d3161ec9842ba2ead13b79a053cc`)
  captures, these preserve interruption, same-session resume, the independent
  rerun, quality gate, 1/1 complete goal, and 3/3 passing criteria.
- After the real turn, LazyGrok-owned state and gate evidence used `0700`/`0600`.
  Shell-created test captures inherited the shell umask but remained beneath a
  `0700` evidence directory. Reused lifecycle, diagnostics, audit, and UPS files
  were mode-repaired to `0600`; descriptor-anchored append rejected symlink and
  hard-link targets.
- Exact-session state existed only under the host UUID and reported 1/1 complete
  goals and 3/3 passing criteria; foreign-session and symlinked state probes were
  rejected.
- Built-hook adversarial probes rejected `sessionId: "../../../escaped-dir"` without
  deleting its sentinel, and a symlinked `.lazygrok/boulder.json` left its external
  target unchanged.
- The regenerated live user bridge at `~/.grok/hooks/lazygrok.json` contains 35
  mirrored hooks and no `git-bash` or telemetry route.

## Intentional host differences

Grok Build has no LazyCodex durable team mailbox/task bus, no Grok/Linux
`git_bash` server, and no native local-raster `view_image` tool. Ordinary ULW
therefore uses Grok's subagent/result surfaces in the current checkout; worktree
isolation is used at branch/PR/conflicting-edit boundaries or when explicitly
requested.

Grok Build `0.2.114` parses headless `--worktree`, but its headless
`run_single_turn` path passes only `has_worktree` into session materialization.
That boolean alters session-ID/restore preflight; the path never invokes
worktree creation and does not carry `--worktree-ref`. A plugin hook runs after
the host has selected cwd, so it cannot fix that process boundary. The verified
headless workflow is to pre-create a detached/task branch worktree and launch
`grok --cwd <absolute-worktree> -p "ulw ..."`. LazyGrok now injects this rule and
requires cwd/worktree/source-cleanliness proof before claiming isolation.

Descriptor-anchored state/evidence and LSP workspace mutation are Linux-only;
those sensitive operations fail closed on macOS and Windows.
