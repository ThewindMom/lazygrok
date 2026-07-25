---
name: teammode
description: "Grok: n/a — use parallel spawn_subagent. Codex-only team orchestration (NOT runnable on Grok Build): run a named team of cooperating Codex threads with durable, script-managed state. Requires multi_agent_v2/codex_app. On Grok, do not run this skill — fan out with parallel spawn_subagent, self-contained prompts, and an orchestrator journal instead. Historical triggers: team mode, teammode, make a team, run as a team, team of agents, coordinate threads, parallel Codex threads, archive the team, delete the team."
---

# Teammode

> **ON GROK BUILD: this skill is NOT runnable.**
>
> It requires Codex `multi_agent_v2` / `codex_app` team transport (durable threads, bind/title/archive thread tools). **Status: n_a / broken on Grok.**
>
> **Do not execute the teammode lifecycle below on Grok.** Keep this skill for reference only.
>
> **Grok alternative:** parallel `spawn_subagent` with self-contained prompts and an orchestrator journal (leader tracks member task ids, status, and findings in chat or under `.lazygrok/`). Collect with `get_command_or_subagent_output`; tear down with `kill_command_or_subagent`. That is a different model — not full teammode.

Run a named team of cooperating Codex threads under one leader, with durable state on disk.
This is a Codex-only workflow. It is inspired by the lifecycle concerns in the
Yeachan-Heo/oh-my-codex team skill, but it does not copy that runtime model and never depends
on an external terminal runner - it coordinates through Codex's own thread tools plus a bundled
state script.

## When to use a team (and when to use plain subagents instead)

Use a TEAM when EITHER holds:
- the work does NOT split into perfectly isolated pieces, but doing it in parallel is clearly
  more convenient - members will need to see and react to each other's findings; or
- one task still needs exploration, yet its GOAL is already clear - parallel investigation under
  a fixed objective.

Use plain subagents (`$ulw` / `spawn_subagent`) - NOT a team - when EITHER holds:
- the work IS perfectly isolated, so there is no coordination cost worth paying; or
- the GOAL is still ambiguous, where one mind should resolve direction before any fan-out.

A team buys cross-member coordination at a real overhead cost; only spend it when coordination
is the thing you actually need.

## You are the leader

The main session is ALWAYS the team leader. Do NOT create a separate leader thread - you
orchestrate directly. Members are the threads you create; they report to you, and you own the
final synthesis and any integration.

## Compose by part, ownership, or perspective - not by job title

A team is ALWAYS two or more members - never a single-member team. One worker on an isolated
job is a subagent (`spawn_subagent`), not a team; if you end up with a single member,
either split off a second distinct slice or drop the team and use a subagent.

Compose the team from what you actually KNOW about the work. Ground the split in real knowledge
of the problem, then divide it into clear, non-overlapping responsibilities - one per aspect of
the work - and give each member exactly one. No two members may own the same thing. Define each
member by a concrete slice: a specific part of the codebase, an ownership area, or a distinct
perspective/lens. Assigning a vague role ("backend dev", "release analyst", "the tester") is an
anti-pattern - it gives the member no real boundary and invites overlap. Each member's `focus`
names what they own concretely; the `lens` is one of `area`, `ownership`, or `perspective`.

## Run the script - never hand-write team state

A bundled, dependency-free Node script owns all team state so you never author `team.json` or
the member manual by hand. Run it with `node` (or `bun`); it works on macOS, Linux, and Windows.
Replace `<skill-root>` with this skill's own directory.

```
node "<skill-root>/scripts/team.mjs" init        --name "<team>" --session-name "<session>" [--session <leader_session_id>] [--worktree] [--base-branch dev]
node "<skill-root>/scripts/team.mjs" add-member  --team <session_id> --id A --focus "<part/ownership/perspective>" --lens area|ownership|perspective --deliverable "<...>" [--branch <branch>]
node "<skill-root>/scripts/team.mjs" bind-thread  --team <session_id> --id A --thread <thread_id> [--cwd <path>]
node "<skill-root>/scripts/team.mjs" member-prompt --team <session_id> --id A
node "<skill-root>/scripts/team.mjs" set-status   --team <session_id> --id A --status reported|blocked|active|archived [--note "<...>"]
node "<skill-root>/scripts/team.mjs" archive      --team <session_id> [--id A]
node "<skill-root>/scripts/team.mjs" delete       --team <session_id> [--force]
node "<skill-root>/scripts/team.mjs" status       --team <session_id>
```

