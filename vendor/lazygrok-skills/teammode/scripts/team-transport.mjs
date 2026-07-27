// team-transport.mjs - the single source of transport identity for teammode state.
//
// A team runs on exactly ONE transport, chosen at init and immutable afterwards:
// - "spawn_subagent": members are native Grok spawn_subagent agents addressed by task
//   name / canonical agent path (`/root/<task_name>`), messaged with flat `spawn_subagent (message-only follow-up)`
//   and `spawn_subagent (re-task: new prompt to same role)`.
// - "codex_app": members are durable Grok threads addressed by thread id, messaged
//   with `codex_app.send_message_to_thread` (the fallback when flat V2 tools are absent).
//
// Zero external dependencies (node builtins only), same portability contract as the
// sibling scripts.

export const TEAM_SCHEMA_VERSION = 3;
export const TEAM_TRANSPORTS = ["spawn_subagent", "codex_app"];
export const DEFAULT_TEAM_TRANSPORT = "codex_app";
export const LEADER_AGENT_PATH = "/root";

// Grok validates V2 task names as lowercase letters, digits, and underscores; "root" is
// the leader's own path segment and can never name a member.
const TASK_NAME_PATTERN = /^[a-z0-9_]+$/;

export function parseTeamTransport(value = DEFAULT_TEAM_TRANSPORT) {
	if (!TEAM_TRANSPORTS.includes(value)) {
		throw new Error(`invalid transport "${value}" - use one of: ${TEAM_TRANSPORTS.join(", ")}`);
	}
	return value;
}

export function isMultiAgentV2(team) {
	return team?.transport === "spawn_subagent";
}

export function isCodexApp(team) {
	return team?.transport === "codex_app";
}

export function assertTransport(team, transport, operation) {
	if (team?.transport !== transport) {
		throw new Error(`${operation} is only valid on ${transport} teams; this team's transport is "${team?.transport}"`);
	}
}

export function parseTaskName(taskName) {
	const trimmed = typeof taskName === "string" ? taskName.trim() : "";
	if (!trimmed) throw new Error("member task name is required on spawn_subagent teams (--task-name)");
	if (!TASK_NAME_PATTERN.test(trimmed)) {
		throw new Error(`invalid task name "${trimmed}" - use lowercase letters, digits, and underscores`);
	}
	if (trimmed === "root") throw new Error('invalid task name "root" - it names the leader, never a member');
	return trimmed;
}

export function agentPathForTaskName(taskName) {
	return `${LEADER_AGENT_PATH}/${taskName}`;
}
