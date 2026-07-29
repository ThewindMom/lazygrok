import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { grokUlwCli } from "../src/runtime-command.js";

const execFileAsync = promisify(execFile);

async function runHook(cliPath: string, cwd: string, payload: Record<string, unknown>): Promise<string> {
	return new Promise((resolveOutput, rejectOutput) => {
		const child = spawn(process.execPath, [cliPath, "hook", "stop"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
		child.on("error", rejectOutput);
		child.on("close", (code) => {
			if (code === 0) resolveOutput(Buffer.concat(stdout).toString("utf8"));
			else rejectOutput(new Error(`relocated hook exited ${code}: ${Buffer.concat(stderr).toString("utf8")}`));
		});
		child.stdin.end(JSON.stringify(payload));
	});
}

describe("grokUlwCli", () => {
	it("#given a relocated plugin #when a recovery command is generated #then it binds to this package instead of an install ID", () => {
		const command = grokUlwCli();
		const source = readFileSync(resolve(process.cwd(), "src", "runtime-command.ts"), "utf8");

		expect(command).toBe(`node '${resolve(process.cwd(), "dist", "cli.js")}'`);
		expect(command).not.toContain("GROK_PLUGIN_ROOT");
		expect(source).not.toMatch(/lazygrok-[0-9a-f]{8}/u);
	});

	it.skipIf(process.platform === "win32")(
		"#given a shell-active renamed bundle path #when Stop emits recovery commands #then they execute without path injection",
		async () => {
			const base = await mkdtemp(join(tmpdir(), "ulw-relocated-command-"));
			const root = join(base, "quoted-'$(touch injected-marker)");
			const repo = join(root, "repo");
			const relocatedCli = join(root, "renamed-ulw-runtime.js");
			try {
				await mkdir(repo, { recursive: true });
				await copyFile(resolve(process.cwd(), "dist", "cli.js"), relocatedCli);
				await execFileAsync(
					process.execPath,
					[relocatedCli, "create-goals", "--brief", "relocation probe", "--session-id", "relocate-s1", "--json"],
					{ cwd: repo },
				);

				const output = await runHook(relocatedCli, repo, {
					hook_event_name: "Stop",
					session_id: "relocate-s1",
					turn_id: "t1",
					transcript_path: null,
					cwd: repo,
					model: "grok",
					permission_mode: "default",
					stop_hook_active: false,
				});

				const parsed = JSON.parse(output) as { readonly decision?: unknown; readonly reason?: unknown };
				expect(parsed.decision).toBe("block");
				const quotedCli = `'${relocatedCli.replaceAll("'", "'\"'\"'")}'`;
				expect(parsed.reason).toContain(`node ${quotedCli}`);
				const recoveryCommand =
					typeof parsed.reason === "string" ? /`(node [^`]+ status [^`]+)`/u.exec(parsed.reason)?.[1] : undefined;
				expect(recoveryCommand).toBeDefined();
				if (recoveryCommand !== undefined) {
					await execFileAsync("/bin/sh", ["-c", recoveryCommand], { cwd: repo });
				}
				expect(() => readFileSync(join(repo, "injected-marker"))).toThrow();
				const { stdout } = await execFileAsync(
					process.execPath,
					[relocatedCli, "status", "--session-id", "relocate-s1", "--json"],
					{ cwd: repo },
				);
				expect(JSON.parse(stdout).summary.total).toBe(1);
			} finally {
				await rm(base, { recursive: true, force: true });
			}
		},
	);
});
