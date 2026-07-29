import { closeSync, fstatSync, readSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import { safeOpenWorkspaceReadFile, safeReadWorkspaceTextFile, safeWriteWorkspaceTextFileSync } from "./file-safety.js";
import { withInterprocessLockSync } from "./interprocess-lock.js";
import { assertSafeUlwLoopPathSegment } from "./paths.js";

const RESUME_CAP = 2;
const MAX_RESUME_LEDGER_BYTES = 64 * 1024 * 1024;

export function consumeResumeBudget(repoRoot: string, stateDir: string, goalId: string): boolean {
	try {
		assertSafeUlwLoopPathSegment(goalId, "goal id");
	} catch {
		return false;
	}
	const counterPath = resolve(stateDir, `auto-resume-${goalId}.json`);
	const stuckPath = resolve(stateDir, `auto-resume-${goalId}.stuck`);
	const lockPath = resolve(stateDir, `auto-resume-${goalId}.lock`);
	if (!isInsideDir(stateDir, counterPath) || !isInsideDir(stateDir, stuckPath) || !isInsideDir(stateDir, lockPath))
		return false;
	try {
		return withInterprocessLockSync(repoRoot, lockPath, () => {
			const ledgerLineCount = countLedgerLines(repoRoot, join(stateDir, "ledger.jsonl"));
			if (ledgerLineCount === null) return false;
			const previous = readCounter(repoRoot, counterPath);
			const count = previous !== null && previous.ledgerLineCount === ledgerLineCount ? previous.count : 0;
			if (count >= RESUME_CAP) {
				safeWriteWorkspaceTextFileSync(repoRoot, stuckPath, `no ledger progress after ${count} resumes\n`);
				return false;
			}
			safeWriteWorkspaceTextFileSync(repoRoot, counterPath, JSON.stringify({ count: count + 1, ledgerLineCount }));
			return true;
		});
	} catch (error) {
		if (error instanceof Error) return false;
		throw error;
	}
}

function isInsideDir(dir: string, candidate: string): boolean {
	return candidate.startsWith(resolve(dir) + sep);
}

function countLedgerLines(repoRoot: string, ledgerPath: string): number | null {
	let fileDescriptor: number | null = null;
	try {
		fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, ledgerPath, MAX_RESUME_LEDGER_BYTES);
		const fileSize = fstatSync(fileDescriptor).size;
		const buffer = Buffer.allocUnsafe(64 * 1024);
		let offset = 0;
		let lineCount = 0;
		let lastByte = -1;
		while (offset < fileSize) {
			const requested = Math.min(buffer.length, fileSize - offset);
			const bytesRead = readSync(fileDescriptor, buffer, 0, requested, offset);
			if (bytesRead <= 0) return null;
			for (let index = 0; index < bytesRead; index += 1) {
				if (buffer[index] === 0x0a) lineCount += 1;
			}
			lastByte = buffer[bytesRead - 1] ?? lastByte;
			offset += bytesRead;
		}
		return fileSize > 0 && lastByte !== 0x0a ? lineCount + 1 : lineCount;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return 0;
		if (error instanceof Error) return null;
		throw error;
	} finally {
		if (fileDescriptor !== null) closeSync(fileDescriptor);
	}
}

function readCounter(repoRoot: string, counterPath: string): { count: number; ledgerLineCount: number } | null {
	try {
		const parsed = JSON.parse(safeReadWorkspaceTextFile(repoRoot, counterPath)) as Record<string, unknown>;
		const count = parsed["count"];
		const ledgerLineCount = parsed["ledgerLineCount"];
		if (
			typeof count !== "number" ||
			!Number.isSafeInteger(count) ||
			count < 0 ||
			typeof ledgerLineCount !== "number" ||
			!Number.isSafeInteger(ledgerLineCount) ||
			ledgerLineCount < 0
		) {
			throw new Error("Invalid ULW auto-resume counter.");
		}
		return { count, ledgerLineCount };
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
		throw error;
	}
}
