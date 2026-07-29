import { randomUUID } from "node:crypto";
import {
	closeSync,
	constants,
	existsSync,
	fchmodSync,
	fstatSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	realpathSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { open } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { readBoundedDescriptorText } from "./bounded-read.js";
import { UlwLoopError } from "./types.js";

function isInside(root: string, candidate: string): boolean {
	const pathFromRoot = relative(root, candidate);
	return (
		pathFromRoot === "" ||
		(pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
	);
}

export function safeWorkspacePath(repoRoot: string, candidate: string): string {
	const lexicalRoot = resolve(repoRoot);
	const lexicalCandidate = resolve(candidate);
	if (!isInside(lexicalRoot, lexicalCandidate)) {
		throw new UlwLoopError("ULW state path escapes the workspace.", "ULW_LOOP_UNSAFE_PATH");
	}
	const canonicalRoot = realpathSync(lexicalRoot);
	const canonicalCandidate = resolve(canonicalRoot, relative(lexicalRoot, lexicalCandidate));
	let current = canonicalRoot;
	for (const component of relative(canonicalRoot, canonicalCandidate)
		.split(/[\\/]+/u)
		.filter(Boolean)) {
		current = join(current, component);
		if (!existsSync(current)) break;
		if (lstatSync(current).isSymbolicLink()) {
			throw new UlwLoopError("ULW state paths may not contain symlinks.", "ULW_LOOP_UNSAFE_PATH");
		}
		if (!isInside(canonicalRoot, realpathSync(current))) {
			throw new UlwLoopError("ULW state path escapes the workspace.", "ULW_LOOP_UNSAFE_PATH");
		}
	}
	return canonicalCandidate;
}

export function safeReadWorkspaceTextFile(repoRoot: string, candidate: string, maxBytes = 10 * 1024 * 1024): string {
	const fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, candidate, maxBytes);
	try {
		return readBoundedDescriptorText(fileDescriptor, maxBytes);
	} finally {
		closeSync(fileDescriptor);
	}
}

export function readBoundedRegularTextFile(candidate: string, maxBytes: number): string {
	requireDescriptorAnchoring();
	const parentDescriptor = openSync(
		dirname(candidate),
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
	);
	const procParent = `/proc/self/fd/${parentDescriptor}`;
	let fileDescriptor: number;
	try {
		fileDescriptor = openSync(
			existsSync(procParent) ? join(procParent, basename(candidate)) : candidate,
			constants.O_RDONLY | constants.O_NOFOLLOW,
		);
	} finally {
		closeSync(parentDescriptor);
	}
	try {
		const file = fstatSync(fileDescriptor);
		if (!file.isFile() || file.nlink !== 1 || file.size > maxBytes) {
			throw new UlwLoopError("ULW input is not a bounded regular file.", "ULW_LOOP_UNSAFE_PATH");
		}
		return readBoundedDescriptorText(fileDescriptor, maxBytes);
	} finally {
		closeSync(fileDescriptor);
	}
}

function assertOpenDescriptorInsideWorkspace(
	repoRoot: string,
	fileDescriptor: number,
	expectedKind: "file" | "directory" = "file",
): void {
	const canonicalRoot = realpathSync(repoRoot);
	const procPath = `/proc/self/fd/${fileDescriptor}`;
	if (existsSync(procPath)) {
		const openedPath = realpathSync(procPath);
		if (!isInside(canonicalRoot, openedPath)) {
			throw new UlwLoopError("ULW state file changed identity during write.", "ULW_LOOP_UNSAFE_PATH");
		}
	}
	const opened = fstatSync(fileDescriptor);
	if ((expectedKind === "file" && !opened.isFile()) || (expectedKind === "directory" && !opened.isDirectory())) {
		throw new UlwLoopError("ULW state output is not a regular file.", "ULW_LOOP_UNSAFE_PATH");
	}
	if (expectedKind === "file" && opened.nlink !== 1) {
		throw new UlwLoopError("ULW state files may not be hard linked.", "ULW_LOOP_UNSAFE_PATH");
	}
}

function ensureWorkspaceDirectory(repoRoot: string, directory: string): void {
	requireDescriptorAnchoring();
	const canonicalRoot = realpathSync(resolve(repoRoot));
	const safeDirectory = safeWorkspacePath(repoRoot, directory);
	const components = relative(canonicalRoot, safeDirectory)
		.split(/[\\/]+/u)
		.filter(Boolean);
	let currentDescriptor = openSync(canonicalRoot, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
	try {
		assertOpenDescriptorInsideWorkspace(repoRoot, currentDescriptor, "directory");
		let fallbackPath = canonicalRoot;
		for (const component of components) {
			const procParent = `/proc/self/fd/${currentDescriptor}`;
			const entryPath = existsSync(procParent) ? join(procParent, component) : join(fallbackPath, component);
			try {
				mkdirSync(entryPath, { mode: 0o700 });
			} catch (error) {
				if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
			}
			const childDescriptor = openSync(entryPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
			try {
				assertOpenDescriptorInsideWorkspace(repoRoot, childDescriptor, "directory");
				fchmodSync(childDescriptor, 0o700);
			} catch (error) {
				closeSync(childDescriptor);
				throw error;
			}
			closeSync(currentDescriptor);
			currentDescriptor = childDescriptor;
			fallbackPath = join(fallbackPath, component);
		}
	} finally {
		closeSync(currentDescriptor);
	}
}

function openAnchoredParent(
	repoRoot: string,
	safePath: string,
): { readonly fileDescriptor: number; readonly path: string } {
	requireDescriptorAnchoring();
	const safeParent = safeWorkspacePath(repoRoot, dirname(safePath));
	const fileDescriptor = openSync(safeParent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
	try {
		assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor, "directory");
		const procPath = `/proc/self/fd/${fileDescriptor}`;
		return {
			fileDescriptor,
			path: existsSync(procPath) ? join(procPath, basename(safePath)) : safePath,
		};
	} catch (error) {
		closeSync(fileDescriptor);
		throw error;
	}
}

function requireDescriptorAnchoring(): void {
	if (process.platform !== "linux") {
		throw new UlwLoopError(
			"ULW state and evidence operations require Linux descriptor anchoring.",
			"ULW_LOOP_UNSAFE_PATH",
		);
	}
}

export function safeOpenWorkspaceReadFile(repoRoot: string, candidate: string, maxBytes: number): number {
	const safePath = safeWorkspacePath(repoRoot, candidate);
	const parent = openAnchoredParent(repoRoot, safePath);
	let fileDescriptor: number;
	try {
		fileDescriptor = openSync(parent.path, constants.O_RDONLY | constants.O_NOFOLLOW);
	} finally {
		closeSync(parent.fileDescriptor);
	}
	try {
		assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor);
		const file = fstatSync(fileDescriptor);
		if (file.size > maxBytes) {
			throw new UlwLoopError("ULW state input is not a bounded regular file.", "ULW_LOOP_UNSAFE_PATH");
		}
		return fileDescriptor;
	} catch (error) {
		closeSync(fileDescriptor);
		throw error;
	}
}

export function assertSafeEvidenceArtifact(
	repoRoot: string,
	candidate: string,
	attemptRoot: string | undefined,
	maxBytes: number,
): void {
	const safePath = safeWorkspacePath(repoRoot, candidate);
	const safeAttemptRoot = attemptRoot === undefined ? undefined : safeWorkspacePath(repoRoot, attemptRoot);
	if (safeAttemptRoot !== undefined && (!isInside(safeAttemptRoot, safePath) || safeAttemptRoot === safePath)) {
		throw new UlwLoopError("ULW evidence artifact is outside the current attempt.", "ULW_LOOP_UNSAFE_PATH");
	}
	const fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, safePath, maxBytes);
	try {
		const file = fstatSync(fileDescriptor);
		if (file.size <= 0) {
			throw new UlwLoopError("ULW evidence artifact is empty.", "ULW_LOOP_UNSAFE_PATH");
		}
		if (safeAttemptRoot !== undefined) {
			const procPath = `/proc/self/fd/${fileDescriptor}`;
			if (existsSync(procPath) && !isInside(realpathSync(safeAttemptRoot), realpathSync(procPath))) {
				throw new UlwLoopError("ULW evidence artifact changed identity.", "ULW_LOOP_UNSAFE_PATH");
			}
		}
	} finally {
		closeSync(fileDescriptor);
	}
}

export function safeWriteWorkspaceTextFileSync(repoRoot: string, candidate: string, data: string): void {
	const safePath = safeWorkspacePath(repoRoot, candidate);
	const safeParent = safeWorkspacePath(repoRoot, dirname(safePath));
	if (!existsSync(safeParent)) {
		throw new UlwLoopError("ULW state output directory is missing.", "ULW_LOOP_UNSAFE_PATH");
	}
	const parent = openAnchoredParent(repoRoot, safePath);
	const temporaryName = `.${basename(safePath)}.${randomUUID()}.tmp`;
	const temporaryPath = join(`/proc/self/fd/${parent.fileDescriptor}`, temporaryName);
	let fileDescriptor: number | undefined;
	try {
		fileDescriptor = openSync(
			temporaryPath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600,
		);
		assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor);
		fchmodSync(fileDescriptor, 0o600);
		writeFileSync(fileDescriptor, data, "utf8");
		fsyncSync(fileDescriptor);
		closeSync(fileDescriptor);
		fileDescriptor = undefined;
		renameSync(temporaryPath, parent.path);
		fsyncSync(parent.fileDescriptor);
	} catch (error) {
		if (fileDescriptor !== undefined) closeSync(fileDescriptor);
		try {
			unlinkSync(temporaryPath);
		} catch (cleanupError) {
			if (!(cleanupError instanceof Error) || !("code" in cleanupError) || cleanupError.code !== "ENOENT") {
				throw cleanupError;
			}
		}
		throw error;
	} finally {
		closeSync(parent.fileDescriptor);
	}
}

