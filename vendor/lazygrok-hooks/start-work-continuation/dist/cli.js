#!/usr/bin/env node

// src/cli.ts
import { lstatSync as lstatSync2, readFileSync as readFileSync3, statSync } from "node:fs";
import { stdin as processStdin, stdout as processStdout } from "node:process";

// src/boulder-reader.ts
import { existsSync as existsSync3, lstatSync, readFileSync, realpathSync as realpathSync2 } from "node:fs";
import { dirname as dirname2, isAbsolute as isAbsolute2, join as join2, relative as relative2, resolve as resolve2 } from "node:path";

// src/file-safety.ts
import { closeSync, constants, existsSync, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
function isInside(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot);
}
function readBoundedRegularTextFile(path, maxBytes, workspace) {
  const parentDescriptor = openSync(dirname(path), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const procParent = `/proc/self/fd/${parentDescriptor}`;
  let fileDescriptor;
  try {
    fileDescriptor = openSync(existsSync(procParent) ? join(procParent, basename(path)) : path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } finally {
    closeSync(parentDescriptor);
  }
  try {
    const file = fstatSync(fileDescriptor);
    if (!file.isFile() || file.nlink !== 1 || file.size > maxBytes) {
      throw new Error("start-work input is not a bounded regular file");
    }
    if (workspace !== undefined) {
      const canonicalWorkspace = realpathSync(resolve(workspace));
      const descriptorPath = `/proc/self/fd/${fileDescriptor}`;
      const openedPath = existsSync(descriptorPath) ? realpathSync(descriptorPath) : realpathSync(path);
      if (!isInside(canonicalWorkspace, openedPath))
        throw new Error("start-work input escaped the workspace");
    }
    const snapshotBytes = fstatSync(fileDescriptor).size;
    if (!Number.isSafeInteger(snapshotBytes) || snapshotBytes < 0 || snapshotBytes > maxBytes) {
      throw new Error("start-work input is not a bounded regular file");
    }
    const buffer = Buffer.alloc(snapshotBytes);
    let offset = 0;
    while (offset < snapshotBytes) {
      const bytesRead = readSync(fileDescriptor, buffer, offset, snapshotBytes - offset, offset);
      if (bytesRead === 0)
        break;
      offset += bytesRead;
    }
    return buffer.subarray(0, offset).toString("utf8");
  } finally {
    closeSync(fileDescriptor);
  }
}

// src/plan-checklist.ts
import { existsSync as existsSync2 } from "node:fs";
var TODO_HEADING_PATTERN = /^##[ \t]+TODOs(?:[ \t]+#+)?[ \t]*$/i;
var FINAL_VERIFICATION_HEADING_PATTERN = /^##[ \t]+Final Verification Wave(?:[ \t]+#+)?[ \t]*$/i;
var SECTION_BOUNDARY_HEADING_PATTERN = /^#{1,2}(?:[ \t]+|$)/;
var FENCE_PATTERN = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/;
var SIMPLE_CHECKBOX_PATTERN = /^[-*][ \t]*\[[ \t]*([xX]?)[ \t]*\][ \t]+(.+)$/;
var TODO_CHECKBOX_PATTERN = /^- \[([ xX])\] ([1-9]\d*\. .+)$/;
var FINAL_WAVE_CHECKBOX_PATTERN = /^- \[([ xX])\] (F[1-9]\d*\. .+)$/i;
var MAX_PLAN_BYTES = 10 * 1024 * 1024;
function getPlanChecklist(planPath, workspace) {
  if (!existsSync2(planPath))
    return emptyChecklist();
  try {
    return parsePlanChecklist(readBoundedRegularTextFile(planPath, MAX_PLAN_BYTES, workspace));
  } catch (error) {
    if (error instanceof Error)
      return emptyChecklist();
    throw error;
  }
}
function parsePlanChecklist(markdown) {
  const lines = markdown.split(/\r?\n/);
  if (!hasStructuredSection(lines))
    return parseSimpleChecklist(lines);
  let completed = 0;
  let remaining = 0;
  let nextTaskLabel = null;
  let section = "other";
  let fence = null;
  for (const line of lines) {
    if (fence !== null) {
      if (isClosingFence(line, fence))
        fence = null;
      continue;
    }
    const openingFence = parseOpeningFence(line);
    if (openingFence !== null) {
      fence = openingFence;
      continue;
    }
    if (SECTION_BOUNDARY_HEADING_PATTERN.test(line)) {
      section = parseStructuredSectionHeading(line);
      continue;
    }
    if (section === "other")
      continue;
    const checkbox = parseStructuredCheckbox(line, section);
    if (checkbox === null)
      continue;
    if (checkbox.checked)
      completed += 1;
    else {
      remaining += 1;
      nextTaskLabel = nextTaskLabel ?? checkbox.label;
    }
  }
  return { completed, remaining, total: completed + remaining, nextTaskLabel };
}
function hasStructuredSection(lines) {
  let fence = null;
  for (const line of lines) {
    if (fence !== null) {
      if (isClosingFence(line, fence))
        fence = null;
      continue;
    }
    const openingFence = parseOpeningFence(line);
    if (openingFence !== null) {
      fence = openingFence;
      continue;
    }
    if (parseStructuredSectionHeading(line) !== "other")
      return true;
  }
  return false;
}
function parseSimpleChecklist(lines) {
  let completed = 0;
  let remaining = 0;
  let nextTaskLabel = null;
  let fence = null;
  for (const line of lines) {
    if (fence !== null) {
      if (isClosingFence(line, fence))
        fence = null;
      continue;
    }
    const openingFence = parseOpeningFence(line);
    if (openingFence !== null) {
      fence = openingFence;
      continue;
    }
    const checkbox = parseSimpleTopLevelCheckbox(line);
    if (checkbox === null)
      continue;
    if (checkbox.checked)
      completed += 1;
    else {
      remaining += 1;
      nextTaskLabel = nextTaskLabel ?? checkbox.label;
    }
  }
  return { completed, remaining, total: completed + remaining, nextTaskLabel };
}
function parseStructuredSectionHeading(line) {
  if (TODO_HEADING_PATTERN.test(line))
    return "todo";
  if (FINAL_VERIFICATION_HEADING_PATTERN.test(line))
    return "final-wave";
  return "other";
}
function parseStructuredCheckbox(line, section) {
  const pattern = section === "todo" ? TODO_CHECKBOX_PATTERN : FINAL_WAVE_CHECKBOX_PATTERN;
  const match = line.match(pattern);
  const marker = match?.[1];
  const label = match?.[2];
  if (marker === undefined || label === undefined)
    return null;
  return { checked: marker.toLowerCase() === "x", label };
}
function parseSimpleTopLevelCheckbox(line) {
  const match = line.match(SIMPLE_CHECKBOX_PATTERN);
  const marker = match?.[1];
  const label = match?.[2];
  if (marker === undefined || label === undefined)
    return null;
  return { checked: marker.toLowerCase() === "x", label };
}
function parseOpeningFence(line) {
  const match = line.match(FENCE_PATTERN);
  const run = match?.[1];
  const info = match?.[2];
  const marker = run?.charAt(0);
  if (run === undefined || info === undefined || marker !== "`" && marker !== "~" || marker === "`" && info.includes("`"))
    return null;
  return { marker, length: run.length };
}
function isClosingFence(line, fence) {
  const run = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/)?.[1];
  return run?.charAt(0) === fence.marker && run.length >= fence.length;
}
function emptyChecklist() {
  return { completed: 0, remaining: 0, total: 0, nextTaskLabel: null };
}

// src/boulder-reader.ts
var SESSION_ID_PREFIX_PATTERN = /^(grok|codex|opencode):/;
var MAX_BOULDER_BYTES = 1024 * 1024;
function readContinuationState(cwd, sessionId) {
  for (const boulderPath of getBoulderFilePaths(cwd)) {
    const continuation = readContinuationStateFromBoulder(cwd, sessionId, boulderPath);
    if (continuation !== null)
      return continuation;
  }
  return null;
}
function readContinuationStateFromBoulder(cwd, sessionId, boulderPath) {
  const boulderState = readBoulderState(cwd, boulderPath);
  if (boulderState === null)
    return null;
  const work = getWorkForSession(boulderState, sessionId);
  if (work === null || !isContinuableStatus(work.status))
    return null;
  const stateRoot = getStateRootForBoulder(cwd, boulderPath);
  if (stateRoot === null)
    return null;
  const resolved = resolveBoulderPathsForWork(cwd, work, stateRoot);
  if (resolved === null)
    return null;
  const { planPath, worktreePath } = resolved;
  const checklist = getPlanChecklist(planPath, worktreePath ?? cwd);
  if (checklist.total === 0)
    return null;
  return {
    planName: work.planName,
    planPath,
    boulderPath,
    ledgerPath: join2(cwd, stateRoot, "start-work", "ledger.jsonl"),
    worktreePath,
    checklist
  };
}
function readBoulderState(cwd, path) {
  try {
    const parsed = JSON.parse(readBoundedRegularTextFile(path, MAX_BOULDER_BYTES, cwd));
    return parseBoulderState(parsed);
  } catch (error) {
    if (error instanceof Error)
      return null;
    throw error;
  }
}
function parseBoulderState(value) {
  if (!isRecord(value))
    return null;
  const works = [];
  const worksValue = value["works"];
  const hasWorksMap = isRecord(worksValue);
  if (hasWorksMap) {
    for (const workValue of Object.values(worksValue)) {
      const work = parseBoulderWork(workValue);
      if (work !== null)
        works.push(work);
    }
  }
  const mirrorWork = parseBoulderWork(value);
  if (works.length === 0 && mirrorWork === null)
    return null;
  return { works, mirrorWork, hasWorksMap };
}
function parseBoulderWork(value) {
  if (!isRecord(value))
    return null;
  const activePlan = value["active_plan"];
  const planName = value["plan_name"];
  if (typeof activePlan !== "string")
    return null;
  const status = parseBoulderWorkStatus(value["status"]);
  const sessionIds = parseSessionIds(value["session_ids"]);
  const worktreePath = value["worktree_path"];
  const startedAt = value["started_at"];
  const updatedAt = value["updated_at"];
  return {
    activePlan,
    planName: typeof planName === "string" ? planName : activePlan,
    sessionIds,
    ...status === undefined ? {} : { status },
    ...typeof startedAt === "string" ? { startedAt } : {},
    ...typeof updatedAt === "string" ? { updatedAt } : {},
    ...typeof worktreePath === "string" ? { worktreePath } : {}
  };
}
function getWorkForSession(state, sessionId) {
  let newestWork = null;
  let newestWorkMs = 0;
  for (const work of state.works) {
    if (!work.sessionIds.some((candidate) => sessionMatches(candidate, sessionId)))
      continue;
    const workMs = parseIsoToMs(work.updatedAt ?? work.startedAt) ?? 0;
    if (newestWork === null || workMs > newestWorkMs) {
      newestWork = work;
      newestWorkMs = workMs;
    }
  }
  if (newestWork !== null)
    return newestWork;
  if (state.hasWorksMap)
    return null;
  if (state.mirrorWork?.sessionIds.some((candidate) => sessionMatches(candidate, sessionId)) === true)
    return state.mirrorWork;
  return null;
}
function resolveBoulderPathsForWork(cwd, work, stateRoot) {
  const absolutePlanPath = resolveTrackedPath(cwd, work.activePlan);
  if (!isAllowedPlanPath(cwd, absolutePlanPath, stateRoot))
    return null;
  const worktreePath = work.worktreePath?.trim();
  if (worktreePath === undefined || worktreePath.length === 0)
    return { planPath: absolutePlanPath, worktreePath: null };
  const relativePlanPath = relative2(resolve2(cwd), absolutePlanPath);
  if (relativePlanPath.length === 0 || relativePlanPath.startsWith("..") || isAbsolute2(relativePlanPath)) {
    return { planPath: absolutePlanPath, worktreePath: null };
  }
  const canonicalWorktree = trustedWorktreePath(cwd, resolveTrackedPath(cwd, worktreePath));
  if (canonicalWorktree === null)
    return { planPath: absolutePlanPath, worktreePath: null };
  const worktreePlanPath = resolve2(canonicalWorktree, relativePlanPath);
  return isAllowedPlanPath(canonicalWorktree, worktreePlanPath, stateRoot) && existsSync3(worktreePlanPath) ? { planPath: worktreePlanPath, worktreePath: canonicalWorktree } : { planPath: absolutePlanPath, worktreePath: null };
}
function resolveTrackedPath(baseDirectory, trackedPath) {
  return isAbsolute2(trackedPath) ? resolve2(trackedPath) : resolve2(baseDirectory, trackedPath);
}
function isAllowedPlanPath(workspace, planPath, stateRoot) {
  try {
    const lexicalWorkspace = resolve2(workspace);
    const canonicalWorkspace = realpathSync2(lexicalWorkspace);
    const canonicalPlan = resolve2(canonicalWorkspace, relative2(lexicalWorkspace, resolve2(planPath)));
    const plansRoot = join2(canonicalWorkspace, stateRoot, "plans");
    if (!isInside2(plansRoot, canonicalPlan) || !existsSync3(canonicalPlan))
      return false;
    let current = canonicalWorkspace;
    for (const component of relative2(canonicalWorkspace, canonicalPlan).split(/[\\/]+/u).filter(Boolean)) {
      current = join2(current, component);
      if (!existsSync3(current) || lstatSync(current).isSymbolicLink())
        return false;
      if (!isInside2(canonicalWorkspace, realpathSync2(current)))
        return false;
    }
    return lstatSync(canonicalPlan).isFile();
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
}
function trustedWorktreePath(cwd, candidate) {
  if (!existsSync3(candidate) || !lstatSync(candidate).isDirectory())
    return null;
  const canonicalCandidate = realpathSync2(candidate);
  const cwdCommonDir = gitCommonDirectory(cwd);
  const candidateCommonDir = gitCommonDirectory(canonicalCandidate);
  if (cwdCommonDir === null || candidateCommonDir === null || cwdCommonDir !== candidateCommonDir)
    return null;
  return canonicalCandidate;
}
function gitCommonDirectory(worktree) {
  try {
    const dotGit = join2(realpathSync2(worktree), ".git");
    if (!existsSync3(dotGit))
      return null;
    if (lstatSync(dotGit).isDirectory())
      return realpathSync2(dotGit);
    if (!lstatSync(dotGit).isFile())
      return null;
    const match = /^gitdir:\s*(.+)\s*$/u.exec(readFileSync(dotGit, "utf8"));
    const gitDirectory = match?.[1];
    if (gitDirectory === undefined)
      return null;
    const canonicalGitDirectory = realpathSync2(resolve2(dirname2(dotGit), gitDirectory));
    const commonDirFile = join2(canonicalGitDirectory, "commondir");
    return existsSync3(commonDirFile) ? realpathSync2(resolve2(canonicalGitDirectory, readFileSync(commonDirFile, "utf8").trim())) : canonicalGitDirectory;
  } catch (error) {
    if (error instanceof Error)
      return null;
    throw error;
  }
}
function isInside2(root, path) {
  const relativePath = relative2(root, path);
  return relativePath === "" || !relativePath.startsWith("..") && !isAbsolute2(relativePath);
}
function parseBoulderWorkStatus(value) {
  if (value === "active" || value === "paused" || value === "completed" || value === "abandoned")
    return value;
  return;
}
function parseSessionIds(value) {
  if (!Array.isArray(value))
    return [];
  const sessionIds = [];
  for (const item of value) {
    if (typeof item === "string")
      sessionIds.push(normalizeSessionId(item));
  }
  return sessionIds;
}
function normalizeSessionId(sessionId, platform = "opencode") {
  if (SESSION_ID_PREFIX_PATTERN.test(sessionId))
    return sessionId;
  return `${platform}:${sessionId}`;
}
function sessionKey(sessionId) {
  return sessionId.replace(SESSION_ID_PREFIX_PATTERN, "");
}
function sessionMatches(candidate, sessionId) {
  return sessionKey(candidate) === sessionKey(sessionId);
}
function parseIsoToMs(value) {
  if (value === undefined)
    return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
function isContinuableStatus(status) {
  return status === "active" || status === "paused";
}
function getBoulderFilePaths(cwd) {
  return [join2(cwd, ".lazygrok", "boulder.json"), join2(cwd, ".omo", "boulder.json")];
}
function getStateRootForBoulder(cwd, boulderPath) {
  for (const stateRoot of [".lazygrok", ".omo"]) {
    if (resolve2(boulderPath) === resolve2(cwd, stateRoot, "boulder.json"))
      return stateRoot;
  }
  return null;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/directive.ts
import { readFileSync as readFileSync2 } from "node:fs";
var START_WORK_CONTINUATION_DIRECTIVE = readFileSync2(new URL("../directive.md", import.meta.url), "utf8");

// src/codex-hook.ts
function runStopHook(input, fs) {
  const payload = parseStopInput(input);
  if (payload === null)
    return "";
  if (payload.stop_hook_active)
    return "";
  if (transcriptHasContextPressureMarker(payload.transcript_path, fs))
    return "";
  const state = readContinuationState(payload.cwd, payload.session_id);
  if (state === null)
    return "";
  return JSON.stringify({
    decision: "block",
    reason: renderDirective(state, payload.session_id)
  });
}
function renderDirective(state, sessionId) {
  const lineBreak = String.fromCharCode(10);
  const worktreeBlock = state.worktreePath === null ? "" : `${lineBreak}- Worktree: \`${safeDirectiveValue(state.worktreePath)}\` (all edits, tests, and commands run inside this directory)`;
  const replacements = {
    PLAN_NAME: safeDirectiveValue(state.planName),
    PLAN_PATH: safeDirectiveValue(state.planPath),
    BOULDER_PATH: safeDirectiveValue(state.boulderPath),
    REMAINING_COUNT: String(state.checklist.remaining),
    TOTAL_COUNT: String(state.checklist.total),
    NEXT_TASK_LABEL: safeDirectiveValue(state.checklist.nextTaskLabel ?? "none (final gate pending)"),
    WORKTREE_BLOCK: worktreeBlock,
    LEDGER_PATH: safeDirectiveValue(state.ledgerPath),
    SESSION_ID: safeDirectiveValue(sessionId)
  };
  let rendered = START_WORK_CONTINUATION_DIRECTIVE;
  for (const [placeholder, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(`{{${placeholder}}}`, value);
  }
  return rendered;
}
function safeDirectiveValue(value) {
  return value.replace(/[\u0000-\u001f\u007f`]+/gu, " ").trim();
}
var CONTEXT_PRESSURE_MARKERS = [
  "context compacted",
  "context_length_exceeded",
  "skill descriptions were shortened",
  "context_too_large",
  "codex ran out of room in the model's context window",
  "your input exceeds the context window",
  "long threads and multiple compactions"
];
function transcriptHasContextPressureMarker(transcriptPath, fs) {
  if (transcriptPath === null || transcriptPath.length === 0)
    return false;
  try {
    const transcript = fs.readBoundedRegularTextFile?.(transcriptPath, 10 * 1024 * 1024) ?? readLegacyBoundedTranscript(transcriptPath, fs);
    return CONTEXT_PRESSURE_MARKERS.some((marker) => transcript.toLowerCase().includes(marker));
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
}
function readLegacyBoundedTranscript(transcriptPath, fs) {
  const linkStat = fs.lstatSync?.(transcriptPath);
  if (linkStat?.isSymbolicLink() === true)
    return "";
  const stat = fs.statSync?.(transcriptPath);
  if (stat !== undefined && (!stat.isFile() || stat.size > 10 * 1024 * 1024))
    return "";
  return fs.readFileSync(transcriptPath, "utf8").toLowerCase();
}
function parseStopInput(value) {
  if (!isRecord2(value))
    return null;
  const eventName = value["hook_event_name"];
  const sessionId = value["session_id"];
  const turnId = value["turn_id"];
  const transcriptPath = value["transcript_path"];
  const cwd = value["cwd"];
  const model = value["model"];
  const permissionMode = value["permission_mode"];
  const stopHookActive = value["stop_hook_active"];
  const lastAssistantMessage = value["last_assistant_message"];
  if (!isStopHookEventName(eventName) || typeof sessionId !== "string" || typeof turnId !== "string" || transcriptPath !== undefined && transcriptPath !== null && typeof transcriptPath !== "string" || typeof cwd !== "string" || typeof model !== "string" || typeof permissionMode !== "string" || typeof stopHookActive !== "boolean" || !optionalString(lastAssistantMessage)) {
    return null;
  }
  return {
    hook_event_name: eventName,
    session_id: sessionId,
    turn_id: turnId,
    transcript_path: typeof transcriptPath === "string" ? transcriptPath : null,
    cwd,
    model,
    permission_mode: permissionMode,
    stop_hook_active: stopHookActive,
    ...typeof lastAssistantMessage === "string" ? { last_assistant_message: lastAssistantMessage } : {}
  };
}
function isStopHookEventName(value) {
  return value === "Stop" || value === "SubagentStop";
}
function optionalString(value) {
  return value === undefined || typeof value === "string";
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/cli.ts
var MAX_HOOK_INPUT_BYTES = 10 * 1024 * 1024;
var nodeFileSystem = {
  lstatSync: lstatSync2,
  readBoundedRegularTextFile,
  readFileSync(path, encoding) {
    return readFileSync3(path, encoding);
  },
  statSync
};
var command = process.argv[2];
var subcommand = process.argv[3];
if (command === "hook" && (subcommand === "stop" || subcommand === "subagent-stop")) {
  await runHookCli();
} else {
  process.stderr.write(`Usage: omo-start-work-continuation hook <stop|subagent-stop>
`);
  process.exitCode = 1;
}
async function runHookCli() {
  const raw = await readStdin();
  if (raw.trim().length === 0)
    return;
  const parsed = parseHookInput(raw);
  const output = runStopHook(parsed, nodeFileSystem);
  if (output.length > 0)
    processStdout.write(output);
}
function parseHookInput(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError)
      return;
    throw error;
  }
}
function readStdin() {
  return new Promise((resolve3) => {
    let data = "";
    let totalBytes = 0;
    let tooLarge = false;
    processStdin.setEncoding("utf8");
    processStdin.on("data", (chunk) => {
      totalBytes += Buffer.byteLength(chunk, "utf8");
      if (totalBytes > MAX_HOOK_INPUT_BYTES) {
        tooLarge = true;
        data = "";
        return;
      }
      if (!tooLarge)
        data += chunk;
    });
    processStdin.once("error", () => resolve3(tooLarge ? "" : data));
    processStdin.once("end", () => resolve3(tooLarge ? "" : data));
  });
}
