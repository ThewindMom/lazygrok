import { appendFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runStopResumeHook } from "../src/stop-resume-hook.ts";

let workDir: string;

beforeEach(async () => {
	workDir = await mkdtemp(join(tmpdir(), "ulw-stop-resume-"));
});

afterEach(async () => {
	await rm(workDir, { recursive: true, force: true });
});

function stopPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		hook_event_name: "Stop",
		session_id: "s1",
		turn_id: "t1",
		transcript_path: join(workDir, "transcript.jsonl"),
		cwd: workDir,
		model: "gpt-5.6-sol",
		permission_mode: "default",
		stop_hook_active: false,
		...overrides,
	};
}

function sessionDir(): string {
	return join(workDir, ".omo", "ulw-loop", "s1");
}

function writeGoals(goals: readonly Record<string, unknown>[], planOverrides: Record<string, unknown> = {}): void {
	mkdirSync(sessionDir(), { recursive: true });
	writeFileSync(
		join(sessionDir(), "goals.json"),
		JSON.stringify({
			version: 1,
			createdAt: "2026-07-11T00:00:00.000Z",
			updatedAt: "2026-07-11T00:00:00.000Z",
			briefPath: ".omo/ulw-loop/s1/brief.md",
			goalsPath: ".omo/ulw-loop/s1/goals.json",
			ledgerPath: ".omo/ulw-loop/s1/ledger.jsonl",
			codexGoalMode: "aggregate",
			goals,
			...planOverrides,
		}),
	);
	writeFileSync(join(sessionDir(), "ledger.jsonl"), "");
	writeFileSync(join(workDir, "transcript.jsonl"), "");
}

function writeBoulderPlan(remaining: boolean): string {
	mkdirSync(join(workDir, ".omo", "plans"), { recursive: true });
	writeFileSync(
		join(workDir, ".omo", "plans", "p.md"),
		remaining ? "## TODOs\n- [ ] pending task\n" : "## TODOs\n- [x] done task\n",
	);
	return ".omo/plans/p.md";
}

function pendingGoal(id = "g1", status = "pending"): Record<string, unknown> {
	return {
		id,
		title: `Goal ${id}`,
		objective: `Objective ${id}`,
		status,
		successCriteria: [],
		attempt: 1,
		createdAt: "2026-07-11T00:00:00.000Z",
		updatedAt: "2026-07-11T00:00:00.000Z",
	};
}

