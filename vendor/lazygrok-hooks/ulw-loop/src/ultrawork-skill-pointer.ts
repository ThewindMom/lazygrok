import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Grok-native bootstrap: host goal tools are often absent when workflows are on. */
export const ULTRAWORK_SKILL_POINTER_TEMPLATE = `<ultrawork-mode>
ULTRAWORK MODE IS ACTIVE FOR THIS TASK.

MANDATORY BOOTSTRAP: do all three steps, in order, before anything else.

1. First user-visible line this turn MUST be exactly:
\`ULTRAWORK MODE ENABLED!\`

2. Register the binding goal NOW (silent — never narrate missing tools):
If host tool \`update_goal\` or \`create_goal\` is in your tool list,
call it with \`objective\` only (no status/budget). Otherwise open with
a binding \`# Goal\` block — that is the normal Grok path, not a defect.
Prefer also \`ulw-loop create-goals\` / skill \`ulw-evidence\` when the CLI is available.

3. Read the FULL ultrawork directive NOW, before any other tool call,
plan, or edit. It is the \`ultrawork\` skill, stored at:

{{ULTRAWORK_SKILL_PATH}}

Read the whole file. If a read result comes back truncated, keep
reading the remaining line ranges until you have seen every line.
Every rule in that file is binding for this entire task: no
compromise, no summarizing from memory, no skipping. If the file does
not exist, tell the user the lazygrok ultrawork skill is missing and
continue with steps 1 and 2 plus evidence-bound execution.

Do not start the requested work until all three steps are complete.
</ultrawork-mode>
`;

const ULTRAWORK_SKILL_PATH_PLACEHOLDER = "{{ULTRAWORK_SKILL_PATH}}";
const ULTRAWORK_DIRECTIVE = readFileSync(new URL("../directive.md", import.meta.url), "utf8");

export interface UltraworkAdditionalContextOptions {
  readonly skillFilePath?: string | null;
}

export function resolveUltraworkSkillFilePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const envRoot = process.env['GROK_PLUGIN_ROOT']?.trim();
  const candidates = [
    join(here, "../skills/ultrawork/SKILL.md"),
    join(here, "../../../../skills/ultrawork/SKILL.md"),
    join(here, "../../../skills/ultrawork/SKILL.md"),
    // ulw-loop lives next to ultrawork under lazygrok-hooks
    join(here, "../../ultrawork/skills/ultrawork/SKILL.md"),
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
