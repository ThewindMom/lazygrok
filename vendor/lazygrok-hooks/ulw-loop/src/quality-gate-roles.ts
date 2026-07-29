import { invalid, literal, section, textField } from "./quality-gate-fields.js";
import type { UlwLoopQualityGate } from "./types.js";

const ROOT_REVIEWER = "lazygrok-root";
const REVIEWER_ROLES = {
	codeReview: "lazycodex-code-reviewer",
	manualQa: "lazycodex-qa-executor",
	gateReview: "lazycodex-gate-reviewer",
} as const;

const REVIEWER_ALIASES: Record<keyof typeof REVIEWER_ROLES, readonly string[]> = {
	codeReview: ["lazycodex-code-reviewer", "lazygrok-code-reviewer"],
	manualQa: ["lazycodex-qa-executor", "lazygrok-qa-executor"],
	gateReview: ["lazycodex-gate-reviewer", "lazygrok-gate-reviewer"],
};

export function reviewerRoleField(
	value: unknown,
	role: keyof typeof REVIEWER_ROLES,
	field: string,
	rootSelfReview: boolean,
): string {
	const actual = textField(value, field);
	if (rootSelfReview) {
		if (actual !== ROOT_REVIEWER) invalid(`${field} must be ${ROOT_REVIEWER} for root self-review.`, field);
		return ROOT_REVIEWER;
	}
	const allowed = REVIEWER_ALIASES[role];
	if (!allowed.includes(actual)) invalid(`${field} must be one of: ${allowed.join(", ")}.`, field);
	return REVIEWER_ROLES[role];
}

export function reviewProvenanceField(value: unknown): UlwLoopQualityGate["provenance"] {
	if (value === undefined) return undefined;
	const provenance = section(value, "provenance");
	return {
		mode: literal(provenance["mode"], "root-self-review", "provenance.mode"),
		producer: literal(provenance["producer"], ROOT_REVIEWER, "provenance.producer"),
		sessionId: textField(provenance["sessionId"], "provenance.sessionId"),
	};
}
