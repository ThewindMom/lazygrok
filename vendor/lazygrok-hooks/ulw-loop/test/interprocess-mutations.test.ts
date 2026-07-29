import { execFile, spawn } from "node:child_process";
import { chmod, link, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const CLI = resolve(process.cwd(), "dist", "cli.js");
const NOW = "2026-07-29T00:00:00.000Z";
const tempRoots: string[] = [];

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function makeRepo(prefix: string): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), prefix));
	tempRoots.push(path);
	return path;
}

function field(value: unknown, key: string): unknown {
	if (typeof value !== "object" || value === null) return undefined;
	return Object.entries(value).find(([name]) => name === key)?.[1];
}

async function runCli(repoRoot: string, args: readonly string[]): Promise<{ readonly stdout: string }> {
	return execFileAsync(process.execPath, [CLI, ...args], {
		cwd: repoRoot,
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	});
}

async function createPlan(repoRoot: string): Promise<void> {
	await runCli(repoRoot, ["create-goals", "--brief", "- Preserve concurrent mutations", "--json"]);
}

async function planAt(repoRoot: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(join(repoRoot, ".lazygrok", "ulw-loop", "goals.json"), "utf8"));
}

function spawnPayload(repoRoot: string, message: string): string {
	return JSON.stringify({
		hook_event_name: "PreToolUse",
		session_id: "s1",
		turn_id: "t1",
		transcript_path: null,
		cwd: repoRoot,
		model: "gpt-5.6-sol",
		permission_mode: "default",
		tool_name: "spawn_agent",
		tool_use_id: message,
		tool_input: { message },
	});
}