describe("runStopResumeHook", () => {
	it("#given a pending goal #when the turn stops #then blocks with a resume directive", () => {
		writeGoals([pendingGoal()]);

		const output = runStopResumeHook(stopPayload());

		const parsed = JSON.parse(output);
		expect(parsed.decision).toBe("block");
		expect(parsed.reason).toContain("vendor/lazygrok-hooks/ulw-loop/dist/cli.js");
		expect(parsed.reason).toContain("status");
	});

	it("#given Grok re-fires Stop with stop_hook_active #when work is pending #then the ledger-aware retry budget still governs", () => {
		writeGoals([pendingGoal()]);

		const first = runStopResumeHook(stopPayload({ stop_hook_active: true }));
		const second = runStopResumeHook(stopPayload({ stop_hook_active: true }));
		const third = runStopResumeHook(stopPayload({ stop_hook_active: true }));

		expect(JSON.parse(first).decision).toBe("block");
		expect(JSON.parse(second).decision).toBe("block");
		expect(third).toBe("");
	});

	it("#given a malformed payload #when the hook runs #then no-ops", () => {
		writeGoals([pendingGoal()]);

		expect(runStopResumeHook({ hook_event_name: "Stop" })).toBe("");
	});

	it("#given an active boulder work with remaining plan tasks #when the hook runs #then defers to start-work-continuation", () => {
		writeGoals([pendingGoal()]);
		const plan = writeBoulderPlan(true);
		writeFileSync(
			join(workDir, ".omo", "boulder.json"),
			JSON.stringify({ works: { w1: { session_ids: ["codex:s1"], status: "active", active_plan: plan } } }),
		);

		expect(runStopResumeHook(stopPayload())).toBe("");
	});

	it("#given an active boulder work whose plan is exhausted #when the hook runs #then defers to the final gate continuation", () => {
		writeGoals([pendingGoal()]);
		const plan = writeBoulderPlan(false);
		writeFileSync(
			join(workDir, ".omo", "boulder.json"),
			JSON.stringify({ works: { w1: { session_ids: ["codex:s1"], status: "active", active_plan: plan } } }),
		);

		expect(runStopResumeHook(stopPayload())).toBe("");
	});

	it("#given a flat legacy boulder work with remaining plan tasks #when the hook runs #then still defers", () => {
		writeGoals([pendingGoal()]);
		const plan = writeBoulderPlan(true);
		writeFileSync(
			join(workDir, ".omo", "boulder.json"),
			JSON.stringify({ session_ids: ["codex:s1"], status: "active", active_plan: plan }),
		);

		expect(runStopResumeHook(stopPayload())).toBe("");
	});

	it("#given a context-pressure marker in the transcript #when the hook runs #then no-ops", () => {
		writeGoals([pendingGoal()]);
		writeFileSync(join(workDir, "transcript.jsonl"), "note: context compacted mid-run\n");

		expect(runStopResumeHook(stopPayload())).toBe("");
	});

	it.each([
		["missing", undefined],
		["null", null],
	])("#given a %s transcript #when pending work stops #then continuation still blocks", (_label, transcriptPath) => {
		writeGoals([pendingGoal()]);
		const payload = stopPayload();
		if (transcriptPath === undefined) delete payload["transcript_path"];
		else payload["transcript_path"] = transcriptPath;

		expect(JSON.parse(runStopResumeHook(payload)).decision).toBe("block");
	});

	it("#given no ulw-loop state #when the hook runs #then no-ops", () => {
		expect(runStopResumeHook(stopPayload())).toBe("");
	});

	it("#given all goals complete but aggregate completion is absent #when the hook runs #then blocks for the final gate", () => {
		writeGoals([pendingGoal("g1", "complete"), pendingGoal("g2", "complete")]);

		expect(JSON.parse(runStopResumeHook(stopPayload())).decision).toBe("block");
	});

	it("#given blocked and failed goals only #when the hook runs #then no-ops", () => {
		writeGoals([pendingGoal("g1", "blocked"), pendingGoal("g2", "failed")]);

		expect(runStopResumeHook(stopPayload())).toBe("");
	});

	it("#given a static ledger #when the hook fires three times #then caps after two and marks stuck", () => {
		writeGoals([pendingGoal()]);

		const first = runStopResumeHook(stopPayload());
		const second = runStopResumeHook(stopPayload());
		const third = runStopResumeHook(stopPayload());

		expect(JSON.parse(first).decision).toBe("block");
		expect(JSON.parse(second).decision).toBe("block");
		expect(third).toBe("");
		const counter = JSON.parse(readFileSync(join(sessionDir(), "auto-resume-g1.json"), "utf8"));
		expect(counter.count).toBe(2);
		expect(existsSync(join(sessionDir(), "auto-resume-g1.stuck"))).toBe(true);
		expect(readFileSync(join(sessionDir(), "ledger.jsonl"), "utf8")).toBe("");
	});

	it("#given a noncanonical session id that aliases an existing state directory #when the hook runs #then rejects it", () => {
		writeGoals([pendingGoal()]);

		const output = runStopResumeHook(stopPayload({ session_id: "s1/" }));

		expect(output).toBe("");
	});

	it("#given a goal id with path traversal #when the hook runs #then nothing is written outside the state dir and the resume is denied", () => {
		writeGoals([pendingGoal("../../../escaped-marker")]);
		const outsideDir = join(workDir, ".omo", "ulw-loop");
		const sentinel = join(outsideDir, "escaped-marker.json");
		writeFileSync(sentinel, "sentinel\n");

		const output = runStopResumeHook(stopPayload());

		expect(output).toBe("");
		expect(readFileSync(sentinel, "utf8")).toBe("sentinel\n");
		expect(existsSync(join(outsideDir, "escaped-marker.stuck"))).toBe(false);
		expect(existsSync(join(outsideDir, "auto-resume-escaped-marker.json"))).toBe(false);
	});

	it("#given a normal goal id #when the hook runs past the cap #then the counter and stuck marker are written inside the state dir", () => {
		writeGoals([pendingGoal("goal-abc")]);

		runStopResumeHook(stopPayload());
		runStopResumeHook(stopPayload());
		const third = runStopResumeHook(stopPayload());

		expect(third).toBe("");
		const counter = JSON.parse(readFileSync(join(sessionDir(), "auto-resume-goal-abc.json"), "utf8"));
		expect(counter.count).toBe(2);
		expect(readFileSync(join(sessionDir(), "auto-resume-goal-abc.stuck"), "utf8")).toBe(
			"no ledger progress after 2 resumes\n",
		);
	});

	it("#given a symlinked resume counter #when the hook runs #then it denies resume without changing the target", () => {
		writeGoals([pendingGoal("goal-abc")]);
		const target = join(workDir, "outside-counter.json");
		writeFileSync(target, "sentinel\n");
		symlinkSync(target, join(sessionDir(), "auto-resume-goal-abc.json"));

		const output = runStopResumeHook(stopPayload());

		expect(output).toBe("");
		expect(readFileSync(target, "utf8")).toBe("sentinel\n");
	});

	it.each([
		["malformed JSON", "{not-json"],
		["invalid fields", '{"count":-1,"ledgerLineCount":0}'],
	])("#given a %s resume counter #when the hook runs #then it denies resume without resetting state", (_label, raw) => {
		writeGoals([pendingGoal("goal-abc")]);
		const counterPath = join(sessionDir(), "auto-resume-goal-abc.json");
		writeFileSync(counterPath, raw);

		const output = runStopResumeHook(stopPayload());

		expect(output).toBe("");
		expect(readFileSync(counterPath, "utf8")).toBe(raw);
		expect(existsSync(join(sessionDir(), "auto-resume-goal-abc.stuck"))).toBe(false);
	});

	it("#given ledger movement between stops #when the hook fires again #then the cap resets", () => {
		writeGoals([pendingGoal()]);

		runStopResumeHook(stopPayload());
		runStopResumeHook(stopPayload());
		appendFileSync(join(sessionDir(), "ledger.jsonl"), '{"kind":"goal_started"}\n');
		const third = runStopResumeHook(stopPayload());

		expect(JSON.parse(third).decision).toBe("block");
		expect(existsSync(join(sessionDir(), "auto-resume-g1.stuck"))).toBe(false);
	});

	it("#given a valid ledger larger than ten MiB #when it grows between Grok Stop re-fires #then movement resets the cap without a synthetic zero count", () => {
		writeGoals([pendingGoal()]);
		writeFileSync(join(sessionDir(), "ledger.jsonl"), "{}\n".repeat(Math.ceil((10 * 1024 * 1024 + 1) / 3)));

		const first = runStopResumeHook(stopPayload({ stop_hook_active: true }));
		appendFileSync(join(sessionDir(), "ledger.jsonl"), '{"kind":"goal_started"}\n');
		const second = runStopResumeHook(stopPayload({ stop_hook_active: true }));
		const counter = JSON.parse(readFileSync(join(sessionDir(), "auto-resume-g1.json"), "utf8"));

		expect(JSON.parse(first).decision).toBe("block");
		expect(JSON.parse(second).decision).toBe("block");
		expect(counter.count).toBe(1);
		expect(counter.ledgerLineCount).toBeGreaterThan(0);
		expect(existsSync(join(sessionDir(), "auto-resume-g1.stuck"))).toBe(false);
	});
});
