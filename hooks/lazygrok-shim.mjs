#!/usr/bin/env node
// lazygrok-shim.mjs — translates Grok hook events to Codex format for OmO components.
//
// Grok dispatches snake_case lifecycle names (user_prompt_submit) and varies prompt field
// shapes. OmO CLIs expect PascalCase (UserPromptSubmit) + { prompt: string }.
//
// Usage: node lazygrok-shim.mjs <component-name> <hook-event>
// Example: node lazygrok-shim.mjs ultrawork user-prompt-submit

import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "node:process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_ROOT = env.GROK_PLUGIN_ROOT || resolve(__dirname, "..");

const componentName = process.argv[2];
const hookEvent = process.argv[3];

if (!componentName || !hookEvent) {
	process.stderr.write("Usage: lazygrok-shim.mjs <component> <hook-event>\n");
	process.exit(1);
}

const cliPath = resolve(PLUGIN_ROOT, "vendor/lazygrok-hooks", componentName, "dist/cli.js");

const EVENT_ALIASES = {
	user_prompt_submit: "UserPromptSubmit",
	UserPromptSubmit: "UserPromptSubmit",
	beforeSubmitPrompt: "UserPromptSubmit",
	session_start: "SessionStart",
	SessionStart: "SessionStart",
	sessionStart: "SessionStart",
	pre_tool_use: "PreToolUse",
	PreToolUse: "PreToolUse",
	preToolUse: "PreToolUse",
	post_tool_use: "PostToolUse",
	PostToolUse: "PostToolUse",
	postToolUse: "PostToolUse",
	post_tool_use_failure: "PostToolUseFailure",
	PostToolUseFailure: "PostToolUseFailure",
	stop: "Stop",
	Stop: "Stop",
	stop_failure: "StopFailure",
	StopFailure: "StopFailure",
	subagent_start: "SubagentStart",
	SubagentStart: "SubagentStart",
	subagent_stop: "SubagentStop",
	SubagentStop: "SubagentStop",
	pre_compact: "PreCompact",
	PreCompact: "PreCompact",
	post_compact: "PostCompact",
	PostCompact: "PostCompact",
	session_end: "SessionEnd",
	SessionEnd: "SessionEnd",
	notification: "Notification",
	Notification: "Notification",
	permission_denied: "PermissionDenied",
	PermissionDenied: "PermissionDenied",
};

/** Coerce Grok/Cursor prompt-ish values to a single string. */
function asString(value) {
	if (typeof value === "string") return value;
	if (value == null) return "";
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) {
		return value.map(asString).filter(Boolean).join("\n");
	}
	if (typeof value === "object") {
		for (const k of ["text", "content", "prompt", "message", "value", "body"]) {
			if (k in value) {
				const s = asString(value[k]);
				if (s) return s;
			}
		}
	}
	return "";
}

/** Best-effort prompt extraction across Grok payload variants. */
function extractPrompt(input, raw) {
	const direct = asString(
		input.prompt ??
			input.userPrompt ??
			input.user_prompt ??
			input.message ??
			input.content ??
			input.text ??
			input.query ??
			input.user_message ??
			input.userMessage,
	);
	if (direct.trim()) return direct;

	// Nested bags sometimes used by adapters
	for (const bag of [input.input, input.payload, input.data, input.hook_input, input.hookInput]) {
		if (bag && typeof bag === "object") {
			const nested = asString(
				bag.prompt ?? bag.userPrompt ?? bag.user_prompt ?? bag.message ?? bag.content ?? bag.text,
			);
			if (nested.trim()) return nested;
		}
	}

	// Last resort: if raw JSON mentions ulw/ultrawork, pass the whole raw so pattern match still fires
	if (typeof raw === "string" && /(?:ultrawork|\bulw\b)/i.test(raw)) {
		return raw;
	}
	return "";
}

function maybeDebugDump(payload) {
	try {
		const dir = join(env.HOME || "/tmp", ".grok/state/lazygrok");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "last-ups-shim.json"), JSON.stringify(payload, null, 2));
	} catch {
		// ignore
	}
}

