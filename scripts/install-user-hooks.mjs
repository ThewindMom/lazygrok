#!/usr/bin/env node
/**
 * One-time bridge for LazyGrok hard UPS inject on Grok 0.2.x.
 *
 * Writes:
 *   ~/.grok/hooks/lazygrok-run.sh   — stable dispatcher (finds plugin each run)
 *   ~/.grok/hooks/lazygrok.json     — file hooks Grok loads at session spawn
 *
 * Why a bridge?
 *   Grok loads plugin hooks late (often after the first prompt). File hooks
 *   under ~/.grok/hooks/ load at spawn — early enough for inject.
 *
 * Why not re-run after every update?
 *   lazygrok-run.sh resolves ~/.grok/installed-plugins/lazygrok-* dynamically.
 *   plugin update → new hash dir → same bridge still works.
 *
 * First install only:
 *   node …/scripts/install-user-hooks.mjs
 */
import { writeFileSync, mkdirSync, chmodSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const USER_HOOKS_DIR = join(homedir(), ".grok", "hooks");
const RUNNER = join(USER_HOOKS_DIR, "lazygrok-run.sh");
const OUT = join(USER_HOOKS_DIR, "lazygrok.json");

function runnerScript() {
	return [
		"#!/usr/bin/env bash",
		"# LazyGrok stable hook dispatcher — installed by install-user-hooks.mjs",
		"# Resolves the current plugin install each invocation (survives plugin update).",
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
		'if [[ -z "${PLUGIN}" || ! -f "${PLUGIN}/hooks/lazygrok-ups-probe.mjs" ]]; then',
		'  echo "lazygrok-run: no plugin under ~/.grok/installed-plugins/lazygrok-*" >&2',
		"  exit 0",
		"fi",
		'export GROK_PLUGIN_ROOT="${PLUGIN}"',
		'MODE="${1:-}"',
		"shift || true",
		'case "$MODE" in',
		'  user-prompt) exec bash "${PLUGIN}/hooks/run-hook.sh" user-prompt "$@" ;;',
		'  stop)        exec bash "${PLUGIN}/hooks/run-hook.sh" stop "$@" ;;',
		"  ultrawork-ups)",
		'    exec node "${PLUGIN}/hooks/lazygrok-ups-probe.mjs" ultrawork user-prompt-submit "$@"',
		"    ;;",
		"  ulw-loop-ups)",
		'    exec node "${PLUGIN}/hooks/lazygrok-shim.mjs" ulw-loop user-prompt-submit "$@"',
		"    ;;",
		"  rules-ups)",
		'    exec node "${PLUGIN}/hooks/lazygrok-shim.mjs" rules user-prompt-submit "$@"',
		"    ;;",
		"  ulw-loop-stop)",
		'    exec node "${PLUGIN}/hooks/lazygrok-shim.mjs" ulw-loop stop "$@"',
		"    ;;",
		"  *)",
		'    echo "lazygrok-run: unknown mode: $MODE" >&2',
		"    exit 0",
		"    ;;",
		"esac",
		"",
	].join("\n");
}

function hooksPayload(runnerPath) {
	const r = runnerPath.replace(/'/g, `'\\''`);
	const bash = (mode, timeout, statusMessage) => {
		const h = {
			type: "command",
			command: `bash '${r}' ${mode}`,
			timeout,
		};
		if (statusMessage) h.statusMessage = statusMessage;
		return { hooks: [h] };
	};
	return {
		_lazygrokUserHooks: {
			version: 3,
			dynamicPluginRoot: true,
			runner: "lazygrok-run.sh",
			writtenBy: "install-user-hooks.mjs",
		},
		hooks: {
			UserPromptSubmit: [
				bash("user-prompt", 20),
				bash("ultrawork-ups", 8, "(OmO) Checking Ultrawork Trigger"),
				bash("ulw-loop-ups", 10, "(OmO) Checking Ulw-Loop Steering"),
				bash("rules-ups", 10, "(OmO) Loading Project Rules"),
			],
			Stop: [
				bash("stop", 20),
				bash("ulw-loop-stop", 15, "(OmO) Ulw-Loop Continuation"),
			],
		},
	};
}

export function writeUserHooksBridge() {
	mkdirSync(USER_HOOKS_DIR, { recursive: true });
	writeFileSync(RUNNER, runnerScript());
	chmodSync(RUNNER, 0o755);
	writeFileSync(OUT, JSON.stringify(hooksPayload(RUNNER), null, 2) + "\n");
	return { runner: RUNNER, hooks: OUT };
}

export function bridgeNeedsHeal() {
	if (!existsSync(OUT) || !existsSync(RUNNER)) return true;
	try {
		const raw = JSON.parse(readFileSync(OUT, "utf8"));
		const meta = raw._lazygrokUserHooks;
		return !meta?.dynamicPluginRoot || (meta.version ?? 0) < 3;
	} catch {
		return true;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { runner, hooks } = writeUserHooksBridge();
	console.log(`Wrote ${hooks}`);
	console.log(`Wrote ${runner} (dynamic plugin root)`);
	console.log("First install only — survives grok plugin update without re-run.");
}
