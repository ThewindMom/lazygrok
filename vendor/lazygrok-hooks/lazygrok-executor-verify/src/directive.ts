import { readFileSync } from "node:fs";

export const LAZYCODEX_EXECUTOR_VERIFY_DIRECTIVE: string = readFileSync(
	new URL("../directive.md", import.meta.url),
	"utf8",
);

export function renderDirective(
	attempts: number,
	lastAssistantMessage: string | undefined,
	requiredEvidenceDirectory: string,
): string {
	return LAZYCODEX_EXECUTOR_VERIFY_DIRECTIVE.replaceAll("{{ATTEMPT_COUNT}}", String(attempts))
		.replaceAll("{{LAST_ASSISTANT_MESSAGE}}", untrustedAssistantExcerpt(lastAssistantMessage))
		.replaceAll("{{REQUIRED_EVIDENCE_DIRECTORY}}", requiredEvidenceDirectory);
}

function untrustedAssistantExcerpt(message: string | undefined): string {
	const bounded = (message ?? "(last_assistant_message was omitted)").slice(0, 4000);
	return bounded.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/\0/gu, "");
}
