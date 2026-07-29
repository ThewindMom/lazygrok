// allow: SIZE_OK — the commit transaction must keep validation, descriptor lifetime, accounting, and failure reporting together.
import {
	closeSync,
	constants,
	existsSync,
	lstatSync,
	openSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
	snapshotPath,
	uriToCanonicalWorkspacePath,
} from "./workspace-edit-path.js";
import type {
	ApplyResult,
	ApplyWorkspaceEditOptions,
	PlannedWorkspaceOperation,
	WorkspaceEditCommit,
	WorkspaceEditCommitIo,
	WorkspaceEditPlan,
	WorkspaceMutation,
	WorkspaceMutationDelta,
	WorkspaceSnapshotEntry,
} from "./workspace-edit-types.js";

const DEFAULT_IO: WorkspaceEditCommitIo = {
	writeFile(path, content) {
		const noFollow = constants.O_NOFOLLOW ?? 0;
		const flags = existsSync(path)
			? constants.O_WRONLY | constants.O_TRUNC | noFollow
			: constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;
		const descriptor = openSync(path, flags, 0o666);
		try {
			writeFileSync(descriptor, content, "utf-8");
		} finally {
			closeSync(descriptor);
		}
	},
	rename(oldPath, newPath) {
		renameSync(oldPath, newPath);
	},
	remove(path, recursive) {
		rmSync(path, { recursive, force: false });
	},
};

function snapshotsEqual(
	expected: WorkspaceSnapshotEntry,
	actual: WorkspaceSnapshotEntry,
): boolean {
	if (expected.kind !== actual.kind) return false;
	if (expected.kind === "file" && actual.kind === "file")
		return expected.content === actual.content;
	if (
		expected.kind === "directory" &&
		actual.kind === "directory" &&
		expected.children !== undefined
	) {
		return (
			JSON.stringify(expected.children) === JSON.stringify(actual.children)
		);
	}
	return true;
}

function liveSnapshot(
	path: string,
	expected: WorkspaceSnapshotEntry,
): WorkspaceSnapshotEntry {
	return snapshotPath(
		path,
		expected.kind === "directory" && expected.children !== undefined,
	);
}

function firstOperationIndex(plan: WorkspaceEditPlan): number {
	return plan.operations[0]?.changeIndex ?? 0;
}

interface CommitFailure {
	readonly message: string;
	readonly changeIndex: number;
	readonly mutations?: readonly WorkspaceMutation[];
	readonly filesModified?: readonly string[];
	readonly totalEdits?: number;
	readonly lateAbort?: boolean;
}

function failedCommit(
	plan: WorkspaceEditPlan,
	failure: CommitFailure,
): WorkspaceEditCommit {
	const {
		message,
		changeIndex,
		mutations = [],
		filesModified = [],
		totalEdits = 0,
		lateAbort = false,
	} = failure;
	return {
		result: {
			success: false,
			filesModified,
			totalEdits,
			errors: [`change ${changeIndex}: ${message}`],
			failedChange: changeIndex,
			...(lateAbort ? { lateAbort: true } : {}),
		},
		delta: mutationDelta(mutations),
		fingerprint: plan.fingerprint,
	};
}

function verifySnapshots(plan: WorkspaceEditPlan): WorkspaceEditCommit | null {
	for (const [path, expected] of plan.snapshots) {
		let actual: WorkspaceSnapshotEntry;
		try {
			actual = liveSnapshot(path, expected);
		} catch (error) {
			const changeIndex =
				plan.firstChangeByPath.get(path) ?? firstOperationIndex(plan);
			const detail = error instanceof Error ? error.message : String(error);
			return failedCommit(plan, {
				message: `cannot verify snapshot for ${path}: ${detail}`,
				changeIndex,
			});
		}
		if (!snapshotsEqual(expected, actual)) {
			const changeIndex =
				plan.firstChangeByPath.get(path) ?? firstOperationIndex(plan);
			return failedCommit(plan, {
				message: `workspace state changed before commit: ${path}`,
				changeIndex,
			});
		}
	}
	return null;
}

function addModifiedPath(paths: string[], path: string): void {
	if (!paths.includes(path)) paths.push(path);
}

function reportedPath(plan: WorkspaceEditPlan, path: string): string {
	return plan.reportedPathByCanonical.get(path) ?? path;
}

function changedPathsForMutation(
	mutation: WorkspaceMutation,
): readonly string[] {
	return mutation.kind === "rename"
		? [mutation.oldPath, mutation.newPath]
		: [mutation.path];
}

function mutationDelta(
	operations: readonly WorkspaceMutation[],
): WorkspaceMutationDelta {
	const changedPaths = new Set<string>();
	for (const operation of operations) {
		for (const path of changedPathsForMutation(operation))
			changedPaths.add(path);
	}
	return { operations, changedPaths: [...changedPaths].sort() };
}

function resolveIo(
	overrides: Partial<WorkspaceEditCommitIo> | undefined,
): WorkspaceEditCommitIo {
	return {
		writeFile: overrides?.writeFile ?? DEFAULT_IO.writeFile,
		rename: overrides?.rename ?? DEFAULT_IO.rename,
		remove: overrides?.remove ?? DEFAULT_IO.remove,
	};
}

interface CommitAccumulator {
	readonly mutations: WorkspaceMutation[];
	readonly filesModified: string[];
	totalEdits: number;
}

