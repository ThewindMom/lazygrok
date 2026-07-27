import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { ULTRAWORK_DIRECTIVE } from "./directive.js";

/**
 * Compact bootstrap injected when the user types ulw / ultrawork.
 * User-facing contract: that one keyword is enough — no /goal ceremony required.
 */
export const ULTRAWORK_SKILL_POINTER_TEMPLATE = `<ultrawork-mode>
ULTRAWORK MODE IS ACTIVE FOR THIS TASK.

The user triggered ultrawork by saying **ulw** or **ultrawork**. That single
keyword is enough — do **not** ask them to also type /goal, /ulw-loop, or any
other command.

MANDATORY BOOTSTRAP (all steps, in order, before any implementation work):

1. First user-visible line this turn MUST be exactly:
\`ULTRAWORK MODE ENABLED!\`

2. Register the binding goal NOW from the user's request (strip the ulw/ultrawork
trigger words; the rest is the objective). Silent — never narrate missing tools:

   a. If tool \`create_goal\` is in your tool list → call it with \`objective\` only
      (no status, no token_budget).
   b. Else if tool \`update_goal\` is in your tool list → call it to set/progress the
      active goal with the objective (only if a host goal is already active; otherwise
      skip to c).
   c. Always open the reply with a binding markdown \`# Goal\` block (objective +
      tier + success criteria + when to stop) so the transcript has a contract.
   d. Always register durable structured criteria via the ulw-loop CLI (skill
      \`ulw-evidence\`) in the same bootstrap wave:
      \`node "\${GROK_PLUGIN_ROOT}/vendor/lazygrok-hooks/ulw-loop/dist/cli.js" create-goals --brief "<objective>" --json\`
      (or \`omo ulw-loop create-goals …\` if available). Prefer \`.lazygrok/ulw-loop/\`;
      if the CLI already uses \`.omo/ulw-loop/\`, keep that run's root.

3. Read the FULL ultrawork directive NOW, before any other tool call, plan, or
edit. It is the \`ultrawork\` skill at:

{{ULTRAWORK_SKILL_PATH}}

Read the whole file (re-read remaining ranges if truncated). Every rule is binding
for this entire task. Also load \`ulw-loop\` + \`ulw-evidence\` when criteria/evidence
work starts; do not make the user invoke separate slash commands.

4. Live checklist: \`todo_write\` (exactly one \`in_progress\`).

Do not start the requested implementation until steps 1–3 are complete.
On LIGHT completion: after all criteria pass, use \`ulw-loop light-quality-gate\` then
\`checkpoint --status complete\` with that gate JSON. On HEAVY: full reviewer gate.
If host \`update_goal\` exists and a host goal is active, mark it complete only after
evidence is real — never invent completion.
</ultrawork-mode>
`;

const ULTRAWORK_SKILL_PATH_PLACEHOLDER = "{{ULTRAWORK_SKILL_PATH}}";

export interface UltraworkAdditionalContextOptions {
  readonly skillFilePath?: string | null;
}

/**
 * Resolve ultrawork SKILL.md for both LazyCodex layout and LazyGrok layout.
 * LazyGrok ships the skill under component skills/ and plugin skills/.
 */
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
