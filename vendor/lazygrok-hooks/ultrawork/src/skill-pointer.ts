import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { ULTRAWORK_DIRECTIVE } from "./directive.js";

/**
 * Bootstrap from code-yeongyu/lazycodex ultrawork skill-pointer, Grok-adapted:
 * LCX steps (announce → register goal → read skill) + ulw-loop ledger when host create_goal is absent.
 */
export const ULTRAWORK_SKILL_POINTER_TEMPLATE = `<ultrawork-mode>
ULTRAWORK MODE IS ACTIVE FOR THIS TASK.

MANDATORY BOOTSTRAP: do all steps, in order, before anything else.

1. First user-visible line this turn MUST be exactly:
\`ULTRAWORK MODE ENABLED!\`

2. Register the binding goal NOW. objective = user request with ulw/ultrawork stripped.
Send objective only: no status, no budget fields.
- If tool \`create_goal\` is available → call it with objective only.
- Always open with a binding \`# Goal\` block (objective, tier, criteria, when-to-stop).
- Always durable ledger (Grok create_goal equivalent when host tools are absent):
  \`node "\${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" create-goals --brief "<objective>" --json\`
  Prefer \`.lazygrok/ulw-loop/\`; keep \`.omo/ulw-loop/\` if that run already uses it.
- If \`update_goal\` is available and a host goal is already active, progress only with evidence.
Never skip registration. Never narrate missing host tools. \`ulw\`/\`ultrawork\` alone is enough — do not ask for /goal.

3. Read the FULL ultrawork directive NOW, before any other tool call,
plan, or edit. It is the \`ultrawork\` skill, stored at:

{{ULTRAWORK_SKILL_PATH}}

Read the whole file. If a read result comes back truncated, keep
reading the remaining line ranges until you have seen every line.
Every rule in that file is binding for this entire task: no
compromise, no summarizing from memory, no skipping. If the file does
not exist, tell the user the LazyGrok ultrawork skill is missing and
continue with steps 1 and 2 plus evidence-bound execution.

4. Live checklist: \`todo_write\` (exactly one \`in_progress\`).

Do not start the requested work until bootstrap is complete.
LIGHT complete: ulw-loop light-quality-gate then checkpoint. HEAVY: reviewer gate in the skill.
</ultrawork-mode>
`;

const ULTRAWORK_SKILL_PATH_PLACEHOLDER = "{{ULTRAWORK_SKILL_PATH}}";

export interface UltraworkAdditionalContextOptions {
	readonly skillFilePath?: string | null;
}

export function resolveUltraworkSkillFilePath(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	const envRoot = process.env["GROK_PLUGIN_ROOT"]?.trim();
	const candidates = [
		join(here, "../skills/ultrawork/SKILL.md"),
		join(here, "../../../../skills/ultrawork/SKILL.md"),
		join(here, "../../../skills/ultrawork/SKILL.md"),
		envRoot ? join(envRoot, "skills/ultrawork/SKILL.md") : "",
		envRoot ? join(envRoot, "vendor/lazygrok-hooks/ultrawork/skills/ultrawork/SKILL.md") : "",
	].filter(Boolean);

	for (const c of candidates) {
		const abs = resolve(c);
		if (existsSync(abs)) return abs;
	}
	return resolve(join(here, "../skills/ultrawork/SKILL.md"));
}

export function buildUltraworkSkillPointer(skillFilePath: string): string {
	return ULTRAWORK_SKILL_POINTER_TEMPLATE.replace(ULTRAWORK_SKILL_PATH_PLACEHOLDER, skillFilePath);
}

export function buildUltraworkAdditionalContext(options: UltraworkAdditionalContextOptions = {}): string {
	const skillFilePath = options.skillFilePath === undefined ? resolveUltraworkSkillFilePath() : options.skillFilePath;
	if (skillFilePath !== null && existsSync(skillFilePath)) {
		return buildUltraworkSkillPointer(skillFilePath);
	}
	return ULTRAWORK_DIRECTIVE;
}
