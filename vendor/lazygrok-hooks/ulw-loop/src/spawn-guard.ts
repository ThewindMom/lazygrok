import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { PreToolUsePayload } from "./codex-hook.js";
import { parsePreToolUsePayload } from "./codex-hook.js";
import { safeReadWorkspaceTextFile, safeWorkspacePath, safeWriteWorkspaceTextFileSync } from "./file-safety.js";
import { isFinalRunCompletionCandidate } from "./goal-status.js";
import { withInterprocessLockSync } from "./interprocess-lock.js";
import { ulwLoopAttemptEvidenceDir, ulwLoopDir, ulwLoopEvidenceRoot } from "./paths.js";
import type { UlwLoopPlan } from "./types.js";

// spawn_agent = v1; collaborationspawn_agent = the delimiter-free flattened v2
// hook token from codex-rs hook_names.rs; collaboration.spawn_agent = the
// dotted token observed live in the task-1 probe (hook-tool-tokens.txt).
const SPAWN_TOOL_TOKENS = new Set([
	"spawn_subagent",
	"spawn_agent",
	"collaborationspawn_agent",
	"collaboration.spawn_agent",
	"task",
]);
const DEFAULT_FANOUT_LIMIT = 60;
const MAX_HOOK_INPUT_BYTES = 10 * 1024 * 1024;
const GATE_MESSAGE_PATTERN = /lazycodex-gate-reviewer|final gate review/i;

export function applySpawnGuards(payload: PreToolUsePayload): string {
	if (payload.hook_event_name !== "PreToolUse" || !SPAWN_TOOL_TOKENS.has(payload.tool_name)) return "";
	let stateDir: string;
	try {
		stateDir = ulwLoopDir(payload.cwd, { sessionId: payload.session_id });
	} catch (error) {
		if (error instanceof Error) return deny("unsafe ulw-loop state path");
		throw error;
	}
	const plan = readPlan(payload.cwd, join(stateDir, "goals.json"));
	if (plan === null) return "";
	const missingArtifact = missingGateArtifact(payload, plan);
	if (missingArtifact !== null)
		return deny(`spawn code-review + QA first; gate audits their artifacts: missing ${missingArtifact}`);
	const fanOutDenial = consumeFanOutBudget(payload.cwd, stateDir);
	if (fanOutDenial !== null) return deny(fanOutDenial);
	return "";
}

export async function runSpawnGuardCli(stdin: NodeJS.ReadableStream, stdout: NodeJS.WritableStream): Promise<void> {
	let payload: PreToolUsePayload | null;
	try {
		const chunks: Buffer[] = [];
		let totalBytes = 0;
		let oversized = false;
		for await (const chunk of stdin) {
			const bytes = Buffer.from(chunk);
			totalBytes += bytes.length;
			if (totalBytes > MAX_HOOK_INPUT_BYTES) {
				oversized = true;
				continue;
			}
			if (!oversized) chunks.push(bytes);
		}
		if (oversized) {
			stdout.write(deny("ulw-loop spawn guard denied oversized hook input"));
			return;
		}
		payload = parsePreToolUsePayload(Buffer.concat(chunks).toString("utf8"));
	} catch (error) {
		if (error instanceof Error) {
			stdout.write(deny("ulw-loop spawn guard denied invalid hook input"));
			return;
		}
		throw error;
	}
	if (payload === null) {
		stdout.write(deny("ulw-loop spawn guard denied invalid hook input"));
		return;
	}
	try {
		const output = applySpawnGuards(payload);
		if (output.length > 0) stdout.write(output);
	} catch (error) {
		if (error instanceof Error) {
			stdout.write(deny("ulw-loop spawn guard denied because budget could not be reserved safely"));
			return;
		}
		throw error;
	}
}