export function safeOpenWorkspaceLockFile(repoRoot: string, candidate: string): number {
	const initialPath = safeWorkspacePath(repoRoot, candidate);
	ensureWorkspaceDirectory(repoRoot, dirname(initialPath));
	const safePath = safeWorkspacePath(repoRoot, initialPath);
	const parent = openAnchoredParent(repoRoot, safePath);
	let fileDescriptor: number | undefined;
	try {
		fileDescriptor = openSync(parent.path, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
		const opened = fstatSync(fileDescriptor);
		const current = statSync(parent.path);
		assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor);
		if (opened.dev !== current.dev || opened.ino !== current.ino) {
			throw new UlwLoopError("ULW lock file changed identity during open.", "ULW_LOOP_UNSAFE_PATH");
		}
		fchmodSync(fileDescriptor, 0o600);
		return fileDescriptor;
	} catch (error) {
		if (fileDescriptor !== undefined) closeSync(fileDescriptor);
		throw error;
	} finally {
		closeSync(parent.fileDescriptor);
	}
}

export function safeUnlinkWorkspaceFile(repoRoot: string, candidate: string): void {
	const safePath = safeWorkspacePath(repoRoot, candidate);
	const fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, safePath, 10 * 1024 * 1024);
	const parent = openAnchoredParent(repoRoot, safePath);
	try {
		const opened = fstatSync(fileDescriptor);
		const current = statSync(parent.path);
		if (opened.dev !== current.dev || opened.ino !== current.ino) {
			throw new UlwLoopError("ULW state file changed identity before removal.", "ULW_LOOP_UNSAFE_PATH");
		}
		unlinkSync(parent.path);
		fsyncSync(parent.fileDescriptor);
	} finally {
		closeSync(fileDescriptor);
		closeSync(parent.fileDescriptor);
	}
}

