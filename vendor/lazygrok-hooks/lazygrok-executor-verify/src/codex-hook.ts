import { lstatSync as nodeLstatSync, readdirSync as nodeReaddirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { renderDirective } from "./directive.js";
import {
	clearAttemptState,
	isNonEmptyWorkspaceRegularFileInsideDirectory,
	MAX_ATTEMPTS,
	readAttemptState,
	readBoundedWorkspaceRegularFile,
	sanitizeKey,
	writeAttemptState,
} from "./state.js";
import type { HookFileSystem, StopHookOutput, SubagentStopInput } from "./types.js";
import { SUBAGENT_STOP_EVENT } from "./types.js";

const RECEIPT_ENFORCED_AGENTS = new Set([
	"lazycodex-executor",
	"lazygrok-executor",
	"lazycodex-worker-low",
	"lazycodex-worker-medium",
	"lazycodex-worker-high",
	"lazygrok-worker-low",
	"lazygrok-worker-medium",
	"lazygrok-worker-high",
]);
const MAX_BOULDER_BYTES = 1024 * 1024;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export function runSubagentStopHook(input: unknown, fs: HookFileSystem): string {
	if (!isSubagentStopInput(input)) return "";
	if (!RECEIPT_ENFORCED_AGENTS.has(input.agent_type)) return "";
	if (hasValidEvidenceReceipt(input, fs)) {
		clearAttemptState(input.cwd, input.session_id, input.agent_id);
		return "";
	}
	const state = readAttemptState(input.cwd, input.session_id, input.agent_id, fs);
	if (state.attempts >= MAX_ATTEMPTS) {
		clearAttemptState(input.cwd, input.session_id, input.agent_id);
		return "";
	}
	const attempts = state.attempts + 1;
	writeAttemptState(input.cwd, input.session_id, input.agent_id, { attempts });
	return JSON.stringify({
		decision: "block",
		reason: renderDirective(attempts, input.last_assistant_message, requiredEvidenceDirectory(input, fs)),
	} satisfies StopHookOutput);
}
function hasValidEvidenceReceipt(input: SubagentStopInput, fs: HookFileSystem): boolean {
	const receiptPath = extractEvidencePath(input.last_assistant_message);
	if (receiptPath === null) return false;
	const resolvedPath = isAbsolute(receiptPath) ? resolve(receiptPath) : resolve(input.cwd, receiptPath);
	const evidenceRoot = resolve(input.cwd, requiredEvidenceDirectory(input, fs));
	if (!isPathInsideDirectory(resolvedPath, evidenceRoot)) return false;
	try {
		return isNonEmptyFileInsideEvidenceRoot(resolvedPath, evidenceRoot, input.cwd, fs);
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

function requiredEvidenceDirectory(input: SubagentStopInput, fs: HookFileSystem): string {
	return join(
		activeStateRoot(input.cwd, input.session_id, fs),
		"evidence",
		"executors",
		sanitizeKey(input.session_id),
		sanitizeKey(input.agent_id),
	);
}

function activeStateRoot(cwd: string, sessionId: string, fs: HookFileSystem): ".lazygrok" | ".omo" {
	const canonicalOwnsSession = hasSessionRunState(cwd, ".lazygrok", sessionId, fs);
	const legacyOwnsSession = hasSessionRunState(cwd, ".omo", sessionId, fs);
	if (canonicalOwnsSession) return ".lazygrok";
	if (legacyOwnsSession) return ".omo";
	if (hasRunState(cwd, ".lazygrok", fs)) return ".lazygrok";
	if (hasRunState(cwd, ".omo", fs)) return ".omo";
	return ".lazygrok";
}

function hasSessionRunState(cwd: string, root: ".lazygrok" | ".omo", sessionId: string, fs: HookFileSystem): boolean {
	const scopedGoals = join(cwd, root, "ulw-loop", sanitizeKey(sessionId), "goals.json");
	if (isNonEmptyFile(scopedGoals, fs)) return true;
	const boulderPath = join(cwd, root, "boulder.json");
	if (!isNonEmptyFile(boulderPath, fs)) return false;
	try {
		return boulderOwnsSession(
			JSON.parse(readBoundedWorkspaceRegularFile(cwd, boulderPath, MAX_BOULDER_BYTES)),
			sessionId,
		);
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

function boulderOwnsSession(value: unknown, sessionId: string): boolean {
	if (!isRecord(value)) return false;
	const candidates: unknown[] = [value];
	if (isRecord(value["works"])) candidates.push(...Object.values(value["works"]));
	return candidates.some((candidate) => {
		if (!isRecord(candidate) || !Array.isArray(candidate["session_ids"])) return false;
		return candidate["session_ids"].some(
			(item) => typeof item === "string" && stripSessionPrefix(item) === stripSessionPrefix(sessionId),
		);
	});
}

function stripSessionPrefix(value: string): string {
	return value.replace(/^(?:grok|codex|opencode):/u, "");
}

function hasRunState(cwd: string, root: ".lazygrok" | ".omo", fs: HookFileSystem): boolean {
	try {
		if (isNonEmptyFile(join(cwd, root, "boulder.json"), fs)) return true;
		if (isNonEmptyFile(join(cwd, root, "start-work", "ledger.jsonl"), fs)) return true;
		const ulwLoopRoot = join(cwd, root, "ulw-loop");
		const runDirectories = fs.readdirSync?.(ulwLoopRoot) ?? nodeReaddirSync(ulwLoopRoot);
		return runDirectories.some((runDirectory) => isNonEmptyFile(join(ulwLoopRoot, runDirectory, "goals.json"), fs));
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

function isPathInsideDirectory(filePath: string, directoryPath: string): boolean {
	const relativePath = relative(directoryPath, filePath);
	return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function isNonEmptyFileInsideEvidenceRoot(
	filePath: string,
	evidenceRoot: string,
	cwd: string,
	fs: HookFileSystem,
): boolean {
	if (!fs.existsSync(filePath)) return false;
	const initial = fs.statSync(filePath);
	return isNonEmptyWorkspaceRegularFileInsideDirectory(cwd, filePath, evidenceRoot, MAX_RECEIPT_BYTES, initial);
}

function isNonEmptyFile(filePath: string, fs: HookFileSystem): boolean {
	if (!fs.existsSync(filePath)) return false;
	const linkStat = fs.lstatSync?.(filePath) ?? nodeLstatSync(filePath);
	if (linkStat.isSymbolicLink?.() === true) return false;
	const stat = fs.statSync(filePath);
	if (stat.size <= 0 || (stat.nlink !== undefined && stat.nlink !== 1)) return false;
	return stat.isFile?.() ?? true;
}

function extractEvidencePath(message: string | undefined): string | null {
	if (message === undefined) return null;
	const match = /EVIDENCE_RECORDED:\s*(\S+)/.exec(message);
	const receiptPath = match?.[1];
	return receiptPath === undefined ? null : receiptPath;
}

function isSubagentStopInput(value: unknown): value is SubagentStopInput {
	return (
		isRecord(value) &&
		value["hook_event_name"] === SUBAGENT_STOP_EVENT &&
		typeof value["agent_type"] === "string" &&
		typeof value["agent_id"] === "string" &&
		typeof value["session_id"] === "string" &&
		typeof value["cwd"] === "string" &&
		typeof value["transcript_path"] === "string" &&
		typeof value["model"] === "string" &&
		typeof value["permission_mode"] === "string" &&
		typeof value["stop_hook_active"] === "boolean" &&
		optionalString(value["turn_id"]) &&
		optionalString(value["last_assistant_message"])
	);
}

function optionalString(value: unknown): boolean {
	return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
