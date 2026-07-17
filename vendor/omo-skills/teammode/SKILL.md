---
name: teammode
description: "Team orchestration: run a named team of cooperating Grok subagents with durable, script-managed state. MUST USE when the user asks Grok to create, run, coordinate, inspect, archive, or delete a team of subagents/sessions, or to work on something as a team in parallel. The main session is always the leader; members are defined by a concrete part, ownership area, or perspective - never a vague job role; a bundled cross-platform script writes the .lazygrok/teams state plus an auto-generated member field manual. Use a team when the work is not perfectly isolated but parallelizing helps, or when a task still needs exploration under a clear goal; use plain subagents when scope is perfectly isolated or the goal is ambiguous. Triggers: team mode, teammode, make a team, run as a team, team of agents, coordinate subagents, parallel subagents, archive the team, delete the team."
---

# Teammode

> **Note: Codex concept, adapted for Grok.** This skill originates from a Codex-centric model of
> durable "threads". Grok has no first-class thread concept; parallel work in Grok is done via
> `spawn_subagent` with `background: true`, then collecting results with
> `get_command_or_subagent_output(task_ids=[...])` and tearing down with
> `kill_command_or_subagent(task_id="...")`. The orchestration concepts below (leader, members,
> worktrees, durable state on disk) still apply, but each "member" is a backgrounded Grok
> subagent rather than a Codex thread.

Run a named team of cooperating Grok subagents under one leader, with durable state on disk.
This workflow is inspired by the lifecycle concerns in the
Yeachan-Heo/oh-my-codex team skill, but it does not copy that runtime model and never depends
on an external terminal runner - it coordinates through Grok's own `spawn_subagent` tool plus a bundled
state script.

## When to use a team (and when to use plain subagents instead)

Use a TEAM when EITHER holds:
- the work does NOT split into perfectly isolated pieces, but doing it in parallel is clearly
  more convenient - members will need to see and react to each other's findings; or
- one task still needs exploration, yet its GOAL is already clear - parallel investigation under
  a fixed objective.

Use plain subagents (`$ulw` / `spawn_subagent` with `background: true`) - NOT a team - when EITHER holds:
- the work IS perfectly isolated, so there is no coordination cost worth paying; or
- the GOAL is still ambiguous, where one mind should resolve direction before any fan-out.

A team buys cross-member coordination at a real overhead cost; only spend it when coordination
is the thing you actually need.

## You are the leader - orchestrate, do not implement

The main session is ALWAYS the team leader; you orchestrate directly and never spin up a separate
leader thread. Your job is orchestration, NOT writing product code: split the work and assign each
slice, hold live situational awareness of every member, verify and QA what they deliver, relay
findings between members, instruct and unblock, and synthesize the result. DELEGATE every code edit
to a member - if you catch yourself editing product files while the team runs, that work was a
member's slice you should have handed off. You own direction, verification, and integration (the
merge), not the keystrokes.

## Compose by part, ownership, or perspective - not by job title

A team is ALWAYS two or more members - never a single-member team. One worker on an isolated
job is a subagent (`spawn_subagent` with `background: true`), not a team; if you end up with a single member,
either split off a second distinct slice or drop the team and use a subagent.

Compose the team from what you actually KNOW about the work. Ground the split in real knowledge
of the problem, then divide it into clear, non-overlapping responsibilities - one per aspect of
the work - and give each member exactly one. No two members may own the same thing. Define each
member by a concrete slice: a specific part of the codebase, an ownership area, or a distinct
perspective/lens. Assigning a vague role ("backend dev", "release analyst", "the tester") is an
anti-pattern - it gives the member no real boundary and invites overlap. Each member's `focus`
names what they own concretely; the `lens` is one of `area`, `ownership`, or `perspective`.
Give each member a short, distinct `--name` too - its role or what it watches (e.g.
`app-server-lifecycle`, `mailbox-delivery`) - because that name titles its subagent; never reuse
one name for two members.

## Run the script - never hand-write team state

A bundled, dependency-free Node script owns all team state so you never author `team.json` or
the member manual by hand. Run it with `node` (or `bun`); it works on macOS, Linux, and Windows.
Replace `<skill-root>` with this skill's own directory.

```
node "<skill-root>/scripts/team.mjs" init        --name "<team>" --session-name "<session>" [--session <leader_session_id>] [--worktree] [--base-branch dev]
node "<skill-root>/scripts/team.mjs" add-member  --team <session_id> --id A --name "<short role>" --focus "<part/ownership/perspective>" --lens area|ownership|perspective --deliverable "<...>" [--branch <branch>]
node "<skill-root>/scripts/team.mjs" bind-thread  --team <session_id> --id A --thread <thread_id> [--cwd <path>]
node "<skill-root>/scripts/team.mjs" member-prompt --team <session_id> --id A
node "<skill-root>/scripts/team.mjs" set-status   --team <session_id> --id A --status reported|blocked|active|archived [--note "<...>"]
node "<skill-root>/scripts/team.mjs" worktree-add    --team <session_id> --id A [--base-branch <branch>]
node "<skill-root>/scripts/team.mjs" worktree-remove --team <session_id> --id A [--force]
node "<skill-root>/scripts/team.mjs" integrate       --team <session_id> [--id A]
node "<skill-root>/scripts/team.mjs" archive      --team <session_id> [--id A]
node "<skill-root>/scripts/team.mjs" delete       --team <session_id> [--force]
node "<skill-root>/scripts/team.mjs" status       --team <session_id>
```

