#!/usr/bin/env node
// lazygrok-shim.mjs — Grok → OmO/Codex hook bridge.
//
// Official Grok Build envelope (xai-org/grok-build HookEventEnvelope):
//   camelCase common fields + flattened event payload on stdin:
//   {
//     "hookEventName": "user_prompt_submit",   // snake_case value
//     "sessionId": "...",
//     "cwd": "...",
//     "workspaceRoot": "...",
//     "timestamp": "...",
//     "permissionMode": "default",
//     "prompt": "user text"                   // UserPromptSubmit payload
//   }
// Env (always set by runner): GROK_HOOK_EVENT, GROK_HOOK_NAME, GROK_SESSION_ID, GROK_WORKSPACE_ROOT
//
// OmO CLIs expect: hook_event_name: "UserPromptSubmit", prompt: string, ...
//
// Usage: node lazygrok-shim.mjs <component> <hook-event>
// Example: node lazygrok-shim.mjs ultrawork user-prompt-submit

import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "node:process";
import { homedir } from "node:os";
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";

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

/** Map Grok display/snake names → OmO PascalCase. */
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

function asString(value) {
	if (typeof value === "string") return value;
	if (value == null) return "";
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return value.map(asString).filter(Boolean).join("\n");
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

function pick(input, ...keys) {
	for (const k of keys) {
		if (input[k] !== undefined && input[k] !== null && input[k] !== "") {
			return input[k];
		}
	}
	return undefined;
}

/**
 * Recover user prompt when stdin lacks it (observed live: {"event":"user_prompt_submit"} only).
 * Prefer prompt_history.jsonl (written at submit with session_id + prompt), then chat_history.
 */
function recoverPromptFromSession(sessionId, workspaceRoot) {
	try {
		const sessionsRoot = join(homedir(), ".grok", "sessions");
		const encoded = workspaceRoot ? encodeURIComponent(workspaceRoot) : "";
		const candidates = [];
		if (encoded) {
			candidates.push(join(sessionsRoot, encoded, "prompt_history.jsonl"));
			if (sessionId) candidates.push(join(sessionsRoot, encoded, sessionId, "chat_history.jsonl"));
		}
		// Any workspace prompt_history under sessions/
		if (existsSync(sessionsRoot)) {
			for (const d of readdirSync(sessionsRoot)) {
				candidates.push(join(sessionsRoot, d, "prompt_history.jsonl"));
				if (sessionId) candidates.push(join(sessionsRoot, d, sessionId, "chat_history.jsonl"));
			}
		}

		// 1) prompt_history: {session_id, prompt, timestamp}
		for (const p of candidates) {
			if (!p.endsWith("prompt_history.jsonl") || !existsSync(p)) continue;
			const fromHist = extractFromPromptHistory(p, sessionId);
			if (fromHist) return fromHist;
		}
		// 2) chat_history last <user_query>
		for (const p of candidates) {
			if (!p.endsWith("chat_history.jsonl") || !existsSync(p)) continue;
			const fromChat = extractLastUserQuery(p);
			if (fromChat) return fromChat;
		}
		return "";
	} catch {
		return "";
	}
}

function extractFromPromptHistory(path, sessionId) {
	const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
	// Prefer match on sessionId; else last non-bash prompt
	let last = "";
	for (let i = lines.length - 1; i >= 0; i--) {
		try {
			const o = JSON.parse(lines[i]);
			const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
			if (!prompt || o.is_bash) continue;
			if (sessionId && o.session_id === sessionId) return prompt;
			if (!last) last = prompt;
		} catch {
			// continue
		}
	}
	return last;
}

function extractLastUserQuery(historyPath) {
	const lines = readFileSync(historyPath, "utf8").split(/\r?\n/).filter(Boolean);
	for (let i = lines.length - 1; i >= 0; i--) {
		try {
			const o = JSON.parse(lines[i]);
			const type = o.type || o.role;
			let text = "";
			const c = o.content;
			if (typeof c === "string") text = c;
			else if (Array.isArray(c)) {
				text = c
					.map((p) => (typeof p === "string" ? p : p?.text || p?.content || ""))
					.join("\n");
			}
			if (!text) continue;
			// Prefer explicit user_query blocks
			const m = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i);
			if (m) return m[1].trim();
			if (type === "user" && !text.includes("<system-reminder>") && text.trim()) {
				return text.trim();
			}
		} catch {
			// continue
		}
	}
	return "";
}

function extractPrompt(input, raw) {
	// Official grok-build fields first
	const direct = asString(
		pick(
			input,
			"prompt",
			"userPrompt",
			"user_prompt",
			"message",
			"content",
			"text",
			"query",
			"userMessage",
			"user_message",
		),
	);
	if (direct.trim()) return direct;

	for (const bagKey of ["input", "payload", "data", "hook_input", "hookInput"]) {
		const bag = input[bagKey];
		if (bag && typeof bag === "object") {
			const nested = asString(
				pick(bag, "prompt", "userPrompt", "user_prompt", "message", "content", "text"),
			);
			if (nested.trim()) return nested;
		}
	}

	const sessionId =
		asString(pick(input, "sessionId", "session_id", "sessionID")) || env.GROK_SESSION_ID || "";
	const workspace =
		asString(pick(input, "workspaceRoot", "workspace_root", "cwd", "workspace")) ||
		env.GROK_WORKSPACE_ROOT ||
		env.CLAUDE_PROJECT_DIR ||
		process.cwd();
	const recovered = recoverPromptFromSession(sessionId, workspace);
	if (recovered.trim()) return recovered;

	if (typeof raw === "string" && /(?:ultrawork|\bulw\b)/i.test(raw)) return raw;
	return "";
}

