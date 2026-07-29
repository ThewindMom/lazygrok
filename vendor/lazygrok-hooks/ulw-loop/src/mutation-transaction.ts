import { join } from "node:path";

import {
	safeAppendWorkspaceTextFile,
	safeAtomicWriteWorkspaceTextFile,
	safeReadWorkspaceTextFile,
	safeUnlinkWorkspaceFile,
} from "./file-safety.js";
import type { UlwLoopScope } from "./paths.js";
import { ulwLoopDir, ulwLoopLedgerPath } from "./paths.js";
import type { UlwLoopLedgerEntry, UlwLoopPlan } from "./types.js";
import { UlwLoopError } from "./types.js";

const MAX_LEDGER_BYTES = 64 * 1024 * 1024;
const MAX_MUTATION_JOURNAL_BYTES = 20 * 1024 * 1024;

type MutationJournal = {
	readonly version: 1;
	readonly ledgerOffset: number;
	readonly ledgerData: string;
	readonly plan: UlwLoopPlan;
};

type PlanWriter = (repoRoot: string, plan: UlwLoopPlan, scope?: UlwLoopScope) => Promise<void>;

function hasCode(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMutationJournal(value: unknown): value is MutationJournal {
	if (!isObject(value) || value["version"] !== 1) return false;
	if (typeof value["ledgerOffset"] !== "number" || typeof value["ledgerData"] !== "string") return false;
	const plan = value["plan"];
	return isObject(plan) && plan["version"] === 1 && Array.isArray(plan["goals"]);
}

function journalPath(repoRoot: string, scope?: UlwLoopScope): string {
	return join(ulwLoopDir(repoRoot, scope), ".mutation-journal.json");
}

function readLedger(repoRoot: string, scope?: UlwLoopScope): string {
	try {
		return safeReadWorkspaceTextFile(repoRoot, ulwLoopLedgerPath(repoRoot, scope), MAX_LEDGER_BYTES);
	} catch (error) {
		if (hasCode(error, "ENOENT")) return "";
		throw error;
	}
}

async function finish(
	repoRoot: string,
	journal: MutationJournal,
	writePlan: PlanWriter,
	scope?: UlwLoopScope,
): Promise<void> {
	const currentLedger = Buffer.from(readLedger(repoRoot, scope), "utf8");
	const expected = Buffer.from(journal.ledgerData, "utf8");
	if (currentLedger.length < journal.ledgerOffset) {
		throw new UlwLoopError("ULW ledger is shorter than its pending transaction.", "ULW_LOOP_TRANSACTION_CONFLICT");
	}
	const tail = currentLedger.subarray(journal.ledgerOffset);
	if (tail.length === 0) {
		await safeAppendWorkspaceTextFile(repoRoot, ulwLoopLedgerPath(repoRoot, scope), journal.ledgerData);
	} else if (tail.length !== expected.length || !tail.equals(expected)) {
		throw new UlwLoopError("ULW ledger diverged from its pending transaction.", "ULW_LOOP_TRANSACTION_CONFLICT");
	}
	await writePlan(repoRoot, journal.plan, scope);
	safeUnlinkWorkspaceFile(repoRoot, journalPath(repoRoot, scope));
}

export async function recoverPlanMutation(
	repoRoot: string,
	writePlan: PlanWriter,
	scope?: UlwLoopScope,
): Promise<void> {
	const path = journalPath(repoRoot, scope);
	let raw: string;
	try {
		raw = safeReadWorkspaceTextFile(repoRoot, path, MAX_MUTATION_JOURNAL_BYTES);
	} catch (error) {
		if (hasCode(error, "ENOENT")) return;
		throw error;
	}
	const parsed: unknown = JSON.parse(raw);
	if (!isMutationJournal(parsed)) {
		throw new UlwLoopError("Invalid ULW mutation journal.", "ULW_LOOP_TRANSACTION_INVALID");
	}
	await finish(repoRoot, parsed, writePlan, scope);
}

export async function commitPlanMutation(
	repoRoot: string,
	plan: UlwLoopPlan,
	entries: readonly UlwLoopLedgerEntry[],
	writePlan: PlanWriter,
	scope?: UlwLoopScope,
): Promise<void> {
	if (entries.length === 0) {
		throw new UlwLoopError("Plan mutations require an audit entry.", "ULW_LOOP_TRANSACTION_AUDIT_REQUIRED");
	}
	const journal: MutationJournal = {
		version: 1,
		ledgerOffset: Buffer.byteLength(readLedger(repoRoot, scope), "utf8"),
		ledgerData: `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
		plan,
	};
	await safeAtomicWriteWorkspaceTextFile(repoRoot, journalPath(repoRoot, scope), `${JSON.stringify(journal)}\n`);
	await finish(repoRoot, journal, writePlan, scope);
}