`init` creates `.omo/teams/{session_id}/` containing `team.json` (the single durable state file:
team id, the main-session leader, the member roster, status, worktree config, and a lifecycle
log), `guide.md` (the auto-generated member field manual), and `artifacts/` (a shared exchange
space). `{session_id}` is the leader's Codex session id when you can pass it via `--session`;
otherwise the script generates a stable handle. Re-running `init` is a safe no-op. Every mutating
subcommand rewrites `guide.md`, so the manual always matches the current team.

## Create the team and its threads

1. `init` the team, then `add-member` once per member.
2. Create a durable thread per member with `spawn_subagent` - ALWAYS this tool for every
   member, never a spawned agent - titled EXACTLY
   `[team name] {session name}` (keep this convention strictly). If `spawn_subagent`
   accepts a working directory / cwd argument, set it to that member's worktree; otherwise the
   member's manual tells it to `cd` there first. Use `spawn_subagent` if the title
   did not land at creation.
3. `bind-thread` to record each thread id (and `--cwd`), then send that member's bootstrap
   trigger (printed by `add-member` / `member-prompt`) as the thread's first message. The trigger
   is short on purpose: it tells the new thread to READ its `guide.md` and `team.json` rather than
   carrying the whole protocol inline.

Every team member is a real Codex thread created with `spawn_subagent` - this is strict,
not a preference. NEVER substitute `spawn_subagent`, or any other in-process subagent,
for a team member: a spawned agent is an ephemeral helper that does not show up as a team thread,
cannot carry the `[team name] {session name}` title, and cannot be inspected, titled, archived, or
re-opened with the `` thread tools - which defeats the entire point of a durable team.
A member only counts once you have `bind-thread`-ed it to a real `spawn_subagent` thread
id. If the thread-creation tool is unavailable, STOP and say so (see Stop rules); do not quietly
fall back to a spawned agent.

## Communication

Coordinate with `spawn_subagent` (leader-to-member and peer digests) and inspect
status with `get_command_or_subagent_output`. The generated manual already binds members to the hard rules,
so you mostly enforce them: all member-to-member and member-to-leader communication is in English;
when the END user addresses a member, that member replies in the user's own language. Members
over-communicate relentlessly - constant, small, lean updates that report every finding, hand-off,
and even the smallest or most trivial step as it happens rather than one final dump - and send
`WORKING:`/`BLOCKED:` markers so the leader always knows their state; stale, stuck, or
silently-blocked members are not acceptable, and a finished
member reports to the leader immediately. Members hand off files and
memos through the team `artifacts/` directory and reference them by path instead of pasting large
content. Wait for every required member's final report before you declare the team done.

## Worktrees (optional isolation)

When parallel members would edit overlapping files, enable isolation with `init --worktree`. Create
one git worktree per member off the base branch, `bind-thread --cwd <worktree>` so each member's
worktree is recorded in `team.json`, and rely on the manual to direct each member into its own
worktree. Each member commits inside its worktree so you can integrate.

## Archive, delete, and cleanup

DISBAND the team the moment it is no longer needed. A team exists only to do its work; once that
work is done, or the user no longer wants it, do not leave it lying around - archive every member,
then delete the team state. A finished team that is never disbanded is a leak.

- `archive` closes the team: notify each active member, copy anything useful into `artifacts/`,
  archive each member thread with `kill_command_or_subagent`, then `archive` flips the team
  and all members to archived. If a thread-archive tool is unavailable, record that in the team log
  and tell the user - never pretend a member was archived.
- `delete` removes `.omo/teams/{session_id}` and refuses while the team is unarchived or any member
  is still active unless `--force`.
- When the work wraps up, integrate each member's worktree the way the user asked - merge directly,
  or open a fresh PR and merge it - then archive and delete. Cleanup is real work; respect the
  user's instruction on how to land it.

## Stop rules

- Stop and ask before deleting an unarchived team while any member is still active.
- Member communication stays English unless the user explicitly requests otherwise; user-facing
  replies follow the user's language.
- Stop if the requested operation needs Codex thread tools (create/read/send/title/archive) and
  they are unavailable; say so instead of faking it.
