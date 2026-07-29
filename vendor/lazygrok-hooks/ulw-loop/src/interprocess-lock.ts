import { spawnSync } from "node:child_process";
import { closeSync } from "node:fs";

import { safeOpenWorkspaceLockFile } from "./file-safety.js";
import { UlwLoopError } from "./types.js";

const LOCK_TIMEOUT_MS = 30_000;

function acquireLock(fileDescriptor: number): void {
	const result = spawnSync("flock", ["-x", "3"], {
		stdio: ["ignore", "ignore", "pipe", fileDescriptor],
		timeout: LOCK_TIMEOUT_MS,
		encoding: "utf8",
	});
	if (result.status === 0) return;
	throw new UlwLoopError(
		result.error === undefined
			? `Unable to acquire ULW interprocess lock: ${result.stderr.trim()}`
			: `Unable to acquire ULW interprocess lock: ${result.error.message}`,
		"ULW_LOOP_LOCK_FAILED",
	);
}

export function withInterprocessLockSync<T>(repoRoot: string, lockPath: string, fn: () => T): T {
	const fileDescriptor = safeOpenWorkspaceLockFile(repoRoot, lockPath);
	try {
		acquireLock(fileDescriptor);
		return fn();
	} finally {
		closeSync(fileDescriptor);
	}
}

export async function withInterprocessLock<T>(repoRoot: string, lockPath: string, fn: () => Promise<T>): Promise<T> {
	const fileDescriptor = safeOpenWorkspaceLockFile(repoRoot, lockPath);
	try {
		acquireLock(fileDescriptor);
		return await fn();
	} finally {
		closeSync(fileDescriptor);
	}
}