`init` creates `.lazygrok/teams/{session_id}/` containing `team.json` (the single durable state file:
team id, the main-session leader, the member roster, status, worktree config, and a lifecycle
log), `guide.md` (the auto-generated member field manual), and `artifacts/` (a shared exchange
space). `{session_id}` is the leader's Grok session id when you can pass it via `--session`;
otherwise the script generates a stable handle. Re-running `init` is a safe no-op. Every mutating
subcommand rewrites `guide.md`, so the manual always matches the current team.

## Create the team and its subagents

1. `init` the team, then `add-member` once per member.
2. Spawn a backgrounded subagent per member with `spawn_subagent(..., background=true)` - ALWAYS
   this tool for every member, never a foreground agent - titled `[team name] <member name>`, using
   THAT member's own name (its role / what it watches), so no two subagents share a title.
   `add-member` prints the exact title to use. Pass the member's worktree path in the prompt so the
   subagent `cd`s there first. Record the returned `task_id` as the member's handle; if the spawn
   tool exposes a title/label argument, set it to the member name.
3. `bind-thread` to record each subagent's task id (and `--cwd`), then send that member's bootstrap
   trigger (printed by `add-member` / `member-prompt`) as the subagent's first prompt. The trigger
   is short on purpose: it tells the new subagent to READ its `guide.md` and `team.json` rather than
   carrying the whole protocol inline.

Every team member is a real Grok subagent created with `spawn_subagent(..., background=true)` - this
is strict, not a preference. NEVER substitute a foreground `spawn_subagent`, or any other in-process
helper, for a team member: a foreground agent is an ephemeral helper that does not show up as a team
member, cannot carry the `[team name] <member name>` title, and cannot be inspected, polled,
archived, or re-opened with the `get_command_or_subagent_output` / `kill_command_or_subagent` tools -
which defeats the entire point of a durable team. A member only counts once you have `bind-thread`-ed
it to a real `spawn_subagent` task id. If the spawn tool is unavailable, STOP and say so (see Stop
rules); do not quietly fall back to a foreground agent.

## Communication

Members push to you and to one another by writing to the shared `artifacts/` directory and by
returning output you collect with `get_command_or_subagent_output(task_ids=[...])`; you inspect their
state with the same tool. So members can actually reach you, run `init` with
`--session <your own session id>` - that makes `leader.sessionId` in team.json a real, referenceable
handle; without it members cannot report to you and you are stuck polling. The generated manual binds
members to the hard rules, so you mainly keep the channel open: expect frequent small inbound updates
from each member - findings, `WORKING:`/`BLOCKED:` markers, peer digests - rather than one final
dump, and act on them as they arrive. All member-to-member and member-to-leader traffic is in English;
when the END user addresses a member, that member replies in the user's own language. Members hand off
files and memos through the team `artifacts/` directory and reference them by path. Wait for every
required member's final report before you declare the team done.

## Worktrees - isolate members who would touch the same files

The moment two members' slices would edit the same files, give each its own git worktree so they
cannot clobber each other. Decide this whenever you see the collision - at team creation OR mid-run,
not only up front. For each colliding member run `worktree-add --team <id> --id <member>`: it creates
the worktree off the base branch on a derived branch, flips the team into worktree mode, records it in
`team.json`, and prints the `cd` path to hand that member. The member works and commits only inside
its own worktree. To land the work, `integrate --team <id>` merges every member branch into your
current branch with a merge commit (never a squash or rebase); resolve any conflict it reports, then
`worktree-remove` each worktree at cleanup.

## Run a ulw-plan in parallel

When a decision-complete plan already exists at `.lazygrok/plans/<slug>.md` (from ulw-plan), execute its
parallel waves as a team instead of one todo at a time. Map it directly:
- one wave's independent todos -> one member each; the todo's scope/files become that member's `focus`,
  and its acceptance criteria + QA become the member's `deliverable`.
- the plan's dependency matrix sets the shape: todos with no unmet dependency inside a wave run as
  concurrent members; a todo that depends on another waits, so launch the next wave only after the
  blocking members report.
- todos in the same wave that touch overlapping files -> give those members worktrees (see above).

Keep the plan file as the shared spec: point each member at its todo by path, and verify the member's
result against that todo's acceptance criteria before you integrate.

## Archive, delete, and cleanup

DISBAND the team the moment it is no longer needed. A team exists only to do its work; once that
work is done, or the user no longer wants it, do not leave it lying around - archive every member,
then delete the team state. A finished team that is never disbanded is a leak.

- `archive` closes the team: notify each active member, copy anything useful into `artifacts/`,
  tear down each member subagent with `kill_command_or_subagent(task_id="...")`, then `archive` flips
  the team and all members to archived. If a teardown tool is unavailable, record that in the team log
  and tell the user - never pretend a member was archived.
- `delete` removes `.lazygrok/teams/{session_id}` and refuses while the team is unarchived or any member
  is still active unless `--force`.
- When the work wraps up, land it the way the user asked: `integrate --team <id>` for a direct merge
  commit, or push each member branch and open a PR. Then `worktree-remove` each worktree, archive, and
  delete. Cleanup is real work; respect the user's instruction on how to land it.

## Stop rules

- Stop and ask before deleting an unarchived team while any member is still active.
- Member communication stays English unless the user explicitly requests otherwise; user-facing
  replies follow the user's language.
- Stop if the requested operation needs Grok subagent tools (`spawn_subagent` with `background: true`,
  `get_command_or_subagent_output`, `kill_command_or_subagent`) and they are unavailable; say so
  instead of faking it.
