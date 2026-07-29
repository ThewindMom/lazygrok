#!/usr/bin/env node
import { lstatSync, readFileSync, statSync } from "node:fs";
import { stdin as processStdin, stdout as processStdout } from "node:process";

import { runStopHook } from "./codex-hook.js";
import { readBoundedRegularTextFile } from "./file-safety.js";
import type { ReadonlyFileSystem } from "./types.js";

const MAX_HOOK_INPUT_BYTES = 10 * 1024 * 1024;

const nodeFileSystem: ReadonlyFileSystem = {
	lstatSync,
	readBoundedRegularTextFile,
	readFileSync(path, encoding) {
		return readFileSync(path, encoding);
	},
	statSync,
};

const command = process.argv[2];
const subcommand = process.argv[3];

if (command === "hook" && (subcommand === "stop" || subcommand === "subagent-stop")) {
	await runHookCli();
} else {
	process.stderr.write("Usage: omo-start-work-continuation hook <stop|subagent-stop>\n");
	process.exitCode = 1;
}

async function runHookCli(): Promise<void> {
	const raw = await readStdin();
	if (raw.trim().length === 0) return;
	const parsed = parseHookInput(raw);
	const output = runStopHook(parsed, nodeFileSystem);
	if (output.length > 0) processStdout.write(output);
}

function parseHookInput(raw: string): unknown | undefined {
	try {
		const parsed: unknown = JSON.parse(raw);
		return parsed;
	} catch (error) {
		if (error instanceof SyntaxError) return undefined;
		throw error;
	}
}

function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		let totalBytes = 0;
		let tooLarge = false;
		processStdin.setEncoding("utf8");
		processStdin.on("data", (chunk: string) => {
			totalBytes += Buffer.byteLength(chunk, "utf8");
			if (totalBytes > MAX_HOOK_INPUT_BYTES) {
				tooLarge = true;
				data = "";
				return;
			}
			if (!tooLarge) data += chunk;
		});
		processStdin.once("error", () => resolve(tooLarge ? "" : data));
		processStdin.once("end", () => resolve(tooLarge ? "" : data));
	});
}
