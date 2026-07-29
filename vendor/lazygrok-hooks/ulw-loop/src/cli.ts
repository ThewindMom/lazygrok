#!/usr/bin/env node
import { isUlwLoopSubcommand, ulwLoopCommand } from "./cli-commands.js";
import { runPreToolUseGoalBudgetGuardCli, runUlwLoopHookCli } from "./codex-hook.js";
import { runSpawnGuardCli } from "./spawn-guard.js";
import { runStopResumeHookCli } from "./stop-resume-hook.js";

const TOP_LEVEL_HELP =
	"Usage:\n  ulw-loop <subcommand> [args]\n  ulw-loop hook user-prompt-submit [--with-ultrawork]  (Grok UserPromptSubmit hook)\n  ulw-loop help | --help | -h                          (this message)\n\nRun `ulw-loop help` for subcommands.\n";

async function main(): Promise<number> {
	const argv = process.argv.slice(2);
	const command = argv[0];
	if (command === undefined || command === "help" || command === "--help" || command === "-h") {
		process.stdout.write(TOP_LEVEL_HELP);
		return 0;
	}
	if (command === "ulw-loop") return ulwLoopCommand(argv.slice(1));
	if (command === "hook") {
		const sub = argv[1];
		if (sub === "user-prompt-submit") {
			await runUlwLoopHookCli(process.stdin, process.stdout, {
				includeUltraworkDirective: argv.includes("--with-ultrawork"),
			});
			return 0;
		}
		if (sub === "pre-tool-use") {
			await runPreToolUseGoalBudgetGuardCli(process.stdin, process.stdout);
			return 0;
		}
		if (sub === "stop") {
			await runStopResumeHookCli(process.stdin, process.stdout);
			return 0;
		}
		if (sub === "pre-tool-use-spawn") {
			await runSpawnGuardCli(process.stdin, process.stdout);
			return 0;
		}
		process.stderr.write(`[omo] unknown hook subcommand: ${sub ?? "(none)"}\n`);
		return 1;
	}
	if (isUlwLoopSubcommand(command)) return ulwLoopCommand(argv);
	process.stderr.write(`[omo] unknown command: ${command}\n${TOP_LEVEL_HELP}`);
	return 1;
}

main()
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error: unknown) => {
		process.stderr.write(`[omo] ${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