async function openForWrite(path: string, append: boolean) {
	const mode = constants.O_WRONLY | constants.O_NOFOLLOW | (append ? constants.O_APPEND : 0);
	try {
		return await open(path, mode);
	} catch (error) {
		if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
		return open(path, mode | constants.O_CREAT | constants.O_EXCL, 0o600);
	}
}

async function writeWorkspaceTextFile(
	repoRoot: string,
	candidate: string,
	data: string,
	append: boolean,
): Promise<void> {
	const initialPath = safeWorkspacePath(repoRoot, candidate);
	ensureWorkspaceDirectory(repoRoot, dirname(initialPath));
	const safePath = safeWorkspacePath(repoRoot, initialPath);
	const parent = openAnchoredParent(repoRoot, safePath);
	let handle: Awaited<ReturnType<typeof openForWrite>>;
	try {
		handle = await openForWrite(parent.path, append);
	} finally {
		closeSync(parent.fileDescriptor);
	}
	try {
		assertOpenDescriptorInsideWorkspace(repoRoot, handle.fd);
		await handle.chmod(0o600);
		if (!append) await handle.truncate(0);
		await handle.writeFile(data, "utf8");
	} finally {
		await handle.close();
	}
}

export async function safeWriteWorkspaceTextFile(repoRoot: string, candidate: string, data: string): Promise<void> {
	await writeWorkspaceTextFile(repoRoot, candidate, data, false);
}

export async function safeAppendWorkspaceTextFile(repoRoot: string, candidate: string, data: string): Promise<void> {
	await writeWorkspaceTextFile(repoRoot, candidate, data, true);
}

export async function safeAtomicWriteWorkspaceTextFile(
	repoRoot: string,
	candidate: string,
	data: string,
): Promise<void> {
	const initialPath = safeWorkspacePath(repoRoot, candidate);
	ensureWorkspaceDirectory(repoRoot, dirname(initialPath));
	const safePath = safeWorkspacePath(repoRoot, initialPath);
	const parent = openAnchoredParent(repoRoot, safePath);
	const temporaryPath = join(dirname(parent.path), `.${basename(safePath)}.${randomUUID()}.tmp`);
	let temporaryHandle: Awaited<ReturnType<typeof open>> | undefined;
	let failure: unknown = null;
	try {
		try {
			const existing = openSync(parent.path, constants.O_RDONLY | constants.O_NOFOLLOW);
			try {
				assertOpenDescriptorInsideWorkspace(repoRoot, existing);
			} finally {
				closeSync(existing);
			}
		} catch (error) {
			if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
		}
		temporaryHandle = await open(
			temporaryPath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600,
		);
		assertOpenDescriptorInsideWorkspace(repoRoot, temporaryHandle.fd);
		await temporaryHandle.writeFile(data, "utf8");
		await temporaryHandle.sync();
		await temporaryHandle.close();
		temporaryHandle = undefined;
		renameSync(temporaryPath, parent.path);
		fsyncSync(parent.fileDescriptor);
	} catch (error) {
		failure = error;
	}
	if (temporaryHandle !== undefined) {
		try {
			await temporaryHandle.close();
		} catch (error) {
			if (failure === null) failure = error;
		}
	}
	try {
		unlinkSync(temporaryPath);
	} catch (error) {
		if ((!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") && failure === null) {
			failure = error;
		}
	}
	try {
		closeSync(parent.fileDescriptor);
	} catch (error) {
		if (failure === null) failure = error;
	}
	if (failure !== null) throw failure;
}