function maybeDebugDump(payload) {
	try {
		const dir = join(homedir(), ".grok/state/lazygrok");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "last-ups-shim.json"), JSON.stringify(payload, null, 2));
	} catch {
		// ignore
	}
}

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
	const raw = Buffer.concat(chunks).toString("utf8").trim();
	if (!raw) {
		// Stdin empty — try env + session recovery (Grok sets GROK_SESSION_ID / GROK_WORKSPACE_ROOT)
		const sessionId = env.GROK_SESSION_ID || "";
		const workspace = env.GROK_WORKSPACE_ROOT || env.CLAUDE_PROJECT_DIR || process.cwd();
		const recovered = recoverPromptFromSession(sessionId, workspace);
		if (!recovered || !/(?:ultrawork|\bulw\b)/i.test(recovered)) {
			process.exit(0);
		}
		const fabricated = {
			hookEventName: env.GROK_HOOK_EVENT || "user_prompt_submit",
			sessionId,
			cwd: workspace,
			workspaceRoot: workspace,
			prompt: recovered,
		};
		processEnvelope(fabricated, JSON.stringify(fabricated));
		return;
	}

	let input;
	try {
		input = JSON.parse(raw);
	} catch {
		process.stdout.write(raw);
		process.exit(0);
	}
	processEnvelope(input, raw);
});

function processEnvelope(input, raw) {
	// Official: hookEventName; legacy tests/docs: event / hook_event_name
	const rawEvent =
		pick(input, "hookEventName", "hook_event_name", "event") ||
		env.GROK_HOOK_EVENT ||
		"";
	const grokEvent = EVENT_ALIASES[rawEvent] || rawEvent;

	const sessionId =
		asString(pick(input, "sessionId", "session_id", "sessionID")) || env.GROK_SESSION_ID || "";
	const workspace =
		asString(pick(input, "workspaceRoot", "workspace_root", "cwd", "workspace")) ||
		env.GROK_WORKSPACE_ROOT ||
		env.CLAUDE_PROJECT_DIR ||
		process.cwd();
	const prompt = extractPrompt(input, raw);
	const toolName = asString(pick(input, "toolName", "tool_name", "tool"));
	const toolInput = pick(input, "toolInput", "tool_input", "arguments", "input") || {};
	const toolUseId = asString(pick(input, "toolUseId", "tool_use_id", "toolCallId"));
	const stopHookActive = Boolean(pick(input, "stopHookActive", "stop_hook_active"));
	const subagentId = asString(pick(input, "subagentId", "subagent_id"));

	const codexEvent = {
		hook_event_name: grokEvent,
		session_id: sessionId,
		turn_id: sessionId,
		transcript_path: pick(input, "transcriptPath", "transcript_path") ?? null,
		cwd: asString(pick(input, "cwd")) || workspace,
		model: asString(pick(input, "model")) || "grok-build",
		permission_mode:
			asString(pick(input, "permissionMode", "permission_mode")) || "default",
	};

	if (grokEvent === "UserPromptSubmit") {
		codexEvent.prompt = prompt;
	} else if (grokEvent === "PreToolUse" || grokEvent === "PostToolUse") {
		codexEvent.tool_name = toolName;
		codexEvent.tool_use_id = toolUseId;
		let enriched = { ...(typeof toolInput === "object" && toolInput ? toolInput : {}) };
		const filePath = enriched.file_path || enriched.filePath || enriched.path || "";
		const lower = toolName.toLowerCase();
		if (
			grokEvent === "PostToolUse" &&
			filePath &&
			!enriched.content &&
			["write", "edit", "search_replace", "strreplace", "apply_patch", "multiedit"].includes(
				lower,
			)
		) {
			try {
				enriched.content = readFileSync(resolve(workspace, filePath), "utf8");
			} catch {
				// skip
			}
		}
		codexEvent.tool_input = enriched;
	} else if (grokEvent === "Stop") {
		codexEvent.stop_hook_active = stopHookActive;
		const last = asString(pick(input, "lastAssistantMessage", "last_assistant_message"));
		if (last) codexEvent.last_assistant_message = last;
	} else if (grokEvent === "SubagentStop") {
		codexEvent.subagent_id = subagentId;
	} else if (grokEvent === "SessionStart") {
		codexEvent.source = asString(pick(input, "source")) || "startup";
	} else if (grokEvent === "PostCompact") {
		codexEvent.trigger = asString(pick(input, "source", "trigger")) || "auto";
	}

	const childEnv = { ...env };
	if (!childEnv.CODEX_HOME) {
		childEnv.CODEX_HOME = env.HOME ? `${env.HOME}/.codex` : "/tmp/codex-home";
	}

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
		if (componentName === "ultrawork" && grokEvent === "UserPromptSubmit") {
			const ok = stdout.includes("ultrawork-mode") || stdout.includes("ULTRAWORK MODE");
			if (!ok) {
				maybeDebugDump({
					reason: "empty_ultrawork_stdout",
					component: componentName,
					rawEvent,
					grokEvent,
					promptLen: prompt.length,
					promptPreview: prompt.slice(0, 300),
					keys: Object.keys(input || {}),
					envHookEvent: env.GROK_HOOK_EVENT || null,
					envSessionId: env.GROK_SESSION_ID || null,
					exitCode: code,
					stderrPreview: stderr.slice(0, 500),
					codexEvent,
					rawPreview: String(raw).slice(0, 3000),
				});
			}
		}
		process.exit(code || 0);
	});
}
