import { fstatSync, readSync } from "node:fs";

import { UlwLoopError } from "./types.js";

export function readBoundedDescriptorText(fileDescriptor: number, maxBytes: number): string {
	const snapshotBytes = fstatSync(fileDescriptor).size;
	if (!Number.isSafeInteger(snapshotBytes) || snapshotBytes < 0 || snapshotBytes > maxBytes) {
		throw new UlwLoopError("ULW input is not a bounded regular file.", "ULW_LOOP_UNSAFE_PATH");
	}
	const buffer = Buffer.alloc(snapshotBytes);
	let offset = 0;
	while (offset < snapshotBytes) {
		const bytesRead = readSync(fileDescriptor, buffer, offset, snapshotBytes - offset, offset);
		if (bytesRead === 0) break;
		offset += bytesRead;
	}
	return buffer.subarray(0, offset).toString("utf8");
}
