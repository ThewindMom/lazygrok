import { closeSync, constants, existsSync, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

function isInside(root: string, candidate: string): boolean {
	const pathFromRoot = relative(root, candidate);
	return (
		pathFromRoot === "" ||
		(pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
	);
}

export function readBoundedRegularTextFile(path: string, maxBytes: number, workspace?: string): string {
	const parentDescriptor = openSync(dirname(path), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
	const procParent = `/proc/self/fd/${parentDescriptor}`;
	let fileDescriptor: number;
	try {
		fileDescriptor = openSync(
			existsSync(procParent) ? join(procParent, basename(path)) : path,
			constants.O_RDONLY | constants.O_NOFOLLOW,
		);
	} finally {
		closeSync(parentDescriptor);
	}
	try {
		const file = fstatSync(fileDescriptor);
		if (!file.isFile() || file.nlink !== 1 || file.size > maxBytes) {
			throw new Error("start-work input is not a bounded regular file");
		}
		if (workspace !== undefined) {
			const canonicalWorkspace = realpathSync(resolve(workspace));
			const descriptorPath = `/proc/self/fd/${fileDescriptor}`;
			const openedPath = existsSync(descriptorPath) ? realpathSync(descriptorPath) : realpathSync(path);
			if (!isInside(canonicalWorkspace, openedPath)) throw new Error("start-work input escaped the workspace");
		}
		const snapshotBytes = fstatSync(fileDescriptor).size;
		if (!Number.isSafeInteger(snapshotBytes) || snapshotBytes < 0 || snapshotBytes > maxBytes) {
			throw new Error("start-work input is not a bounded regular file");
		}
		const buffer = Buffer.alloc(snapshotBytes);
		let offset = 0;
		while (offset < snapshotBytes) {
			const bytesRead = readSync(fileDescriptor, buffer, offset, snapshotBytes - offset, offset);
			if (bytesRead === 0) break;
			offset += bytesRead;
		}
		return buffer.subarray(0, offset).toString("utf8");
	} finally {
		closeSync(fileDescriptor);
	}
}
