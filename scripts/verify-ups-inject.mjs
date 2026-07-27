#!/usr/bin/env node
/**
 * Offline proof for hard ULW inject (UserPromptSubmit → ultrawork additionalContext).
 *
 * Does NOT use ~/.grok/logs/hooks.log (stale / not authoritative).
 * Exit 0 only when all cases PASS.
 */
import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, appendFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN = resolve(__dirname, "..");
const SHIM = join(PLUGIN, "hooks/lazygrok-shim.mjs");
const PROBE = join(PLUGIN, "hooks/lazygrok-ups-probe.mjs");

function runHook(script, stdinObj, envExtra = {}) {
	return new Promise((resolveP) => {
		const child = spawn(process.execPath, [script, "ultrawork", "user-prompt-submit"], {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				GROK_PLUGIN_ROOT: PLUGIN,
				GROK_HOOK_EVENT: "user_prompt_submit",
				GROK_HOOK_NAME: "test/verify-ups-inject",
				GROK_WORKSPACE_ROOT: process.env.GROK_WORKSPACE_ROOT || join(homedir(), ".grok"),
				...envExtra,
			},
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => (stdout += d));
		child.stderr.on("data", (d) => (stderr += d));
		child.stdin.write(JSON.stringify(stdinObj));
		child.stdin.end();
		child.on("exit", (code) => {
			resolveP({
				code: code || 0,
				stdout,
				stderr,
				injectOk:
					stdout.includes("ultrawork-mode") || stdout.includes("ULTRAWORK MODE"),
				stdoutBytes: Buffer.byteLength(stdout),
			});
		});
	});
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

async function caseFullEnvelope() {
	const r = await runHook(SHIM, {
		hookEventName: "user_prompt_submit",
		sessionId: "verify-full-envelope",
		cwd: join(homedir(), ".grok"),
		workspaceRoot: join(homedir(), ".grok"),
		timestamp: new Date().toISOString(),
		prompt: "ulw offline full-envelope inject proof",
	});
	assert(r.injectOk, `full_envelope: expected inject, got ${r.stdoutBytes} bytes`);
	assert(r.stdoutBytes >= 500, `full_envelope: stdout too small (${r.stdoutBytes})`);
	return { name: "full_envelope", ...r };
}

async function caseEventOnlyWithHistory() {
	const sid = `verify-event-only-${Date.now()}`;
	const ws = join(homedir(), ".grok");
	const histDir = join(homedir(), ".grok/sessions", encodeURIComponent(ws));
	mkdirSync(histDir, { recursive: true });
	const hist = join(histDir, "prompt_history.jsonl");
	appendFileSync(
		hist,
		JSON.stringify({
			timestamp: new Date().toISOString(),
			session_id: sid,
			prompt: "ulw event-only recovery proof",
			is_bash: false,
		}) + "\n",
	);
	const r = await runHook(
		SHIM,
		{ event: "user_prompt_submit" },
		{ GROK_SESSION_ID: sid, GROK_WORKSPACE_ROOT: ws },
	);
	assert(r.injectOk, `event_only+history: expected inject, got ${r.stdoutBytes} bytes`);
	return { name: "event_only_history", ...r };
}

async function caseRaceDelayedHistory() {
	const sid = `verify-race-${Date.now()}`;
	const ws = join(homedir(), ".grok");
	const histDir = join(homedir(), ".grok/sessions", encodeURIComponent(ws));
	mkdirSync(histDir, { recursive: true });
	const hist = join(histDir, "prompt_history.jsonl");
	// Start hook first; write history after 80ms (within retry budget)
	const runP = runHook(
		SHIM,
		{ event: "user_prompt_submit" },
		{ GROK_SESSION_ID: sid, GROK_WORKSPACE_ROOT: ws },
	);
	await delay(80);
	appendFileSync(
		hist,
		JSON.stringify({
			timestamp: new Date().toISOString(),
			session_id: sid,
			prompt: "ulw race delayed history proof",
			is_bash: false,
		}) + "\n",
	);
	const r = await runP;
	assert(r.injectOk, `race_delayed_history: expected inject after retry, got ${r.stdoutBytes}`);
	return { name: "race_delayed_history", ...r };
}

async function caseNonUlwEmpty() {
	const r = await runHook(SHIM, {
		hookEventName: "user_prompt_submit",
		sessionId: "verify-non-ulw",
		cwd: join(homedir(), ".grok"),
		workspaceRoot: join(homedir(), ".grok"),
		prompt: "hello plain prompt without keyword",
	});
	assert(!r.injectOk, "non_ulw: must not inject");
	assert(r.stdoutBytes === 0, `non_ulw: expected empty stdout, got ${r.stdoutBytes}`);
	return { name: "non_ulw_empty", ...r };
}

async function caseProbeWritesArtifact() {
	const before = join(homedir(), ".grok/state/lazygrok/ups-probe-latest.json");
	const stamp = Date.now();
	const r = await runHook(PROBE, {
		hookEventName: "user_prompt_submit",
		sessionId: `verify-probe-${stamp}`,
		cwd: join(homedir(), ".grok"),
		workspaceRoot: join(homedir(), ".grok"),
		timestamp: new Date().toISOString(),
		prompt: "ulw probe artifact proof",
	});
	assert(r.injectOk, "probe: expected inject via forwarder");
	assert(existsSync(before), "probe: ups-probe-latest.json missing");
	const j = JSON.parse(readFileSync(before, "utf8"));
	assert(j.classification?.shape === "full_envelope", `probe shape=${j.classification?.shape}`);
	assert(j.injectOk === true, "probe record injectOk false");
	assert(j.stdoutBytes >= 500, "probe stdoutBytes too small");
	return { name: "probe_artifact", stdoutBytes: r.stdoutBytes, injectOk: r.injectOk, shape: j.classification.shape };
}

async function main() {
	const results = [];
	const cases = [
		caseFullEnvelope,
		caseEventOnlyWithHistory,
		caseRaceDelayedHistory,
		caseNonUlwEmpty,
		caseProbeWritesArtifact,
	];
	for (const fn of cases) {
		try {
			const r = await fn();
			results.push({ ok: true, ...r });
			console.log(`PASS ${r.name} stdout=${r.stdoutBytes} inject=${r.injectOk}`);
		} catch (e) {
			results.push({ ok: false, name: fn.name, error: String(e?.message || e) });
			console.error(`FAIL ${fn.name}: ${e?.message || e}`);
		}
	}
	const failed = results.filter((r) => !r.ok);
	const outDir = join(homedir(), ".grok/state/lazygrok");
	mkdirSync(outDir, { recursive: true });
	writeFileSync(
		join(outDir, "verify-ups-inject-latest.json"),
		JSON.stringify({ at: new Date().toISOString(), results, failed: failed.length }, null, 2),
	);
	if (failed.length) {
		console.error(`\n${failed.length} failed`);
		process.exit(1);
	}
	console.log(`\nALL PASS (${results.length})`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