async function runSpawnHook(repoRoot: string, message: string): Promise<string> {
	return new Promise((resolveOutput, rejectOutput) => {
		const child = spawn(process.execPath, [CLI, "hook", "pre-tool-use-spawn"], {
			cwd: repoRoot,
			stdio: ["pipe", "pipe", "pipe"],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
		child.on("error", rejectOutput);
		child.on("close", (code) => {
			if (code === 0) resolveOutput(Buffer.concat(stdout).toString("utf8"));
			else rejectOutput(new Error(`spawn hook exited ${code}: ${Buffer.concat(stderr).toString("utf8")}`));
		});
		child.stdin.end(spawnPayload(repoRoot, message));
	});
}

async function seedSpawnPlan(repoRoot: string): Promise<string> {
	const stateDir = join(repoRoot, ".lazygrok", "ulw-loop", "s1");
	await mkdir(stateDir, { recursive: true });
	await writeFile(
		join(stateDir, "goals.json"),
		JSON.stringify({
			version: 1,
			createdAt: NOW,
			updatedAt: NOW,
			briefPath: ".lazygrok/ulw-loop/s1/brief.md",
			goalsPath: ".lazygrok/ulw-loop/s1/goals.json",
			ledgerPath: ".lazygrok/ulw-loop/s1/ledger.jsonl",
			codexGoalMode: "aggregate",
			goals: [
				{
					id: "G001",
					title: "Final",
					objective: "Final",
					status: "in_progress",
					successCriteria: [
						{
							id: "C001",
							scenario: "final behavior",
							userModel: "happy",
							expectedEvidence: "artifact",
							capturedEvidence: "captured",
							status: "pass",
						},
					],
					attempt: 1,
					createdAt: NOW,
					updatedAt: NOW,
				},
			],
			activeGoalId: "G001",
		}),
	);
	return stateDir;
}

describe("deployed ULW interprocess mutations", () => {
	it("#given one plan #when separate CLI processes add goals concurrently #then every mutation persists", async () => {
		// given
		const repoRoot = await makeRepo("ulw-process-plan-");
		await createPlan(repoRoot);
		const additions = Array.from({ length: 16 }, (_, index) => `parallel-${index}`);

		// when
		await Promise.all(
			additions.map((title) =>
				runCli(repoRoot, ["add-goal", "--title", title, "--objective", `objective-${title}`, "--json"]),
			),
		);

		// then
		const persisted = await planAt(repoRoot);
		const goals = persisted["goals"];
		expect(Array.isArray(goals)).toBe(true);
		if (!Array.isArray(goals)) return;
		expect(goals).toHaveLength(additions.length + 1);
		expect(new Set(goals.map((goal) => field(goal, "title")))).toEqual(
			new Set(["Preserve concurrent mutations", ...additions]),
		);
		const ledger = await readFile(join(repoRoot, ".lazygrok", "ulw-loop", "ledger.jsonl"), "utf8");
		expect(ledger.match(/"kind":"goal_added"/gu)).toHaveLength(additions.length);
	});

	it("#given parallel allowed hooks #when separate PreToolUse processes reserve budget #then every spawn is counted", async () => {
		// given
		const repoRoot = await makeRepo("ulw-process-spawn-");
		const stateDir = await seedSpawnPlan(repoRoot);
		const count = 20;

		// when
		const outputs = await Promise.all(
			Array.from({ length: count }, (_, index) => runSpawnHook(repoRoot, `worker-${index}`)),
		);

		// then
		expect(outputs.every((output) => output === "")).toBe(true);
		expect(JSON.parse(await readFile(join(stateDir, "spawn-count.json"), "utf8"))).toEqual({ count });
	});

	it("#given a denied artifact precondition #when the spawn hook runs #then it does not consume budget", async () => {
		// given
		const repoRoot = await makeRepo("ulw-process-denied-spawn-");
		const stateDir = await seedSpawnPlan(repoRoot);

		// when
		const output = await runSpawnHook(repoRoot, "run the final gate review");

		// then
		expect(field(field(JSON.parse(output), "hookSpecificOutput"), "permissionDecision")).toBe("deny");
		await expect(readFile(join(stateDir, "spawn-count.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("#given an unsafe counter file #when the spawn hook cannot reserve budget #then it denies without changing it", async () => {
		// given
		const repoRoot = await makeRepo("ulw-process-unsafe-spawn-");
		const stateDir = await seedSpawnPlan(repoRoot);
		const protectedCounter = join(repoRoot, "protected-counter.json");
		await writeFile(protectedCounter, '{"count":7}');
		await link(protectedCounter, join(stateDir, "spawn-count.json"));

		// when
		const output = await runSpawnHook(repoRoot, "worker");

		// then
		expect(field(field(JSON.parse(output), "hookSpecificOutput"), "permissionDecision")).toBe("deny");
		expect(await readFile(protectedCounter, "utf8")).toBe('{"count":7}');
	});

	it.each([
		"",
		"not-json",
	])("#given a corrupt counter containing %j #when the spawn hook reserves budget #then it denies without resetting state", async (corruptCounter) => {
		// given
		const repoRoot = await makeRepo("ulw-process-corrupt-spawn-");
		const stateDir = await seedSpawnPlan(repoRoot);
		const counterPath = join(stateDir, "spawn-count.json");
		await writeFile(counterPath, corruptCounter);

		// when
		const output = await runSpawnHook(repoRoot, "worker");

		// then
		expect(field(field(JSON.parse(output), "hookSpecificOutput"), "permissionDecision")).toBe("deny");
		expect(await readFile(counterPath, "utf8")).toBe(corruptCounter);
	});

	it("#given an oversized valid spawn envelope #when the deployed hook reads it #then it fails closed without consuming budget", async () => {
		// given
		const repoRoot = await makeRepo("ulw-process-oversized-spawn-");
		const stateDir = await seedSpawnPlan(repoRoot);
		const oversizedMessage = "x".repeat(10 * 1024 * 1024);

		// when
		const output = await runSpawnHook(repoRoot, oversizedMessage);

		// then
		expect(field(field(JSON.parse(output), "hookSpecificOutput"), "permissionDecision")).toBe("deny");
		await expect(readFile(join(stateDir, "spawn-count.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("#given ledger append failure #when a deployed mutation runs #then plan stays audited and later recovers", async () => {
		// given
		const repoRoot = await makeRepo("ulw-process-journal-");
		await createPlan(repoRoot);
		const stateDir = join(repoRoot, ".lazygrok", "ulw-loop");
		const planPath = join(stateDir, "goals.json");
		const ledgerPath = join(stateDir, "ledger.jsonl");
		const before = await readFile(planPath, "utf8");
		await chmod(ledgerPath, 0o400);

		// when
		await expect(
			runCli(repoRoot, ["add-goal", "--title", "faulted", "--objective", "recover this mutation", "--json"]),
		).rejects.toMatchObject({ code: 1 });

		// then
		expect(await readFile(planPath, "utf8")).toBe(before);
		await chmod(ledgerPath, 0o600);
		await runCli(repoRoot, ["add-goal", "--title", "next", "--objective", "trigger recovery", "--json"]);
		const recovered = await planAt(repoRoot);
		const goals = recovered["goals"];
		expect(Array.isArray(goals)).toBe(true);
		if (!Array.isArray(goals)) return;
		expect(goals.map((goal) => field(goal, "title"))).toEqual(["Preserve concurrent mutations", "faulted", "next"]);
		const ledger = await readFile(ledgerPath, "utf8");
		expect(ledger.match(/"kind":"goal_added"/gu)).toHaveLength(2);
	});
});
