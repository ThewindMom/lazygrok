import { join, resolve } from "node:path";

import { readBoundedRegularTextFile, safeReadWorkspaceTextFile } from "./file-safety.js";
import { assertSafeUlwLoopPathSegment, normalizeUlwLoopSessionId, ulwLoopDir } from "./paths.js";
import { consumeResumeBudget } from "./resume-budget.js";
import { grokUlwCli } from "./runtime-command.js";
import type { UlwLoopItem, UlwLoopPlan } from "./types.js";

// Turn-death recovery only: Codex emits Stop when a turn ends, so a run that
// dies mid-turn (crash, kill, context blowup before any Stop) never reaches
// this handler. Mid-turn stalls are out of scope by design.

const MAX_HOOK_INPUT_BYTES = 10 * 1024 * 1024;

// Mirrors start-work-continuation's context-pressure bail-out: injecting a
// resume directive into an already-overflowing context makes things worse.
const CONTEXT_PRESSURE_MARKERS = [
	"context compacted",
	"context_length_exceeded",
	"skill descriptions were shortened",
	"context_too_large",
	"codex ran out of room in the model's context window",
	"your input exceeds the context window",
	"long threads and multiple compactions",
] as const;

interface StopPayload {
	readonly session_id: string;
	readonly cwd: string;
	readonly transcript_path: string | null;
	readonly stop_hook_active: boolean;
}

export function runStopResumeHook(input: unknown): string {
	const payload = parseStopPayload(input);
	if (payload === null) return "";
	if (transcriptShowsContextPressure(payload.transcript_path)) return "";
	if (boulderContinuationWillFire(payload.cwd, payload.session_id)) return "";
	const stateDir = ulwLoopDir(payload.cwd, { sessionId: payload.session_id });
	const plan = readPlan(payload.cwd, join(stateDir, "goals.json"));
	if (plan === null || plan.aggregateCompletion?.status === "complete") return "";
	const goal = resumableGoal(plan) ?? incompleteAggregateGoal(plan);
	if (goal === undefined) return "";
	if (!consumeResumeBudget(payload.cwd, stateDir, goal.id)) return "";
	const output: { decision: "block"; reason: string } = {
		decision: "block",
		reason: renderResumeDirective(plan, goal, payload.session_id),
	};
	return JSON.stringify(output);
}

export async function runStopResumeHookCli(stdin: NodeJS.ReadableStream, stdout: NodeJS.WritableStream): Promise<void> {
	try {
		const chunks: Buffer[] = [];
		let totalBytes = 0;
		for await (const chunk of stdin) {
			const bytes = Buffer.from(chunk);
			totalBytes += bytes.length;
			if (totalBytes > MAX_HOOK_INPUT_BYTES) return;
			chunks.push(bytes);
		}
		const output = runStopResumeHook(JSON.parse(Buffer.concat(chunks).toString("utf8")));
		if (output.length > 0) stdout.write(output);
	} catch (error) {
		if (error instanceof Error) return;
	}
}

function resumableGoal(plan: UlwLoopPlan): UlwLoopItem | undefined {
	const active = plan.goals.find((goal) => goal.id === plan.activeGoalId);
	if (active !== undefined && isResumableStatus(active.status)) return active;
	return plan.goals.find((goal) => isResumableStatus(goal.status));
}

function isResumableStatus(status: UlwLoopItem["status"]): boolean {
	return status === "pending" || status === "in_progress";
}

function incompleteAggregateGoal(plan: UlwLoopPlan): UlwLoopItem | undefined {
	if (
		plan.codexGoalMode !== "aggregate" ||
		plan.aggregateCompletion?.status === "complete" ||
		plan.goals.length === 0 ||
		!plan.goals.every((goal) => goal.status === "complete")
	) {
		return undefined;
	}
	return plan.goals.at(-1);
}

function renderResumeDirective(plan: UlwLoopPlan, goal: UlwLoopItem, sessionId: string): string {
	const option = plan.goalsPath.includes(`/${sessionId}/`) ? ` --session-id ${sessionId}` : "";
	return [
		`The ulw-loop run in this session still has unfinished goals (next: ${goal.id} — ${goal.title}).`,
		"The turn ended before the loop completed. Resume it now:",
		`1. Run \`${grokUlwCli()} status${option} --json\` to reload the plan, the active goal, and currentAttemptDir.`,
		"2. Continue the active goal's remaining success criteria, recording evidence with record-evidence.",
		`3. Checkpoint through \`${grokUlwCli()} checkpoint${option}\` when the goal's criteria are proven; a complete checkpoint prints the next goal instruction.`,
		"If the loop is genuinely blocked on the user, checkpoint the goal as blocked with the reason instead.",
	].join("\n");
}

