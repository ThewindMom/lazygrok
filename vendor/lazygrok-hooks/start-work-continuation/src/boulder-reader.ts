import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { readBoundedRegularTextFile } from "./file-safety.js";
import { getPlanChecklist, type PlanChecklist } from "./plan-checklist.js";

export type { PlanChecklist } from "./plan-checklist.js";
export { getPlanChecklist } from "./plan-checklist.js";

type BoulderWorkStatus = "active" | "paused" | "completed" | "abandoned";

type BoulderWork = {
	readonly activePlan: string;
	readonly planName: string;
	readonly status?: BoulderWorkStatus;
	readonly startedAt?: string;
	readonly updatedAt?: string;
	readonly sessionIds: readonly string[];
	readonly worktreePath?: string;
};

type BoulderState = {
	readonly works: readonly BoulderWork[];
	readonly mirrorWork: BoulderWork | null;
	readonly hasWorksMap: boolean;
};

type ManagedStateRoot = ".lazygrok" | ".omo";

export type ContinuationState = {
	readonly planName: string;
	readonly planPath: string;
	readonly boulderPath: string;
	readonly ledgerPath: string;
	readonly worktreePath: string | null;
	readonly checklist: PlanChecklist;
};

const SESSION_ID_PREFIX_PATTERN = /^(grok|codex|opencode):/;
const MAX_BOULDER_BYTES = 1024 * 1024;

export function readContinuationState(cwd: string, sessionId: string): ContinuationState | null {
	for (const boulderPath of getBoulderFilePaths(cwd)) {
		const continuation = readContinuationStateFromBoulder(cwd, sessionId, boulderPath);
		if (continuation !== null) return continuation;
	}
	return null;
}

function readContinuationStateFromBoulder(
	cwd: string,
	sessionId: string,
	boulderPath: string,
): ContinuationState | null {
	const boulderState = readBoulderState(cwd, boulderPath);
	if (boulderState === null) return null;
	const work = getWorkForSession(boulderState, sessionId);
	if (work === null || !isContinuableStatus(work.status)) return null;
	const stateRoot = getStateRootForBoulder(cwd, boulderPath);
	if (stateRoot === null) return null;

	const resolved = resolveBoulderPathsForWork(cwd, work, stateRoot);
	if (resolved === null) return null;
	const { planPath, worktreePath } = resolved;
	const checklist = getPlanChecklist(planPath, worktreePath ?? cwd);
	if (checklist.total === 0) return null;

	return {
		planName: work.planName,
		planPath,
		boulderPath,
		ledgerPath: join(cwd, stateRoot, "start-work", "ledger.jsonl"),
		worktreePath,
		checklist,
	};
}

function readBoulderState(cwd: string, path: string): BoulderState | null {
	try {
		const parsed: unknown = JSON.parse(readBoundedRegularTextFile(path, MAX_BOULDER_BYTES, cwd));
		return parseBoulderState(parsed);
	} catch (error) {
		if (error instanceof Error) return null;
		throw error;
	}
}

function parseBoulderState(value: unknown): BoulderState | null {
	if (!isRecord(value)) return null;

	const works: BoulderWork[] = [];
	const worksValue = value["works"];
	const hasWorksMap = isRecord(worksValue);
	if (hasWorksMap) {
		for (const workValue of Object.values(worksValue)) {
			const work = parseBoulderWork(workValue);
			if (work !== null) works.push(work);
		}
	}

	const mirrorWork = parseBoulderWork(value);
	if (works.length === 0 && mirrorWork === null) return null;
	return { works, mirrorWork, hasWorksMap };
}

function parseBoulderWork(value: unknown): BoulderWork | null {
	if (!isRecord(value)) return null;

	const activePlan = value["active_plan"];
	const planName = value["plan_name"];
	if (typeof activePlan !== "string") return null;

	const status = parseBoulderWorkStatus(value["status"]);
	const sessionIds = parseSessionIds(value["session_ids"]);
	const worktreePath = value["worktree_path"];
	const startedAt = value["started_at"];
	const updatedAt = value["updated_at"];

	return {
		activePlan,
		planName: typeof planName === "string" ? planName : activePlan,
		sessionIds,
		...(status === undefined ? {} : { status }),
		...(typeof startedAt === "string" ? { startedAt } : {}),
		...(typeof updatedAt === "string" ? { updatedAt } : {}),
		...(typeof worktreePath === "string" ? { worktreePath } : {}),
	};
}

function getWorkForSession(state: BoulderState, sessionId: string): BoulderWork | null {
	let newestWork: BoulderWork | null = null;
	let newestWorkMs = 0;

	for (const work of state.works) {
		if (!work.sessionIds.some((candidate) => sessionMatches(candidate, sessionId))) continue;

		const workMs = parseIsoToMs(work.updatedAt ?? work.startedAt) ?? 0;
		if (newestWork === null || workMs > newestWorkMs) {
			newestWork = work;
			newestWorkMs = workMs;
		}
	}

	if (newestWork !== null) return newestWork;
	if (state.hasWorksMap) return null;
	if (state.mirrorWork?.sessionIds.some((candidate) => sessionMatches(candidate, sessionId)) === true)
		return state.mirrorWork;
	return null;
}

