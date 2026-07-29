import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import { safeWorkspacePath } from "./file-safety.js";
import {
	ULW_LOOP_BRIEF,
	ULW_LOOP_DIR,
	ULW_LOOP_GOALS,
	ULW_LOOP_LEDGER,
	ULW_LOOP_LEGACY_DIR,
	UlwLoopError,
} from "./types.js";

export interface UlwLoopScope {
	readonly sessionId?: string | null;
}

const SESSION_ENV_KEYS = ["OMO_ULW_LOOP_SESSION_ID", "GROK_SESSION_ID", "GROK_THREAD_ID"] as const;
const SESSION_BINDING_MAX_AGE_MS = 10 * 60 * 1000;
type EnvMap = Readonly<Record<string, string | undefined>>;

export function normalizeUlwLoopSessionId(sessionId: string | null | undefined): string | null {
	if (
		sessionId === null ||
		sessionId === undefined ||
		sessionId.length === 0 ||
		sessionId.length > 160 ||
		!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(sessionId)
	) {
		return null;
	}
	return sessionId;
}

export function resolveUlwLoopSessionIdFromEnv(env: EnvMap = process.env): string | null {
	for (const key of SESSION_ENV_KEYS) {
		const value = env[key];
		if (value === undefined || value.length === 0) continue;
		const sessionId = normalizeUlwLoopSessionId(value);
		if (sessionId === null) {
			throw new UlwLoopError(`Invalid session ID in ${key}.`, "ULW_LOOP_SESSION_ID_INVALID");
		}
		return sessionId;
	}
	return null;
}

export function resolveUlwLoopSessionIdFromBinding(
	repoRoot: string,
	options: {
		readonly homeDir?: string;
		readonly nowMs?: number;
	} = {},
): string | null {
	const canonicalRoot = realpathSync(repoRoot);
	const workspaceHash = createHash("sha256").update(canonicalRoot).digest("hex");
	const grokHome =
		options.homeDir === undefined
			? (process.env["GROK_HOME"] ?? join(homedir(), ".grok"))
			: join(options.homeDir, ".grok");
	const bindingDir = join(grokHome, "state", "lazygrok", "session-bindings");
	let entries: string[];
	try {
		const directory = lstatSync(bindingDir);
		if (!directory.isDirectory() || directory.isSymbolicLink()) return null;
		entries = readdirSync(bindingDir);
	} catch {
		return null;
	}
	const nowMs = options.nowMs ?? Date.now();
	const sessionIds = new Set<string>();
	for (const name of entries) {
		if (!name.startsWith(`${workspaceHash}-`) || !name.endsWith(".json")) continue;
		const path = join(bindingDir, name);
		try {
			const info = lstatSync(path);
			if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 4096) continue;
			const binding = JSON.parse(readFileSync(path, "utf8")) as {
				readonly workspaceHash?: unknown;
				readonly sessionId?: unknown;
				readonly updatedAt?: unknown;
			};
			if (
				binding.workspaceHash !== workspaceHash ||
				typeof binding.sessionId !== "string" ||
				typeof binding.updatedAt !== "string"
			) {
				continue;
			}
			const sessionId = normalizeUlwLoopSessionId(binding.sessionId);
			const updatedAt = Date.parse(binding.updatedAt);
			if (
				sessionId !== binding.sessionId ||
				!Number.isFinite(updatedAt) ||
				updatedAt > nowMs + 60_000 ||
				nowMs - updatedAt > SESSION_BINDING_MAX_AGE_MS
			) {
				continue;
			}
			sessionIds.add(sessionId);
		} catch {}
	}
	if (sessionIds.size > 1) {
		throw new UlwLoopError(
			"Multiple recent Grok sessions are active for this workspace; use the exact CURRENT_GROK_SESSION_ID from hook context.",
			"ULW_LOOP_SESSION_AMBIGUOUS",
		);
	}
	return sessionIds.values().next().value ?? null;
}

export function ulwLoopRelativeDir(scope?: UlwLoopScope, root = ULW_LOOP_DIR): string {
	const requestedSessionId = scope?.sessionId;
	const sessionId = normalizeUlwLoopSessionId(requestedSessionId);
	if (requestedSessionId !== undefined && requestedSessionId !== null && sessionId === null) {
		throw new UlwLoopError("Invalid session id: expected one safe path segment.", "ULW_LOOP_SESSION_ID_INVALID");
	}
	return sessionId === null ? root : `${root}/${sessionId}`;
}

export function ulwLoopDir(repoRoot: string, scope?: UlwLoopScope): string {
	const canonical = join(repoRoot, ulwLoopRelativeDir(scope));
	const legacy = join(repoRoot, ulwLoopRelativeDir(scope, ULW_LOOP_LEGACY_DIR));
	if (hasSafeGoalsFile(repoRoot, canonical)) return canonical;
	if (hasSafeGoalsFile(repoRoot, legacy)) return legacy;
	return canonical;
}

