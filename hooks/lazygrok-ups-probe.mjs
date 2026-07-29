#!/usr/bin/env node
/**
 * UserPromptSubmit ultrawork shim forwarder.
 *
 * The active hook path intentionally writes no diagnostic payloads. It records
 * only the sanitized workspace/session binding through the descriptor-anchored
 * Go state writer, then forwards the original envelope to the real shim.
 */
import { spawn, spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const realShim = resolve(__dirname, "lazygrok-shim.mjs");
const runHook = resolve(__dirname, "run-hook.sh");
const args = process.argv.slice(2);
const MAX_HOOK_INPUT_BYTES = 10 * 1024 * 1024;

function sessionIdFromInput(raw) {
	try {
		const input = JSON.parse(raw.toString("utf8"));
		return input.sessionId || input.session_id || null;
	} catch {
		return null;
	}
}

function bindGrokSessionScope(stdout, sessionId) {
	if (!sessionId) return stdout;
	try {
		const output = JSON.parse(stdout.toString("utf8"));
		const context = output?.hookSpecificOutput?.additionalContext;
		if (typeof context !== "string") return stdout;
		output.hookSpecificOutput.additionalContext =
			`${context}\n\nExact Grok hook session ID for this turn: "${sessionId}".\n` +
			`Every ulw-loop CLI call in this turn MUST initially include exactly --session-id "${sessionId}". ` +
			"Do not generate, rename, timestamp, or suffix this ID. " +
			"This is conversational hook context, not a shell environment variable. " +
			"Ignore ambient CODEX_SESSION_ID and CODEX_THREAD_ID; they belong to a parent process, not this Grok session.";
		return Buffer.from(JSON.stringify(output));
	} catch {
		return stdout;
	}
}

const chunks = [];
let inputBytes = 0;
let inputTooLarge = false;
process.stdin.on("data", (chunk) => {
	inputBytes += chunk.length;
	if (inputBytes > MAX_HOOK_INPUT_BYTES) {
		inputTooLarge = true;
		return;
	}
	chunks.push(chunk);
});
process.stdin.on("end", () => {
	if (inputTooLarge) {
		process.stderr.write("LazyGrok hook envelope exceeds 10 MiB; ignoring it.\n");
		process.exit(0);
	}
	const raw = Buffer.concat(chunks);
	const grokSessionId = env.GROK_SESSION_ID || sessionIdFromInput(raw);
	if (grokSessionId) {
		const binding = spawnSync("bash", [runHook, "record-session-binding"], {
			input: raw,
			env,
			stdio: ["pipe", "ignore", "pipe"],
			timeout: 3000,
		});
		if (binding.stderr?.length) process.stderr.write(binding.stderr);
	}

	const child = spawn(process.execPath, [realShim, ...args], {
		stdio: ["pipe", "pipe", "pipe"],
		env,
	});

	let stdout = Buffer.alloc(0);
	child.stdout.on("data", (d) => {
		stdout = Buffer.concat([stdout, d]);
	});
	child.stderr.on("data", (d) => {
		process.stderr.write(d);
	});

	child.stdin.write(raw);
	child.stdin.end();

	child.on("exit", (code) => {
		const scopedStdout = bindGrokSessionScope(stdout, grokSessionId);
		process.stdout.write(scopedStdout);
		process.exit(code || 0);
	});
});