// Read all of stdin
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
	const raw = Buffer.concat(chunks).toString("utf8").trim();
	if (!raw) {
		process.exit(0);
	}

	let input;
	try {
		input = JSON.parse(raw);
	} catch {
		process.stdout.write(raw);
		process.exit(0);
	}

	const rawEvent = input.event || input.hookEventName || input.hook_event_name || "";
	const grokEvent = EVENT_ALIASES[rawEvent] || rawEvent;
	const sessionId = input.session_id || input.sessionId || input.sessionID || "";
	const workspace = input.workspace || input.workspaceRoot || input.cwd || process.cwd();
	const prompt = extractPrompt(input, raw);
	const toolName = input.tool || input.toolName || input.tool_name || "";
	const toolInput = input.tool_input || input.toolInput || input.arguments || input.input || {};
	const toolUseId = input.tool_use_id || input.toolUseId || input.toolCallId || "";
	const stopHookActive = input.stop_hook_active || input.stopHookActive || false;
	const subagentId = input.subagent_id || input.subagentId || "";

	const codexEvent = {
		hook_event_name: grokEvent,
		session_id: sessionId,
		turn_id: sessionId,
		transcript_path: input.transcript_path || input.transcriptPath || null,
		cwd: workspace,
		model: input.model || "grok-build",
		permission_mode: input.permission_mode || "default",
	};

	if (grokEvent === "UserPromptSubmit") {
		codexEvent.prompt = prompt;
		if (!prompt.trim()) {
			maybeDebugDump({
				reason: "empty_prompt",
				component: componentName,
				rawEvent,
				grokEvent,
				keys: Object.keys(input),
				rawPreview: raw.slice(0, 2000),
			});
		}
	} else if (grokEvent === "PreToolUse" || grokEvent === "PostToolUse") {
		codexEvent.tool_name = toolName;
		codexEvent.tool_use_id = toolUseId;
		let enrichedToolInput = { ...toolInput };
		const filePath =
			enrichedToolInput.file_path || enrichedToolInput.filePath || enrichedToolInput.path || "";
		const lowerTool = String(toolName).toLowerCase();
		if (
			grokEvent === "PostToolUse" &&
			filePath &&
			!enrichedToolInput.content &&
			(lowerTool === "write" ||
				lowerTool === "edit" ||
				lowerTool === "search_replace" ||
				lowerTool === "strreplace" ||
				lowerTool === "apply_patch" ||
				lowerTool === "multiedit")
		) {
			try {
				const absPath = resolve(workspace, filePath);
				enrichedToolInput.content = readFileSync(absPath, "utf8");
			} catch {
				// skip
			}
		}
		codexEvent.tool_input = enrichedToolInput;
	} else if (grokEvent === "Stop") {
		codexEvent.stop_hook_active = stopHookActive;
	} else if (grokEvent === "SubagentStop") {
		codexEvent.subagent_id = subagentId;
	} else if (grokEvent === "SessionStart") {
		codexEvent.source = input.source || "startup";
	} else if (grokEvent === "PostCompact") {
		codexEvent.trigger = input.trigger || "auto";
	}

	const childEnv = { ...env };
	if (!childEnv.CODEX_HOME) {
		childEnv.CODEX_HOME = env.HOME ? `${env.HOME}/.codex` : "/tmp/codex-home";
	}

	// Pipe child stdio so Grok's stdout capture always sees OmO CLI output
	// (inherit is unreliable under some hook runners).
	const child = spawn("node", [cliPath, "hook", hookEvent], {
		stdio: ["pipe", "pipe", "pipe"],
		env: {
			...childEnv,
			PLUGIN_ROOT: resolve(PLUGIN_ROOT, "vendor/lazygrok-hooks", componentName),
			GROK_PLUGIN_ROOT: PLUGIN_ROOT,
		},
	});

	let stdout = "";
	let stderr = "";
	child.stdout.on("data", (d) => {
		stdout += d;
		process.stdout.write(d);
	});
	child.stderr.on("data", (d) => {
		stderr += d;
		process.stderr.write(d);
	});

	child.stdin.write(JSON.stringify(codexEvent));
	child.stdin.end();

	child.on("exit", (code) => {
		if (
			grokEvent === "UserPromptSubmit" &&
			componentName === "ultrawork" &&
			stdout.trim().length === 0
		) {
			maybeDebugDump({
				reason: "empty_ultrawork_stdout",
				component: componentName,
				rawEvent,
				grokEvent,
				promptLen: prompt.length,
				promptPreview: prompt.slice(0, 200),
				keys: Object.keys(input),
				exitCode: code,
				stderrPreview: stderr.slice(0, 500),
				codexEvent,
				rawPreview: raw.slice(0, 2000),
			});
		}
		process.exit(code || 0);
	});
});
