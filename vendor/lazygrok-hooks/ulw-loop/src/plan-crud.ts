import { existsSync } from "node:fs";

import { safeWriteWorkspaceTextFile } from "./file-safety.js";
import { aggregateCodexObjectiveForScope, isUlwLoopDone } from "./goal-status.js";
import {
	type UlwLoopScope,
	ulwLoopBriefPath,
	ulwLoopBriefRelativePath,
	ulwLoopGoalsPath,
	ulwLoopGoalsRelativePath,
	ulwLoopLedgerPath,
	ulwLoopLedgerRelativePath,
} from "./paths.js";
import { appendGoalToPlan, deriveGoalCandidates, makeGoal } from "./plan-goal-factory.js";
import { commitPlanAndLedgerEntries, readUlwLoopPlan, withUlwLoopMutationLock } from "./plan-io.js";
import { grokUlwCli } from "./runtime-command.js";
import type {
	UlwLoopCodexGoalMode,
	UlwLoopItem,
	UlwLoopLedgerEntry,
	UlwLoopPlan,
	UlwLoopSuccessCriterion,
} from "./types.js";
import { iso, UlwLoopError } from "./types.js";
import { parseValidationBatches } from "./validation-batch.js";

export { deriveGoalCandidates, seedDefaultSuccessCriteria } from "./plan-goal-factory.js";

export type UlwLoopPlanSummary = {
	readonly total: number;
	readonly pending: number;
	readonly in_progress: number;
	readonly complete: number;
	readonly failed: number;
	readonly blocked: number;
	readonly review_blocked: number;
	readonly needs_user_decision: number;
	readonly superseded: number;
	readonly criteria: {
		readonly total: number;
		readonly pass: number;
		readonly pending: number;
		readonly fail: number;
		readonly blocked: number;
	};
};

function isScheduleEligible(goal: UlwLoopItem): boolean {
	return goal.steeringStatus !== "superseded" && goal.steeringStatus !== "blocked";
}

function clearGoalBlockerFields(goal: UlwLoopItem): void {
	for (const key of [
		"blockedReason",
		"blockerSignature",
		"blockerOccurrenceCount",
		"requiredExternalDecision",
		"nonRetriable",
		"failedAt",
		"failureReason",
	] as const)
		delete goal[key];
}

export async function createUlwLoopPlan(
	repoRoot: string,
	args: { brief: string; codexGoalMode?: UlwLoopCodexGoalMode; force?: boolean; validationBatchesJson?: string },
	scope?: UlwLoopScope,
): Promise<UlwLoopPlan> {
	return withUlwLoopMutationLock(repoRoot, scope, async () => {
		if (!args.force && existsSync(ulwLoopGoalsPath(repoRoot, scope))) {
			const existing = await readUlwLoopPlan(repoRoot, scope);
			if (isUlwLoopDone(existing)) throw completedPlanExistsError(scope);
			throw new UlwLoopError(
				`Refusing to overwrite existing ${ulwLoopGoalsRelativePath(scope)}; pass --force to recreate it.`,
				"ULW_LOOP_PLAN_EXISTS",
			);
		}
		const now = iso();
		const goals = deriveGoalCandidates(args.brief).map((goal, index) =>
			makeGoal(goal.title, goal.objective, index, now),
		);
		const plan: UlwLoopPlan = {
			version: 1,
			evidenceLayoutVersion: 2,
			createdAt: now,
			updatedAt: now,
			briefPath: ulwLoopBriefRelativePath(scope),
			goalsPath: ulwLoopGoalsRelativePath(scope),
			ledgerPath: ulwLoopLedgerRelativePath(scope),
			codexGoalMode: args.codexGoalMode ?? "aggregate",
			goals,
		};
		const validationBatches = await parseValidationBatches(args.validationBatchesJson, goals, repoRoot);
		if (validationBatches !== undefined) plan.validationBatches = validationBatches;
		if (plan.codexGoalMode === "aggregate") plan.codexObjective = aggregateCodexObjectiveForScope(scope);
		await safeWriteWorkspaceTextFile(
			repoRoot,
			ulwLoopBriefPath(repoRoot, scope),
			args.brief.endsWith("\n") ? args.brief : `${args.brief}\n`,
		);
		await safeWriteWorkspaceTextFile(repoRoot, ulwLoopLedgerPath(repoRoot, scope), "");
		await commitPlanAndLedgerEntries(
			repoRoot,
			plan,
			[{ at: now, kind: "plan_created", message: `${goals.length} goal(s) created` }],
			scope,
		);
		return plan;
	});
}