interface CommitContext {
	readonly plan: WorkspaceEditPlan;
	readonly io: WorkspaceEditCommitIo;
	readonly accumulator: CommitAccumulator;
}

function commitOperation(
	context: CommitContext,
	operation: PlannedWorkspaceOperation,
): void {
	const { plan, io, accumulator } = context;
	if (operation.kind === "noop") return;
	if (operation.kind === "text") {
		withBoundCommitPath(plan, operation.path, (path) =>
			io.writeFile(path, operation.afterText),
		);
		accumulator.mutations.push({
			kind: "text",
			path: operation.path,
			beforeText: operation.beforeText,
			afterText: operation.afterText,
		});
		addModifiedPath(
			accumulator.filesModified,
			reportedPath(plan, operation.path),
		);
		accumulator.totalEdits += operation.editCount;
		return;
	}
	if (operation.kind === "create") {
		withBoundCommitPath(plan, operation.path, (path) => io.writeFile(path, ""));
		accumulator.mutations.push({
			kind: "create",
			path: operation.path,
			replaced: operation.replaced,
		});
		addModifiedPath(
			accumulator.filesModified,
			reportedPath(plan, operation.path),
		);
		return;
	}
	if (operation.kind === "rename") {
		withBoundCommitPath(plan, operation.oldPath, (oldPath) =>
			withBoundCommitPath(plan, operation.newPath, (newPath) => {
				if (operation.replaceDestination) {
					const targetKind =
						existsSync(newPath) && lstatSync(newPath).isDirectory()
							? "directory"
							: "file";
					io.remove(newPath, targetKind === "directory");
					accumulator.mutations.push({
						kind: "delete",
						path: operation.newPath,
						targetKind,
					});
					addModifiedPath(
						accumulator.filesModified,
						reportedPath(plan, operation.newPath),
					);
				}
				io.rename(oldPath, newPath);
			}),
		);
		accumulator.mutations.push({
			kind: "rename",
			oldPath: operation.oldPath,
			newPath: operation.newPath,
			sourceKind: operation.sourceKind,
		});
		addModifiedPath(
			accumulator.filesModified,
			reportedPath(plan, operation.newPath),
		);
		return;
	}
	withBoundCommitPath(plan, operation.path, (path) =>
		io.remove(path, operation.recursive),
	);
	accumulator.mutations.push({
		kind: "delete",
		path: operation.path,
		targetKind: operation.targetKind,
	});
	addModifiedPath(
		accumulator.filesModified,
		reportedPath(plan, operation.path),
	);
}

function withBoundCommitPath<T>(
	plan: WorkspaceEditPlan,
	path: string,
	mutate: (path: string) => T,
): T {
	const resolved = uriToCanonicalWorkspacePath(
		pathToFileURL(path).href,
		plan.workspaceRoot,
	);
	if (
		!resolved.success ||
		resolved.followedSymbolicLink ||
		resolved.path !== path
	) {
		const detail = resolved.success
			? `path identity changed before commit: ${path}`
			: resolved.error;
		throw new Error(detail);
	}
	if (process.platform !== "linux") {
		throw new Error(
			"workspace mutation requires Linux descriptor anchoring",
		);
	}
	const parent = dirname(path);
	const descriptor = openSync(
		parent,
		constants.O_RDONLY |
			(constants.O_DIRECTORY ?? 0) |
			(constants.O_NOFOLLOW ?? 0),
	);
	try {
		const descriptorParent = `/proc/self/fd/${descriptor}`;
		if (realpathSync(descriptorParent) !== parent) {
			throw new Error(`parent identity changed before commit: ${parent}`);
		}
		return mutate(join(descriptorParent, basename(path)));
	} finally {
		closeSync(descriptor);
	}
}

export function commitWorkspaceEditPlan(
	plan: WorkspaceEditPlan,
	options: Pick<ApplyWorkspaceEditOptions, "signal" | "io"> = {},
): WorkspaceEditCommit {
	if (options.signal?.aborted) {
		return failedCommit(plan, {
			message: "cancelled before commit",
			changeIndex: firstOperationIndex(plan),
		});
	}
	const stale = verifySnapshots(plan);
	if (stale) return stale;
	if (options.signal?.aborted) {
		return failedCommit(plan, {
			message: "cancelled before commit",
			changeIndex: firstOperationIndex(plan),
		});
	}

	const io = resolveIo(options.io);
	const accumulator: CommitAccumulator = {
		mutations: [],
		filesModified: [],
		totalEdits: 0,
	};
	const context: CommitContext = { plan, io, accumulator };
	let lateAbort = false;
	for (const operation of plan.operations) {
		try {
			commitOperation(context, operation);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			return failedCommit(plan, {
				message: `I/O failure during ${operation.kind}: ${detail}`,
				changeIndex: operation.changeIndex,
				mutations: accumulator.mutations,
				filesModified: accumulator.filesModified,
				totalEdits: accumulator.totalEdits,
				lateAbort: lateAbort || options.signal?.aborted === true,
			});
		}
		if (options.signal?.aborted) lateAbort = true;
	}

	const result: ApplyResult = {
		success: true,
		filesModified: accumulator.filesModified,
		totalEdits: accumulator.totalEdits,
		errors: [],
		...(lateAbort ? { lateAbort: true } : {}),
	};
	return {
		result,
		delta: mutationDelta(accumulator.mutations),
		fingerprint: plan.fingerprint,
	};
}
