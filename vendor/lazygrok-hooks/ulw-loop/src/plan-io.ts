import { AsyncLocalStorage } from "node:async_hooks";
import { closeSync, createReadStream, fstatSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

import {
	safeAppendWorkspaceTextFile,
	safeAtomicWriteWorkspaceTextFile,
	safeOpenWorkspaceReadFile,
	safeReadWorkspaceTextFile,
} from "./file-safety.js";
import { aggregateCodexObjectiveForScope } from "./goal-status.js";
import { withInterprocessLock } from "./interprocess-lock.js";
import { commitPlanMutation, recoverPlanMutation } from "./mutation-transaction.js";
import {
	assertSafeUlwLoopPathSegment,
	repoRelative,
	type UlwLoopScope,
	ulwLoopDir,
	ulwLoopGoalsPath,
	ulwLoopLedgerPath,
} from "./paths.js";
import type { UlwLoopLedgerEntry, UlwLoopPlan } from "./types.js";
import { iso, ULW_LOOP_DIR, ULW_LOOP_GOALS, ULW_LOOP_LEDGER, ULW_LOOP_LEGACY_DIR, UlwLoopError } from "./types.js";

const LEGACY_OBJECTIVE_PREFIXES = [ULW_LOOP_DIR, ULW_LOOP_LEGACY_DIR].map(
	(dir) => `Complete all ulw-loop stories in ${dir}/${ULW_LOOP_GOALS}: `,
);
const LEGACY_OBJECTIVES = [ULW_LOOP_DIR, ULW_LOOP_LEGACY_DIR].map(
	(dir) =>
		`Complete all ulw-loop stories listed in ${dir}/${ULW_LOOP_GOALS}. Use ${dir}/${ULW_LOOP_LEDGER} as the durable audit trail.`,
);
const locks = new Map<string, Promise<undefined>>();
const heldMutationLocks = new AsyncLocalStorage<ReadonlySet<string>>();
const MAX_LEDGER_BYTES = 64 * 1024 * 1024;
const MAX_LEDGER_LINE_BYTES = 1024 * 1024;
const MAX_STEERING_ENTRIES = 100_000;

function hasCode(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}

function isLegacyEnumeratedAggregateObjective(objective: string | undefined): objective is string {
	return (
		objective !== undefined &&
		(LEGACY_OBJECTIVES.includes(objective) ||
			LEGACY_OBJECTIVE_PREFIXES.some((prefix) => objective.startsWith(prefix)))
	);
}

function isSteeringKind(value: unknown): value is UlwLoopLedgerEntry["kind"] {
	return (
		value === "steering_accepted" ||
		value === "steering_rejected" ||
		value === "criteria_revised" ||
		value === "batch_updated"
	);
}

function mutationLockKey(repoRoot: string, scope?: UlwLoopScope): string {
	return `${repoRoot}\0${repoRelative(ulwLoopDir(repoRoot, scope), repoRoot)}`;
}

export async function withUlwLoopMutationLock<T>(repoRoot: string, fn: () => Promise<T>): Promise<T>;
export async function withUlwLoopMutationLock<T>(
	repoRoot: string,
	scope: UlwLoopScope | undefined,
	fn: () => Promise<T>,
): Promise<T>;
export async function withUlwLoopMutationLock<T>(
	repoRoot: string,
	scopeOrFn: UlwLoopScope | (() => Promise<T>) | undefined,
	maybeFn?: () => Promise<T>,
): Promise<T> {
	const scope = typeof scopeOrFn === "function" ? undefined : scopeOrFn;
	const fn = typeof scopeOrFn === "function" ? scopeOrFn : maybeFn;
	if (fn === undefined) throw new UlwLoopError("Missing ulw-loop mutation body.", "ULW_LOOP_LOCK_BODY_MISSING");
	const lockKey = mutationLockKey(repoRoot, scope);
	const held = heldMutationLocks.getStore();
	if (held?.has(lockKey) === true) return fn();
	const prior = locks.get(lockKey) ?? Promise.resolve(undefined);
	const runLocked = (): Promise<T> =>
		withInterprocessLock(repoRoot, join(ulwLoopDir(repoRoot, scope), ".mutation.lock"), async () => {
			await recoverPlanMutation(repoRoot, writePlan, scope);
			return heldMutationLocks.run(new Set([...(held ?? []), lockKey]), fn);
		});
	const run = prior.then(runLocked, runLocked);
	// The stored gate resolves to undefined so the map never retains fn's result
	// (plans/audits), and it removes itself once no newer waiter replaced it —
	// otherwise a long-lived host leaks one entry per (repo, scope) forever.
	const gate: Promise<undefined> = run.then(
		() => undefined,
		() => undefined,
	);
	locks.set(lockKey, gate);
	void gate.then(() => {
		if (locks.get(lockKey) === gate) locks.delete(lockKey);
	});
	return run;
}

export async function readUlwLoopPlan(repoRoot: string, scope?: UlwLoopScope): Promise<UlwLoopPlan> {
	const path = ulwLoopGoalsPath(repoRoot, scope);
	let raw: string;
	try {
		raw = safeReadWorkspaceTextFile(repoRoot, path);
	} catch (error) {
		if (!hasCode(error, "ENOENT")) throw error;
		throw new UlwLoopError(
			`No ulw-loop plan found at ${repoRelative(path, repoRoot)}. Run \`ulw-loop create-goals ...\` first.`,
			"ULW_LOOP_PLAN_MISSING",
			{ cause: error },
		);
	}
	const parsed: UlwLoopPlan = JSON.parse(raw);
	if (parsed.version !== 1 || !Array.isArray(parsed.goals)) {
		throw new UlwLoopError(`Invalid ulw-loop plan at ${repoRelative(path, repoRoot)}.`, "ULW_LOOP_PLAN_INVALID");
	}
	for (const goal of parsed.goals) assertSafeUlwLoopPathSegment(goal.id, "goal id");
	if (parsed.activeGoalId !== undefined) assertSafeUlwLoopPathSegment(parsed.activeGoalId, "active goal id");
	const previousObjective = parsed.codexObjective;
	if (
		(parsed.codexGoalMode ?? "per_story") === "aggregate" &&
		isLegacyEnumeratedAggregateObjective(previousObjective)
	) {
		if (heldMutationLocks.getStore()?.has(mutationLockKey(repoRoot, scope)) !== true) {
			return withUlwLoopMutationLock(repoRoot, scope, () => readUlwLoopPlan(repoRoot, scope));
		}
		const now = iso();
		parsed.codexObjective = aggregateCodexObjectiveForScope(scope);
		parsed.codexObjectiveAliases = [...new Set([...(parsed.codexObjectiveAliases ?? []), previousObjective])];
		parsed.updatedAt = now;
		await commitPlanAndLedgerEntries(
			repoRoot,
			parsed,
			[
				{
					at: now,
					kind: "aggregate_objective_migrated",
					message: "Migrated legacy enumerated aggregate Codex objective to the stable pointer objective.",
					before: { codexObjective: previousObjective },
					after: { codexObjective: parsed.codexObjective },
				},
			],
			scope,
		);
	}
	return parsed;
}

export async function writePlan(repoRoot: string, plan: UlwLoopPlan, scope?: UlwLoopScope): Promise<void> {
	for (const goal of plan.goals) assertSafeUlwLoopPathSegment(goal.id, "goal id");
	if (plan.activeGoalId !== undefined) assertSafeUlwLoopPathSegment(plan.activeGoalId, "active goal id");
	const path = ulwLoopGoalsPath(repoRoot, scope);
	await safeAtomicWriteWorkspaceTextFile(repoRoot, path, `${JSON.stringify(plan, null, 2)}\n`);
}

export async function appendLedger(repoRoot: string, entry: UlwLoopLedgerEntry, scope?: UlwLoopScope): Promise<void> {
	await appendLedgerEntries(repoRoot, [entry], scope);
}

export async function appendLedgerEntries(
	repoRoot: string,
	entries: readonly UlwLoopLedgerEntry[],
	scope?: UlwLoopScope,
): Promise<void> {
	if (entries.length === 0) return;
	await safeAppendWorkspaceTextFile(
		repoRoot,
		ulwLoopLedgerPath(repoRoot, scope),
		`${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
	);
}

export async function commitPlanAndLedgerEntries(
	repoRoot: string,
	plan: UlwLoopPlan,
	entries: readonly UlwLoopLedgerEntry[],
	scope?: UlwLoopScope,
): Promise<void> {
	if (entries.length === 0) {
		throw new UlwLoopError("Plan mutations require an audit entry.", "ULW_LOOP_TRANSACTION_AUDIT_REQUIRED");
	}
	await commitPlanMutation(repoRoot, plan, entries, writePlan, scope);
}

/**
 * Streams raw ledger lines without materializing the file. Real ledgers reach
 * many MB (legacy entries embedded full-plan snapshots), so `readFile` here
 * ballooned every steer/dedup path; line-at-a-time keeps memory O(longest line).
 */
async function* ledgerLines(repoRoot: string, scope?: UlwLoopScope): AsyncGenerator<string> {
	const ledgerPath = ulwLoopLedgerPath(repoRoot, scope);
	let fileDescriptor: number;
	try {
		fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, ledgerPath, MAX_LEDGER_BYTES);
	} catch (error) {
		if (hasCode(error, "ENOENT")) return;
		throw error;
	}
	const ledgerBytes = fstatSync(fileDescriptor).size;
	if (ledgerBytes === 0) {
		closeSync(fileDescriptor);
		return;
	}
	const stream = createReadStream(ledgerPath, {
		encoding: "utf8",
		fd: fileDescriptor,
		autoClose: true,
		start: 0,
		end: ledgerBytes - 1,
	});
	const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
	try {
		for await (const line of lines) {
			if (Buffer.byteLength(line, "utf8") > MAX_LEDGER_LINE_BYTES) {
				throw new UlwLoopError("ULW ledger line exceeds the bounded input limit.", "ULW_LOOP_LEDGER_TOO_LARGE");
			}
			if (line.trim().length > 0) yield line;
		}
	} finally {
		lines.close();
		stream.destroy();
	}
}

export async function readSteeringLedgerEntries(repoRoot: string, scope?: UlwLoopScope): Promise<UlwLoopLedgerEntry[]> {
	const entries: UlwLoopLedgerEntry[] = [];
	for await (const line of ledgerLines(repoRoot, scope)) {
		const entry: UlwLoopLedgerEntry = JSON.parse(line);
		if (!isSteeringKind(entry.kind)) continue;
		if (entries.length >= MAX_STEERING_ENTRIES) {
			throw new UlwLoopError("ULW steering ledger exceeds the bounded entry limit.", "ULW_LOOP_LEDGER_TOO_LARGE");
		}
		entries.push(entry);
	}
	return entries;
}

/**
 * First accepted steering entry matching an idempotency key/prompt signature.
 * A cheap substring probe on the raw line skips JSON.parse for the vast
 * majority of entries, so dedup stays flat even on legacy multi-MB ledgers.
 */
export async function findAcceptedSteeringLedgerEntry(
	repoRoot: string,
	key: string,
	scope?: UlwLoopScope,
): Promise<UlwLoopLedgerEntry | undefined> {
	const probe = JSON.stringify(key);
	for await (const line of ledgerLines(repoRoot, scope)) {
		if (!line.includes(probe)) continue;
		const entry: UlwLoopLedgerEntry = JSON.parse(line);
		if (!isSteeringKind(entry.kind)) continue;
		if (entry.steering?.invariant.accepted !== true) continue;
		if (
			entry.idempotencyKey === key ||
			entry.steering.idempotencyKey === key ||
			entry.steering.promptSignature === key
		)
			return entry;
	}
	return undefined;
}