// Per-session spawn counter; depth/lineage tracking is descoped — this is a
// total-volume backstop against fan-out explosions, not a recursion tracker.
function consumeFanOutBudget(repoRoot: string, stateDir: string): string | null {
	return withInterprocessLockSync(repoRoot, join(stateDir, ".spawn-count.lock"), () => {
		const counterPath = join(stateDir, "spawn-count.json");
		const count = readCount(repoRoot, counterPath) + 1;
		const limit = fanOutLimit();
		if (count > limit) {
			return `ulw-loop spawn fan-out cap reached (${count}/${limit}). Consolidate work into the agents already running, or raise OMO_SPAWN_FANOUT_LIMIT if this volume is intentional.`;
		}
		safeWriteWorkspaceTextFileSync(repoRoot, counterPath, JSON.stringify({ count }));
		return null;
	});
}

function missingGateArtifact(payload: PreToolUsePayload, plan: UlwLoopPlan): string | null {
	if (!isGateReviewerSpawn(payload.tool_input)) return null;
	const goal = plan.goals.find((candidate) => isFinalRunCompletionCandidate(plan, candidate));
	if (goal === undefined || goal.status === "complete") return null;
	if (!goal.successCriteria.every((criterion) => criterion.status === "pass")) return null;
	const scope = { sessionId: payload.session_id } as const;
	if (plan.evidenceLayoutVersion === 2) {
		const attemptDir = ulwLoopAttemptEvidenceDir(payload.cwd, goal.id, goal.attempt, scope);
		for (const name of [`${goal.id}-code-review.md`, `${goal.id}-manual-qa.md`]) {
			const relative = `${attemptDir}/${name}`;
			if (!isNonEmptyFile(payload.cwd, join(payload.cwd, relative))) return relative;
		}
		return null;
	}
	const evidenceRoot = ulwLoopEvidenceRoot(payload.cwd, scope);
	const flatReport = `${evidenceRoot}/${goal.id}-code-review.md`;
	if (!isNonEmptyFile(payload.cwd, join(payload.cwd, flatReport))) return flatReport;
	// v1 manual-QA approximation: any other non-empty evidence file counts.
	if (!hasOtherEvidenceFile(payload.cwd, join(payload.cwd, evidenceRoot), `${goal.id}-code-review.md`))
		return `${evidenceRoot}/<any manual-QA artifact besides ${goal.id}-code-review.md>`;
	return null;
}

function isGateReviewerSpawn(toolInput: unknown): boolean {
	if (typeof toolInput !== "object" || toolInput === null) return false;
	const record = toolInput as Record<string, unknown>;
	const agentType = record["agent_type"];
	if (typeof agentType === "string") return agentType === "lazycodex-gate-reviewer";
	const message = record["message"];
	return typeof message === "string" && GATE_MESSAGE_PATTERN.test(message);
}

function deny(reason: string): string {
	return `${JSON.stringify({
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: "deny",
			permissionDecisionReason: reason,
			additionalContext: reason,
		},
	})}\n`;
}

function fanOutLimit(): number {
	const raw = process.env["OMO_SPAWN_FANOUT_LIMIT"];
	if (raw === undefined) return DEFAULT_FANOUT_LIMIT;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FANOUT_LIMIT;
}

function isNonEmptyFile(repoRoot: string, path: string): boolean {
	try {
		return safeReadWorkspaceTextFile(repoRoot, path, 1024 * 1024).length > 0;
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

function hasOtherEvidenceFile(repoRoot: string, evidenceDir: string, excludedName: string): boolean {
	try {
		const safeEvidenceDir = safeWorkspacePath(repoRoot, evidenceDir);
		return readdirSync(safeEvidenceDir).some(
			(name) => name !== excludedName && isNonEmptyFile(repoRoot, join(safeEvidenceDir, name)),
		);
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

function readCount(repoRoot: string, counterPath: string): number {
	try {
		const parsed = JSON.parse(safeReadWorkspaceTextFile(repoRoot, counterPath, 64 * 1024)) as Record<string, unknown>;
		const count = parsed["count"];
		if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
			throw new Error("invalid ulw-loop spawn counter");
		}
		return count;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return 0;
		throw error;
	}
}

function readPlan(repoRoot: string, goalsPath: string): UlwLoopPlan | null {
	try {
		return JSON.parse(safeReadWorkspaceTextFile(repoRoot, goalsPath)) as UlwLoopPlan;
	} catch (error) {
		if (error instanceof Error) return null;
		throw error;
	}
}
