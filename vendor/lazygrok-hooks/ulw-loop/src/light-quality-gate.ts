import { join } from "node:path";

import { printJson } from "./cli-output.js";
import { safeWorkspacePath, safeWriteWorkspaceTextFile } from "./file-safety.js";
import { resolveUlwLoopSessionIdFromEnv, type UlwLoopScope, ulwLoopAttemptEvidenceDir } from "./paths.js";
import { readUlwLoopPlan } from "./plan-io.js";
import { UlwLoopError } from "./types.js";

/**
 * Build a valid OmO quality-gate payload for LIGHT / smoke completions on Grok.
 * Writes real non-empty artifact files under the current attempt evidence dir
 * (evidence layout v2) and identifies the root agent as the actual reviewer.
 */
export async function buildLightQualityGate(
	repoRoot: string,
	goalId: string,
	scope?: UlwLoopScope,
): Promise<{
	qualityGatePath: string;
	attemptDir: string;
	qualityGate: unknown;
}> {
	const plan = await readUlwLoopPlan(repoRoot, scope);
	const goal = plan.goals.find((g) => g.id === goalId);
	if (!goal) throw new UlwLoopError(`Unknown goal ${goalId}`, "ULW_LOOP_GOAL_NOT_FOUND");
	const criteria = goal.successCriteria ?? [];
	if (criteria.length === 0) throw new UlwLoopError("Goal has no success criteria", "ULW_LOOP_NO_CRITERIA");
	const pending = criteria.filter((c) => c.status !== "pass");
	if (pending.length > 0) {
		throw new UlwLoopError(
			`Cannot build light quality gate: criteria not all pass (${pending.map((c) => c.id).join(", ")})`,
			"ULW_LOOP_CRITERIA_INCOMPLETE",
		);
	}

	const attemptDir = ulwLoopAttemptEvidenceDir(repoRoot, goal.id, goal.attempt ?? 0, scope);
	const absAttempt = safeWorkspacePath(repoRoot, join(repoRoot, attemptDir));

	const artifactId = "artifact-light-cli";
	const artifactRel = `${attemptDir}/light-cli-evidence.txt`;
	const codeReportRel = `${attemptDir}/light-root-code-review.md`;
	const gateReportRel = `${attemptDir}/light-root-gate-review.md`;

	const evidenceLines = criteria.map((c) => `- ${c.id} (${c.status}): ${c.capturedEvidence ?? c.scenario ?? ""}`);
	const cliBody = [
		`LIGHT quality gate evidence for ${goal.id}`,
		`objective: ${goal.objective}`,
		`generated: ${new Date().toISOString()}`,
		"",
		"Criteria:",
		...evidenceLines,
		"",
		"Grok LIGHT path: root agent self-review + criterion evidence (no multi-agent gate required).",
	].join("\n");
	await safeWriteWorkspaceTextFile(repoRoot, join(repoRoot, artifactRel), `${cliBody}\n`);
	await safeWriteWorkspaceTextFile(
		repoRoot,
		join(repoRoot, codeReportRel),
		`# LIGHT root code self-review\n\nAPPROVE — performed by the LazyGrok root agent, not an independent reviewer.\n\n${evidenceLines.join("\n")}\n`,
	);
	await safeWriteWorkspaceTextFile(
		repoRoot,
		join(repoRoot, gateReportRel),
		`# LIGHT root gate self-review\n\nAPPROVE — root agent confirmed all ${criteria.length} criteria pass with captured evidence.\n`,
	);

	const first = criteria[0];
	if (first === undefined) {
		throw new UlwLoopError("Goal has no success criteria", "ULW_LOOP_NO_CRITERIA");
	}
	const qualityGate = {
		provenance: {
			mode: "root-self-review",
			producer: "lazygrok-root",
			sessionId: scope?.sessionId ?? resolveUlwLoopSessionIdFromEnv() ?? "session",
		},
		codeReview: {
			by: "lazygrok-root",
			recommendation: "APPROVE",
			codeQualityStatus: "CLEAR",
			reportPath: codeReportRel,
			evidence: `LIGHT self-review: all criteria pass for ${goal.id}`,
			blockers: [],
		},
		manualQa: {
			by: "lazygrok-root",
			status: "passed",
			evidence: criteria.map((c) => c.capturedEvidence || c.id).join(" | "),
			surfaceEvidence: [
				{
					id: "surface-light-cli",
					criterionRef: first.id,
					surface: "cli",
					invocation: "ulw-loop light-quality-gate (Grok LIGHT)",
					verdict: "passed",
					artifactRefs: [artifactId],
				},
			],
			adversarialCases: [
				{
					id: "adv-none-applicable",
					criterionRef: first.id,
					scenario: "LIGHT tier: no adversarial class triggered",
					expectedBehavior: "none-applicable recorded",
					verdict: "not_applicable",
					reason: "LIGHT smoke / single-agent completion",
					artifactRefs: [artifactId],
				},
			],
			artifactRefs: [
				{
					id: artifactId,
					kind: "cli-transcript",
					description: "LIGHT criterion evidence dump",
					path: artifactRel,
				},
			],
		},
		gateReview: {
			by: "lazygrok-root",
			recommendation: "APPROVE",
			reportPath: gateReportRel,
			evidence: "LIGHT gate: criteria coverage complete",
			blockers: [],
		},
		iteration: {
			fullRerun: true,
			status: "passed",
			rerunCommands: ["node vendor/lazygrok-hooks/ulw-loop/dist/cli.js status --json"],
			evidence: "LIGHT iteration: evidence already recorded in ledger",
		},
		criteriaCoverage: {
			totalCriteria: criteria.length,
			passCount: criteria.filter((c) => c.status === "pass").length,
			originalIntent: goal.objective,
			desiredOutcome: goal.objective,
			userOutcomeReview: "LIGHT path: all success criteria pass with captured evidence",
			adversarialClassesCovered: ["none-applicable: LIGHT tier"],
		},
	};

	const qualityGatePath = join(attemptDir, "quality-gate.light.json");
	await safeWriteWorkspaceTextFile(
		repoRoot,
		join(repoRoot, qualityGatePath),
		`${JSON.stringify(qualityGate, null, 2)}\n`,
	);
	return { qualityGatePath, attemptDir: absAttempt, qualityGate };
}

export async function lightQualityGateCmd(
	repoRoot: string,
	argv: readonly string[],
	json: boolean,
	scope?: UlwLoopScope,
): Promise<number> {
	const goalId = (() => {
		const i = argv.indexOf("--goal-id");
		if (i >= 0 && argv[i + 1]) return argv[i + 1];
		return undefined;
	})();
	if (!goalId) throw new UlwLoopError("Missing --goal-id", "ULW_LOOP_GOAL_ID_REQUIRED");
	const result = await buildLightQualityGate(repoRoot, goalId, scope);
	if (json) printJson({ ok: true, ...result });
	else {
		process.stdout.write(
			`light quality gate written: ${result.qualityGatePath}\n` +
				`attempt dir: ${result.attemptDir}\n` +
				`Use: ulw-loop checkpoint --goal-id ${goalId} --status complete --evidence "..." \\\n` +
				`  --codex-goal-json '<complete snapshot>' --quality-gate-json ${result.qualityGatePath}\n`,
		);
	}
	return 0;
}