function completedPlanExistsError(scope?: UlwLoopScope): UlwLoopError {
	return new UlwLoopError(
		[
			`Existing ulw-loop aggregate is already complete at ${ulwLoopGoalsRelativePath(scope)}.`,
			`Start a new run with \`${grokUlwCli()} create-goals --session-id <new-id> ...\` to isolate fresh state.`,
			"Use --force only when you intentionally want to overwrite the completed evidence.",
		].join(" "),
		"ULW_LOOP_PLAN_EXISTS_COMPLETE",
	);
}

export async function addUlwLoopGoal(
	repoRoot: string,
	args: { title: string; objective: string },
	scope?: UlwLoopScope,
): Promise<{ plan: UlwLoopPlan; goal: UlwLoopItem }> {
	return withUlwLoopMutationLock(repoRoot, scope, async () => {
		const plan = await readUlwLoopPlan(repoRoot, scope);
		const now = iso();
		const goal = appendGoalToPlan(plan, args.title, args.objective, now);
		await commitPlanAndLedgerEntries(
			repoRoot,
			plan,
			[{ at: now, kind: "goal_added", goalId: goal.id, status: goal.status, message: goal.title }],
			scope,
		);
		return { plan, goal };
	});
}

export async function startNextUlwLoop(
	repoRoot: string,
	args: { retryFailed?: boolean } = {},
	scope?: UlwLoopScope,
): Promise<{ plan: UlwLoopPlan; goal: UlwLoopItem; resumed: boolean } | { done: true; plan: UlwLoopPlan }> {
	return withUlwLoopMutationLock(repoRoot, scope, async () => {
		const plan = await readUlwLoopPlan(repoRoot, scope);
		const now = iso();
		if (plan.aggregateCompletion?.status === "complete") return { done: true, plan };
		const existing = plan.goals.find((goal) => goal.status === "in_progress" && isScheduleEligible(goal));
		if (existing) return { plan, goal: existing, resumed: true };
		const ledgerEntries: UlwLoopLedgerEntry[] = [];
		let next = plan.goals.find((goal) => goal.status === "pending" && isScheduleEligible(goal));
		if (!next && args.retryFailed) {
			next = plan.goals.find((goal) => goal.status === "failed" && !goal.nonRetriable && isScheduleEligible(goal));
			if (next)
				ledgerEntries.push({
					at: now,
					kind: "goal_retried",
					goalId: next.id,
					status: "pending",
					...(next.failureReason ? { message: next.failureReason } : {}),
				});
		}
		if (!next) return { done: true, plan };
		next.status = "in_progress";
		next.attempt += 1;
		next.startedAt = now;
		clearGoalBlockerFields(next);
		next.updatedAt = now;
		plan.activeGoalId = next.id;
		plan.updatedAt = now;
		ledgerEntries.push({
			at: now,
			kind: "goal_started",
			goalId: next.id,
			status: next.status,
			message: `Attempt ${next.attempt}`,
		});
		await commitPlanAndLedgerEntries(repoRoot, plan, ledgerEntries, scope);
		return { plan, goal: next, resumed: false };
	});
}

export function summarizeUlwLoopPlan(plan: UlwLoopPlan): UlwLoopPlanSummary {
	const countStatus = (status: UlwLoopItem["status"]): number =>
		plan.goals.filter((goal) => goal.status === status).length;
	const countCriteria = (status: UlwLoopSuccessCriterion["status"]): number =>
		plan.goals.reduce(
			(sum, goal) => sum + goal.successCriteria.filter((criterion) => criterion.status === status).length,
			0,
		);
	return {
		total: plan.goals.length,
		pending: countStatus("pending"),
		in_progress: countStatus("in_progress"),
		complete: countStatus("complete"),
		failed: countStatus("failed"),
		blocked: countStatus("blocked"),
		review_blocked: countStatus("review_blocked"),
		needs_user_decision: countStatus("needs_user_decision"),
		superseded: plan.goals.filter((goal) => goal.steeringStatus === "superseded").length,
		criteria: {
			total: plan.goals.reduce((sum, goal) => sum + goal.successCriteria.length, 0),
			pass: countCriteria("pass"),
			pending: countCriteria("pending"),
			fail: countCriteria("fail"),
			blocked: countCriteria("blocked"),
		},
	};
}
