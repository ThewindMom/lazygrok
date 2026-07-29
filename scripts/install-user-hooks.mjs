#!/usr/bin/env node
/**
 * Install full LazyGrok hook bridge under ~/.grok/hooks/ so Grok 0.2.x runs
 * plugin hooks at session spawn (plugin hooks alone often load too late).
 *
 * Writes:
 *   ~/.grok/hooks/lazygrok-run.sh  — resolves installed-plugins/lazygrok-* each run
 *   ~/.grok/hooks/lazygrok.json    — full mirror of plugin hooks/hooks.json commands
 *
 * The bridge resolves the current plugin root dynamically and self-heals when
 * the plugin hook manifest changes after `grok plugin update`.
 */
import {
	writeFileSync,
	mkdirSync,
	chmodSync,
	existsSync,
	readFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const USER_HOOKS_DIR = join(homedir(), ".grok", "hooks");
const RUNNER = join(USER_HOOKS_DIR, "lazygrok-run.sh");
const OUT = join(USER_HOOKS_DIR, "lazygrok.json");
const HEAL_OUT = join(USER_HOOKS_DIR, "lazygrok-heal.json");
const PLUGIN_HOOKS = join(PLUGIN_ROOT, "hooks/hooks.json");

function runnerScript() {
	return [
		"#!/usr/bin/env bash",
		"# LazyGrok full hook dispatcher — install-user-hooks.mjs v4",
		"set -euo pipefail",
		'PLUGIN="${GROK_PLUGIN_ROOT:-}"',
		'if [[ -z "${PLUGIN}" || ! -d "${PLUGIN}" ]]; then',
		'  PLUGIN=""',
		'  for d in "${HOME}/.grok/installed-plugins"/lazygrok-*; do',
		'    [[ -d "$d" ]] || continue',
		'    if [[ -z "${PLUGIN}" || "$d" -nt "${PLUGIN}" ]]; then',
		'      PLUGIN="$d"',
		"    fi",
		"  done",
		"fi",
		'if [[ -z "${PLUGIN}" || ! -d "${PLUGIN}/hooks" ]]; then',
		'  echo "lazygrok-run: plugin not found" >&2',
		"  exit 0",
		"fi",
		'export GROK_PLUGIN_ROOT="${PLUGIN}"',
		'KIND="${1:-}"',
		"shift || true",
		'case "$KIND" in',
		"  run-hook)",
		'    exec bash "${PLUGIN}/hooks/run-hook.sh" "$@"',
		"    ;;",
		"  shim)",
		'    exec node "${PLUGIN}/hooks/lazygrok-shim.mjs" "$@"',
		"    ;;",
			"  ups-probe)",
			'    exec node "${PLUGIN}/hooks/lazygrok-ups-probe.mjs" "$@"',
			"    ;;",
			"  heal)",
			'    exec node "${PLUGIN}/scripts/install-user-hooks.mjs" --heal',
			"    ;;",
		"  *)",
		'    echo "lazygrok-run: unknown kind: $KIND (want run-hook|shim|ups-probe)" >&2',
		"    exit 0",
		"    ;;",
		"esac",
		"",
	].join("\n");
}

/**
 * Map plugin command → bridge command via stable runner.
 * Unknown shapes preserved with PLUGIN expand via env only (best effort).
 */
function bridgeCommand(pluginCmd, runnerPath) {
	const r = runnerPath.replace(/'/g, `'\\''`);
	const c = String(pluginCmd).trim();

	// bash "${GROK_PLUGIN_ROOT}/hooks/run-hook.sh" <args...>
	let m = c.match(
		/^bash\s+"?\$\{GROK_PLUGIN_ROOT\}\/hooks\/run-hook\.sh"?\s+(.+)$/,
	);
	if (m) return `bash '${r}' run-hook ${m[1].trim()}`;

	// node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-ups-probe.mjs" <args>
	m = c.match(
		/^node\s+"?\$\{GROK_PLUGIN_ROOT\}\/hooks\/lazygrok-ups-probe\.mjs"?\s+(.+)$/,
	);
	if (m) return `bash '${r}' ups-probe ${m[1].trim()}`;

	// node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim.mjs" <args>
	m = c.match(
		/^node\s+"?\$\{GROK_PLUGIN_ROOT\}\/hooks\/lazygrok-shim\.mjs"?\s+(.+)$/,
	);
	if (m) return `bash '${r}' shim ${m[1].trim()}`;

	// node "${GROK_PLUGIN_ROOT}/hooks/lazygrok-shim-capture.mjs" … → probe path
	m = c.match(
		/^node\s+"?\$\{GROK_PLUGIN_ROOT\}\/hooks\/lazygrok-shim-capture\.mjs"?\s+(.+)$/,
	);
	if (m) return `bash '${r}' ups-probe ${m[1].trim()}`;

	throw new Error(`unmapped plugin hook command: ${pluginCmd}`);
}

function buildBridgeFromPlugin(pluginHooksPath, runnerPath) {
	const raw = JSON.parse(readFileSync(pluginHooksPath, "utf8"));
	const events = raw.hooks || raw;
	const out = {
		_lazygrokUserHooks: {
			version: 4,
			dynamicPluginRoot: true,
			runner: "lazygrok-run.sh",
			fullMirror: true,
			source: "hooks/hooks.json",
			writtenBy: "install-user-hooks.mjs",
		},
		hooks: {},
	};
	let count = 0;
	for (const [event, groups] of Object.entries(events)) {
		if (!Array.isArray(groups)) continue;
		out.hooks[event] = groups.map((g) => {
			const hooks = (g.hooks || []).map((hh) => {
				count += 1;
				const next = { ...hh };
				if (typeof hh.command === "string") {
					next.command = bridgeCommand(hh.command, runnerPath);
				}
				return next;
			});
			const group = { hooks };
			if (g.matcher != null) group.matcher = g.matcher;
			return group;
		});
	}
	return { payload: out, count };
}

function healerPayload() {
	const runner = RUNNER.replace(/'/g, `'\\''`);
	return {
		_lazygrokHookHealer: {
			version: 1,
			dynamicPluginRoot: true,
			runner: "lazygrok-run.sh",
		},
		hooks: {
			SessionStart: [
				{
					hooks: [
						{
							type: "command",
							command: `bash '${runner}' heal`,
							timeout: 10,
							statusMessage: "(LazyGrok) Refreshing Hook Mirror",
						},
					],
				},
			],
		},
	};
}

export function writeUserHooksBridge() {
	if (!existsSync(PLUGIN_HOOKS)) {
		throw new Error(`missing plugin hooks: ${PLUGIN_HOOKS}`);
	}
	mkdirSync(USER_HOOKS_DIR, { recursive: true });
	writeFileSync(RUNNER, runnerScript());
	chmodSync(RUNNER, 0o755);
	const { payload, count } = buildBridgeFromPlugin(PLUGIN_HOOKS, RUNNER);
	writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
	writeFileSync(HEAL_OUT, JSON.stringify(healerPayload(), null, 2) + "\n");
	return {
		runner: RUNNER,
		hooks: OUT,
		healer: HEAL_OUT,
		count,
		events: Object.keys(payload.hooks).length,
	};
}

export function bridgeNeedsHeal() {
	if (!existsSync(OUT) || !existsSync(RUNNER) || !existsSync(HEAL_OUT)) return true;
	try {
		if (readFileSync(RUNNER, "utf8") !== runnerScript()) return true;
		const { payload } = buildBridgeFromPlugin(PLUGIN_HOOKS, RUNNER);
		const expected = JSON.stringify(payload, null, 2) + "\n";
		const expectedHealer = JSON.stringify(healerPayload(), null, 2) + "\n";
		return (
			readFileSync(OUT, "utf8") !== expected ||
			readFileSync(HEAL_OUT, "utf8") !== expectedHealer
		);
	} catch {
		return true;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const healOnly = process.argv.includes("--heal");
	if (healOnly && !bridgeNeedsHeal()) process.exit(0);
	const r = writeUserHooksBridge();
	console.log(`Wrote ${r.hooks}`);
	console.log(`Wrote ${r.healer}`);
	console.log(`Wrote ${r.runner}`);
	console.log(`Mirrored ${r.count} hook commands across ${r.events} events (full plugin mirror)`);
	console.log(
		healOnly
			? "Healed user-hook bridge after plugin manifest drift."
			: "Installed update-safe user-hook bridge (dynamic root).",
	);
}