function resolveBoulderPathsForWork(
	cwd: string,
	work: BoulderWork,
	stateRoot: ManagedStateRoot,
): { readonly planPath: string; readonly worktreePath: string | null } | null {
	const absolutePlanPath = resolveTrackedPath(cwd, work.activePlan);
	if (!isAllowedPlanPath(cwd, absolutePlanPath, stateRoot)) return null;
	const worktreePath = work.worktreePath?.trim();
	if (worktreePath === undefined || worktreePath.length === 0)
		return { planPath: absolutePlanPath, worktreePath: null };

	const relativePlanPath = relative(resolve(cwd), absolutePlanPath);
	if (relativePlanPath.length === 0 || relativePlanPath.startsWith("..") || isAbsolute(relativePlanPath)) {
		return { planPath: absolutePlanPath, worktreePath: null };
	}

	const canonicalWorktree = trustedWorktreePath(cwd, resolveTrackedPath(cwd, worktreePath));
	if (canonicalWorktree === null) return { planPath: absolutePlanPath, worktreePath: null };
	const worktreePlanPath = resolve(canonicalWorktree, relativePlanPath);
	return isAllowedPlanPath(canonicalWorktree, worktreePlanPath, stateRoot) && existsSync(worktreePlanPath)
		? { planPath: worktreePlanPath, worktreePath: canonicalWorktree }
		: { planPath: absolutePlanPath, worktreePath: null };
}

function resolveTrackedPath(baseDirectory: string, trackedPath: string): string {
	return isAbsolute(trackedPath) ? resolve(trackedPath) : resolve(baseDirectory, trackedPath);
}

function isAllowedPlanPath(workspace: string, planPath: string, stateRoot: ManagedStateRoot): boolean {
	try {
		const lexicalWorkspace = resolve(workspace);
		const canonicalWorkspace = realpathSync(lexicalWorkspace);
		const canonicalPlan = resolve(canonicalWorkspace, relative(lexicalWorkspace, resolve(planPath)));
		const plansRoot = join(canonicalWorkspace, stateRoot, "plans");
		if (!isInside(plansRoot, canonicalPlan) || !existsSync(canonicalPlan)) return false;

		let current = canonicalWorkspace;
		for (const component of relative(canonicalWorkspace, canonicalPlan)
			.split(/[\\/]+/u)
			.filter(Boolean)) {
			current = join(current, component);
			if (!existsSync(current) || lstatSync(current).isSymbolicLink()) return false;
			if (!isInside(canonicalWorkspace, realpathSync(current))) return false;
		}
		return lstatSync(canonicalPlan).isFile();
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

function trustedWorktreePath(cwd: string, candidate: string): string | null {
	if (!existsSync(candidate) || !lstatSync(candidate).isDirectory()) return null;
	const canonicalCandidate = realpathSync(candidate);
	const cwdCommonDir = gitCommonDirectory(cwd);
	const candidateCommonDir = gitCommonDirectory(canonicalCandidate);
	if (cwdCommonDir === null || candidateCommonDir === null || cwdCommonDir !== candidateCommonDir) return null;
	return canonicalCandidate;
}

function gitCommonDirectory(worktree: string): string | null {
	try {
		const dotGit = join(realpathSync(worktree), ".git");
		if (!existsSync(dotGit)) return null;
		if (lstatSync(dotGit).isDirectory()) return realpathSync(dotGit);
		if (!lstatSync(dotGit).isFile()) return null;
		const match = /^gitdir:\s*(.+)\s*$/u.exec(readFileSync(dotGit, "utf8"));
		const gitDirectory = match?.[1];
		if (gitDirectory === undefined) return null;
		const canonicalGitDirectory = realpathSync(resolve(dirname(dotGit), gitDirectory));
		const commonDirFile = join(canonicalGitDirectory, "commondir");
		return existsSync(commonDirFile)
			? realpathSync(resolve(canonicalGitDirectory, readFileSync(commonDirFile, "utf8").trim()))
			: canonicalGitDirectory;
	} catch (error) {
		if (error instanceof Error) return null;
		throw error;
	}
}

function isInside(root: string, path: string): boolean {
	const relativePath = relative(root, path);
	return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function parseBoulderWorkStatus(value: unknown): BoulderWorkStatus | undefined {
	if (value === "active" || value === "paused" || value === "completed" || value === "abandoned") return value;
	return undefined;
}

function parseSessionIds(value: unknown): readonly string[] {
	if (!Array.isArray(value)) return [];
	const sessionIds: string[] = [];
	for (const item of value) {
		if (typeof item === "string") sessionIds.push(normalizeSessionId(item));
	}
	return sessionIds;
}

function normalizeSessionId(sessionId: string, platform: "grok" | "opencode" = "opencode"): string {
	if (SESSION_ID_PREFIX_PATTERN.test(sessionId)) return sessionId;
	return `${platform}:${sessionId}`;
}

function sessionKey(sessionId: string): string {
	return sessionId.replace(SESSION_ID_PREFIX_PATTERN, "");
}

function sessionMatches(candidate: string, sessionId: string): boolean {
	return sessionKey(candidate) === sessionKey(sessionId);
}

function parseIsoToMs(value: string | undefined): number | null {
	if (value === undefined) return null;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function isContinuableStatus(status: BoulderWorkStatus | undefined): boolean {
	return status === "active" || status === "paused";
}

function getBoulderFilePaths(cwd: string): readonly string[] {
	return [join(cwd, ".lazygrok", "boulder.json"), join(cwd, ".omo", "boulder.json")];
}

function getStateRootForBoulder(cwd: string, boulderPath: string): ManagedStateRoot | null {
	for (const stateRoot of [".lazygrok", ".omo"] as const) {
		if (resolve(boulderPath) === resolve(cwd, stateRoot, "boulder.json")) return stateRoot;
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
