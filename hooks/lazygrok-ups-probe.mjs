#!/usr/bin/env node
/**
 * Permanent UserPromptSubmit probe + ultrawork shim forwarder.
 *
 * Always records the live host contract for measurement (never trust ~/.grok/logs/hooks.log):
 *   ~/.grok/state/lazygrok/ups-probe-latest.json
 *   ~/.grok/state/lazygrok/ups-probe.log
 *
 * Classifies stdin shape (full_envelope | event_only | empty | other), captures env,
 * runs the real ultrawork shim, and records stdout bytes / inject markers.
 *
 * Usage (hooks.json):
 *   node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-ups-probe.mjs" ultrawork user-prompt-submit
 */
import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "node:process";
import { homedir } from "node:os";
import {
	writeFileSync,
	mkdirSync,
	appendFileSync,
	existsSync,
	readFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const realShim = resolve(__dirname, "lazygrok-shim.mjs");
const installUserHooks = resolve(__dirname, "../scripts/install-user-hooks.mjs");
const args = process.argv.slice(2);

/**
 * Keep ~/.grok/hooks/lazygrok.json on dynamic v2 so `grok plugin update`
 * does not require a manual re-install. Best-effort; never block inject.
 */
function ensureUserHooksBridge() {
	try {
		const out = join(homedir(), ".grok/hooks/lazygrok.json");
		const runner = join(homedir(), ".grok/hooks/lazygrok-run.sh");
		let needs = !existsSync(out) || !existsSync(runner);
		if (!needs) {
			const raw = JSON.parse(readFileSync(out, "utf8"));
			const meta = raw._lazygrokUserHooks;
			// v4+ = full plugin hooks mirror + dynamic plugin root
			needs =
				!meta?.dynamicPluginRoot ||
				!meta?.fullMirror ||
				(meta.version ?? 0) < 4;
		}
		if (!needs || !existsSync(installUserHooks)) return;
		spawnSync(process.execPath, [installUserHooks], {
			stdio: "ignore",
			timeout: 3000,
		});
	} catch {
		// ignore
	}
}

ensureUserHooksBridge();

function classifyStdin(raw) {
	const text = raw.toString("utf8");
	const trimmed = text.trim();
	if (!trimmed) return { shape: "empty", keys: [], hasPrompt: false, hasSessionId: false };
	try {
		const o = JSON.parse(trimmed);
		const keys = Object.keys(o || {});
		const hasPrompt = typeof o.prompt === "string" && o.prompt.length > 0;
		const hasSessionId = Boolean(o.sessionId || o.session_id);
		const hasHookEventName = Boolean(o.hookEventName || o.hook_event_name);
		if (hasHookEventName && (hasPrompt || hasSessionId)) {
			return { shape: "full_envelope", keys, hasPrompt, hasSessionId };
		}
		if (keys.length === 1 && (keys[0] === "event" || keys[0] === "hookEventName")) {
			return { shape: "event_only", keys, hasPrompt, hasSessionId };
		}
		if (!hasPrompt && !hasSessionId) {
			return { shape: "minimal", keys, hasPrompt, hasSessionId };
		}
		return { shape: "other", keys, hasPrompt, hasSessionId };
	} catch {
		return { shape: "non_json", keys: [], hasPrompt: false, hasSessionId: false };
	}
}

function writeProbe(record) {
	const dir = join(homedir(), ".grok/state/lazygrok");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "ups-probe-latest.json"), JSON.stringify(record, null, 2));
	appendFileSync(
		join(dir, "ups-probe.log"),
		`${record.at} shape=${record.classification.shape} stdin=${record.stdinBytes} stdout=${record.stdoutBytes} inject=${record.injectOk} session=${record.env.GROK_SESSION_ID || ""}\n`,
	);
	// Keep legacy name for prior smoke checklists
	writeFileSync(
		join(dir, "ups-stdin-latest.json"),
		JSON.stringify(
			{
				at: record.at,
				args: record.args,
				env: record.env,
				stdinBytes: record.stdinBytes,
				stdinUtf8: record.stdinUtf8,
				classification: record.classification,
				stdoutBytes: record.stdoutBytes,
				injectOk: record.injectOk,
			},
			null,
			2,
		),
	);
}

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
	const raw = Buffer.concat(chunks);
	const classification = classifyStdin(raw);
	const at = new Date().toISOString();
	const base = {
		at,
		args,
		env: {
			GROK_HOOK_EVENT: env.GROK_HOOK_EVENT || null,
			GROK_HOOK_NAME: env.GROK_HOOK_NAME || null,
			GROK_SESSION_ID: env.GROK_SESSION_ID || null,
			GROK_WORKSPACE_ROOT: env.GROK_WORKSPACE_ROOT || null,
			GROK_PLUGIN_ROOT: env.GROK_PLUGIN_ROOT || null,
		},
		stdinBytes: raw.length,
		stdinUtf8: raw.toString("utf8").slice(0, 8000),
		classification,
	};

	const child = spawn(process.execPath, [realShim, ...args], {
		stdio: ["pipe", "pipe", "pipe"],
		env,
	});

	let stdout = Buffer.alloc(0);
	let stderr = Buffer.alloc(0);
	child.stdout.on("data", (d) => {
		stdout = Buffer.concat([stdout, d]);
		process.stdout.write(d);
	});
	child.stderr.on("data", (d) => {
		stderr = Buffer.concat([stderr, d]);
		process.stderr.write(d);
	});

	child.stdin.write(raw);
	child.stdin.end();

	child.on("exit", (code) => {
		const outText = stdout.toString("utf8");
		const injectOk =
			outText.includes("ultrawork-mode") || outText.includes("ULTRAWORK MODE");
		try {
			writeProbe({
				...base,
				stdoutBytes: stdout.length,
				stderrBytes: stderr.length,
				injectOk,
				exitCode: code || 0,
				stdoutPreview: outText.slice(0, 400),
			});
		} catch {
			// never block inject path
		}
		process.exit(code || 0);
	});
});
