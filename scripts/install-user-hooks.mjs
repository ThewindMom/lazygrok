#!/usr/bin/env node
/**
 * Install LazyGrok UPS/Stop hooks into ~/.grok/hooks/lazygrok.json so file
 * discovery loads them at session spawn (before the first UserPromptSubmit).
 *
 * Root cause (Grok 0.2.112): plugins discover with has_hooks=true, but session
 * spawn only loads settings/file hooks first. Plugin hooks are merged later via
 * reload — often after the first -p / headless prompt. Soft skill path still
 * works; hard inject does not until this bridge is installed.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const USER_HOOKS_DIR = join(homedir(), ".grok", "hooks");
const OUT = join(USER_HOOKS_DIR, "lazygrok.json");

function shQuote(s) {
	return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function cmd(inner) {
	return `env GROK_PLUGIN_ROOT=${shQuote(PLUGIN_ROOT)} ${inner}`;
}

const probe = join(PLUGIN_ROOT, "hooks/lazygrok-ups-probe.mjs");
const shim = join(PLUGIN_ROOT, "hooks/lazygrok-shim.mjs");
const runHook = join(PLUGIN_ROOT, "hooks/run-hook.sh");

const payload = {
	hooks: {
		UserPromptSubmit: [
			{
				hooks: [
					{
						type: "command",
						command: cmd(`bash ${shQuote(runHook)} user-prompt`),
						timeout: 20,
					},
				],
			},
			{
				hooks: [
					{
						type: "command",
						command: cmd(
							`node ${shQuote(probe)} ultrawork user-prompt-submit`,
						),
						timeout: 8,
						statusMessage: "(OmO) Checking Ultrawork Trigger",
					},
				],
			},
			{
				hooks: [
					{
						type: "command",
						command: cmd(
							`node ${shQuote(shim)} ulw-loop user-prompt-submit`,
						),
						timeout: 10,
						statusMessage: "(OmO) Checking Ulw-Loop Steering",
					},
				],
			},
			{
				hooks: [
					{
						type: "command",
						command: cmd(`node ${shQuote(shim)} rules user-prompt-submit`),
						timeout: 10,
						statusMessage: "(OmO) Loading Project Rules",
					},
				],
			},
		],
		Stop: [
			{
				hooks: [
					{
						type: "command",
						command: cmd(`bash ${shQuote(runHook)} stop`),
						timeout: 20,
					},
				],
			},
			{
				hooks: [
					{
						type: "command",
						command: cmd(`node ${shQuote(shim)} ulw-loop stop`),
						timeout: 15,
						statusMessage: "(OmO) Ulw-Loop Continuation",
					},
				],
			},
		],
	},
};

mkdirSync(USER_HOOKS_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
console.log(`PLUGIN_ROOT=${PLUGIN_ROOT}`);
console.log(`UserPromptSubmit groups: ${payload.hooks.UserPromptSubmit.length}`);