function readPlan(repoRoot: string, goalsPath: string): UlwLoopPlan | null {
	try {
		const parsed = JSON.parse(safeReadWorkspaceTextFile(repoRoot, goalsPath)) as UlwLoopPlan;
		for (const goal of parsed.goals) assertSafeUlwLoopPathSegment(goal.id, "goal id");
		return parsed;
	} catch (error) {
		if (error instanceof Error) return null;
		throw error;
	}
}

// Local ~10-LOC approximation of start-work-continuation's boulder check (no
// cross-component import allowed): any continuable work for this session means
// that hook owns the Stop event, so this one stays silent.
function boulderContinuationWillFire(cwd: string, sessionId: string): boolean {
	for (const relativePath of [join(".lazygrok", "boulder.json"), join(".omo", "boulder.json")]) {
		try {
			const raw = JSON.parse(safeReadWorkspaceTextFile(cwd, join(cwd, relativePath), 1024 * 1024)) as Record<
				string,
				unknown
			>;
			const works = raw["works"];
			// The flat legacy shape has no works map: the top level is the single work.
			const entries = typeof works === "object" && works !== null ? Object.values(works) : [raw];
			const continuationExists = entries.some((work) => {
				if (typeof work !== "object" || work === null) return false;
				const entry = work as Record<string, unknown>;
				const sessionIds = Array.isArray(entry["session_ids"]) ? entry["session_ids"] : [];
				const continuable = entry["status"] === "active" || entry["status"] === "paused";
				const ownsSession = sessionIds.some((candidate) => {
					if (typeof candidate !== "string") return false;
					return (
						candidate === sessionId || candidate === `grok:${sessionId}` || candidate === `codex:${sessionId}`
					);
				});
				return continuable && ownsSession && boulderPlanHasChecklist(cwd, entry);
			});
			if (continuationExists) return true;
		} catch (error) {
			if (!(error instanceof Error)) throw error;
		}
	}
	return false;
}

function transcriptShowsContextPressure(transcriptPath: string | null): boolean {
	if (transcriptPath === null || transcriptPath.length === 0) return false;
	try {
		const transcript = readBoundedRegularTextFile(transcriptPath, 10 * 1024 * 1024).toLowerCase();
		return CONTEXT_PRESSURE_MARKERS.some((marker) => transcript.includes(marker));
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

// start-work-continuation owns an active Boulder plan until its final gate marks
// the work complete, including the zero-remaining checklist state.
function boulderPlanHasChecklist(cwd: string, entry: Record<string, unknown>): boolean {
	const activePlan = entry["active_plan"];
	if (typeof activePlan !== "string" || activePlan.trim().length === 0) return false;
	try {
		return safeReadWorkspaceTextFile(cwd, resolve(cwd, activePlan), 10 * 1024 * 1024)
			.split(/\r?\n/)
			.some((line) => line.startsWith("- [ ] ") || line.startsWith("- [x] ") || line.startsWith("- [X] "));
	} catch (error) {
		if (!(error instanceof Error)) throw error;
	}
	return false;
}

function parseStopPayload(value: unknown): StopPayload | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	const optionalMessage = record["last_assistant_message"];
	const transcriptPath = record["transcript_path"];
	const sessionId = record["session_id"];
	const valid =
		record["hook_event_name"] === "Stop" &&
		typeof sessionId === "string" &&
		normalizeUlwLoopSessionId(sessionId) === sessionId &&
		typeof record["turn_id"] === "string" &&
		(transcriptPath === undefined || transcriptPath === null || typeof transcriptPath === "string") &&
		typeof record["cwd"] === "string" &&
		typeof record["model"] === "string" &&
		typeof record["permission_mode"] === "string" &&
		typeof record["stop_hook_active"] === "boolean" &&
		(optionalMessage === undefined || typeof optionalMessage === "string");
	if (!valid) return null;
	return {
		session_id: sessionId as string,
		cwd: record["cwd"] as string,
		transcript_path: typeof transcriptPath === "string" ? transcriptPath : null,
		stop_hook_active: record["stop_hook_active"] as boolean,
	};
}
