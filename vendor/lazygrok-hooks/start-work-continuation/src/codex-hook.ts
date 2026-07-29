import type { ContinuationState } from "./boulder-reader.js";
import { readContinuationState } from "./boulder-reader.js";
import { START_WORK_CONTINUATION_DIRECTIVE } from "./directive.js";
import type { ReadonlyFileSystem, StopHookEventName, StopHookOutput, StopInput } from "./types.js";

type ParsedStopInput = Omit<StopInput, "transcript_path"> & {
	readonly transcript_path: string | null;
};

export function runStopHook(input: unknown, fs: ReadonlyFileSystem): string {
	const payload = parseStopInput(input);
	if (payload === null) return "";
	if (payload.stop_hook_active) return "";
	if (transcriptHasContextPressureMarker(payload.transcript_path, fs)) return "";
	const state = readContinuationState(payload.cwd, payload.session_id);
	if (state === null) return "";
	return JSON.stringify({
		decision: "block",
		reason: renderDirective(state, payload.session_id),
	} satisfies StopHookOutput);
}

function renderDirective(state: ContinuationState, sessionId: string): string {
	const lineBreak = String.fromCharCode(10);
	const worktreeBlock =
		state.worktreePath === null
			? ""
			: `${lineBreak}- Worktree: \`${safeDirectiveValue(state.worktreePath)}\` (all edits, tests, and commands run inside this directory)`;
	const replacements = {
		PLAN_NAME: safeDirectiveValue(state.planName),
		PLAN_PATH: safeDirectiveValue(state.planPath),
		BOULDER_PATH: safeDirectiveValue(state.boulderPath),
		REMAINING_COUNT: String(state.checklist.remaining),
		TOTAL_COUNT: String(state.checklist.total),
		NEXT_TASK_LABEL: safeDirectiveValue(state.checklist.nextTaskLabel ?? "none (final gate pending)"),
		WORKTREE_BLOCK: worktreeBlock,
		LEDGER_PATH: safeDirectiveValue(state.ledgerPath),
		SESSION_ID: safeDirectiveValue(sessionId),
	} as const;
	let rendered = START_WORK_CONTINUATION_DIRECTIVE;
	for (const [placeholder, value] of Object.entries(replacements)) {
		rendered = rendered.replaceAll(`{{${placeholder}}}`, value);
	}
	return rendered;
}

function safeDirectiveValue(value: string): string {
	return value.replace(/[\u0000-\u001f\u007f`]+/gu, " ").trim();
}

const CONTEXT_PRESSURE_MARKERS = [
	"context compacted",
	"context_length_exceeded",
	"skill descriptions were shortened",
	"context_too_large",
	"codex ran out of room in the model's context window",
	"your input exceeds the context window",
	"long threads and multiple compactions",
] as const;

function transcriptHasContextPressureMarker(transcriptPath: string | null, fs: ReadonlyFileSystem): boolean {
	if (transcriptPath === null || transcriptPath.length === 0) return false;
	try {
		const transcript =
			fs.readBoundedRegularTextFile?.(transcriptPath, 10 * 1024 * 1024) ??
			readLegacyBoundedTranscript(transcriptPath, fs);
		return CONTEXT_PRESSURE_MARKERS.some((marker) => transcript.toLowerCase().includes(marker));
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

function readLegacyBoundedTranscript(transcriptPath: string, fs: ReadonlyFileSystem): string {
	const linkStat = fs.lstatSync?.(transcriptPath);
	if (linkStat?.isSymbolicLink() === true) return "";
	const stat = fs.statSync?.(transcriptPath);
	if (stat !== undefined && (!stat.isFile() || stat.size > 10 * 1024 * 1024)) return "";
	return fs.readFileSync(transcriptPath, "utf8").toLowerCase();
}

function parseStopInput(value: unknown): ParsedStopInput | null {
	if (!isRecord(value)) return null;
	const eventName = value["hook_event_name"];
	const sessionId = value["session_id"];
	const turnId = value["turn_id"];
	const transcriptPath = value["transcript_path"];
	const cwd = value["cwd"];
	const model = value["model"];
	const permissionMode = value["permission_mode"];
	const stopHookActive = value["stop_hook_active"];
	const lastAssistantMessage = value["last_assistant_message"];
	if (
		!isStopHookEventName(eventName) ||
		typeof sessionId !== "string" ||
		typeof turnId !== "string" ||
		(transcriptPath !== undefined && transcriptPath !== null && typeof transcriptPath !== "string") ||
		typeof cwd !== "string" ||
		typeof model !== "string" ||
		typeof permissionMode !== "string" ||
		typeof stopHookActive !== "boolean" ||
		!optionalString(lastAssistantMessage)
	) {
		return null;
	}
	return {
		hook_event_name: eventName,
		session_id: sessionId,
		turn_id: turnId,
		transcript_path: typeof transcriptPath === "string" ? transcriptPath : null,
		cwd,
		model,
		permission_mode: permissionMode,
		stop_hook_active: stopHookActive,
		...(typeof lastAssistantMessage === "string" ? { last_assistant_message: lastAssistantMessage } : {}),
	};
}

function isStopHookEventName(value: unknown): value is StopHookEventName {
	return value === "Stop" || value === "SubagentStop";
}

function optionalString(value: unknown): boolean {
	return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