function hasSafeGoalsFile(repoRoot: string, stateDir: string): boolean {
	const goalsPath = join(stateDir, ULW_LOOP_GOALS);
	if (!existsSync(goalsPath)) return false;
	safeWorkspacePath(repoRoot, goalsPath);
	return true;
}

export function ulwLoopBriefRelativePath(scope?: UlwLoopScope): string {
	return `${ulwLoopRelativeDir(scope)}/${ULW_LOOP_BRIEF}`;
}

export function ulwLoopGoalsRelativePath(scope?: UlwLoopScope): string {
	return `${ulwLoopRelativeDir(scope)}/${ULW_LOOP_GOALS}`;
}

export function ulwLoopLedgerRelativePath(scope?: UlwLoopScope): string {
	return `${ulwLoopRelativeDir(scope)}/${ULW_LOOP_LEDGER}`;
}

export function ulwLoopBriefPath(repoRoot: string, scope?: UlwLoopScope): string {
	return join(ulwLoopDir(repoRoot, scope), ULW_LOOP_BRIEF);
}

export function ulwLoopGoalsPath(repoRoot: string, scope?: UlwLoopScope): string {
	return join(ulwLoopDir(repoRoot, scope), ULW_LOOP_GOALS);
}

export function ulwLoopLedgerPath(repoRoot: string, scope?: UlwLoopScope): string {
	return join(ulwLoopDir(repoRoot, scope), ULW_LOOP_LEDGER);
}

export function repoRelative(absolutePath: string, repoRoot: string): string {
	const slashPrefix = `${repoRoot}/`;
	const backslashPrefix = `${repoRoot}\\`;
	if (absolutePath.startsWith(slashPrefix)) return absolutePath.slice(slashPrefix.length).split("\\").join("/");
	if (absolutePath.startsWith(backslashPrefix))
		return absolutePath.slice(backslashPrefix.length).split("\\").join("/");
	return absolutePath.split("\\").join("/");
}

export function ulwLoopEvidenceRoot(repoRoot: string, scope?: UlwLoopScope): ".lazygrok/evidence" | ".omo/evidence" {
	const stateDir = repoRelative(ulwLoopDir(repoRoot, scope), repoRoot);
	return stateDir.startsWith(".omo/") ? ".omo/evidence" : ".lazygrok/evidence";
}

// Both the status --json emitter and the checkpoint enforcement resolve the attempt dir through
// this function; a second resolution path would let the gate reject its own advertised directory.
export function ulwLoopAttemptEvidenceDir(
	repoRoot: string,
	goalId: string,
	attempt: number,
	scope?: UlwLoopScope,
): string {
	assertSafeUlwLoopPathSegment(goalId, "goal id");
	if (!Number.isSafeInteger(attempt) || attempt < 0) {
		throw new UlwLoopError("Invalid ULW goal attempt.", "ULW_LOOP_UNSAFE_PATH");
	}
	const requestedSessionId = scope?.sessionId;
	const scopedSessionId = normalizeUlwLoopSessionId(requestedSessionId);
	if (requestedSessionId !== undefined && requestedSessionId !== null && scopedSessionId === null) {
		throw new UlwLoopError("Invalid session id: expected one safe path segment.", "ULW_LOOP_SESSION_ID_INVALID");
	}
	const sessionId = scopedSessionId ?? resolveUlwLoopSessionIdFromEnv() ?? "session";
	const evidenceRoot = ulwLoopEvidenceRoot(repoRoot, scope);
	return `${evidenceRoot}/ulw/${sessionId}/${goalId}/a${attempt}`;
}

export function assertSafeUlwLoopPathSegment(value: string, label: string): void {
	if (
		value.length === 0 ||
		value.length > 160 ||
		value === "." ||
		value === ".." ||
		!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
	) {
		throw new UlwLoopError(`Invalid ${label}: expected one safe path segment.`, "ULW_LOOP_UNSAFE_PATH");
	}
}

interface AttemptPathApi {
	relative(from: string, to: string): string;
	isAbsolute(path: string): boolean;
	readonly sep: string;
}

const PLATFORM_PATH_API: AttemptPathApi = { relative, isAbsolute, sep };

export function isWithinAttemptDir(
	absolutePath: string,
	attemptRoot: string,
	pathApi: AttemptPathApi = PLATFORM_PATH_API,
): boolean {
	const relativePath = pathApi.relative(attemptRoot, absolutePath);
	if (relativePath === "") return true;
	if (relativePath === ".." || relativePath.startsWith(`..${pathApi.sep}`)) return false;
	return !pathApi.isAbsolute(relativePath);
}
