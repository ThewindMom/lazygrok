#!/usr/bin/env node

// src/checkpoint.ts
import { existsSync as existsSync3, lstatSync as lstatSync3, realpathSync as realpathSync3, statSync as statSync2 } from "node:fs";
import { resolve as resolve6 } from "node:path";

// src/file-safety.ts
import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants as constants2,
  existsSync,
  fchmodSync,
  fstatSync as fstatSync2,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { open } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

// src/bounded-read.ts
import { fstatSync, readSync } from "node:fs";
// src/constants.ts
var ULW_LOOP_DIR = ".lazygrok/ulw-loop";
var ULW_LOOP_LEGACY_DIR = ".omo/ulw-loop";
var ULW_LOOP_BRIEF = "brief.md";
var ULW_LOOP_GOALS = "goals.json";
var ULW_LOOP_LEDGER = "ledger.jsonl";
var ULW_LOOP_STEERING_MUTATION_KINDS = [
  "add_subgoal",
  "split_subgoal",
  "reorder_pending",
  "revise_pending_wording",
  "revise_criterion",
  "annotate_ledger",
  "mark_blocked_superseded"
];
var ULW_LOOP_SUCCESS_CRITERION_USER_MODELS = [
  "happy",
  "edge",
  "regression",
  "adversarial"
];
// src/runtime.ts
class UlwLoopError extends Error {
  code;
  details;
  constructor(message, code, opts) {
    super(message, opts?.cause === undefined ? undefined : { cause: opts.cause });
    this.name = "UlwLoopError";
    this.code = code;
    if (opts?.details !== undefined) {
      this.details = opts.details;
    }
  }
}
function iso() {
  return new Date().toISOString();
}
// src/bounded-read.ts
function readBoundedDescriptorText(fileDescriptor, maxBytes) {
  const snapshotBytes = fstatSync(fileDescriptor).size;
  if (!Number.isSafeInteger(snapshotBytes) || snapshotBytes < 0 || snapshotBytes > maxBytes) {
    throw new UlwLoopError("ULW input is not a bounded regular file.", "ULW_LOOP_UNSAFE_PATH");
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
}

// src/file-safety.ts
function isInside(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot);
}
function safeWorkspacePath(repoRoot, candidate) {
  const lexicalRoot = resolve(repoRoot);
  const lexicalCandidate = resolve(candidate);
  if (!isInside(lexicalRoot, lexicalCandidate)) {
    throw new UlwLoopError("ULW state path escapes the workspace.", "ULW_LOOP_UNSAFE_PATH");
  }
  const canonicalRoot = realpathSync(lexicalRoot);
  const canonicalCandidate = resolve(canonicalRoot, relative(lexicalRoot, lexicalCandidate));
  let current = canonicalRoot;
  for (const component of relative(canonicalRoot, canonicalCandidate).split(/[\\/]+/u).filter(Boolean)) {
    current = join(current, component);
    if (!existsSync(current))
      break;
    if (lstatSync(current).isSymbolicLink()) {
      throw new UlwLoopError("ULW state paths may not contain symlinks.", "ULW_LOOP_UNSAFE_PATH");
    }
    if (!isInside(canonicalRoot, realpathSync(current))) {
      throw new UlwLoopError("ULW state path escapes the workspace.", "ULW_LOOP_UNSAFE_PATH");
    }
  }
  return canonicalCandidate;
}
function safeReadWorkspaceTextFile(repoRoot, candidate, maxBytes = 10 * 1024 * 1024) {
  const fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, candidate, maxBytes);
  try {
    return readBoundedDescriptorText(fileDescriptor, maxBytes);
  } finally {
    closeSync(fileDescriptor);
  }
}
function readBoundedRegularTextFile(candidate, maxBytes) {
  requireDescriptorAnchoring();
  const parentDescriptor = openSync(dirname(candidate), constants2.O_RDONLY | constants2.O_DIRECTORY | constants2.O_NOFOLLOW);
  const procParent = `/proc/self/fd/${parentDescriptor}`;
  let fileDescriptor;
  try {
    fileDescriptor = openSync(existsSync(procParent) ? join(procParent, basename(candidate)) : candidate, constants2.O_RDONLY | constants2.O_NOFOLLOW);
  } finally {
    closeSync(parentDescriptor);
  }
  try {
    const file = fstatSync2(fileDescriptor);
    if (!file.isFile() || file.nlink !== 1 || file.size > maxBytes) {
      throw new UlwLoopError("ULW input is not a bounded regular file.", "ULW_LOOP_UNSAFE_PATH");
    }
    return readBoundedDescriptorText(fileDescriptor, maxBytes);
  } finally {
    closeSync(fileDescriptor);
  }
}
function assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor, expectedKind = "file") {
  const canonicalRoot = realpathSync(repoRoot);
  const procPath = `/proc/self/fd/${fileDescriptor}`;
  if (existsSync(procPath)) {
    const openedPath = realpathSync(procPath);
    if (!isInside(canonicalRoot, openedPath)) {
      throw new UlwLoopError("ULW state file changed identity during write.", "ULW_LOOP_UNSAFE_PATH");
    }
  }
  const opened = fstatSync2(fileDescriptor);
  if (expectedKind === "file" && !opened.isFile() || expectedKind === "directory" && !opened.isDirectory()) {
    throw new UlwLoopError("ULW state output is not a regular file.", "ULW_LOOP_UNSAFE_PATH");
  }
  if (expectedKind === "file" && opened.nlink !== 1) {
    throw new UlwLoopError("ULW state files may not be hard linked.", "ULW_LOOP_UNSAFE_PATH");
  }
}
function ensureWorkspaceDirectory(repoRoot, directory) {
  requireDescriptorAnchoring();
  const canonicalRoot = realpathSync(resolve(repoRoot));
  const safeDirectory = safeWorkspacePath(repoRoot, directory);
  const components = relative(canonicalRoot, safeDirectory).split(/[\\/]+/u).filter(Boolean);
  let currentDescriptor = openSync(canonicalRoot, constants2.O_RDONLY | constants2.O_DIRECTORY | constants2.O_NOFOLLOW);
  try {
    assertOpenDescriptorInsideWorkspace(repoRoot, currentDescriptor, "directory");
    let fallbackPath = canonicalRoot;
    for (const component of components) {
      const procParent = `/proc/self/fd/${currentDescriptor}`;
      const entryPath = existsSync(procParent) ? join(procParent, component) : join(fallbackPath, component);
      try {
        mkdirSync(entryPath, { mode: 448 });
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST")
          throw error;
      }
      const childDescriptor = openSync(entryPath, constants2.O_RDONLY | constants2.O_DIRECTORY | constants2.O_NOFOLLOW);
      try {
        assertOpenDescriptorInsideWorkspace(repoRoot, childDescriptor, "directory");
        fchmodSync(childDescriptor, 448);
      } catch (error) {
        closeSync(childDescriptor);
        throw error;
      }
      closeSync(currentDescriptor);
      currentDescriptor = childDescriptor;
      fallbackPath = join(fallbackPath, component);
    }
  } finally {
    closeSync(currentDescriptor);
  }
}
function openAnchoredParent(repoRoot, safePath) {
  requireDescriptorAnchoring();
  const safeParent = safeWorkspacePath(repoRoot, dirname(safePath));
  const fileDescriptor = openSync(safeParent, constants2.O_RDONLY | constants2.O_DIRECTORY | constants2.O_NOFOLLOW);
  try {
    assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor, "directory");
    const procPath = `/proc/self/fd/${fileDescriptor}`;
    return {
      fileDescriptor,
      path: existsSync(procPath) ? join(procPath, basename(safePath)) : safePath
    };
  } catch (error) {
    closeSync(fileDescriptor);
    throw error;
  }
}
function requireDescriptorAnchoring() {
  if (process.platform !== "linux") {
    throw new UlwLoopError("ULW state and evidence operations require Linux descriptor anchoring.", "ULW_LOOP_UNSAFE_PATH");
  }
}
function safeOpenWorkspaceReadFile(repoRoot, candidate, maxBytes) {
  const safePath = safeWorkspacePath(repoRoot, candidate);
  const parent = openAnchoredParent(repoRoot, safePath);
  let fileDescriptor;
  try {
    fileDescriptor = openSync(parent.path, constants2.O_RDONLY | constants2.O_NOFOLLOW);
  } finally {
    closeSync(parent.fileDescriptor);
  }
  try {
    assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor);
    const file = fstatSync2(fileDescriptor);
    if (file.size > maxBytes) {
      throw new UlwLoopError("ULW state input is not a bounded regular file.", "ULW_LOOP_UNSAFE_PATH");
    }
    return fileDescriptor;
  } catch (error) {
    closeSync(fileDescriptor);
    throw error;
  }
}
function assertSafeEvidenceArtifact(repoRoot, candidate, attemptRoot, maxBytes) {
  const safePath = safeWorkspacePath(repoRoot, candidate);
  const safeAttemptRoot = attemptRoot === undefined ? undefined : safeWorkspacePath(repoRoot, attemptRoot);
  if (safeAttemptRoot !== undefined && (!isInside(safeAttemptRoot, safePath) || safeAttemptRoot === safePath)) {
    throw new UlwLoopError("ULW evidence artifact is outside the current attempt.", "ULW_LOOP_UNSAFE_PATH");
  }
  const fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, safePath, maxBytes);
  try {
    const file = fstatSync2(fileDescriptor);
    if (file.size <= 0) {
      throw new UlwLoopError("ULW evidence artifact is empty.", "ULW_LOOP_UNSAFE_PATH");
    }
    if (safeAttemptRoot !== undefined) {
      const procPath = `/proc/self/fd/${fileDescriptor}`;
      if (existsSync(procPath) && !isInside(realpathSync(safeAttemptRoot), realpathSync(procPath))) {
        throw new UlwLoopError("ULW evidence artifact changed identity.", "ULW_LOOP_UNSAFE_PATH");
      }
    }
  } finally {
    closeSync(fileDescriptor);
  }
}
function safeWriteWorkspaceTextFileSync(repoRoot, candidate, data) {
  const safePath = safeWorkspacePath(repoRoot, candidate);
  const safeParent = safeWorkspacePath(repoRoot, dirname(safePath));
  if (!existsSync(safeParent)) {
    throw new UlwLoopError("ULW state output directory is missing.", "ULW_LOOP_UNSAFE_PATH");
  }
  const parent = openAnchoredParent(repoRoot, safePath);
  const temporaryName = `.${basename(safePath)}.${randomUUID()}.tmp`;
  const temporaryPath = join(`/proc/self/fd/${parent.fileDescriptor}`, temporaryName);
  let fileDescriptor;
  try {
    fileDescriptor = openSync(temporaryPath, constants2.O_WRONLY | constants2.O_CREAT | constants2.O_EXCL | constants2.O_NOFOLLOW, 384);
    assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor);
    fchmodSync(fileDescriptor, 384);
    writeFileSync(fileDescriptor, data, "utf8");
    fsyncSync(fileDescriptor);
    closeSync(fileDescriptor);
    fileDescriptor = undefined;
    renameSync(temporaryPath, parent.path);
    fsyncSync(parent.fileDescriptor);
  } catch (error) {
    if (fileDescriptor !== undefined)
      closeSync(fileDescriptor);
    try {
      unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error) || !("code" in cleanupError) || cleanupError.code !== "ENOENT") {
        throw cleanupError;
      }
    }
    throw error;
  } finally {
    closeSync(parent.fileDescriptor);
  }
}
function safeOpenWorkspaceLockFile(repoRoot, candidate) {
  const initialPath = safeWorkspacePath(repoRoot, candidate);
  ensureWorkspaceDirectory(repoRoot, dirname(initialPath));
  const safePath = safeWorkspacePath(repoRoot, initialPath);
  const parent = openAnchoredParent(repoRoot, safePath);
  let fileDescriptor;
  try {
    fileDescriptor = openSync(parent.path, constants2.O_RDWR | constants2.O_CREAT | constants2.O_NOFOLLOW, 384);
    const opened = fstatSync2(fileDescriptor);
    const current = statSync(parent.path);
    assertOpenDescriptorInsideWorkspace(repoRoot, fileDescriptor);
    if (opened.dev !== current.dev || opened.ino !== current.ino) {
      throw new UlwLoopError("ULW lock file changed identity during open.", "ULW_LOOP_UNSAFE_PATH");
    }
    fchmodSync(fileDescriptor, 384);
    return fileDescriptor;
  } catch (error) {
    if (fileDescriptor !== undefined)
      closeSync(fileDescriptor);
    throw error;
  } finally {
    closeSync(parent.fileDescriptor);
  }
}
function safeUnlinkWorkspaceFile(repoRoot, candidate) {
  const safePath = safeWorkspacePath(repoRoot, candidate);
  const fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, safePath, 10 * 1024 * 1024);
  const parent = openAnchoredParent(repoRoot, safePath);
  try {
    const opened = fstatSync2(fileDescriptor);
    const current = statSync(parent.path);
    if (opened.dev !== current.dev || opened.ino !== current.ino) {
      throw new UlwLoopError("ULW state file changed identity before removal.", "ULW_LOOP_UNSAFE_PATH");
    }
    unlinkSync(parent.path);
    fsyncSync(parent.fileDescriptor);
  } finally {
    closeSync(fileDescriptor);
    closeSync(parent.fileDescriptor);
  }
}
async function openForWrite(path, append) {
  const mode = constants2.O_WRONLY | constants2.O_NOFOLLOW | (append ? constants2.O_APPEND : 0);
  try {
    return await open(path, mode);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
      throw error;
    return open(path, mode | constants2.O_CREAT | constants2.O_EXCL, 384);
  }
}
async function writeWorkspaceTextFile(repoRoot, candidate, data, append) {
  const initialPath = safeWorkspacePath(repoRoot, candidate);
  ensureWorkspaceDirectory(repoRoot, dirname(initialPath));
  const safePath = safeWorkspacePath(repoRoot, initialPath);
  const parent = openAnchoredParent(repoRoot, safePath);
  let handle;
  try {
    handle = await openForWrite(parent.path, append);
  } finally {
    closeSync(parent.fileDescriptor);
  }
  try {
    assertOpenDescriptorInsideWorkspace(repoRoot, handle.fd);
    await handle.chmod(384);
    if (!append)
      await handle.truncate(0);
    await handle.writeFile(data, "utf8");
  } finally {
    await handle.close();
  }
}
async function safeWriteWorkspaceTextFile(repoRoot, candidate, data) {
  await writeWorkspaceTextFile(repoRoot, candidate, data, false);
}
async function safeAppendWorkspaceTextFile(repoRoot, candidate, data) {
  await writeWorkspaceTextFile(repoRoot, candidate, data, true);
}
async function safeAtomicWriteWorkspaceTextFile(repoRoot, candidate, data) {
  const initialPath = safeWorkspacePath(repoRoot, candidate);
  ensureWorkspaceDirectory(repoRoot, dirname(initialPath));
  const safePath = safeWorkspacePath(repoRoot, initialPath);
  const parent = openAnchoredParent(repoRoot, safePath);
  const temporaryPath = join(dirname(parent.path), `.${basename(safePath)}.${randomUUID()}.tmp`);
  let temporaryHandle;
  let failure = null;
  try {
    try {
      const existing = openSync(parent.path, constants2.O_RDONLY | constants2.O_NOFOLLOW);
      try {
        assertOpenDescriptorInsideWorkspace(repoRoot, existing);
      } finally {
        closeSync(existing);
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
        throw error;
    }
    temporaryHandle = await open(temporaryPath, constants2.O_WRONLY | constants2.O_CREAT | constants2.O_EXCL | constants2.O_NOFOLLOW, 384);
    assertOpenDescriptorInsideWorkspace(repoRoot, temporaryHandle.fd);
    await temporaryHandle.writeFile(data, "utf8");
    await temporaryHandle.sync();
    await temporaryHandle.close();
    temporaryHandle = undefined;
    renameSync(temporaryPath, parent.path);
    fsyncSync(parent.fileDescriptor);
  } catch (error) {
    failure = error;
  }
  if (temporaryHandle !== undefined) {
    try {
      await temporaryHandle.close();
    } catch (error) {
      if (failure === null)
        failure = error;
    }
  }
  try {
    unlinkSync(temporaryPath);
  } catch (error) {
    if ((!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") && failure === null) {
      failure = error;
    }
  }
  try {
    closeSync(parent.fileDescriptor);
  } catch (error) {
    if (failure === null)
      failure = error;
  }
  if (failure !== null)
    throw failure;
}

// src/paths.ts
import { createHash } from "node:crypto";
import { existsSync as existsSync2, lstatSync as lstatSync2, readdirSync, readFileSync, realpathSync as realpathSync2 } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute as isAbsolute2, join as join2, relative as relative2, sep as sep2 } from "node:path";
var SESSION_ENV_KEYS = ["OMO_ULW_LOOP_SESSION_ID", "GROK_SESSION_ID", "GROK_THREAD_ID"];
var SESSION_BINDING_MAX_AGE_MS = 10 * 60 * 1000;
function normalizeUlwLoopSessionId(sessionId) {
  if (sessionId === null || sessionId === undefined || sessionId.length === 0 || sessionId.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(sessionId)) {
    return null;
  }
  return sessionId;
}
function resolveUlwLoopSessionIdFromEnv(env = process.env) {
  for (const key of SESSION_ENV_KEYS) {
    const value = env[key];
    if (value === undefined || value.length === 0)
      continue;
    const sessionId = normalizeUlwLoopSessionId(value);
    if (sessionId === null) {
      throw new UlwLoopError(`Invalid session ID in ${key}.`, "ULW_LOOP_SESSION_ID_INVALID");
    }
    return sessionId;
  }
  return null;
}
function resolveUlwLoopSessionIdFromBinding(repoRoot, options = {}) {
  const canonicalRoot = realpathSync2(repoRoot);
  const workspaceHash = createHash("sha256").update(canonicalRoot).digest("hex");
  const grokHome = options.homeDir === undefined ? process.env["GROK_HOME"] ?? join2(homedir(), ".grok") : join2(options.homeDir, ".grok");
  const bindingDir = join2(grokHome, "state", "lazygrok", "session-bindings");
  let entries;
  try {
    const directory = lstatSync2(bindingDir);
    if (!directory.isDirectory() || directory.isSymbolicLink())
      return null;
    entries = readdirSync(bindingDir);
  } catch {
    return null;
  }
  const nowMs = options.nowMs ?? Date.now();
  const sessionIds = new Set;
  for (const name of entries) {
    if (!name.startsWith(`${workspaceHash}-`) || !name.endsWith(".json"))
      continue;
    const path = join2(bindingDir, name);
    try {
      const info = lstatSync2(path);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 4096)
        continue;
      const binding = JSON.parse(readFileSync(path, "utf8"));
      if (binding.workspaceHash !== workspaceHash || typeof binding.sessionId !== "string" || typeof binding.updatedAt !== "string") {
        continue;
      }
      const sessionId = normalizeUlwLoopSessionId(binding.sessionId);
      const updatedAt = Date.parse(binding.updatedAt);
      if (sessionId !== binding.sessionId || !Number.isFinite(updatedAt) || updatedAt > nowMs + 60000 || nowMs - updatedAt > SESSION_BINDING_MAX_AGE_MS) {
        continue;
      }
      sessionIds.add(sessionId);
    } catch {}
  }
  if (sessionIds.size > 1) {
    throw new UlwLoopError("Multiple recent Grok sessions are active for this workspace; use the exact CURRENT_GROK_SESSION_ID from hook context.", "ULW_LOOP_SESSION_AMBIGUOUS");
  }
  return sessionIds.values().next().value ?? null;
}
function ulwLoopRelativeDir(scope, root = ULW_LOOP_DIR) {
  const requestedSessionId = scope?.sessionId;
  const sessionId = normalizeUlwLoopSessionId(requestedSessionId);
  if (requestedSessionId !== undefined && requestedSessionId !== null && sessionId === null) {
    throw new UlwLoopError("Invalid session id: expected one safe path segment.", "ULW_LOOP_SESSION_ID_INVALID");
  }
  return sessionId === null ? root : `${root}/${sessionId}`;
}
function ulwLoopDir(repoRoot, scope) {
  const canonical = join2(repoRoot, ulwLoopRelativeDir(scope));
  const legacy = join2(repoRoot, ulwLoopRelativeDir(scope, ULW_LOOP_LEGACY_DIR));
  if (hasSafeGoalsFile(repoRoot, canonical))
    return canonical;
  if (hasSafeGoalsFile(repoRoot, legacy))
    return legacy;
  return canonical;
}
function hasSafeGoalsFile(repoRoot, stateDir) {
  const goalsPath = join2(stateDir, ULW_LOOP_GOALS);
  if (!existsSync2(goalsPath))
    return false;
  safeWorkspacePath(repoRoot, goalsPath);
  return true;
}
function ulwLoopBriefRelativePath(scope) {
  return `${ulwLoopRelativeDir(scope)}/${ULW_LOOP_BRIEF}`;
}
function ulwLoopGoalsRelativePath(scope) {
  return `${ulwLoopRelativeDir(scope)}/${ULW_LOOP_GOALS}`;
}
function ulwLoopLedgerRelativePath(scope) {
  return `${ulwLoopRelativeDir(scope)}/${ULW_LOOP_LEDGER}`;
}
function ulwLoopBriefPath(repoRoot, scope) {
  return join2(ulwLoopDir(repoRoot, scope), ULW_LOOP_BRIEF);
}
function ulwLoopGoalsPath(repoRoot, scope) {
  return join2(ulwLoopDir(repoRoot, scope), ULW_LOOP_GOALS);
}
function ulwLoopLedgerPath(repoRoot, scope) {
  return join2(ulwLoopDir(repoRoot, scope), ULW_LOOP_LEDGER);
}
function repoRelative(absolutePath, repoRoot) {
  const slashPrefix = `${repoRoot}/`;
  const backslashPrefix = `${repoRoot}\\`;
  if (absolutePath.startsWith(slashPrefix))
    return absolutePath.slice(slashPrefix.length).split("\\").join("/");
  if (absolutePath.startsWith(backslashPrefix))
    return absolutePath.slice(backslashPrefix.length).split("\\").join("/");
  return absolutePath.split("\\").join("/");
}
function ulwLoopEvidenceRoot(repoRoot, scope) {
  const stateDir = repoRelative(ulwLoopDir(repoRoot, scope), repoRoot);
  return stateDir.startsWith(".omo/") ? ".omo/evidence" : ".lazygrok/evidence";
}
function ulwLoopAttemptEvidenceDir(repoRoot, goalId, attempt, scope) {
  assertSafeUlwLoopPathSegment(goalId, "goal id");
  if (!Number.isSafeInteger(attempt) || attempt < 0) {
    throw new UlwLoopError("Invalid ULW goal attempt.", "ULW_LOOP_UNSAFE_PATH");
  }
  const requestedSessionId = scope?.sessionId;
  const scopedSessionId = normalizeUlwLoopSessionId(requestedSessionId);
  if (requestedSessionId !== undefined && requestedSessionId !== null && scopedSessionId === null) {
    throw new UlwLoopError("Invalid session id: expected one safe path segment.", "ULW_LOOP_SESSION_ID_INVALID");
  }
  const sessionId = scopedSessionId ?? resolveUlwLoopSessionIdFromEnv() ?? "session";
  const evidenceRoot = ulwLoopEvidenceRoot(repoRoot, scope);
  return `${evidenceRoot}/ulw/${sessionId}/${goalId}/a${attempt}`;
}
function assertSafeUlwLoopPathSegment(value, label) {
  if (value.length === 0 || value.length > 160 || value === "." || value === ".." || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)) {
    throw new UlwLoopError(`Invalid ${label}: expected one safe path segment.`, "ULW_LOOP_UNSAFE_PATH");
  }
}
var PLATFORM_PATH_API = { relative: relative2, isAbsolute: isAbsolute2, sep: sep2 };
function isWithinAttemptDir(absolutePath, attemptRoot, pathApi = PLATFORM_PATH_API) {
  const relativePath = pathApi.relative(attemptRoot, absolutePath);
  if (relativePath === "")
    return true;
  if (relativePath === ".." || relativePath.startsWith(`..${pathApi.sep}`))
    return false;
  return !pathApi.isAbsolute(relativePath);
}

// src/goal-status.ts
var ULW_LOOP_AGGREGATE_CODEX_OBJECTIVE = aggregateCodexObjectiveForScope();
function aggregateCodexObjectiveForScope(scope) {
  return `Complete the durable ulw-loop plan in ${ulwLoopGoalsRelativePath(scope)}, including later accepted/appended stories, under the original brief constraints; use ${ulwLoopLedgerRelativePath(scope)} as the audit trail.`;
}
function codexGoalMode(plan) {
  return plan.codexGoalMode ?? "per_story";
}
function isResolvedStatus(status) {
  return status === "complete";
}
function isMemberResolved(goal, plan) {
  return isResolvedStatus(goal.status) || isSupersededResolved(goal, plan);
}
function isSupersededResolved(goal, plan) {
  if (goal.steeringStatus !== "superseded")
    return false;
  const replacements = goal.supersededBy ?? [];
  if (replacements.length === 0)
    return false;
  return replacements.every((id) => {
    const replacement = plan.goals.find((candidate) => candidate.id === id);
    return replacement !== undefined && isResolvedStatus(replacement.status);
  });
}
function isCompletionBlocking(goal, plan) {
  if (goal.steeringStatus === "superseded")
    return !isSupersededResolved(goal, plan);
  if (goal.steeringStatus === "blocked")
    return true;
  return !isResolvedStatus(goal.status);
}
function isCompletionBlockingForFinalCandidate(candidate, finalCandidate, plan) {
  if (candidate.id === finalCandidate.id)
    return false;
  if (candidate.steeringStatus === "superseded") {
    const replacements = candidate.supersededBy ?? [];
    if (replacements.length === 0)
      return true;
    return !replacements.every((id) => {
      if (id === finalCandidate.id)
        return true;
      const replacement = plan.goals.find((goal) => goal.id === id);
      return replacement !== undefined && isResolvedStatus(replacement.status);
    });
  }
  return isCompletionBlocking(candidate, plan);
}
function isUlwLoopDone(plan) {
  if (plan.aggregateCompletion?.status === "complete")
    return true;
  return plan.goals.every((goal) => !isCompletionBlocking(goal, plan));
}
function isFinalRunCompletionCandidate(plan, goal) {
  return isCompletionBlocking(goal, plan) && plan.goals.every((candidate) => !isCompletionBlockingForFinalCandidate(candidate, goal, plan));
}
function aggregateCodexObjective(plan) {
  return plan.codexObjective ?? ULW_LOOP_AGGREGATE_CODEX_OBJECTIVE;
}
function expectedCodexObjective(plan, goal) {
  return codexGoalMode(plan) === "aggregate" ? aggregateCodexObjective(plan) : goal.objective;
}
function compatibleCodexObjectives(plan) {
  return [aggregateCodexObjective(plan), ...plan.codexObjectiveAliases ?? []];
}
function hasAllCriteriaPass(goal) {
  return goal.successCriteria.length > 0 && goal.successCriteria.every((criterion) => criterion.status === "pass");
}
function isEssentialCriterion(criterion) {
  return criterion.essential ?? true;
}
function essentialCriteriaOf(goal) {
  const explicit = goal.successCriteria.filter(isEssentialCriterion);
  if (explicit.length > 0)
    return explicit;
  const happy = goal.successCriteria.find((criterion) => criterion.userModel === "happy");
  return happy === undefined ? [] : [happy];
}
function hasEssentialCriteriaPass(goal) {
  const criteria = essentialCriteriaOf(goal);
  return criteria.length > 0 && criteria.every((criterion) => criterion.status === "pass");
}

// src/runtime-command.ts
import { basename as basename2, dirname as dirname2, join as join3, resolve as resolve2 } from "node:path";
import { fileURLToPath } from "node:url";
function grokUlwCli() {
  const modulePath = fileURLToPath(import.meta.url);
  const moduleDir = dirname2(modulePath);
  const cliPath = basename2(moduleDir) === "src" ? resolve2(moduleDir, "../dist/cli.js") : basename2(modulePath) === "runtime-command.js" ? join3(moduleDir, "cli.js") : modulePath;
  return `node ${shellQuote(cliPath)}`;
}
function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

// src/checkpoint-reconciliation.ts
function normalizeObjective(value) {
  return value.replace(/\s+/g, " ").trim();
}
function textMentionsUlwLoopPlanArtifact(value) {
  const normalized = (value ?? "").toLowerCase();
  return normalized.includes(ULW_LOOP_DIR.toLowerCase()) || normalized.includes(ULW_LOOP_GOALS.toLowerCase()) || normalized.includes(ULW_LOOP_LEDGER.toLowerCase());
}
function textMentionsGoalId(value, goalId) {
  return (value ?? "").toLowerCase().includes(goalId.toLowerCase());
}
function textHasCompletionValidationEvidence(value) {
  const normalized = (value ?? "").toLowerCase();
  const done = /\b(?:planned work|implementation|deliverables?|scope|task|work)\b/.test(normalized) && /\b(?:done|complete|completed|finished|shipped)\b/.test(normalized);
  const verified = /\b(?:validation|verification|tests?|build|lint|review|quality gate|code-review)\b/.test(normalized) && /\b(?:passed|complete|completed|clean|green|approve|approved|clear)\b/.test(normalized);
  return done && verified;
}
async function snapshotObjectiveMapsToUlwLoopPlan(repoRoot, snapshotObjective, scope) {
  const actual = normalizeObjective(snapshotObjective).toLowerCase();
  if (textMentionsUlwLoopPlanArtifact(actual))
    return true;
  if (actual.length < 24)
    return false;
  try {
    const brief = normalizeObjective(safeReadWorkspaceTextFile(repoRoot, ulwLoopBriefPath(repoRoot, scope))).toLowerCase();
    return brief.length >= 24 && (brief.includes(actual) || actual.includes(brief));
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
}
async function canReconcileCompletedTaskScopedAggregateSnapshot(repoRoot, plan, goal, snapshotObjective, evidence, scope) {
  if (codexGoalMode(plan) !== "aggregate")
    return false;
  if (goal.status !== "in_progress" || plan.activeGoalId !== goal.id)
    return false;
  if (isFinalRunCompletionCandidate(plan, goal)) {
    return snapshotObjectiveMapsToUlwLoopPlan(repoRoot, snapshotObjective, scope);
  }
  if (!textMentionsUlwLoopPlanArtifact(evidence) || !textMentionsGoalId(evidence, goal.id))
    return false;
  if (!textHasCompletionValidationEvidence(evidence))
    return false;
  return snapshotObjectiveMapsToUlwLoopPlan(repoRoot, snapshotObjective, scope);
}
async function canReconcileActiveFinalTaskScopedAggregateSnapshot(repoRoot, plan, goal, snapshotObjective, evidence, scope) {
  if (codexGoalMode(plan) !== "aggregate")
    return false;
  if (goal.status !== "in_progress" || plan.activeGoalId !== goal.id)
    return false;
  if (!isFinalRunCompletionCandidate(plan, goal))
    return false;
  if (!textHasCompletionValidationEvidence(evidence))
    return false;
  return snapshotObjectiveMapsToUlwLoopPlan(repoRoot, snapshotObjective, scope);
}
function buildCompletedLegacyGoalRemediation(goal) {
  return [
    "If get_goal returns a different completed legacy/thread objective, do not repeat --status complete in this thread.",
    `Record a non-terminal blocker with: ${grokUlwCli()} checkpoint --goal-id ${goal.id} --status blocked --evidence "<completed legacy Codex goal blocks create_goal in this thread>" --codex-goal-json "<different completed get_goal JSON or path>".`,
    "Then continue only from a Codex goal context with no active/completed conflicting goal, in the same repo/worktree, and create the intended goal there."
  ].join(" ");
}
function buildTaskScopedAggregateReconciliationHint(goal, final) {
  if (final) {
    return ` Final task-scoped aggregate reconciliation requires the checkpoint goal to be the active in-progress final LazyGrok goal and the completed get_goal objective to map to the ulw-loop brief or artifact. ${buildCompletedLegacyGoalRemediation(goal)}`;
  }
  return ` Completed task-scoped aggregate reconciliation requires the checkpoint goal to be the active in-progress LazyGrok goal, evidence that names that active goal id, names .lazygrok/ulw-loop/goals.json or ledger.jsonl (or the existing .omo path for a legacy run), includes completed implementation plus validation/review evidence, and a get_goal objective that maps to the ulw-loop brief/artifact. ${buildCompletedLegacyGoalRemediation(goal)}`;
}

// src/codex-goal-snapshot.ts
import { resolve as resolve3 } from "node:path";
class CodexGoalSnapshotError extends Error {
}
function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeStatus(value) {
  const status = safeString(value).toLowerCase();
  if (status === "complete" || status === "completed" || status === "done")
    return "complete";
  if (status === "cancelled" || status === "canceled")
    return "cancelled";
  if (status === "failed" || status === "failure")
    return "failed";
  if (status === "active" || status === "in_progress" || status === "pending" || status === "running")
    return "active";
  return "unknown";
}
function normalizeObjective2(value) {
  return value.replace(/\s+/g, " ").trim();
}
function parseCodexGoalSnapshot(value) {
  const root = safeObject(value);
  const goalValue = Object.hasOwn(root, "goal") ? root["goal"] : value;
  if (goalValue === null || goalValue === undefined || goalValue === false) {
    return { available: false, raw: value };
  }
  const goal = safeObject(goalValue);
  const objective = safeString(goal["objective"] ?? goal["goal"] ?? goal["description"] ?? root["objective"]);
  const status = normalizeStatus(goal["status"] ?? root["status"]);
  return {
    available: Boolean(objective || status !== "unknown"),
    ...objective ? { objective } : {},
    status,
    raw: value
  };
}
async function readCodexGoalSnapshotInput(raw, cwd = process.cwd()) {
  if (!raw?.trim())
    return null;
  const trimmed = raw.trim();
  try {
    return parseCodexGoalSnapshot(JSON.parse(trimmed));
  } catch {
    try {
      return parseCodexGoalSnapshot(JSON.parse(safeReadWorkspaceTextFile(cwd, resolve3(cwd, trimmed))));
    } catch (error) {
      throw new CodexGoalSnapshotError(`Codex goal snapshot path does not contain valid JSON: ${trimmed}${error instanceof Error ? ` (${error.message})` : ""}`);
    }
  }
}
function reconcileCodexGoalSnapshot(snapshot, options) {
  const effectiveSnapshot = snapshot ?? { available: false, raw: null };
  const errors = [];
  const warnings = [];
  if (!effectiveSnapshot.available) {
    const message = "Codex goal snapshot is absent or reports no active goal; call get_goal and pass its JSON with --codex-goal-json.";
    if (options.requireSnapshot)
      errors.push(message);
    else
      warnings.push(message);
    return { ok: errors.length === 0, snapshot: effectiveSnapshot, warnings, errors };
  }
  const expected = normalizeObjective2(options.expectedObjective);
  const accepted = new Set([expected, ...(options.acceptedObjectives ?? []).map((objective) => normalizeObjective2(objective))].filter(Boolean));
  const actual = normalizeObjective2(effectiveSnapshot.objective ?? "");
  if (!actual) {
    errors.push("Codex goal snapshot is missing objective text.");
  } else if (!accepted.has(actual)) {
    errors.push(`Codex goal objective mismatch: expected "${expected}", got "${actual}".`);
  }
  const allowed = options.allowedStatuses ?? (options.requireComplete ? ["complete"] : ["active", "complete"]);
  const actualStatus = effectiveSnapshot.status ?? "unknown";
  if (!allowed.includes(actualStatus)) {
    errors.push(`Codex goal status mismatch: expected ${allowed.join(" or ")}, got ${actualStatus}.`);
  }
  if (options.requireComplete && actualStatus !== "complete") {
    errors.push('Codex goal is not complete; call update_goal({status: "complete"}) only after the objective is actually complete, then pass the fresh get_goal JSON.');
  }
  return { ok: errors.length === 0, snapshot: effectiveSnapshot, warnings, errors };
}
function formatCodexGoalReconciliation(reconciliation) {
  const parts = [...reconciliation.errors, ...reconciliation.warnings];
  return parts.join(" ");
}

// src/plan-io.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { closeSync as closeSync3, createReadStream, fstatSync as fstatSync3 } from "node:fs";
import { join as join5 } from "node:path";
import { createInterface } from "node:readline";

// src/interprocess-lock.ts
import { spawnSync } from "node:child_process";
import { closeSync as closeSync2 } from "node:fs";
var LOCK_TIMEOUT_MS = 30000;
function acquireLock(fileDescriptor) {
  const result = spawnSync("flock", ["-x", "3"], {
    stdio: ["ignore", "ignore", "pipe", fileDescriptor],
    timeout: LOCK_TIMEOUT_MS,
    encoding: "utf8"
  });
  if (result.status === 0)
    return;
  throw new UlwLoopError(result.error === undefined ? `Unable to acquire ULW interprocess lock: ${result.stderr.trim()}` : `Unable to acquire ULW interprocess lock: ${result.error.message}`, "ULW_LOOP_LOCK_FAILED");
}
function withInterprocessLockSync(repoRoot, lockPath, fn) {
  const fileDescriptor = safeOpenWorkspaceLockFile(repoRoot, lockPath);
  try {
    acquireLock(fileDescriptor);
    return fn();
  } finally {
    closeSync2(fileDescriptor);
  }
}
async function withInterprocessLock(repoRoot, lockPath, fn) {
  const fileDescriptor = safeOpenWorkspaceLockFile(repoRoot, lockPath);
  try {
    acquireLock(fileDescriptor);
    return await fn();
  } finally {
    closeSync2(fileDescriptor);
  }
}

// src/mutation-transaction.ts
import { join as join4 } from "node:path";
var MAX_LEDGER_BYTES = 64 * 1024 * 1024;
var MAX_MUTATION_JOURNAL_BYTES = 20 * 1024 * 1024;
function hasCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isMutationJournal(value) {
  if (!isObject(value) || value["version"] !== 1)
    return false;
  if (typeof value["ledgerOffset"] !== "number" || typeof value["ledgerData"] !== "string")
    return false;
  const plan = value["plan"];
  return isObject(plan) && plan["version"] === 1 && Array.isArray(plan["goals"]);
}
function journalPath(repoRoot, scope) {
  return join4(ulwLoopDir(repoRoot, scope), ".mutation-journal.json");
}
function readLedger(repoRoot, scope) {
  try {
    return safeReadWorkspaceTextFile(repoRoot, ulwLoopLedgerPath(repoRoot, scope), MAX_LEDGER_BYTES);
  } catch (error) {
    if (hasCode(error, "ENOENT"))
      return "";
    throw error;
  }
}
async function finish(repoRoot, journal, writePlan, scope) {
  const currentLedger = Buffer.from(readLedger(repoRoot, scope), "utf8");
  const expected = Buffer.from(journal.ledgerData, "utf8");
  if (currentLedger.length < journal.ledgerOffset) {
    throw new UlwLoopError("ULW ledger is shorter than its pending transaction.", "ULW_LOOP_TRANSACTION_CONFLICT");
  }
  const tail = currentLedger.subarray(journal.ledgerOffset);
  if (tail.length === 0) {
    await safeAppendWorkspaceTextFile(repoRoot, ulwLoopLedgerPath(repoRoot, scope), journal.ledgerData);
  } else if (tail.length !== expected.length || !tail.equals(expected)) {
    throw new UlwLoopError("ULW ledger diverged from its pending transaction.", "ULW_LOOP_TRANSACTION_CONFLICT");
  }
  await writePlan(repoRoot, journal.plan, scope);
  safeUnlinkWorkspaceFile(repoRoot, journalPath(repoRoot, scope));
}
async function recoverPlanMutation(repoRoot, writePlan, scope) {
  const path = journalPath(repoRoot, scope);
  let raw;
  try {
    raw = safeReadWorkspaceTextFile(repoRoot, path, MAX_MUTATION_JOURNAL_BYTES);
  } catch (error) {
    if (hasCode(error, "ENOENT"))
      return;
    throw error;
  }
  const parsed = JSON.parse(raw);
  if (!isMutationJournal(parsed)) {
    throw new UlwLoopError("Invalid ULW mutation journal.", "ULW_LOOP_TRANSACTION_INVALID");
  }
  await finish(repoRoot, parsed, writePlan, scope);
}
async function commitPlanMutation(repoRoot, plan, entries, writePlan, scope) {
  if (entries.length === 0) {
    throw new UlwLoopError("Plan mutations require an audit entry.", "ULW_LOOP_TRANSACTION_AUDIT_REQUIRED");
  }
  const journal = {
    version: 1,
    ledgerOffset: Buffer.byteLength(readLedger(repoRoot, scope), "utf8"),
    ledgerData: `${entries.map((entry) => JSON.stringify(entry)).join(`
`)}
`,
    plan
  };
  await safeAtomicWriteWorkspaceTextFile(repoRoot, journalPath(repoRoot, scope), `${JSON.stringify(journal)}
`);
  await finish(repoRoot, journal, writePlan, scope);
}

// src/plan-io.ts
var LEGACY_OBJECTIVE_PREFIXES = [ULW_LOOP_DIR, ULW_LOOP_LEGACY_DIR].map((dir) => `Complete all ulw-loop stories in ${dir}/${ULW_LOOP_GOALS}: `);
var LEGACY_OBJECTIVES = [ULW_LOOP_DIR, ULW_LOOP_LEGACY_DIR].map((dir) => `Complete all ulw-loop stories listed in ${dir}/${ULW_LOOP_GOALS}. Use ${dir}/${ULW_LOOP_LEDGER} as the durable audit trail.`);
var locks = new Map;
var heldMutationLocks = new AsyncLocalStorage;
var MAX_LEDGER_BYTES2 = 64 * 1024 * 1024;
var MAX_LEDGER_LINE_BYTES = 1024 * 1024;
function hasCode2(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
function isLegacyEnumeratedAggregateObjective(objective) {
  return objective !== undefined && (LEGACY_OBJECTIVES.includes(objective) || LEGACY_OBJECTIVE_PREFIXES.some((prefix) => objective.startsWith(prefix)));
}
function isSteeringKind(value) {
  return value === "steering_accepted" || value === "steering_rejected" || value === "criteria_revised" || value === "batch_updated";
}
function mutationLockKey(repoRoot, scope) {
  return `${repoRoot}\x00${repoRelative(ulwLoopDir(repoRoot, scope), repoRoot)}`;
}
async function withUlwLoopMutationLock(repoRoot, scopeOrFn, maybeFn) {
  const scope = typeof scopeOrFn === "function" ? undefined : scopeOrFn;
  const fn = typeof scopeOrFn === "function" ? scopeOrFn : maybeFn;
  if (fn === undefined)
    throw new UlwLoopError("Missing ulw-loop mutation body.", "ULW_LOOP_LOCK_BODY_MISSING");
  const lockKey = mutationLockKey(repoRoot, scope);
  const held = heldMutationLocks.getStore();
  if (held?.has(lockKey) === true)
    return fn();
  const prior = locks.get(lockKey) ?? Promise.resolve(undefined);
  const runLocked = () => withInterprocessLock(repoRoot, join5(ulwLoopDir(repoRoot, scope), ".mutation.lock"), async () => {
    await recoverPlanMutation(repoRoot, writePlan, scope);
    return heldMutationLocks.run(new Set([...held ?? [], lockKey]), fn);
  });
  const run = prior.then(runLocked, runLocked);
  const gate = run.then(() => {
    return;
  }, () => {
    return;
  });
  locks.set(lockKey, gate);
  gate.then(() => {
    if (locks.get(lockKey) === gate)
      locks.delete(lockKey);
  });
  return run;
}
async function readUlwLoopPlan(repoRoot, scope) {
  const path = ulwLoopGoalsPath(repoRoot, scope);
  let raw;
  try {
    raw = safeReadWorkspaceTextFile(repoRoot, path);
  } catch (error) {
    if (!hasCode2(error, "ENOENT"))
      throw error;
    throw new UlwLoopError(`No ulw-loop plan found at ${repoRelative(path, repoRoot)}. Run \`ulw-loop create-goals ...\` first.`, "ULW_LOOP_PLAN_MISSING", { cause: error });
  }
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1 || !Array.isArray(parsed.goals)) {
    throw new UlwLoopError(`Invalid ulw-loop plan at ${repoRelative(path, repoRoot)}.`, "ULW_LOOP_PLAN_INVALID");
  }
  for (const goal of parsed.goals)
    assertSafeUlwLoopPathSegment(goal.id, "goal id");
  if (parsed.activeGoalId !== undefined)
    assertSafeUlwLoopPathSegment(parsed.activeGoalId, "active goal id");
  const previousObjective = parsed.codexObjective;
  if ((parsed.codexGoalMode ?? "per_story") === "aggregate" && isLegacyEnumeratedAggregateObjective(previousObjective)) {
    if (heldMutationLocks.getStore()?.has(mutationLockKey(repoRoot, scope)) !== true) {
      return withUlwLoopMutationLock(repoRoot, scope, () => readUlwLoopPlan(repoRoot, scope));
    }
    const now = iso();
    parsed.codexObjective = aggregateCodexObjectiveForScope(scope);
    parsed.codexObjectiveAliases = [...new Set([...parsed.codexObjectiveAliases ?? [], previousObjective])];
    parsed.updatedAt = now;
    await commitPlanAndLedgerEntries(repoRoot, parsed, [
      {
        at: now,
        kind: "aggregate_objective_migrated",
        message: "Migrated legacy enumerated aggregate Codex objective to the stable pointer objective.",
        before: { codexObjective: previousObjective },
        after: { codexObjective: parsed.codexObjective }
      }
    ], scope);
  }
  return parsed;
}
async function writePlan(repoRoot, plan, scope) {
  for (const goal of plan.goals)
    assertSafeUlwLoopPathSegment(goal.id, "goal id");
  if (plan.activeGoalId !== undefined)
    assertSafeUlwLoopPathSegment(plan.activeGoalId, "active goal id");
  const path = ulwLoopGoalsPath(repoRoot, scope);
  await safeAtomicWriteWorkspaceTextFile(repoRoot, path, `${JSON.stringify(plan, null, 2)}
`);
}
async function appendLedger(repoRoot, entry, scope) {
  await appendLedgerEntries(repoRoot, [entry], scope);
}
async function appendLedgerEntries(repoRoot, entries, scope) {
  if (entries.length === 0)
    return;
  await safeAppendWorkspaceTextFile(repoRoot, ulwLoopLedgerPath(repoRoot, scope), `${entries.map((entry) => JSON.stringify(entry)).join(`
`)}
`);
}
async function commitPlanAndLedgerEntries(repoRoot, plan, entries, scope) {
  if (entries.length === 0) {
    throw new UlwLoopError("Plan mutations require an audit entry.", "ULW_LOOP_TRANSACTION_AUDIT_REQUIRED");
  }
  await commitPlanMutation(repoRoot, plan, entries, writePlan, scope);
}
async function* ledgerLines(repoRoot, scope) {
  const ledgerPath = ulwLoopLedgerPath(repoRoot, scope);
  let fileDescriptor;
  try {
    fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, ledgerPath, MAX_LEDGER_BYTES2);
  } catch (error) {
    if (hasCode2(error, "ENOENT"))
      return;
    throw error;
  }
  const ledgerBytes = fstatSync3(fileDescriptor).size;
  if (ledgerBytes === 0) {
    closeSync3(fileDescriptor);
    return;
  }
  const stream = createReadStream(ledgerPath, {
    encoding: "utf8",
    fd: fileDescriptor,
    autoClose: true,
    start: 0,
    end: ledgerBytes - 1
  });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) {
      if (Buffer.byteLength(line, "utf8") > MAX_LEDGER_LINE_BYTES) {
        throw new UlwLoopError("ULW ledger line exceeds the bounded input limit.", "ULW_LOOP_LEDGER_TOO_LARGE");
      }
      if (line.trim().length > 0)
        yield line;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}
async function findAcceptedSteeringLedgerEntry(repoRoot, key, scope) {
  const probe = JSON.stringify(key);
  for await (const line of ledgerLines(repoRoot, scope)) {
    if (!line.includes(probe))
      continue;
    const entry = JSON.parse(line);
    if (!isSteeringKind(entry.kind))
      continue;
    if (entry.steering?.invariant.accepted !== true)
      continue;
    if (entry.idempotencyKey === key || entry.steering.idempotencyKey === key || entry.steering.promptSignature === key)
      return entry;
  }
  return;
}

// src/evidence.ts
function ulwLoopFail(message, code, details) {
  throw new UlwLoopError(message, code, { details });
}
function ledgerKind(status) {
  switch (status) {
    case "pass":
      return "evidence_captured";
    case "fail":
      return "criterion_failed";
    case "blocked":
      return "criterion_blocked";
    default:
      return ulwLoopFail("Invalid criterion status.", "ULW_LOOP_CRITERION_STATUS_INVALID", { status });
  }
}
function findGoal(plan, goalId) {
  const goal = plan.goals.find((candidate) => candidate.id === goalId);
  return goal ?? ulwLoopFail(`UlwLoop goal not found: ${goalId}.`, "ULW_LOOP_GOAL_NOT_FOUND", { goalId });
}
function findCriterion(goal, criterionId) {
  const criterion = goal.successCriteria.find((candidate) => candidate.id === criterionId);
  return criterion ?? ulwLoopFail(`Success criterion not found: ${criterionId}.`, "ULW_LOOP_CRITERION_NOT_FOUND", {
    goalId: goal.id,
    criterionId
  });
}
function nonEmptyEvidence(evidence) {
  const trimmed = evidence.trim();
  return trimmed || ulwLoopFail("Evidence must be a non-empty string.", "ULW_LOOP_EVIDENCE_REQUIRED", {});
}
async function recordEvidence(repoRoot, args, scope) {
  return withUlwLoopMutationLock(repoRoot, scope, async () => {
    const plan = await readUlwLoopPlan(repoRoot, scope);
    const goal = findGoal(plan, args.goalId);
    const criterion = findCriterion(goal, args.criterionId);
    const evidence = nonEmptyEvidence(args.evidence);
    const kind = ledgerKind(args.status);
    const prevStatus = criterion.status;
    const capturedAt = iso();
    criterion.status = args.status;
    criterion.capturedEvidence = evidence;
    criterion.capturedAt = capturedAt;
    if (args.notes !== undefined)
      criterion.notes = args.notes;
    goal.updatedAt = capturedAt;
    plan.updatedAt = capturedAt;
    const ledgerEntry = {
      at: capturedAt,
      kind,
      goalId: goal.id,
      criterionId: criterion.id,
      criterionStatus: args.status,
      evidence,
      capturedEvidence: evidence,
      before: { status: prevStatus },
      after: { goalId: goal.id, criterionId: criterion.id, status: args.status, evidence, capturedAt, prevStatus }
    };
    await commitPlanAndLedgerEntries(repoRoot, plan, [ledgerEntry], scope);
    return { plan, goal, criterion, ledgerEntry };
  });
}
function unresolvedCriteriaOf(goal) {
  return goal.successCriteria.filter((criterion) => criterion.status !== "pass");
}
function unresolvedEssentialCriteriaOf(goal) {
  const essentialCriteria = new Set(essentialCriteriaOf(goal).map((criterion) => criterion.id));
  return goal.successCriteria.filter((criterion) => essentialCriteria.has(criterion.id) && criterion.status !== "pass");
}
function requireAllCriteriaPass(goal) {
  if (hasAllCriteriaPass(goal))
    return;
  throw new UlwLoopError(`Goal ${goal.id} has unresolved success criteria.`, "ulw_loop_criteria_not_all_pass", {
    details: {
      goalId: goal.id,
      unresolved: unresolvedCriteriaOf(goal).map((criterion) => ({ id: criterion.id, status: criterion.status }))
    }
  });
}
function requireAllPlanCriteriaPass(plan) {
  const unresolved = plan.goals.flatMap((goal) => unresolvedCriteriaOf(goal).map((criterion) => ({
    goalId: goal.id,
    id: criterion.id,
    status: criterion.status
  })));
  if (unresolved.length === 0)
    return;
  throw new UlwLoopError("Ulw-loop aggregate has unresolved success criteria.", "ulw_loop_criteria_not_all_pass", {
    details: { unresolved }
  });
}
function requireEssentialCriteriaPass(goal) {
  if (hasEssentialCriteriaPass(goal))
    return;
  throw new UlwLoopError(`Goal ${goal.id} has unresolved essential success criteria.`, "ulw_loop_criteria_not_all_pass", {
    details: {
      goalId: goal.id,
      unresolved: unresolvedEssentialCriteriaOf(goal).map((criterion) => ({
        id: criterion.id,
        status: criterion.status
      }))
    }
  });
}

// src/quality-gate-artifacts.ts
import { resolve as resolve4 } from "node:path";

// src/quality-gate-fields.ts
var PLACEHOLDER_PATTERN = /^(?:placeholder|todo|tbd|n\/a|stub)$/i;
function invalid(message, field) {
  throw new UlwLoopError(message, "ULW_LOOP_QUALITY_GATE_INVALID", { details: { field } });
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function section(value, field) {
  return isRecord(value) ? value : invalid(`Final quality gate is missing ${field} evidence.`, field);
}
function textField(value, field) {
  if (typeof value !== "string" || value.trim() === "")
    invalid(`Final quality gate requires non-empty ${field}.`, field);
  const trimmed = value.trim();
  if (PLACEHOLDER_PATTERN.test(trimmed))
    invalid(`Final quality gate rejects placeholder ${field}.`, field);
  return trimmed;
}
function numberField(value, field) {
  return typeof value === "number" && Number.isFinite(value) ? value : invalid(`Final quality gate requires numeric ${field}.`, field);
}
function stringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0)
    return invalid(`Final quality gate requires ${field}.`, field);
  return value.map((item) => textField(item, field));
}
function emptyBlockers(value, field) {
  if (Array.isArray(value) && value.length === 0)
    return [];
  invalid(`${field} must be empty.`, field);
}
function literal(value, expected, field) {
  if (value === expected)
    return expected;
  invalid(`${field} must be ${String(expected)}.`, field);
}

// src/quality-gate-artifacts.ts
function checkArtifactFile(path, field, opts) {
  if (opts === undefined)
    return;
  const absolute = resolve4(opts.repoRoot, path);
  if (!opts.fs.existsSync(absolute))
    invalid(`${field} must point to an existing artifact.`, field);
  if (opts.fs.lstatSync(absolute).isSymbolicLink())
    invalid(`${field} must not point to a symbolic link.`, field);
  if (opts.fs.statSync(absolute).size <= 0)
    invalid(`${field} must point to a non-empty artifact.`, field);
  if (opts.currentAttemptDir !== undefined) {
    const attemptRoot = resolve4(opts.repoRoot, opts.currentAttemptDir);
    const attemptError = `${field} (${path}) must point to an artifact from the current attempt (${opts.currentAttemptDir}).`;
    if (!opts.fs.existsSync(attemptRoot))
      invalid(attemptError, field);
    if (!isWithinAttemptDir(opts.fs.realpathSync(absolute), opts.fs.realpathSync(attemptRoot))) {
      invalid(attemptError, field);
    }
  }
  try {
    assertSafeEvidenceArtifact(opts.repoRoot, absolute, opts.currentAttemptDir === undefined ? undefined : resolve4(opts.repoRoot, opts.currentAttemptDir), 10 * 1024 * 1024);
  } catch (error) {
    if (error instanceof Error)
      invalid(`${field} must point to a non-empty single-link regular artifact.`, field);
    throw error;
  }
}

// src/quality-gate-roles.ts
var ROOT_REVIEWER = "lazygrok-root";
var REVIEWER_ROLES = {
  codeReview: "lazycodex-code-reviewer",
  manualQa: "lazycodex-qa-executor",
  gateReview: "lazycodex-gate-reviewer"
};
var REVIEWER_ALIASES = {
  codeReview: ["lazycodex-code-reviewer", "lazygrok-code-reviewer"],
  manualQa: ["lazycodex-qa-executor", "lazygrok-qa-executor"],
  gateReview: ["lazycodex-gate-reviewer", "lazygrok-gate-reviewer"]
};
function reviewerRoleField(value, role, field, rootSelfReview) {
  const actual = textField(value, field);
  if (rootSelfReview) {
    if (actual !== ROOT_REVIEWER)
      invalid(`${field} must be ${ROOT_REVIEWER} for root self-review.`, field);
    return ROOT_REVIEWER;
  }
  const allowed = REVIEWER_ALIASES[role];
  if (!allowed.includes(actual))
    invalid(`${field} must be one of: ${allowed.join(", ")}.`, field);
  return REVIEWER_ROLES[role];
}
function reviewProvenanceField(value) {
  if (value === undefined)
    return;
  const provenance = section(value, "provenance");
  return {
    mode: literal(provenance["mode"], "root-self-review", "provenance.mode"),
    producer: literal(provenance["producer"], ROOT_REVIEWER, "provenance.producer"),
    sessionId: textField(provenance["sessionId"], "provenance.sessionId")
  };
}

// src/quality-gate-verdicts.ts
function passedVerdict(value, field) {
  if (value === "not_applicable")
    invalid(`${field} must not be not_applicable.`, field);
  return literal(value, "passed", field);
}
function codeQualityStatusField(value, field) {
  if (value === "CLEAR" || value === "WATCH")
    return value;
  invalid(`${field} must be CLEAR or WATCH.`, field);
}
function adversarialVerdict(row, field) {
  const value = row["verdict"];
  if (value === "passed")
    return { verdict: "passed" };
  if (value === "not_applicable") {
    return { verdict: "not_applicable", reason: textField(row["reason"], `${field}.reason`) };
  }
  invalid(`${field} must be passed or not_applicable with a reason.`, field);
}

// src/quality-gate-blockers.ts
var BLOCKER_FIELD_KEYS = "blocker blockerSignature blockerEvidence blockerOccurrences blockedAt".split(" ");
var URL_PATTERN = /https?:\/\/\S+/g;
var PUNCTUATION_PATTERN = /[`"'()[\]{}:,;]/g;
var WHITESPACE_PATTERN = /\s+/g;
var AUTH_PATTERN = /\b(auth\w*|credential\w*|token|permission\w*|scope\w*|access|unauthorized|forbidden|401|403)\b/;
var MISSING_PATTERN = /\b(unset|missing|required|requires|without|omit\w*|not set|not available|no read packages|read packages)\b/;
var GHCR_PATTERN = /\b(ghcr|github container registry|read packages|imagepullsecret|package api|anonymous|container image)\b/;
var GHCR_401_PATTERN = /\b(401|unauthorized|anonymous pull|authentication required)\b/;
var GHCR_403_PATTERN = /\b(403|forbidden|read packages|package api)\b/;
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeBlockerEvidence(evidence) {
  const withoutUrls = evidence.toLowerCase().replace(URL_PATTERN, " ");
  const withoutPunctuation = withoutUrls.replace(PUNCTUATION_PATTERN, " ");
  return withoutPunctuation.replace(WHITESPACE_PATTERN, " ").trim();
}
function classifyExternalAuthorizationBlocker(evidence) {
  const normalized = normalizeBlockerEvidence(evidence);
  if (!normalized || !AUTH_PATTERN.test(normalized) || !MISSING_PATTERN.test(normalized))
    return null;
  if (!GHCR_PATTERN.test(normalized))
    return "EXTERNAL_AUTHORIZATION_REQUIRED";
  const status401 = GHCR_401_PATTERN.test(normalized) ? "HTTP_401_ANONYMOUS" : null;
  const status403 = GHCR_403_PATTERN.test(normalized) ? "HTTP_403_NO_READ_PACKAGES" : null;
  const status = [status401, status403].filter((part) => part !== null).join("+");
  return `GHCR_PULL_ACCESS:${status || "AUTHORIZATION_REQUIRED"}:GHCR_VISIBILITY_OR_CREDENTIAL_REQUIRED`;
}
function nestedBlockerSignature(goal) {
  const blocker = Reflect.get(goal, "blocker");
  const signature = isRecord2(blocker) ? blocker["signature"] : null;
  return typeof signature === "string" ? signature : null;
}
function sameBlockerOccurrences(plan, signature) {
  return plan.goals.filter((goal) => goal.blockerSignature === signature || nestedBlockerSignature(goal) === signature).length;
}
function clearGoalBlockerFields(goal) {
  for (const key of BLOCKER_FIELD_KEYS)
    Reflect.deleteProperty(goal, key);
}

// src/quality-gate.ts
function surfaceField(value, field) {
  if (value === "cli" || value === "http" || value === "tmux" || value === "browser" || value === "gui" || value === "data")
    return value;
  invalid(`${field} must be a supported manual QA surface.`, field);
}
function kindField(value, field) {
  if (value === "cli-transcript" || value === "log" || value === "screenshot" || value === "image" || value === "http-dump" || value === "data-diff")
    return value;
  invalid(`${field} must be a supported artifact kind.`, field);
}
function artifactCompatible(surface, kind) {
  switch (surface) {
    case "cli":
    case "tmux":
      return kind === "cli-transcript" || kind === "log";
    case "http":
      return kind === "http-dump";
    case "browser":
    case "gui":
      return kind === "screenshot" || kind === "image";
    case "data":
      return kind === "data-diff";
    default:
      invalid("manualQa.surfaceEvidence has an unsupported surface.", "manualQa.surfaceEvidence.surface");
  }
}
function artifactMap(refs) {
  const byId = new Map;
  for (const ref of refs) {
    if (byId.has(ref.id))
      invalid(`manualQa.artifactRefs contains duplicate ${ref.id}.`, "manualQa.artifactRefs");
    byId.set(ref.id, ref);
  }
  return byId;
}
function parseArtifactRefs(value, opts) {
  if (!Array.isArray(value) || value.length === 0)
    invalid("manualQa.artifactRefs must not be empty.", "manualQa.artifactRefs");
  return value.map((item, index) => {
    const ref = section(item, `manualQa.artifactRefs[${index}]`);
    const path = textField(ref["path"], `manualQa.artifactRefs[${index}].path`);
    checkArtifactFile(path, `manualQa.artifactRefs[${index}].path`, opts);
    return {
      id: textField(ref["id"], `manualQa.artifactRefs[${index}].id`),
      kind: kindField(ref["kind"], `manualQa.artifactRefs[${index}].kind`),
      description: textField(ref["description"], `manualQa.artifactRefs[${index}].description`),
      path
    };
  });
}
function referencedArtifacts(value, field, byId) {
  return stringArray(value, field).map((id) => {
    const artifact = byId.get(id);
    if (artifact === undefined)
      invalid(`${field} references unknown artifact ${id}.`, field);
    return artifact;
  });
}
function validateQualityGate(input, opts) {
  const gate = section(input, "qualityGate");
  const provenance = reviewProvenanceField(gate["provenance"]);
  const rootSelfReview = provenance?.mode === "root-self-review";
  const codeReview = section(gate["codeReview"], "codeReview");
  const manualQa = section(gate["manualQa"], "manualQa");
  const gateReview = section(gate["gateReview"], "gateReview");
  const iteration = section(gate["iteration"], "iteration");
  const coverage = section(gate["criteriaCoverage"], "criteriaCoverage");
  const totalCriteria = numberField(coverage["totalCriteria"], "criteriaCoverage.totalCriteria");
  const passCount = numberField(coverage["passCount"], "criteriaCoverage.passCount");
  if (passCount < totalCriteria)
    invalid("criteriaCoverage.passCount must cover totalCriteria.", "criteriaCoverage.passCount");
  const artifactRefs = parseArtifactRefs(manualQa["artifactRefs"], opts);
  const byId = artifactMap(artifactRefs);
  const surfaceEvidence = parseSurfaceEvidence(manualQa["surfaceEvidence"], byId);
  const adversarialCases = parseAdversarialCases(manualQa["adversarialCases"], byId);
  const codeReportPath = textField(codeReview["reportPath"], "codeReview.reportPath");
  const gateReportPath = textField(gateReview["reportPath"], "gateReview.reportPath");
  checkArtifactFile(codeReportPath, "codeReview.reportPath", opts);
  checkArtifactFile(gateReportPath, "gateReview.reportPath", opts);
  return {
    ...provenance === undefined ? {} : { provenance },
    codeReview: {
      by: reviewerRoleField(codeReview["by"], "codeReview", "codeReview.by", rootSelfReview),
      recommendation: literal(codeReview["recommendation"], "APPROVE", "codeReview.recommendation"),
      codeQualityStatus: codeQualityStatusField(codeReview["codeQualityStatus"], "codeReview.codeQualityStatus"),
      reportPath: codeReportPath,
      evidence: textField(codeReview["evidence"], "codeReview.evidence"),
      blockers: emptyBlockers(codeReview["blockers"], "codeReview.blockers")
    },
    manualQa: {
      by: reviewerRoleField(manualQa["by"], "manualQa", "manualQa.by", rootSelfReview),
      status: literal(manualQa["status"], "passed", "manualQa.status"),
      evidence: textField(manualQa["evidence"], "manualQa.evidence"),
      surfaceEvidence,
      adversarialCases,
      artifactRefs
    },
    gateReview: {
      by: reviewerRoleField(gateReview["by"], "gateReview", "gateReview.by", rootSelfReview),
      recommendation: literal(gateReview["recommendation"], "APPROVE", "gateReview.recommendation"),
      reportPath: gateReportPath,
      evidence: textField(gateReview["evidence"], "gateReview.evidence"),
      blockers: emptyBlockers(gateReview["blockers"], "gateReview.blockers")
    },
    iteration: {
      fullRerun: literal(iteration["fullRerun"], true, "iteration.fullRerun"),
      status: literal(iteration["status"], "passed", "iteration.status"),
      rerunCommands: stringArray(iteration["rerunCommands"], "iteration.rerunCommands"),
      evidence: textField(iteration["evidence"], "iteration.evidence")
    },
    criteriaCoverage: {
      totalCriteria,
      passCount,
      originalIntent: textField(coverage["originalIntent"], "criteriaCoverage.originalIntent"),
      desiredOutcome: textField(coverage["desiredOutcome"], "criteriaCoverage.desiredOutcome"),
      userOutcomeReview: textField(coverage["userOutcomeReview"], "criteriaCoverage.userOutcomeReview"),
      adversarialClassesCovered: stringArray(coverage["adversarialClassesCovered"], "criteriaCoverage.adversarialClassesCovered")
    }
  };
}
function parseSurfaceEvidence(value, byId) {
  if (!Array.isArray(value) || value.length === 0)
    invalid("manualQa.surfaceEvidence must not be empty.", "manualQa.surfaceEvidence");
  return value.map((item, index) => {
    const row = section(item, `manualQa.surfaceEvidence[${index}]`);
    const surface = surfaceField(row["surface"], `manualQa.surfaceEvidence[${index}].surface`);
    const artifacts = referencedArtifacts(row["artifactRefs"], `manualQa.surfaceEvidence[${index}].artifactRefs`, byId);
    for (const artifact of artifacts) {
      if (!artifactCompatible(surface, artifact.kind)) {
        invalid(`manualQa.surfaceEvidence ${surface} artifact ${artifact.kind} is incompatible.`, "manualQa.surfaceEvidence");
      }
    }
    return {
      id: textField(row["id"], `manualQa.surfaceEvidence[${index}].id`),
      criterionRef: textField(row["criterionRef"], `manualQa.surfaceEvidence[${index}].criterionRef`),
      surface,
      invocation: textField(row["invocation"], `manualQa.surfaceEvidence[${index}].invocation`),
      verdict: passedVerdict(row["verdict"], `manualQa.surfaceEvidence[${index}].verdict`),
      artifactRefs: artifacts.map((artifact) => artifact.id)
    };
  });
}
function parseAdversarialCases(value, byId) {
  if (!Array.isArray(value) || value.length === 0)
    invalid("manualQa.adversarialCases must not be empty.", "manualQa.adversarialCases");
  return value.map((item, index) => {
    const row = section(item, `manualQa.adversarialCases[${index}]`);
    const artifacts = referencedArtifacts(row["artifactRefs"], `manualQa.adversarialCases[${index}].artifactRefs`, byId);
    const verdictInfo = adversarialVerdict(row, `manualQa.adversarialCases[${index}]`);
    return {
      id: textField(row["id"], `manualQa.adversarialCases[${index}].id`),
      criterionRef: textField(row["criterionRef"], `manualQa.adversarialCases[${index}].criterionRef`),
      scenario: textField(row["scenario"], `manualQa.adversarialCases[${index}].scenario`),
      expectedBehavior: textField(row["expectedBehavior"], `manualQa.adversarialCases[${index}].expectedBehavior`),
      verdict: verdictInfo.verdict,
      ...verdictInfo.reason === undefined ? {} : { reason: verdictInfo.reason },
      artifactRefs: artifacts.map((artifact) => artifact.id)
    };
  });
}

// src/cli-arg-parser.ts
import { resolve as resolve5 } from "node:path";
var VALUE_FLAGS = new Set("--brief --brief-file --session-id --codex-goal-mode --validation-batch-json --goal --goal-id --criterion-id --status --evidence --notes --codex-goal-json --quality-gate-json --kind --rationale --title --objective --target-goal-id --source --after-json --directive-json --directive-file --idempotency-key --proposals-json".split(" "));
var SUBCOMMANDS = new Set("create-goals status complete-goals criteria record-evidence checkpoint steer add-goal record-review-blockers".split(" "));
function hasFlag(argv, flag) {
  return argv.includes(flag);
}
function readValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index >= 0) {
    const next = argv[index + 1];
    return next === undefined || next.startsWith("--") ? undefined : next;
  }
  const prefix = `${flag}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
function parseGoalArg(argv) {
  return readValue(argv, "--goal-id") ?? readValue(argv, "--goal");
}
async function readStdin() {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > 10 * 1024 * 1024) {
      throw new UlwLoopError("Standard input exceeds 10 MiB.", "ULW_LOOP_INPUT_TOO_LARGE");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function positionalText(argv) {
  const words = [];
  for (let index = SUBCOMMANDS.has(argv[0] ?? "") ? 1 : 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined)
      continue;
    if (VALUE_FLAGS.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--"))
      continue;
    words.push(arg);
  }
  return words.join(" ").trim();
}
function looksLikeJson(value) {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}
async function readJsonInput(value, repoRoot = process.cwd()) {
  if (value === undefined)
    return;
  try {
    return JSON.parse(looksLikeJson(value) ? value : safeReadWorkspaceTextFile(repoRoot, resolve5(repoRoot, value)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new UlwLoopError(`Invalid JSON input: ${message}`, "ULW_LOOP_JSON_INPUT_INVALID", { cause: error });
  }
}
async function parseCodexGoalJson(value, repoRoot = process.cwd()) {
  if (value === undefined)
    return;
  const raw = looksLikeJson(value) ? value : safeReadWorkspaceTextFile(repoRoot, resolve5(repoRoot, value));
  try {
    JSON.parse(raw);
    return raw;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new UlwLoopError(`Invalid --codex-goal-json: ${message}`, "ULW_LOOP_CODEX_GOAL_JSON_INVALID", { cause: error });
  }
}
function required(argv, flag, code) {
  const value = readValue(argv, flag)?.trim();
  if (value)
    return value;
  throw new UlwLoopError(`Missing ${flag}.`, code, { details: { flag } });
}
function evidenceStatus(value) {
  switch (value) {
    case "pass":
      return "pass";
    case "fail":
      return "fail";
    case "blocked":
      return "blocked";
    default:
      throw new UlwLoopError("Invalid --status; expected pass, fail, or blocked.", "ULW_LOOP_EVIDENCE_STATUS_INVALID", { details: { status: value } });
  }
}
function parseRecordEvidenceArgs(argv) {
  const result = { goalId: required(argv, "--goal-id", "ULW_LOOP_GOAL_ID_REQUIRED"), criterionId: required(argv, "--criterion-id", "ULW_LOOP_CRITERION_ID_REQUIRED"), status: evidenceStatus(required(argv, "--status", "ULW_LOOP_EVIDENCE_STATUS_REQUIRED")), evidence: required(argv, "--evidence", "ULW_LOOP_EVIDENCE_REQUIRED") };
  const notes = readValue(argv, "--notes")?.trim();
  return notes ? { ...result, notes } : result;
}

// src/validation-batch.ts
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function read(value, key) {
  return Object.entries(value).find(([name]) => name === key)?.[1];
}
function text(value, key) {
  const candidate = read(value, key);
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : undefined;
}
function strings(value, key) {
  const candidate = read(value, key);
  return Array.isArray(candidate) && candidate.every((item) => typeof item === "string" && item.trim().length > 0) ? candidate.map((item) => item.trim()) : undefined;
}
async function parseValidationBatches(input, goals, repoRoot = process.cwd()) {
  const raw = await readJsonInput(input, repoRoot);
  if (raw === undefined)
    return;
  if (!Array.isArray(raw))
    fail("--validation-batch-json must be a JSON array.");
  const batches = raw.map(batchFromObject);
  validateBatches(batches, goals);
  return batches;
}
function batchFromObject(value) {
  if (!isObject2(value))
    fail("validation batch entries must be objects.");
  const batchId = text(value, "batchId");
  const memberIds = strings(value, "memberIds");
  const finalGoalId = text(value, "finalGoalId");
  if (batchId === undefined)
    fail("validation batch requires batchId.");
  if (memberIds === undefined || memberIds.length < 2)
    fail("validation batch requires at least two memberIds.");
  if (finalGoalId === undefined)
    fail("validation batch requires finalGoalId.");
  return { batchId, memberIds, finalGoalId };
}
function validateBatches(batches, goals) {
  const goalIds = new Set(goals.map((goal) => goal.id));
  const batchIds = new Set;
  const members = new Set;
  for (const batch of batches) {
    if (batchIds.has(batch.batchId))
      fail(`duplicate validation batch id: ${batch.batchId}.`);
    batchIds.add(batch.batchId);
    if (new Set(batch.memberIds).size !== batch.memberIds.length)
      fail(`validation batch ${batch.batchId} has duplicate memberIds.`);
    if (!batch.memberIds.includes(batch.finalGoalId))
      fail(`validation batch ${batch.batchId} finalGoalId must be a member.`, "ULW_LOOP_VALIDATION_BATCH_FINAL_NOT_MEMBER");
    for (const memberId of batch.memberIds) {
      if (!goalIds.has(memberId))
        fail(`validation batch ${batch.batchId} references unknown goal: ${memberId}.`, "ULW_LOOP_VALIDATION_BATCH_MEMBER_UNKNOWN");
      if (members.has(memberId))
        fail(`goal appears in multiple validation batches: ${memberId}.`, "ULW_LOOP_VALIDATION_BATCH_OVERLAP");
      members.add(memberId);
    }
  }
}
function updateBatchesAfterSupersede(plan, targetId, replacementIds) {
  if (replacementIds.length === 0 || plan.validationBatches === undefined)
    return;
  plan.validationBatches = plan.validationBatches.map((batch) => {
    if (!batch.memberIds.includes(targetId))
      return batch;
    const memberIds = batch.memberIds.flatMap((id) => id === targetId ? [...replacementIds] : [id]);
    const replacementFinalGoalId = replacementIds[replacementIds.length - 1] ?? batch.finalGoalId;
    const finalGoalId = batch.finalGoalId === targetId ? replacementFinalGoalId : batch.finalGoalId;
    return { batchId: batch.batchId, memberIds, finalGoalId };
  });
}
function batchUpdateLedgerEntry(before, after, at) {
  if (JSON.stringify(before.validationBatches ?? []) === JSON.stringify(after.validationBatches ?? []))
    return null;
  return { at, kind: "batch_updated", before: before.validationBatches ?? [], after: after.validationBatches ?? [], message: "Validation batch membership updated after steering." };
}
function batchOf(plan, goalId) {
  return plan.validationBatches?.find((batch) => batch.memberIds.includes(goalId));
}
function batchClosedBy(plan, goalId) {
  const batch = batchOf(plan, goalId);
  return batch?.finalGoalId === goalId ? batch : undefined;
}
function requireBatchFinalReady(plan, goal) {
  const batch = batchClosedBy(plan, goal.id);
  if (batch === undefined)
    return;
  const open2 = batch.memberIds.filter((id) => id !== goal.id && !memberResolved(plan, id));
  if (open2.length > 0)
    throw new UlwLoopError("Validation batch has unresolved members.", "ULW_LOOP_VALIDATION_BATCH_OPEN", { details: { batchId: batch.batchId, open: open2 } });
}
function requireAllValidationBatchesClosed(plan, closingGoalId) {
  const open2 = (plan.validationBatches ?? []).filter((batch) => batch.memberIds.some((id) => id !== closingGoalId && !memberResolved(plan, id)));
  if (open2.length > 0)
    throw new UlwLoopError("Validation batches remain open.", "ULW_LOOP_VALIDATION_BATCH_OPEN", { details: { batchIds: open2.map((batch) => batch.batchId) } });
}
function requireBatchGate(plan, goal, gate) {
  const batch = batchClosedBy(plan, goal.id);
  if (batch === undefined)
    return;
  const members = batch.memberIds.map((id) => plan.goals.find((item) => item.id === id)).filter((item) => item !== undefined);
  const pending = members.flatMap((member) => member.successCriteria.filter((criterion) => criterion.status !== "pass").map((criterion) => `${member.id}:${criterion.id}`));
  if (pending.length > 0)
    throw new UlwLoopError("Validation batch criteria remain pending.", "ULW_LOOP_VALIDATION_BATCH_CRITERIA_PENDING", { details: { batchId: batch.batchId, pending } });
  const totalCriteria = members.reduce((sum, member) => sum + member.successCriteria.length, 0);
  const passCount = members.reduce((sum, member) => sum + member.successCriteria.filter((criterion) => criterion.status === "pass").length, 0);
  if (gate.criteriaCoverage.totalCriteria !== totalCriteria || gate.criteriaCoverage.passCount !== passCount)
    throw new UlwLoopError("Validation batch gate coverage does not match member criteria.", "ULW_LOOP_VALIDATION_BATCH_GATE_MISMATCH", { details: { batchId: batch.batchId, expected: { totalCriteria, passCount }, actual: gate.criteriaCoverage } });
}
function memberResolved(plan, goalId) {
  const goal = plan.goals.find((candidate) => candidate.id === goalId);
  return goal !== undefined && isMemberResolved(goal, plan);
}
function fail(message, code = "ULW_LOOP_VALIDATION_BATCH_INVALID") {
  throw new UlwLoopError(message, code);
}

// src/checkpoint.ts
var QUALITY_GATE_FS = { existsSync: existsSync3, lstatSync: lstatSync3, realpathSync: realpathSync3, statSync: statSync2 };
function ulwLoopFail2(message, code) {
  throw new UlwLoopError(message, code);
}
function normalizeObjective3(value) {
  return value.replace(/\s+/g, " ").trim();
}
function nonEmptyEvidence2(value) {
  const trimmed = value.trim();
  return trimmed || ulwLoopFail2("Evidence must be a non-empty string.", "ulw_loop_evidence_required");
}
function findGoal2(plan, goalId) {
  const goal = plan.goals.find((candidate) => candidate.id === goalId);
  return goal ?? ulwLoopFail2(`Unknown ulw-loop id: ${goalId}.`, "ulw_loop_goal_not_found");
}
async function readJsonInput2(raw, repoRoot) {
  if (raw === undefined || raw.trim() === "")
    return;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    if (!(error instanceof SyntaxError))
      throw error;
  }
  try {
    return JSON.parse(safeReadWorkspaceTextFile(repoRoot, resolve6(repoRoot, trimmed)));
  } catch (error) {
    return ulwLoopFail2(`Quality gate path does not contain valid JSON${error instanceof Error ? `: ${error.message}` : "."}`, "ulw_loop_json_input_invalid");
  }
}
function makeAggregateCompletion(now, evidence, codexGoal) {
  return { status: "complete", completedAt: now, evidence, codexGoal };
}
function applyBlockedOrFailed(goal, plan, status, evidence, now) {
  const signature = classifyExternalAuthorizationBlocker(evidence);
  const occurrences = signature === null ? 0 : sameBlockerOccurrences(plan, signature) + 1;
  const needsDecision = signature !== null && occurrences >= 3;
  goal.status = needsDecision ? "needs_user_decision" : status;
  goal.updatedAt = now;
  if (status === "failed" || needsDecision) {
    goal.failedAt = now;
    goal.failureReason = evidence;
  }
  if (status === "blocked" || needsDecision)
    goal.blockedReason = evidence;
  if (signature !== null) {
    goal.blockerSignature = signature;
    goal.blockerOccurrenceCount = occurrences;
    goal.requiredExternalDecision = `Resolve external authorization: ${signature}`;
  }
  if (needsDecision)
    goal.nonRetriable = true;
  if (plan.activeGoalId === goal.id)
    delete plan.activeGoalId;
}
function ledgerKind2(status, goal, aggregateCompletion) {
  if (aggregateCompletion !== undefined)
    return "aggregate_completed";
  if (status === "complete")
    return "goal_completed";
  if (goal.status === "needs_user_decision")
    return "goal_needs_user_decision";
  return status === "blocked" ? "goal_blocked" : "goal_failed";
}
function buildLedger(now, args, goal, qualityGate, codexGoal, aggregateCompletion) {
  const watch = qualityGate?.codeReview.codeQualityStatus === "WATCH";
  const entry = {
    at: now,
    kind: ledgerKind2(args.status, goal, aggregateCompletion),
    goalId: goal.id,
    status: goal.status,
    evidence: watch ? `${args.evidence} | codeQuality=WATCH: ${qualityGate.codeReview.evidence}` : args.evidence
  };
  if (codexGoal !== undefined)
    entry.codexGoal = codexGoal;
  if (qualityGate !== undefined)
    entry.qualityGate = qualityGate;
  if (goal.blockerSignature !== undefined)
    entry.blockerSignature = goal.blockerSignature;
  if (goal.blockerOccurrenceCount !== undefined)
    entry.blockerOccurrenceCount = goal.blockerOccurrenceCount;
  if (goal.requiredExternalDecision !== undefined)
    entry.requiredExternalDecision = goal.requiredExternalDecision;
  return entry;
}
async function checkpointUlwLoop(repoRoot, args, scope) {
  return withUlwLoopMutationLock(repoRoot, scope, async () => {
    const plan = await readUlwLoopPlan(repoRoot, scope);
    const goal = findGoal2(plan, args.goalId);
    const evidence = nonEmptyEvidence2(args.evidence);
    const now = iso();
    let aggregateCompletion;
    let qualityGate;
    let codexGoal;
    if (args.status === "complete") {
      const aggregate = codexGoalMode(plan) === "aggregate";
      const final = isFinalRunCompletionCandidate(plan, goal);
      const closesBatch = batchClosedBy(plan, goal.id) !== undefined;
      if (final) {
        requireAllCriteriaPass(goal);
        requireAllPlanCriteriaPass(plan);
        requireAllValidationBatchesClosed(plan, goal.id);
      } else if (aggregate)
        requireEssentialCriteriaPass(goal);
      else
        requireAllCriteriaPass(goal);
      const snapshot = await readCodexGoalSnapshotInput(args.codexGoalJson, repoRoot);
      const reconciliation = reconcileCodexGoalSnapshot(snapshot, {
        expectedObjective: expectedCodexObjective(plan, goal),
        ...aggregate ? { acceptedObjectives: compatibleCodexObjectives(plan) } : {},
        allowedStatuses: aggregate ? final ? ["complete"] : ["active"] : ["complete"],
        requireSnapshot: true,
        requireComplete: !aggregate || final
      });
      codexGoal = reconciliation.snapshot.raw;
      if (!reconciliation.ok) {
        const objective = snapshot?.objective;
        const mismatchedTaskObjective = snapshot?.available === true && objective !== undefined && normalizeObjective3(objective) !== normalizeObjective3(expectedCodexObjective(plan, goal));
        const completedTaskScoped = mismatchedTaskObjective && snapshot.status === "complete" && await canReconcileCompletedTaskScopedAggregateSnapshot(repoRoot, plan, goal, objective, evidence, scope);
        const activeFinalTaskScoped = mismatchedTaskObjective && snapshot.status === "active" && await canReconcileActiveFinalTaskScopedAggregateSnapshot(repoRoot, plan, goal, objective, evidence, scope);
        const taskScoped = completedTaskScoped || activeFinalTaskScoped;
        if (!taskScoped)
          throw new UlwLoopError(`${formatCodexGoalReconciliation(reconciliation)}${aggregate && snapshot?.status === "complete" && objective !== undefined ? buildTaskScopedAggregateReconciliationHint(goal, final) : ""}`, "ulw_loop_codex_snapshot_mismatch");
      }
      if (closesBatch)
        requireBatchFinalReady(plan, goal);
      if (closesBatch && args.qualityGateJson === undefined)
        throw new UlwLoopError("Validation batch final checkpoint requires --quality-gate-json.", "ULW_LOOP_VALIDATION_BATCH_GATE_REQUIRED");
      if (final)
        aggregateCompletion = makeAggregateCompletion(now, evidence, codexGoal);
      if (final || aggregateCompletion !== undefined || closesBatch) {
        qualityGate = validateQualityGate(await readJsonInput2(args.qualityGateJson, repoRoot), {
          repoRoot,
          fs: QUALITY_GATE_FS,
          ...plan.evidenceLayoutVersion === 2 ? { currentAttemptDir: ulwLoopAttemptEvidenceDir(repoRoot, goal.id, goal.attempt, scope) } : {}
        });
        requireBatchGate(plan, goal, qualityGate);
      }
      goal.status = "complete";
      goal.completedAt = now;
      goal.evidence = evidence;
      delete goal.failedAt;
      delete goal.failureReason;
      clearGoalBlockerFields(goal);
      if (plan.activeGoalId === goal.id)
        delete plan.activeGoalId;
    } else
      applyBlockedOrFailed(goal, plan, args.status, evidence, now);
    goal.updatedAt = now;
    if (aggregateCompletion !== undefined)
      plan.aggregateCompletion = aggregateCompletion;
    plan.updatedAt = now;
    const ledgerEntry = buildLedger(now, args, goal, qualityGate, codexGoal, aggregateCompletion);
    const closedBatch = args.status === "complete" ? batchClosedBy(plan, goal.id) : undefined;
    await commitPlanAndLedgerEntries(repoRoot, plan, closedBatch === undefined ? [ledgerEntry] : [ledgerEntry, { at: now, kind: "batch_closed", goalId: goal.id, message: closedBatch.batchId }], scope);
    return aggregateCompletion === undefined ? { plan, goal, ledgerEntry } : { plan, goal, ledgerEntry, aggregateCompletion };
  });
}

// src/cli-output.ts
var ULW_LOOP_HELP = `Usage:
  ulw-loop create-goals --brief "..." [--brief-file <path>] [--from-stdin] [--codex-goal-mode aggregate|per_story] [--validation-batch-json <json-or-path>] [--force] [--json]
  ulw-loop status [--json]
  ulw-loop complete-goals [--retry-failed] [--json]
  ulw-loop criteria --goal-id <id> [--json]
  ulw-loop record-evidence --goal-id <id> --criterion-id <id> --status pass|fail|blocked --evidence "..." [--notes "..."] [--json]
  ulw-loop checkpoint --goal-id <id> --status complete|failed|blocked --evidence "..." --codex-goal-json <...> [--quality-gate-json <...>] [--no-advance] [--json]
  ulw-loop steer --kind <kind> ... --evidence "..." --rationale "..." [--proposals-json <json-or-path>] [--json]
  ulw-loop add-goal --title "..." --objective "..." [--json]
  ulw-loop record-review-blockers
  ulw-loop light-quality-gate --goal-id <id> [--session-id <id>] [--json]

All subcommands accept [--session-id <id>] to isolate state under .lazygrok/ulw-loop/<id>/; without it, Grok session env is used when present. Legacy .omo runs remain readable.`;
function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}
`);
}
function printJsonError(error) {
  if (error instanceof UlwLoopError) {
    printJson({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...error.details === undefined ? {} : { details: error.details }
      }
    });
    return;
  }
  if (error instanceof Error) {
    printJson({ ok: false, error: { code: "ULW_LOOP_UNEXPECTED", message: error.message } });
    return;
  }
  printJson({ ok: false, error: { code: "ULW_LOOP_UNKNOWN", message: "unknown error" } });
}
function criteriaCounts(goal) {
  let pass = 0;
  for (const criterion of goal.successCriteria)
    if (criterion.status === "pass")
      pass += 1;
  return { pass, total: goal.successCriteria.length };
}
function printStatus(plan) {
  let totalCriteria = 0;
  let passCriteria = 0;
  const lines = ["ulw-loop status", "", "goals:"];
  for (const goal of plan.goals) {
    const counts = criteriaCounts(goal);
    totalCriteria += counts.total;
    passCriteria += counts.pass;
    const marker = goal.id === plan.activeGoalId ? "*" : "-";
    lines.push(`${marker} ${goal.id} [${goal.status}] ${goal.title} (criteria: ${counts.pass}/${counts.total})`);
  }
  lines.push("", "summary:", `total goals: ${plan.goals.length}`, `criteria: ${passCriteria}/${totalCriteria} pass`);
  process.stdout.write(`${lines.join(`
`)}
`);
}
function blockedDecisionHandoff(plan) {
  const blocked = plan.goals.find((goal) => goal.status === "needs_user_decision" && goal.nonRetriable);
  if (blocked === undefined)
    return "";
  return [
    "ulw-loop: blocked on repeated external authorization; no retryable failed goals remain.",
    `Goal: ${blocked.id} - ${blocked.title}`,
    `Required external decision: ${blocked.requiredExternalDecision ?? "provide the missing authorization or choose a different unblock path"}.`,
    "Do not run complete-goals --retry-failed again until external state changes or the user authorizes an unblock path."
  ].join(`
`);
}
function normalizeCodexGoalMode(value) {
  if (value === undefined)
    return "aggregate";
  if (value === "aggregate" || value === "per_story")
    return value;
  throw new UlwLoopError("Invalid --codex-goal-mode; expected aggregate or per_story.", "ULW_LOOP_CODEX_GOAL_MODE_INVALID", { details: { value } });
}

// src/codex-goal-instruction.ts
function buildCodexGoalInstruction(args) {
  const mode = codexGoalMode(args.plan);
  const createGoal = buildCreateGoalPayload(args.plan, args.goal);
  const isFinal = args.isFinal ?? isFinalRunCompletionCandidate(args.plan, args.goal);
  return { text: buildText(mode, args.plan, args.goal, createGoal, isFinal), json: createGoal };
}
function buildCreateGoalPayload(plan, goal) {
  return { objective: expectedCodexObjective(plan, goal) };
}
function buildText(mode, plan, goal, createGoal, isFinal) {
  return joinLines([
    mode === "aggregate" ? "UlwLoop aggregate-goal handoff" : "UlwLoop active-goal handoff",
    `Mode: ${mode}`,
    `Plan: ${plan.goalsPath}`,
    `Ledger: ${plan.ledgerPath}`,
    `Goal: ${goal.id} — ${goal.title}`,
    "",
    ...activeGoalLines(goal),
    "",
    ...successCriteriaLines(goal.successCriteria),
    "",
    "Codex goal integration constraints:",
    "- Use the create_goal payload exactly as rendered: objective only.",
    "- Goals are unlimited. Do not add numeric limits.",
    ...modeConstraintLines(mode, isFinal),
    ...evidenceLayoutLines(plan),
    finalSection(plan, goal, isFinal, mode === "aggregate"),
    ...checkpointLines(plan, mode),
    "",
    "create_goal payload:",
    JSON.stringify(createGoal, null, 2)
  ]);
}
function modeConstraintLines(mode, isFinal) {
  if (mode === "per_story") {
    return [
      "- First call get_goal. If no active goal exists, call create_goal with the payload below.",
      "- If a different active Codex goal exists, finish/checkpoint that goal before starting this ulw-loop.",
      "- Work only this goal until its completion audit passes."
    ];
  }
  return [
    "- Codex goal = the whole omo ulw-loop run; OMO G001/G002/etc. = ledger stories.",
    "- First call get_goal. If no active goal exists, call create_goal with the aggregate payload below.",
    "- If get_goal reports the same aggregate objective as active, continue this OMO story without creating a new Codex goal.",
    "- If a different active or incomplete Codex goal exists, finish/checkpoint that goal before starting this ulw-loop.",
    isFinal ? "- This is the final story; update_goal is allowed only after the mandatory quality gate passes." : "- This is not the final story: do not call update_goal mid-aggregate; checkpoint this OMO ledger story and continue the remaining stories. update_goal is reserved for the final story after the mandatory quality gate passes."
  ];
}
function checkpointLines(plan, mode) {
  const failureLine = `- If blocked or failed, checkpoint with --status failed and the failure evidence; rerun complete-goals${sessionOption(plan)} --retry-failed to resume.`;
  if (mode === "per_story")
    return [failureLine];
  return [
    "- Checkpoint this OMO story with a fresh get_goal snapshot whose objective matches the aggregate payload.",
    failureLine
  ];
}
function activeGoalLines(goal) {
  return ["Active goal:", `- id: ${goal.id}`, `- title: ${goal.title}`, `- objective: ${goal.objective}`];
}
function successCriteriaLines(criteria) {
  if (criteria.length === 0)
    return ["Success criteria:", "- No success criteria recorded for this goal."];
  return ["Success criteria:", ...criteria.map(formatCriterionLine)];
}
function formatCriterionLine(criterion) {
  const remainingWork = criterion.status === "pending" ? " remaining work:" : "";
  const marker = isEssentialCriterion(criterion) ? "essential" : "non-essential";
  return `-${remainingWork} [${criterion.id}] [${marker}] (${criterion.userModel}) ${criterion.scenario} — expect: ${criterion.expectedEvidence} — status: ${criterion.status}`;
}
function evidenceLayoutLines(plan) {
  if (plan.evidenceLayoutVersion !== 2)
    return [];
  return [
    "- Evidence layout v2: write every artifact for the active goal (QA matrix, review reports, receipts) under the current attempt directory — read currentAttemptDir from `ulw-loop status --json` (.lazygrok/evidence/ulw/<session>/<goalId>/a<attempt>, or .omo/evidence for a legacy run). The final checkpoint rejects quality-gate artifacts outside that directory."
  ];
}
function finalSection(plan, goal, isFinal, aggregate) {
  if (!isFinal)
    return "- This is not the final ulw-loop story; do not run the final reviewer/manual-QA/gate-review quality gate yet.";
  const option = sessionOption(plan);
  const blockerCommand = `${grokUlwCli()} record-review-blockers${option} --goal-id ${goal.id} --title "Resolve final code-review blockers" --objective "<blocker-resolution objective>" --evidence "<review findings>" --codex-goal-json "<active get_goal JSON or path>"`;
  const checkpointCommand = `${grokUlwCli()} checkpoint${option} --goal-id ${goal.id} --status complete --evidence "<targeted verification/manualQa/gateReview evidence>" --codex-goal-json "<fresh complete get_goal JSON or path>" --quality-gate-json "<quality gate JSON or path>"`;
  return joinLines([
    "Final story — run mandatory quality gate before update_goal:",
    "- Run targeted verification for changed behavior.",
    "- Confirm every manualQa artifact path exists and has non-zero size.",
    '- First spawn lazycodex-code-reviewer and lazycodex-qa-executor in parallel (fork_context: false on the v1 surface; fork_turns: "none" on v2). Include the original brief, goal objectives, desired user-visible outcome, diff, and evidence; wait for BOTH to return and confirm their report artifacts exist on disk (code-review report + manualQa matrix).',
    "- Only then spawn lazycodex-gate-reviewer (same fork settings), passing those artifact paths.",
    "- Require clean codeReview, manualQa, gateReview, iteration, and criteriaCoverage. criteriaCoverage must summarize originalIntent, desiredOutcome, and userOutcomeReview; counts alone are not approval.",
    "- On a reviewer REJECT, fix only the cited blockers, rerun the affected verification/Manual-QA, and re-review the delta at most TWICE; if blockers remain, record them and surface to the user.",
    "- If codeQualityStatus is WATCH, include the WATCH notes verbatim in your final user-facing message.",
    "- If any reviewer is blocked/inconclusive or the quality gate is not clean, do not call update_goal. Record blocker work first:",
    `  ${blockerCommand}`,
    aggregate ? '- If the quality gate is clean, call update_goal({status: "complete"}), call get_goal again, then checkpoint the aggregate story:' : '- If the quality gate is clean, call update_goal({status: "complete"}), call get_goal again, then checkpoint:',
    `  ${checkpointCommand}`
  ]);
}
function sessionOption(plan) {
  const suffix = "/goals.json";
  if (!plan.goalsPath.endsWith(suffix))
    return "";
  for (const prefix of [".lazygrok/ulw-loop/", ".omo/ulw-loop/"]) {
    if (!plan.goalsPath.startsWith(prefix))
      continue;
    const sessionId = plan.goalsPath.slice(prefix.length, -suffix.length);
    return sessionId.length === 0 ? "" : ` --session-id ${sessionId}`;
  }
  return "";
}
function joinLines(lines) {
  return lines.join(`
`);
}

// src/plan-crud.ts
import { existsSync as existsSync4 } from "node:fs";

// src/plan-goal-factory.ts
function cleanLine(line) {
  return line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim();
}
function normalizeObjective4(value) {
  return value.replace(/\s+/g, " ").trim();
}
function titleFromObjective(objective, fallback) {
  const firstLine = objective.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? fallback;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69).trimEnd()}...` : firstLine;
}
function normalizeGoalId(title, index) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36).replace(/-+$/g, "");
  return `G${String(index + 1).padStart(3, "0")}${slug ? `-${slug}` : ""}`;
}
function assertNonEmpty(value, label) {
  const trimmed = value?.trim();
  if (!trimmed)
    throw new UlwLoopError(`Missing ${label}.`, "ULW_LOOP_ARGUMENT_MISSING");
  return trimmed;
}
function truncateObjective(objective) {
  return objective.length > 80 ? `${objective.slice(0, 77).trimEnd()}...` : objective;
}
function seedDefaultSuccessCriteria(goalIndex, objective) {
  const subject = truncateObjective(normalizeObjective4(objective) || `Goal ${goalIndex + 1}`);
  const rows = [
    [
      "C001",
      "happy",
      `happy path for: ${subject}`,
      `Replace via revise_criterion with observable happy-path proof for goal ${goalIndex + 1}.`,
      true
    ],
    [
      "C002",
      "edge",
      "edge case (boundary/empty/malformed)",
      `Replace via revise_criterion with boundary or malformed-input proof for: ${subject}.`,
      true
    ],
    [
      "C003",
      "regression",
      "regression: adjacent surface still works",
      `Replace via revise_criterion with regression proof for neighboring behavior after: ${subject}.`,
      false
    ]
  ];
  return rows.map(([id, userModel, scenario, expectedEvidence, essential]) => ({
    id,
    scenario,
    userModel,
    expectedEvidence,
    essential,
    capturedEvidence: null,
    status: "pending"
  }));
}
function deriveGoalCandidates(brief) {
  const bulletGoals = brief.split(/\r?\n/).map((line) => ({ original: line, cleaned: normalizeObjective4(cleanLine(line)) })).filter(({ cleaned }) => cleaned.length > 0 && cleaned.length <= 1200).filter(({ original, cleaned }, index, all) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(original) && all.findIndex((candidate) => candidate.cleaned === cleaned) === index).map(({ cleaned }) => cleaned);
  const paragraphs = brief.split(/\n\s*\n/).map(normalizeObjective4).filter((paragraph) => paragraph.length > 0 && !paragraph.startsWith("#"));
  const selected = (bulletGoals.length > 0 ? bulletGoals : paragraphs).length > 0 ? bulletGoals.length > 0 ? bulletGoals : paragraphs : ["Complete the requested project objective."];
  return selected.map((objective, index) => ({
    title: titleFromObjective(objective, `Goal ${index + 1}`),
    objective
  }));
}
function makeGoal(title, objective, index, now) {
  const cleanTitle = assertNonEmpty(title, "title");
  const cleanObjective = assertNonEmpty(objective, "objective");
  return {
    id: normalizeGoalId(cleanTitle, index),
    title: cleanTitle,
    objective: cleanObjective,
    status: "pending",
    successCriteria: seedDefaultSuccessCriteria(index, cleanObjective),
    attempt: 0,
    createdAt: now,
    updatedAt: now
  };
}
function appendGoalToPlan(plan, title, objective, now) {
  const goal = makeGoal(title, objective, plan.goals.length, now);
  plan.goals.push(goal);
  plan.updatedAt = now;
  return goal;
}

// src/plan-crud.ts
function isScheduleEligible(goal) {
  return goal.steeringStatus !== "superseded" && goal.steeringStatus !== "blocked";
}
function clearGoalBlockerFields2(goal) {
  for (const key of [
    "blockedReason",
    "blockerSignature",
    "blockerOccurrenceCount",
    "requiredExternalDecision",
    "nonRetriable",
    "failedAt",
    "failureReason"
  ])
    delete goal[key];
}
async function createUlwLoopPlan(repoRoot, args, scope) {
  return withUlwLoopMutationLock(repoRoot, scope, async () => {
    if (!args.force && existsSync4(ulwLoopGoalsPath(repoRoot, scope))) {
      const existing = await readUlwLoopPlan(repoRoot, scope);
      if (isUlwLoopDone(existing))
        throw completedPlanExistsError(scope);
      throw new UlwLoopError(`Refusing to overwrite existing ${ulwLoopGoalsRelativePath(scope)}; pass --force to recreate it.`, "ULW_LOOP_PLAN_EXISTS");
    }
    const now = iso();
    const goals = deriveGoalCandidates(args.brief).map((goal, index) => makeGoal(goal.title, goal.objective, index, now));
    const plan = {
      version: 1,
      evidenceLayoutVersion: 2,
      createdAt: now,
      updatedAt: now,
      briefPath: ulwLoopBriefRelativePath(scope),
      goalsPath: ulwLoopGoalsRelativePath(scope),
      ledgerPath: ulwLoopLedgerRelativePath(scope),
      codexGoalMode: args.codexGoalMode ?? "aggregate",
      goals
    };
    const validationBatches = await parseValidationBatches(args.validationBatchesJson, goals, repoRoot);
    if (validationBatches !== undefined)
      plan.validationBatches = validationBatches;
    if (plan.codexGoalMode === "aggregate")
      plan.codexObjective = aggregateCodexObjectiveForScope(scope);
    await safeWriteWorkspaceTextFile(repoRoot, ulwLoopBriefPath(repoRoot, scope), args.brief.endsWith(`
`) ? args.brief : `${args.brief}
`);
    await safeWriteWorkspaceTextFile(repoRoot, ulwLoopLedgerPath(repoRoot, scope), "");
    await commitPlanAndLedgerEntries(repoRoot, plan, [{ at: now, kind: "plan_created", message: `${goals.length} goal(s) created` }], scope);
    return plan;
  });
}
function completedPlanExistsError(scope) {
  return new UlwLoopError([
    `Existing ulw-loop aggregate is already complete at ${ulwLoopGoalsRelativePath(scope)}.`,
    `Start a new run with \`${grokUlwCli()} create-goals --session-id <new-id> ...\` to isolate fresh state.`,
    "Use --force only when you intentionally want to overwrite the completed evidence."
  ].join(" "), "ULW_LOOP_PLAN_EXISTS_COMPLETE");
}
async function addUlwLoopGoal(repoRoot, args, scope) {
  return withUlwLoopMutationLock(repoRoot, scope, async () => {
    const plan = await readUlwLoopPlan(repoRoot, scope);
    const now = iso();
    const goal = appendGoalToPlan(plan, args.title, args.objective, now);
    await commitPlanAndLedgerEntries(repoRoot, plan, [{ at: now, kind: "goal_added", goalId: goal.id, status: goal.status, message: goal.title }], scope);
    return { plan, goal };
  });
}
async function startNextUlwLoop(repoRoot, args = {}, scope) {
  return withUlwLoopMutationLock(repoRoot, scope, async () => {
    const plan = await readUlwLoopPlan(repoRoot, scope);
    const now = iso();
    if (plan.aggregateCompletion?.status === "complete")
      return { done: true, plan };
    const existing = plan.goals.find((goal) => goal.status === "in_progress" && isScheduleEligible(goal));
    if (existing)
      return { plan, goal: existing, resumed: true };
    const ledgerEntries = [];
    let next = plan.goals.find((goal) => goal.status === "pending" && isScheduleEligible(goal));
    if (!next && args.retryFailed) {
      next = plan.goals.find((goal) => goal.status === "failed" && !goal.nonRetriable && isScheduleEligible(goal));
      if (next)
        ledgerEntries.push({
          at: now,
          kind: "goal_retried",
          goalId: next.id,
          status: "pending",
          ...next.failureReason ? { message: next.failureReason } : {}
        });
    }
    if (!next)
      return { done: true, plan };
    next.status = "in_progress";
    next.attempt += 1;
    next.startedAt = now;
    clearGoalBlockerFields2(next);
    next.updatedAt = now;
    plan.activeGoalId = next.id;
    plan.updatedAt = now;
    ledgerEntries.push({
      at: now,
      kind: "goal_started",
      goalId: next.id,
      status: next.status,
      message: `Attempt ${next.attempt}`
    });
    await commitPlanAndLedgerEntries(repoRoot, plan, ledgerEntries, scope);
    return { plan, goal: next, resumed: false };
  });
}
function summarizeUlwLoopPlan(plan) {
  const countStatus = (status) => plan.goals.filter((goal) => goal.status === status).length;
  const countCriteria = (status) => plan.goals.reduce((sum, goal) => sum + goal.successCriteria.filter((criterion) => criterion.status === status).length, 0);
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
      blocked: countCriteria("blocked")
    }
  };
}

// src/checkpoint-continuation.ts
async function checkpointAndContinue(repoRoot, args, scope) {
  const result = await checkpointUlwLoop(repoRoot, args, scope);
  if (args.status !== "complete" || result.aggregateCompletion !== undefined || !args.advance)
    return result;
  const next = await startNextUlwLoop(repoRoot, {}, scope);
  if ("done" in next)
    return { ...result, plan: next.plan, next: doneNext(next.plan) };
  const instruction = buildCodexGoalInstruction({ plan: next.plan, goal: next.goal });
  return { ...result, plan: next.plan, next: { resumed: next.resumed, goal: next.goal, instruction } };
}
async function checkpoint(repoRoot, argv, json, scope) {
  const goalId = required2(argv, "--goal-id");
  const statusValue = checkpointStatus(required2(argv, "--status"));
  const evidence = required2(argv, "--evidence");
  const codexGoalJson = await parseCodexGoalJson(statusValue === "complete" ? required2(argv, "--codex-goal-json") : readValue(argv, "--codex-goal-json"), repoRoot);
  if (statusValue === "complete" && codexGoalJson === undefined) {
    throw new UlwLoopError("Missing --codex-goal-json.", "ULW_LOOP_CODEX_GOAL_JSON_REQUIRED");
  }
  const qualityGateJson = readValue(argv, "--quality-gate-json");
  const args = {
    goalId,
    status: statusValue,
    evidence,
    advance: !hasFlag(argv, "--no-advance"),
    ...codexGoalJson === undefined ? {} : { codexGoalJson },
    ...qualityGateJson === undefined ? {} : { qualityGateJson }
  };
  const result = await checkpointAndContinue(repoRoot, args, scope);
  if (json)
    printJson({ ok: true, ...result, summary: summarizeUlwLoopPlan(result.plan) });
  else
    printCheckpointText(result);
  return 0;
}
function printCheckpointText(result) {
  process.stdout.write(`ulw-loop checkpoint: ${result.goal.id} -> ${result.goal.status}
`);
  if (result.next === undefined)
    return;
  if ("instruction" in result.next)
    process.stdout.write(`${result.next.instruction.text}
`);
  else
    process.stdout.write(`${result.next.handoff || "ulw-loop: all goals complete"}
`);
}
function doneNext(plan) {
  const handoff = blockedDecisionHandoff(plan);
  return { done: true, blocked: handoff.length > 0, handoff };
}
function required2(argv, flag) {
  const value = readValue(argv, flag)?.trim();
  if (value)
    return value;
  throw new UlwLoopError(`Missing ${flag}.`, "ULW_LOOP_ARGUMENT_MISSING", { details: { flag } });
}
function checkpointStatus(value) {
  if (value === "complete" || value === "failed" || value === "blocked")
    return value;
  throw new UlwLoopError("Missing or invalid --status; expected complete, failed, or blocked.", "ULW_LOOP_STATUS_INVALID", { details: { status: value } });
}

// src/cli-steering.ts
var SOURCES = ["user_prompt_submit", "finding", "cli"];
var STEERING_KIND_HELP = [
  `Allowed --kind values: ${ULW_LOOP_STEERING_MUTATION_KINDS.join(", ")}`,
  "Kind-specific required flags:",
  "  add_subgoal: --title, --objective, --evidence, --rationale",
  "  split_subgoal: --goal-id, --children, --evidence, --rationale",
  "  reorder_pending: --order, --evidence, --rationale",
  "  revise_pending_wording: --goal-id, --title or --objective, --evidence, --rationale",
  "  revise_criterion: --goal-id, --criterion-id, one of --scenario/--expected-evidence/--user-model, --evidence, --rationale",
  "  annotate_ledger: --evidence, --rationale",
  "  mark_blocked_superseded: --goal-id, optional --replacements, --evidence, --rationale",
  'Example: ulw-loop steer --kind annotate_ledger --evidence "observed behavior" --rationale "why this changes the plan" --json'
].join(`
`);
function isKind(value) {
  return value !== undefined && ULW_LOOP_STEERING_MUTATION_KINDS.some((kind) => kind === value);
}
function isSource(value) {
  return value !== undefined && SOURCES.some((source) => source === value);
}
function isModel(value) {
  return ULW_LOOP_SUCCESS_CRITERION_USER_MODELS.some((model) => model === value);
}
function fail2(message, code, details) {
  throw new UlwLoopError(message, code, { details });
}
function kindMessage(prefix) {
  return `${prefix}

${STEERING_KIND_HELP}`;
}
function text2(value, field) {
  if (value === undefined)
    return;
  const trimmed = value.trim();
  if (trimmed.length > 0)
    return trimmed;
  return fail2(`Empty ${field}.`, "ULW_LOOP_STEERING_FIELD_EMPTY", { field });
}
function required3(argv, flag) {
  const value = text2(readValue(argv, flag), flag);
  return value ?? fail2(`Missing ${flag}.`, "ULW_LOOP_STEERING_FIELD_REQUIRED", { flag });
}
function requiredGoal(argv) {
  const value = text2(parseGoalArg(argv), "--goal-id");
  return value ?? fail2("Missing --goal-id.", "ULW_LOOP_GOAL_ID_REQUIRED", { flag: "--goal-id" });
}
function readObject(value, key) {
  return Object.entries(value).find(([name]) => name === key)?.[1];
}
function isPlain(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function objectText(value, key) {
  const candidate = readObject(value, key);
  return typeof candidate === "string" ? candidate : undefined;
}
function objectStrings(value, key) {
  const candidate = readObject(value, key);
  return Array.isArray(candidate) && candidate.every((item) => typeof item === "string") ? candidate : undefined;
}
function objectChildren(value, key) {
  const candidate = readObject(value, key);
  if (!Array.isArray(candidate))
    return;
  const parsed = [];
  for (const item of candidate) {
    const next = child(item);
    if (next === null)
      return fail2(`${key} entries require title/objective.`, "ULW_LOOP_STEERING_CHILD_INVALID", { key });
    parsed.push(next);
  }
  return parsed;
}
function isProposalKind(value) {
  return typeof value === "string" && ULW_LOOP_STEERING_MUTATION_KINDS.some((kind) => kind === value);
}
function isProposalSource(value) {
  return typeof value === "string" && SOURCES.some((source) => source === value);
}
function parseSteeringKind(argv) {
  const value = readValue(argv, "--kind");
  if (isKind(value))
    return value;
  return value === undefined ? fail2(kindMessage("Missing --kind."), "ULW_LOOP_STEERING_KIND_REQUIRED", { flag: "--kind", expected: ULW_LOOP_STEERING_MUTATION_KINDS, usage: STEERING_KIND_HELP }) : fail2(kindMessage(`Invalid --kind: ${value}.`), "ULW_LOOP_STEERING_KIND_INVALID", { value, expected: ULW_LOOP_STEERING_MUTATION_KINDS, usage: STEERING_KIND_HELP });
}
function parseSteeringSource(argv) {
  const value = readValue(argv, "--source");
  if (value === undefined)
    return "cli";
  return isSource(value) ? value : fail2(`Invalid --source: ${value}.`, "ULW_LOOP_STEERING_SOURCE_INVALID", { value, expected: SOURCES });
}
function child(value) {
  if (!isPlain(value))
    return null;
  const title = text2(objectText(value, "title"), "title");
  const objective = text2(objectText(value, "objective"), "objective");
  if (title === undefined || objective === undefined)
    return null;
  return { title, objective };
}
async function children(argv, flag, needed, repoRoot) {
  const input = needed ? required3(argv, flag) : text2(readValue(argv, flag), flag);
  if (input === undefined)
    return [];
  const raw = await readJsonInput(input, repoRoot);
  if (!Array.isArray(raw))
    return fail2(`${flag} must be a JSON array.`, "ULW_LOOP_STEERING_JSON_ARRAY_REQUIRED", { flag });
  const parsed = [];
  for (const item of raw) {
    const next = child(item);
    if (next === null)
      return fail2(`${flag} entries require title/objective.`, "ULW_LOOP_STEERING_CHILD_INVALID", { flag });
    parsed.push(next);
  }
  return parsed;
}
async function stringArray2(argv, flag, repoRoot) {
  const raw = await readJsonInput(required3(argv, flag), repoRoot);
  if (!Array.isArray(raw))
    return fail2(`${flag} must be a JSON array.`, "ULW_LOOP_STEERING_JSON_ARRAY_REQUIRED", { flag });
  const values = [];
  for (const item of raw) {
    if (typeof item !== "string")
      return fail2(`${flag} entries must be strings.`, "ULW_LOOP_STEERING_STRING_ARRAY_REQUIRED", { flag });
    values.push(text2(item, flag) ?? "");
  }
  return values;
}
function model(value) {
  const trimmed = text2(value, "--user-model");
  if (trimmed === undefined)
    return;
  return isModel(trimmed) ? trimmed : fail2(`Invalid --user-model: ${trimmed}.`, "ULW_LOOP_STEERING_USER_MODEL_INVALID", { value: trimmed, expected: ULW_LOOP_SUCCESS_CRITERION_USER_MODELS });
}
function neverKind(kind) {
  return fail2(`Unsupported steering kind: ${String(kind)}.`, "ULW_LOOP_STEERING_KIND_UNSUPPORTED", { kind });
}
async function parseSteeringProposal(argv, repoRoot = process.cwd()) {
  const kind = parseSteeringKind(argv);
  const source = parseSteeringSource(argv);
  const idempotencyKey = text2(readValue(argv, "--idempotency-key"), "--idempotency-key");
  const base = { kind, source, evidence: required3(argv, "--evidence"), rationale: required3(argv, "--rationale"), ...idempotencyKey === undefined ? {} : { idempotencyKey } };
  switch (kind) {
    case "add_subgoal":
      return normalizeSteeringProposal({ ...base, title: required3(argv, "--title"), objective: required3(argv, "--objective") });
    case "split_subgoal": {
      const goalId = requiredGoal(argv);
      return normalizeSteeringProposal({ ...base, goalId, targetGoalId: goalId, childGoals: await children(argv, "--children", true, repoRoot) });
    }
    case "reorder_pending":
      return normalizeSteeringProposal({ ...base, pendingOrder: await stringArray2(argv, "--order", repoRoot) });
    case "revise_pending_wording": {
      const goalId = requiredGoal(argv);
      const revisedTitle = readValue(argv, "--title");
      const revisedObjective = readValue(argv, "--objective");
      if (revisedTitle === undefined && revisedObjective === undefined)
        return fail2("revise_pending_wording requires --title or --objective.", "ULW_LOOP_STEERING_UPDATE_REQUIRED", { kind });
      return normalizeSteeringProposal({ ...base, goalId, targetGoalId: goalId, ...revisedTitle === undefined ? {} : { revisedTitle }, ...revisedObjective === undefined ? {} : { revisedObjective } });
    }
    case "revise_criterion": {
      const goalId = requiredGoal(argv);
      const criterionId = required3(argv, "--criterion-id");
      const scenario = readValue(argv, "--scenario");
      const expectedEvidence = readValue(argv, "--expected-evidence");
      const userModel = model(readValue(argv, "--user-model"));
      if (scenario === undefined && expectedEvidence === undefined && userModel === undefined)
        return fail2("revise_criterion requires scenario, expected-evidence, or user-model.", "ULW_LOOP_STEERING_UPDATE_REQUIRED", { kind });
      return normalizeSteeringProposal({ ...base, goalId, targetGoalId: goalId, criterionId, ...scenario === undefined ? {} : { scenario }, ...expectedEvidence === undefined ? {} : { expectedEvidence }, ...userModel === undefined ? {} : { userModel } });
    }
    case "annotate_ledger":
      return normalizeSteeringProposal(base);
    case "mark_blocked_superseded": {
      const goalId = requiredGoal(argv);
      const childGoals = await children(argv, "--replacements", false, repoRoot);
      return normalizeSteeringProposal({ ...base, goalId, targetGoalId: goalId, ...childGoals.length === 0 ? {} : { childGoals } });
    }
    default:
      return neverKind(kind);
  }
}
function normalizedChildren(values) {
  if (values === undefined)
    return;
  return values.map((item) => ({ title: text2(item.title, "child.title") ?? "", objective: text2(item.objective, "child.objective") ?? "" }));
}
function normalizedStrings(values, field) {
  if (values === undefined)
    return;
  return values.map((value) => text2(value, field) ?? "");
}
function normalizeSteeringProposal(proposal) {
  const evidence = text2(proposal.evidence, "evidence") ?? "";
  const rationale = text2(proposal.rationale, "rationale") ?? "";
  const goalId = text2(proposal.goalId, "goalId");
  const targetGoalId = text2(proposal.targetGoalId, "targetGoalId");
  const targetGoalIds = normalizedStrings(proposal.targetGoalIds, "targetGoalIds");
  const criterionId = text2(proposal.criterionId, "criterionId");
  const title = text2(proposal.title, "title");
  const objective = text2(proposal.objective, "objective");
  const revisedTitle = text2(proposal.revisedTitle, "revisedTitle");
  const revisedObjective = text2(proposal.revisedObjective, "revisedObjective");
  const blockedReason = text2(proposal.blockedReason, "blockedReason");
  const directiveText = text2(proposal.directiveText, "directiveText");
  const promptSignature = text2(proposal.promptSignature, "promptSignature");
  const idempotencyKey = text2(proposal.idempotencyKey, "idempotencyKey");
  const scenario = text2(proposal.scenario, "scenario");
  const expectedEvidence = text2(proposal.expectedEvidence, "expectedEvidence");
  const childGoals = normalizedChildren(proposal.childGoals);
  const pendingOrder = normalizedStrings(proposal.pendingOrder, "pendingOrder");
  return { kind: proposal.kind, source: proposal.source, evidence, rationale, ...goalId === undefined ? {} : { goalId }, ...targetGoalId === undefined ? {} : { targetGoalId }, ...targetGoalIds === undefined ? {} : { targetGoalIds }, ...criterionId === undefined ? {} : { criterionId }, ...title === undefined ? {} : { title }, ...objective === undefined ? {} : { objective }, ...childGoals === undefined ? {} : { childGoals }, ...revisedTitle === undefined ? {} : { revisedTitle }, ...revisedObjective === undefined ? {} : { revisedObjective }, ...pendingOrder === undefined ? {} : { pendingOrder }, ...blockedReason === undefined ? {} : { blockedReason }, ...proposal.after === undefined ? {} : { after: proposal.after }, ...directiveText === undefined ? {} : { directiveText }, ...promptSignature === undefined ? {} : { promptSignature }, ...idempotencyKey === undefined ? {} : { idempotencyKey }, ...proposal.now === undefined ? {} : { now: proposal.now }, ...scenario === undefined ? {} : { scenario }, ...expectedEvidence === undefined ? {} : { expectedEvidence }, ...proposal.userModel === undefined ? {} : { userModel: proposal.userModel } };
}
async function parseSteeringProposals(argv, repoRoot = process.cwd()) {
  const input = text2(readValue(argv, "--proposals-json"), "--proposals-json");
  if (input === undefined)
    return [await parseSteeringProposal(argv, repoRoot)];
  if (readValue(argv, "--kind") !== undefined)
    return fail2("--kind and --proposals-json are mutually exclusive.", "ULW_LOOP_STEERING_BATCH_CONFLICT", { flags: ["--kind", "--proposals-json"] });
  const raw = await readJsonInput(input, repoRoot);
  if (!Array.isArray(raw) || raw.length === 0)
    return fail2("--proposals-json must be a non-empty JSON array.", "ULW_LOOP_STEERING_BATCH_ARRAY_REQUIRED", { flag: "--proposals-json" });
  const proposals = [];
  for (const item of raw)
    proposals.push(normalizeSteeringProposal(proposalFromObject(item)));
  return proposals;
}
function proposalFromObject(value) {
  if (!isPlain(value))
    return fail2("--proposals-json entries must be objects.", "ULW_LOOP_STEERING_BATCH_ITEM_INVALID", { flag: "--proposals-json" });
  const kind = readObject(value, "kind");
  const source = readObject(value, "source") ?? "cli";
  if (!isProposalKind(kind))
    return fail2(`Invalid batch steering kind: ${String(kind)}.`, "ULW_LOOP_STEERING_KIND_INVALID", { value: kind });
  if (!isProposalSource(source))
    return fail2(`Invalid batch steering source: ${String(source)}.`, "ULW_LOOP_STEERING_SOURCE_INVALID", { value: source });
  let proposal = { kind, source, evidence: objectText(value, "evidence") ?? "", rationale: objectText(value, "rationale") ?? "" };
  const goalId = objectText(value, "goalId");
  const targetGoalId = objectText(value, "targetGoalId");
  const criterionId = objectText(value, "criterionId");
  const title = objectText(value, "title");
  const objective = objectText(value, "objective");
  const revisedTitle = objectText(value, "revisedTitle");
  const revisedObjective = objectText(value, "revisedObjective");
  const scenario = objectText(value, "scenario");
  const expectedEvidence = objectText(value, "expectedEvidence");
  const idempotencyKey = objectText(value, "idempotencyKey");
  const targetGoalIds = objectStrings(value, "targetGoalIds");
  const pendingOrder = objectStrings(value, "pendingOrder");
  const childGoals = objectChildren(value, "childGoals");
  if (goalId !== undefined)
    proposal = { ...proposal, goalId };
  if (targetGoalId !== undefined)
    proposal = { ...proposal, targetGoalId };
  if (criterionId !== undefined)
    proposal = { ...proposal, criterionId };
  if (title !== undefined)
    proposal = { ...proposal, title };
  if (objective !== undefined)
    proposal = { ...proposal, objective };
  if (revisedTitle !== undefined)
    proposal = { ...proposal, revisedTitle };
  if (revisedObjective !== undefined)
    proposal = { ...proposal, revisedObjective };
  if (scenario !== undefined)
    proposal = { ...proposal, scenario };
  if (expectedEvidence !== undefined)
    proposal = { ...proposal, expectedEvidence };
  if (idempotencyKey !== undefined)
    proposal = { ...proposal, idempotencyKey };
  if (targetGoalIds !== undefined)
    proposal = { ...proposal, targetGoalIds };
  if (pendingOrder !== undefined)
    proposal = { ...proposal, pendingOrder };
  if (childGoals !== undefined)
    proposal = { ...proposal, childGoals };
  return proposal;
}
function printSteerResult(result, json) {
  if (json) {
    printJson({ ok: result.accepted, accepted: result.accepted, rejectedReasons: result.rejectedReasons, deduped: result.deduped, audit: result.audit, plan: result.plan });
    return;
  }
  const outcome = result.deduped ? "deduped" : result.accepted ? "accepted" : "rejected";
  process.stdout.write(`ulw-loop steer: ${outcome} ${result.audit.kind}
`);
  if (result.rejectedReasons.length > 0)
    process.stdout.write(`rejected: ${result.rejectedReasons.join("; ")}
`);
  if (result.audit.idempotencyKey !== undefined)
    process.stdout.write(`idempotency-key: ${result.audit.idempotencyKey}
`);
  printStatus(result.plan);
}
function printSteerBatchResult(result, json) {
  if (json) {
    printJson({ ok: result.accepted, accepted: result.accepted, rejectedReasons: result.rejectedReasons, results: result.results, plan: result.plan });
    return;
  }
  process.stdout.write(`ulw-loop steer batch: ${result.accepted ? "accepted" : "rejected"} ${result.results.length} proposal(s)
`);
  if (result.rejectedReasons.length > 0)
    process.stdout.write(`rejected: ${result.rejectedReasons.join("; ")}
`);
  printStatus(result.plan);
}

// src/review-blockers.ts
var BLOCKER_FIELDS = "blockedReason blockerSignature blockerOccurrenceCount requiredExternalDecision nonRetriable failedAt failureReason completedAt blocker blockerEvidence blockerOccurrences blockedAt".split(" ");
function ulwLoopError(message, code) {
  throw new UlwLoopError(message, code);
}
function nextGoalId(plan) {
  const max = plan.goals.reduce((current, goal) => {
    const digits = /^G(\d+)/u.exec(goal.id)?.[1];
    return digits === undefined ? current : Math.max(current, Number(digits));
  }, 0);
  return `G${String(max + 1).padStart(3, "0")}`;
}
function appendBlockerGoal(plan, args, now) {
  const index = plan.goals.length;
  const goal = {
    id: nextGoalId(plan),
    title: args.title,
    objective: args.objective,
    status: "pending",
    successCriteria: seedDefaultSuccessCriteria(index, args.objective),
    attempt: 0,
    createdAt: now,
    updatedAt: now
  };
  plan.goals.push(goal);
  return goal;
}
async function recordFinalReviewBlockers(repoRoot, args, scope) {
  return withUlwLoopMutationLock(repoRoot, scope, async () => {
    const plan = await readUlwLoopPlan(repoRoot, scope);
    const goal = plan.goals.find((candidate) => candidate.id === args.goalId);
    if (goal === undefined)
      ulwLoopError(`Unknown ulw-loop id: ${args.goalId}`, "ulw_loop_goal_not_found");
    if (goal.status !== "in_progress")
      ulwLoopError(`${goal.id} is ${goal.status}.`, "ulw_loop_goal_not_in_progress");
    if (!isFinalRunCompletionCandidate(plan, goal))
      ulwLoopError(`${goal.id} is not final.`, "ulw_loop_not_final_story");
    const snapshot = await readCodexGoalSnapshotInput(args.codexGoalJson, repoRoot);
    const aggregate = codexGoalMode(plan) === "aggregate";
    const reconciliation = reconcileCodexGoalSnapshot(snapshot, { expectedObjective: expectedCodexObjective(plan, goal), ...aggregate ? { acceptedObjectives: compatibleCodexObjectives(plan) } : {}, allowedStatuses: ["active"], requireSnapshot: true, requireComplete: false });
    if (!reconciliation.ok)
      ulwLoopError(reconciliation.errors.join(" "), "ulw_loop_codex_snapshot_mismatch");
    const now = iso();
    for (const field of BLOCKER_FIELDS)
      Reflect.deleteProperty(goal, field);
    goal.status = "review_blocked";
    goal.reviewBlockedAt = now;
    goal.evidence = args.evidence;
    goal.updatedAt = now;
    if (plan.activeGoalId === goal.id)
      delete plan.activeGoalId;
    const newGoal = appendBlockerGoal(plan, args, now);
    plan.updatedAt = now;
    const codexGoal = reconciliation.snapshot.raw;
    const blockedEntry = { at: now, kind: "goal_review_blocked", goalId: goal.id, status: goal.status, evidence: args.evidence, codexGoal };
    const addedEntry = { at: now, kind: "goal_added", goalId: newGoal.id, status: newGoal.status, evidence: args.evidence, message: newGoal.title };
    const summaryEntry = { at: now, kind: "goal_review_blocked", goalId: goal.id, status: goal.status, evidence: args.evidence, codexGoal, message: `Review blockers recorded; appended ${newGoal.id}.` };
    Reflect.set(summaryEntry, "kind", "blocker_recorded");
    const ledgerEntries = [blockedEntry, addedEntry, summaryEntry];
    await commitPlanAndLedgerEntries(repoRoot, plan, ledgerEntries, scope);
    return { plan, blockedGoal: goal, newGoal, ledgerEntries };
  });
}

// src/steering-mutations.ts
var read2 = (value, key) => Object.entries(value).find(([name]) => name === key)?.[1];
var isText = (value) => typeof value === "string" && value.trim().length > 0;
var text3 = (value, key) => {
  const candidate = read2(value, key);
  return isText(candidate) ? candidate.trim() : undefined;
};
var isModel2 = (value) => typeof value === "string" && ULW_LOOP_SUCCESS_CRITERION_USER_MODELS.some((model2) => model2 === value);
var after = (proposal) => {
  const candidate = read2(proposal, "after");
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate) ? candidate : undefined;
};
var revised = (proposal, direct, nested) => text3(proposal, direct) ?? text3(after(proposal) ?? proposal, nested);
var targets = (proposal) => proposal.targetGoalIds ?? [proposal.targetGoalId ?? text3(proposal, "goalId") ?? ""].filter(Boolean);
var child2 = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const title = text3(value, "title");
  const objective = text3(value, "objective");
  return title === undefined || objective === undefined ? null : { title, objective };
};
var children2 = (proposal) => {
  const direct = proposal.childGoals;
  if (direct !== undefined && direct.length > 0)
    return direct;
  const nested = after(proposal);
  const fromAfter = nested === undefined ? undefined : read2(nested, "children");
  return Array.isArray(fromAfter) ? fromAfter.map(child2).filter((item) => item !== null) : [];
};
var goal = (plan, id) => id === undefined ? undefined : plan.goals.find((item) => item.id === id);
function nextId(plan, offset) {
  const max = plan.goals.reduce((current, item) => {
    const digits = /^G(\d+)(?:-|$)/u.exec(item.id)?.[1];
    return digits === undefined ? current : Math.max(current, Number(digits));
  }, 0);
  return `G${String(max + offset).padStart(3, "0")}`;
}
function makeGoal2(plan, childGoal, evidence, now, offset) {
  const id = nextId(plan, offset);
  const digits = /^G(\d+)/u.exec(id)?.[1];
  const goalIndex = digits === undefined ? plan.goals.length + offset - 1 : Number(digits) - 1;
  return { id, title: childGoal.title, objective: childGoal.objective, status: "pending", successCriteria: seedDefaultSuccessCriteria(goalIndex, childGoal.objective), attempt: 0, createdAt: now, updatedAt: now, evidence };
}
function reviseWording(plan, proposal, now) {
  const target = goal(plan, targets(proposal)[0]);
  if (target === undefined)
    return;
  target.title = revised(proposal, "revisedTitle", "title") ?? target.title;
  target.objective = revised(proposal, "revisedObjective", "objective") ?? target.objective;
  target.steeringEvidence = proposal.evidence;
  target.steeringRationale = proposal.rationale;
  target.updatedAt = now;
}
function splitOrBlock(plan, proposal, now) {
  const target = goal(plan, targets(proposal)[0]);
  if (target === undefined)
    return;
  const replacements = children2(proposal).map((item, index) => makeGoal2(plan, item, proposal.evidence, now, index + 1));
  target.steeringEvidence = proposal.evidence;
  target.steeringRationale = proposal.rationale;
  target.updatedAt = now;
  if (replacements.length === 0) {
    target.status = "blocked";
    target.steeringStatus = "blocked";
    target.blockedReason = proposal.blockedReason ?? proposal.rationale;
  } else {
    target.steeringStatus = "superseded";
    target.supersededBy = replacements.map((item) => item.id);
    for (const item of replacements)
      item.supersedes = [target.id];
    plan.goals.splice(plan.goals.indexOf(target) + 1, 0, ...replacements);
    updateBatchesAfterSupersede(plan, target.id, replacements.map((item) => item.id));
  }
  if (plan.activeGoalId === target.id)
    delete plan.activeGoalId;
}
function reviseCriterion(plan, proposal, now) {
  const target = goal(plan, targets(proposal)[0]);
  const index = target?.successCriteria.findIndex((item) => item.id === proposal.criterionId) ?? -1;
  const current = target?.successCriteria[index];
  if (target === undefined || current === undefined)
    return;
  const model2 = read2(proposal, "userModel");
  target.successCriteria[index] = { ...current, scenario: text3(proposal, "scenario") ?? current.scenario, expectedEvidence: text3(proposal, "expectedEvidence") ?? current.expectedEvidence, userModel: isModel2(model2) ? model2 : current.userModel };
  target.updatedAt = now;
}

// src/steering-snapshot.ts
function buildSteeringPlanSnapshot(plan, changedGoalIds) {
  const snapshot = {
    updatedAt: plan.updatedAt,
    goalCount: plan.goals.length,
    goalIds: plan.goals.map((goal2) => goal2.id),
    goals: plan.goals.filter((goal2) => changedGoalIds.has(goal2.id))
  };
  return plan.activeGoalId === undefined ? snapshot : { ...snapshot, activeGoalId: plan.activeGoalId };
}
function changedGoalIdsBetween(before, after2) {
  const beforeById = new Map(before.goals.map((goal2) => [goal2.id, goal2]));
  const changed = new Set;
  for (const goal2 of after2.goals) {
    const prior = beforeById.get(goal2.id);
    if (prior === undefined || JSON.stringify(prior) !== JSON.stringify(goal2))
      changed.add(goal2.id);
    beforeById.delete(goal2.id);
  }
  for (const id of beforeById.keys())
    changed.add(id);
  return changed;
}

// src/steering.ts
var SOURCES2 = ["user_prompt_submit", "finding", "cli"];
var PROTECTED = new Set(["aggregateCompletion", "codexObjective", "codexObjectiveAliases", "originalConstraints", "qualityGate", "status", "completedAt", "completionStatus"]);
var isObject3 = (value) => typeof value === "object" && value !== null;
var isPlain2 = (value) => isObject3(value) && !Array.isArray(value);
var read3 = (value, key) => Object.entries(value).find(([name]) => name === key)?.[1];
var isText2 = (value) => typeof value === "string" && value.trim().length > 0;
var text4 = (value, key) => {
  const candidate = read3(value, key);
  return isText2(candidate) ? candidate.trim() : undefined;
};
var isKind2 = (value) => typeof value === "string" && ULW_LOOP_STEERING_MUTATION_KINDS.some((kind) => kind === value);
var isSource2 = (value) => typeof value === "string" && SOURCES2.some((source) => source === value);
var isModel3 = (value) => typeof value === "string" && ULW_LOOP_SUCCESS_CRITERION_USER_MODELS.some((model2) => model2 === value);
var texts = (value, key) => {
  const candidate = read3(value, key);
  return Array.isArray(candidate) && candidate.every((item) => typeof item === "string") ? candidate : [];
};
function targets2(proposal) {
  const many = texts(proposal, "targetGoalIds");
  const one = text4(proposal, "targetGoalId") ?? text4(proposal, "goalId");
  return many.length > 0 ? many : one === undefined ? [] : [one];
}
var after2 = (proposal) => {
  const candidate = read3(proposal, "after");
  return isPlain2(candidate) ? candidate : undefined;
};
var revised2 = (proposal, direct, nested) => text4(proposal, direct) ?? text4(after2(proposal) ?? proposal, nested);
function child3(value) {
  if (!isPlain2(value))
    return null;
  const title = text4(value, "title");
  const objective = text4(value, "objective");
  if (title === undefined || objective === undefined)
    return null;
  return { title, objective };
}
function childValues(proposal) {
  const direct = read3(proposal, "childGoals");
  if (Array.isArray(direct) && direct.length > 0)
    return direct;
  const nested = after2(proposal);
  const fromAfter = nested === undefined ? undefined : read3(nested, "children");
  return Array.isArray(fromAfter) ? fromAfter : [];
}
var pendingOrder = (proposal) => {
  const direct = texts(proposal, "pendingOrder");
  return direct.length > 0 ? direct : texts(after2(proposal) ?? proposal, "pendingGoalIds");
};
function hasProtected(value) {
  if (!isObject3(value))
    return false;
  for (const [key, childValue] of Object.entries(value))
    if (PROTECTED.has(key) || key.toLowerCase().includes("complete") || hasProtected(childValue))
      return true;
  return false;
}
function allText(value) {
  if (typeof value === "string")
    return value;
  return isObject3(value) ? Object.values(value).map(allText).filter(Boolean).join(`
`) : "";
}
function weakens(value) {
  const valueText = allText(value).toLowerCase();
  return /\b(skip|bypass|weaken|remove|omit|auto[-\s]?complete|mark complete|complete faster)\b/.test(valueText) && /\b(test|tests|verification|review|quality gate|complete|completion)\b/.test(valueText);
}
function auditFor(proposal, reasons) {
  const object = isPlain2(proposal) ? proposal : undefined;
  const kindRaw = object === undefined ? undefined : read3(object, "kind");
  const sourceRaw = object === undefined ? undefined : read3(object, "source");
  const evidence = object === undefined ? "" : text4(object, "evidence") ?? "";
  const rationale = object === undefined ? "" : text4(object, "rationale") ?? "";
  const audit = { kind: isKind2(kindRaw) ? kindRaw : "annotate_ledger", source: isSource2(sourceRaw) ? sourceRaw : "cli", targetGoalIds: object === undefined ? [] : targets2(object), evidence, rationale, invariant: { accepted: reasons.length === 0, structuralInvariantAccepted: reasons.length === 0, evidenceBackedNecessity: evidence.length > 0 && rationale.length > 0, noEasierCompletion: !weakens(proposal), rejectedReasons: reasons, reasons } };
  if (object === undefined)
    return audit;
  const criterionId = text4(object, "criterionId");
  const directiveText = text4(object, "directiveText");
  const promptSignature = text4(object, "promptSignature");
  const idempotencyKey = text4(object, "idempotencyKey");
  if (criterionId !== undefined)
    audit.criterionId = criterionId;
  if (directiveText !== undefined)
    audit.directiveText = directiveText;
  if (promptSignature !== undefined)
    audit.promptSignature = promptSignature;
  if (idempotencyKey !== undefined)
    audit.idempotencyKey = idempotencyKey;
  return audit;
}
function validateUlwLoopSteeringProposal(plan, proposal) {
  const reasons = [];
  if (!isPlain2(proposal))
    reasons.push("proposal must be an object");
  const object = isPlain2(proposal) ? proposal : {};
  const kind = read3(object, "kind");
  if (!isKind2(kind))
    reasons.push(`invalid kind: ${String(kind)}`);
  if (!isSource2(read3(object, "source")))
    reasons.push(`invalid source: ${String(read3(object, "source"))}`);
  if (text4(object, "evidence") === undefined)
    reasons.push("missing evidence");
  if (text4(object, "rationale") === undefined)
    reasons.push("missing rationale");
  if (hasProtected(proposal))
    reasons.push("protected payload");
  if (weakens(proposal))
    reasons.push("weakened completion");
  if (isUlwLoopDone(plan))
    reasons.push("plan already complete");
  if (isKind2(kind))
    validateKind(plan, object, kind, reasons);
  return auditFor(proposal, reasons);
}
function goal2(plan, id) {
  return id === undefined ? undefined : plan.goals.find((item) => item.id === id);
}
function validateKind(plan, proposal, kind, reasons) {
  const target = goal2(plan, targets2(proposal)[0]);
  if (kind === "add_subgoal" && (text4(proposal, "title") === undefined || text4(proposal, "objective") === undefined))
    reasons.push("add_subgoal requires title/objective");
  if ((kind === "split_subgoal" || kind === "revise_pending_wording" || kind === "mark_blocked_superseded") && target === undefined)
    reasons.push(`${kind} requires target`);
  if ((kind === "split_subgoal" || kind === "revise_pending_wording") && target !== undefined && target.status !== "pending")
    reasons.push(`${kind} requires pending target`);
  const rawChildren = childValues(proposal);
  if (kind === "split_subgoal" && rawChildren.length === 0)
    reasons.push("split_subgoal requires children");
  if ((kind === "split_subgoal" || kind === "mark_blocked_superseded") && rawChildren.some((item) => child3(item) === null))
    reasons.push(`${kind} children require title/objective`);
  if (kind === "reorder_pending")
    validateOrder(plan, proposal, reasons);
  if (kind === "revise_pending_wording" && revised2(proposal, "revisedTitle", "title") === undefined && revised2(proposal, "revisedObjective", "objective") === undefined)
    reasons.push("revise_pending_wording requires update");
  if (kind === "revise_criterion")
    validateCriterion(plan, proposal, reasons);
}
function validateOrder(plan, proposal, reasons) {
  const requested = pendingOrder(proposal);
  const pending = plan.goals.filter((item) => item.status === "pending" && item.steeringStatus === undefined).map((item) => item.id);
  if (requested.length === 0)
    reasons.push("reorder_pending requires ids");
  if (new Set(requested).size !== requested.length)
    reasons.push("duplicate pending id");
  if (requested.some((id) => !pending.includes(id)))
    reasons.push("unknown pending id");
}
function validateCriterion(plan, proposal, reasons) {
  const target = goal2(plan, targets2(proposal)[0]);
  const criterionId = text4(proposal, "criterionId");
  if (target === undefined)
    reasons.push("revise_criterion requires goalId");
  else if (criterionId === undefined || target.successCriteria.every((item) => item.id !== criterionId))
    reasons.push("revise_criterion requires criterionId");
  const model2 = read3(proposal, "userModel");
  if (read3(proposal, "scenario") === undefined && read3(proposal, "expectedEvidence") === undefined && model2 === undefined)
    reasons.push("revise_criterion requires update");
  if (model2 !== undefined && !isModel3(model2))
    reasons.push("invalid userModel");
}
function applySteeringMutation(plan, proposal, audit) {
  const next = structuredClone(plan);
  if (!audit.invariant.accepted)
    return next;
  const now = proposal.now?.toISOString() ?? iso();
  if (proposal.kind === "add_subgoal")
    next.goals.push(makeGoal2(next, { title: proposal.title ?? "", objective: proposal.objective ?? "" }, proposal.evidence, now, 1));
  if (proposal.kind === "reorder_pending") {
    const order = pendingOrder(proposal);
    next.goals = [...order.map((id) => goal2(next, id)).filter((item) => item !== undefined), ...next.goals.filter((item) => !order.includes(item.id))];
  }
  if (proposal.kind === "revise_pending_wording")
    reviseWording(next, proposal, now);
  if (proposal.kind === "split_subgoal" || proposal.kind === "mark_blocked_superseded")
    splitOrBlock(next, proposal, now);
  if (proposal.kind === "revise_criterion")
    reviseCriterion(next, proposal, now);
  if (proposal.kind !== "annotate_ledger")
    next.updatedAt = now;
  return next;
}
function isProposal(value) {
  return isPlain2(value) && isKind2(read3(value, "kind")) && isSource2(read3(value, "source")) && isText2(read3(value, "evidence")) && isText2(read3(value, "rationale"));
}
function parseUlwLoopSteeringDirective(text5) {
  const match = /(?:^|\s)(?:OMO_ULW_LOOP_STEER|omo\.ulw-loop\.steer|omo ulw-loop steer):\s*([\s\S]+)$/u.exec(text5);
  if (match?.[1] === undefined)
    return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    return isProposal(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof SyntaxError)
      return null;
    throw error;
  }
}
async function steerUlwLoop(repoRoot, proposal, scope) {
  return withUlwLoopMutationLock(repoRoot, scope, async () => {
    const plan = await readUlwLoopPlan(repoRoot, scope);
    const key = proposal.idempotencyKey ?? proposal.promptSignature;
    const prior = key === undefined ? undefined : await findAcceptedSteeringLedgerEntry(repoRoot, key, scope);
    if (prior?.steering !== undefined) {
      const { before: _before, after: _after, ...compactPrior } = prior.steering;
      return { plan, accepted: true, audit: { ...compactPrior, deduped: true }, rejectedReasons: [], deduped: true };
    }
    const audit = validateUlwLoopSteeringProposal(plan, proposal);
    const accepted = audit.invariant.accepted;
    const next = accepted ? applySteeringMutation(plan, proposal, audit) : plan;
    const finalAudit = { ...audit };
    if (accepted) {
      const changed = changedGoalIdsBetween(plan, next);
      finalAudit.before = buildSteeringPlanSnapshot(plan, changed);
      finalAudit.after = buildSteeringPlanSnapshot(next, changed);
    }
    const at = proposal.now?.toISOString() ?? iso();
    const batchEntry = accepted ? batchUpdateLedgerEntry(plan, next, at) : null;
    const auditEntry = ledgerEntry(proposal, finalAudit, at);
    if (accepted) {
      await commitPlanAndLedgerEntries(repoRoot, next, batchEntry === null ? [auditEntry] : [auditEntry, batchEntry], scope);
    } else
      await appendLedger(repoRoot, auditEntry, scope);
    return { plan: next, accepted, audit: finalAudit, rejectedReasons: audit.invariant.rejectedReasons, deduped: false };
  });
}
function ledgerEntry(proposal, audit, at) {
  const entry = { at, kind: audit.invariant.accepted ? proposal.kind === "revise_criterion" ? "criteria_revised" : "steering_accepted" : "steering_rejected", evidence: proposal.evidence, message: proposal.rationale, steering: audit, mutationKind: proposal.kind };
  const goalId = audit.targetGoalIds[0];
  if (goalId !== undefined)
    entry.goalId = goalId;
  if (proposal.criterionId !== undefined)
    entry.criterionId = proposal.criterionId;
  if (proposal.idempotencyKey !== undefined)
    entry.idempotencyKey = proposal.idempotencyKey;
  return entry;
}

// src/steering-batch.ts
async function steerUlwLoopBatch(repoRoot, proposals, scope) {
  return withUlwLoopMutationLock(repoRoot, scope, async () => {
    const plan = await readUlwLoopPlan(repoRoot, scope);
    const prepared = await prepareBatch(repoRoot, plan, proposals, scope);
    const failed = prepared.results.find((item) => !item.accepted);
    if (failed !== undefined) {
      const entry = rejectedLedgerEntry(prepared.results);
      await appendLedger(repoRoot, entry, scope);
      return rejected(plan, prepared.results, failed.rejectedReasons);
    }
    let next = plan;
    for (const item of prepared.items)
      if (item.kind === "fresh")
        next = item.prepared.next;
    const fresh = prepared.items.filter((item) => item.kind === "fresh");
    if (fresh.length > 0) {
      const entries = fresh.map((item) => ledgerEntry2(item.prepared.proposal, item.prepared.audit, item.prepared.proposal.now?.toISOString() ?? iso()));
      const batchEntry = batchUpdateLedgerEntry(plan, next, iso());
      await commitPlanAndLedgerEntries(repoRoot, next, batchEntry === null ? entries : [...entries, batchEntry], scope);
    }
    return { plan: next, accepted: true, results: prepared.results, rejectedReasons: [] };
  });
}
async function prepareBatch(repoRoot, plan, proposals, scope) {
  const items = [];
  const results = [];
  let current = plan;
  for (const proposal of proposals) {
    const key = proposal.idempotencyKey ?? proposal.promptSignature;
    const prior = key === undefined ? undefined : await findAcceptedSteeringLedgerEntry(repoRoot, key, scope);
    if (prior?.steering !== undefined) {
      const result2 = { accepted: true, deduped: true, audit: { ...prior.steering, deduped: true }, rejectedReasons: [] };
      items.push({ kind: "deduped", result: result2 });
      results.push(result2);
      continue;
    }
    const audit = validateUlwLoopSteeringProposal(current, proposal);
    if (!audit.invariant.accepted) {
      const result2 = { accepted: false, deduped: false, audit, rejectedReasons: audit.invariant.rejectedReasons };
      items.push({ kind: "deduped", result: result2 });
      results.push(result2);
      continue;
    }
    const next = applySteeringMutation(current, proposal, audit);
    const changed = changedGoalIdsBetween(current, next);
    const finalAudit = { ...audit, before: buildSteeringPlanSnapshot(current, changed), after: buildSteeringPlanSnapshot(next, changed) };
    const result = { accepted: true, deduped: false, audit: finalAudit, rejectedReasons: [] };
    items.push({ kind: "fresh", prepared: { proposal, audit: finalAudit, before: current, next } });
    results.push(result);
    current = next;
  }
  return { items, results };
}
function rejected(plan, results, rejectedReasons) {
  return { plan, accepted: false, results, rejectedReasons };
}
function rejectedLedgerEntry(results) {
  const rejectedItems = results.map((result, index) => ({ result, index })).filter((item) => !item.result.accepted);
  return { at: iso(), kind: "steering_rejected", message: rejectedItems.map((item) => `index ${item.index}: ${item.result.rejectedReasons.join(", ")}`).join("; ") };
}
function ledgerEntry2(proposal, audit, at) {
  const entry = {
    at,
    kind: proposal.kind === "revise_criterion" ? "criteria_revised" : "steering_accepted",
    evidence: proposal.evidence,
    message: proposal.rationale,
    steering: audit,
    mutationKind: proposal.kind
  };
  const goalId = audit.targetGoalIds[0];
  if (goalId !== undefined)
    entry.goalId = goalId;
  if (proposal.criterionId !== undefined)
    entry.criterionId = proposal.criterionId;
  if (proposal.idempotencyKey !== undefined)
    entry.idempotencyKey = proposal.idempotencyKey;
  return entry;
}

// src/cli-subcommands.ts
import { resolve as resolve7 } from "node:path";
async function createGoals(repoRoot, argv, json, scope) {
  const briefFile = readValue(argv, "--brief-file");
  const brief = readValue(argv, "--brief") ?? (briefFile === undefined ? undefined : safeReadWorkspaceTextFile(repoRoot, resolve7(repoRoot, briefFile))) ?? (hasFlag(argv, "--from-stdin") ? await readStdin() : undefined) ?? positionalText(argv);
  if (!brief.trim()) {
    throw new UlwLoopError("Missing brief text. Pass --brief, --brief-file, --from-stdin, or positional text.", "ULW_LOOP_BRIEF_REQUIRED");
  }
  const validationBatchesJson = readValue(argv, "--validation-batch-json");
  const plan = await createUlwLoopPlan(repoRoot, {
    brief,
    codexGoalMode: normalizeCodexGoalMode(readValue(argv, "--codex-goal-mode")),
    force: hasFlag(argv, "--force"),
    ...validationBatchesJson === undefined ? {} : { validationBatchesJson }
  }, scope);
  if (json)
    printJson({ ok: true, plan, summary: summarizeUlwLoopPlan(plan) });
  else {
    process.stdout.write(`ulw-loop plan created: ${plan.goals.length} goal(s)
brief: ${plan.briefPath}
goals: ${plan.goalsPath}
ledger: ${plan.ledgerPath}
`);
  }
  return 0;
}
async function status(repoRoot, json, scope) {
  const plan = await readUlwLoopPlan(repoRoot, scope);
  if (json) {
    const active = plan.goals.find((goal3) => goal3.id === plan.activeGoalId);
    const currentAttemptDir = plan.evidenceLayoutVersion === 2 && active ? ulwLoopAttemptEvidenceDir(repoRoot, active.id, active.attempt, scope) : undefined;
    printJson({
      ok: true,
      plan,
      summary: summarizeUlwLoopPlan(plan),
      ...currentAttemptDir === undefined ? {} : { currentAttemptDir }
    });
  } else
    printStatus(plan);
  return 0;
}
async function completeGoals(repoRoot, argv, json, scope) {
  const result = await startNextUlwLoop(repoRoot, { retryFailed: hasFlag(argv, "--retry-failed") }, scope);
  if ("done" in result) {
    const handoff = blockedDecisionHandoff(result.plan);
    if (json) {
      printJson({
        ok: true,
        done: true,
        blocked: handoff.length > 0,
        handoff,
        summary: summarizeUlwLoopPlan(result.plan),
        plan: result.plan
      });
    } else
      process.stdout.write(`${handoff || "ulw-loop: all goals complete"}
`);
    return 0;
  }
  const instruction = buildCodexGoalInstruction({ plan: result.plan, goal: result.goal });
  if (json)
    printJson({ ok: true, resumed: result.resumed, goal: result.goal, instruction, plan: result.plan });
  else
    process.stdout.write(`${instruction.text}
`);
  return 0;
}
async function steer(repoRoot, argv, json, scope) {
  const proposals = await parseSteeringProposals(argv, repoRoot);
  const single = proposals[0];
  if (single !== undefined && proposals.length === 1 && readValue(argv, "--proposals-json") === undefined) {
    const result2 = await steerUlwLoop(repoRoot, single, scope);
    printSteerResult(result2, json);
    return result2.accepted ? 0 : 1;
  }
  const result = await steerUlwLoopBatch(repoRoot, proposals, scope);
  printSteerBatchResult(result, json);
  return result.accepted ? 0 : 1;
}
async function addGoal(repoRoot, argv, json, scope) {
  const result = await addUlwLoopGoal(repoRoot, { title: required4(argv, "--title"), objective: required4(argv, "--objective") }, scope);
  if (json)
    printJson({ ok: true, plan: result.plan, goal: result.goal, summary: summarizeUlwLoopPlan(result.plan) });
  else {
    process.stdout.write(`ulw-loop added goal: ${result.goal.id}
`);
    printStatus(result.plan);
  }
  return 0;
}
async function criteria(repoRoot, argv, json, scope) {
  const goalId = required4(argv, "--goal-id");
  const goal3 = findGoal3(await readUlwLoopPlan(repoRoot, scope), goalId);
  if (json)
    printJson({ ok: true, goalId: goal3.id, criteria: goal3.successCriteria });
  else {
    process.stdout.write(`criteria for ${goal3.id}:
${goal3.successCriteria.map(formatCriterionForCli).join(`
`)}
`);
  }
  return 0;
}
async function captureEvidence(repoRoot, argv, json, scope) {
  const result = await recordEvidence(repoRoot, parseRecordEvidenceArgs(argv), scope);
  if (json)
    printJson({ ok: true, ...result, summary: summarizeUlwLoopPlan(result.plan) });
  else {
    process.stdout.write(`ulw-loop evidence recorded: ${result.goal.id}/${result.criterion.id} -> ${result.criterion.status}
`);
  }
  return 0;
}
async function reviewBlockers(repoRoot, argv, json, scope) {
  const codexGoalJson = await parseCodexGoalJson(required4(argv, "--codex-goal-json"), repoRoot);
  if (codexGoalJson === undefined) {
    throw new UlwLoopError("Missing --codex-goal-json.", "ULW_LOOP_CODEX_GOAL_JSON_REQUIRED");
  }
  const result = await recordFinalReviewBlockers(repoRoot, {
    goalId: required4(argv, "--goal-id"),
    title: required4(argv, "--title"),
    objective: required4(argv, "--objective"),
    evidence: required4(argv, "--evidence"),
    codexGoalJson
  }, scope);
  if (json) {
    printJson({
      ok: true,
      plan: result.plan,
      blockedGoal: result.blockedGoal,
      goal: result.newGoal,
      ledgerEntries: result.ledgerEntries,
      summary: summarizeUlwLoopPlan(result.plan)
    });
  } else {
    process.stdout.write(`ulw-loop final review blockers recorded: ${result.blockedGoal.id} -> review_blocked; added ${result.newGoal.id}
`);
  }
  return 0;
}
function formatCriterionForCli(criterion) {
  const marker = isEssentialCriterion(criterion) ? "essential" : "non-essential";
  return `- ${criterion.id} [${criterion.status}] [${marker}] (${criterion.userModel}) ${criterion.scenario} evidence: ${criterion.capturedEvidence ?? "pending"}`;
}
function required4(argv, flag) {
  const value = readValue(argv, flag)?.trim();
  if (value)
    return value;
  throw new UlwLoopError(`Missing ${flag}.`, "ULW_LOOP_ARGUMENT_MISSING", { details: { flag } });
}
function findGoal3(plan, goalId) {
  const goal3 = plan.goals.find((candidate) => candidate.id === goalId);
  if (goal3 !== undefined)
    return goal3;
  throw new UlwLoopError(`Unknown ulw-loop id: ${goalId}.`, "ULW_LOOP_GOAL_NOT_FOUND", { details: { goalId } });
}

// src/light-quality-gate.ts
import { join as join6 } from "node:path";
async function buildLightQualityGate(repoRoot, goalId, scope) {
  const plan = await readUlwLoopPlan(repoRoot, scope);
  const goal3 = plan.goals.find((g) => g.id === goalId);
  if (!goal3)
    throw new UlwLoopError(`Unknown goal ${goalId}`, "ULW_LOOP_GOAL_NOT_FOUND");
  const criteria2 = goal3.successCriteria ?? [];
  if (criteria2.length === 0)
    throw new UlwLoopError("Goal has no success criteria", "ULW_LOOP_NO_CRITERIA");
  const pending = criteria2.filter((c) => c.status !== "pass");
  if (pending.length > 0) {
    throw new UlwLoopError(`Cannot build light quality gate: criteria not all pass (${pending.map((c) => c.id).join(", ")})`, "ULW_LOOP_CRITERIA_INCOMPLETE");
  }
  const attemptDir = ulwLoopAttemptEvidenceDir(repoRoot, goal3.id, goal3.attempt ?? 0, scope);
  const absAttempt = safeWorkspacePath(repoRoot, join6(repoRoot, attemptDir));
  const artifactId = "artifact-light-cli";
  const artifactRel = `${attemptDir}/light-cli-evidence.txt`;
  const codeReportRel = `${attemptDir}/light-root-code-review.md`;
  const gateReportRel = `${attemptDir}/light-root-gate-review.md`;
  const evidenceLines = criteria2.map((c) => `- ${c.id} (${c.status}): ${c.capturedEvidence ?? c.scenario ?? ""}`);
  const cliBody = [
    `LIGHT quality gate evidence for ${goal3.id}`,
    `objective: ${goal3.objective}`,
    `generated: ${new Date().toISOString()}`,
    "",
    "Criteria:",
    ...evidenceLines,
    "",
    "Grok LIGHT path: root agent self-review + criterion evidence (no multi-agent gate required)."
  ].join(`
`);
  await safeWriteWorkspaceTextFile(repoRoot, join6(repoRoot, artifactRel), `${cliBody}
`);
  await safeWriteWorkspaceTextFile(repoRoot, join6(repoRoot, codeReportRel), `# LIGHT root code self-review

APPROVE — performed by the LazyGrok root agent, not an independent reviewer.

${evidenceLines.join(`
`)}
`);
  await safeWriteWorkspaceTextFile(repoRoot, join6(repoRoot, gateReportRel), `# LIGHT root gate self-review

APPROVE — root agent confirmed all ${criteria2.length} criteria pass with captured evidence.
`);
  const first = criteria2[0];
  if (first === undefined) {
    throw new UlwLoopError("Goal has no success criteria", "ULW_LOOP_NO_CRITERIA");
  }
  const qualityGate = {
    provenance: {
      mode: "root-self-review",
      producer: "lazygrok-root",
      sessionId: scope?.sessionId ?? resolveUlwLoopSessionIdFromEnv() ?? "session"
    },
    codeReview: {
      by: "lazygrok-root",
      recommendation: "APPROVE",
      codeQualityStatus: "CLEAR",
      reportPath: codeReportRel,
      evidence: `LIGHT self-review: all criteria pass for ${goal3.id}`,
      blockers: []
    },
    manualQa: {
      by: "lazygrok-root",
      status: "passed",
      evidence: criteria2.map((c) => c.capturedEvidence || c.id).join(" | "),
      surfaceEvidence: [
        {
          id: "surface-light-cli",
          criterionRef: first.id,
          surface: "cli",
          invocation: "ulw-loop light-quality-gate (Grok LIGHT)",
          verdict: "passed",
          artifactRefs: [artifactId]
        }
      ],
      adversarialCases: [
        {
          id: "adv-none-applicable",
          criterionRef: first.id,
          scenario: "LIGHT tier: no adversarial class triggered",
          expectedBehavior: "none-applicable recorded",
          verdict: "not_applicable",
          reason: "LIGHT smoke / single-agent completion",
          artifactRefs: [artifactId]
        }
      ],
      artifactRefs: [
        {
          id: artifactId,
          kind: "cli-transcript",
          description: "LIGHT criterion evidence dump",
          path: artifactRel
        }
      ]
    },
    gateReview: {
      by: "lazygrok-root",
      recommendation: "APPROVE",
      reportPath: gateReportRel,
      evidence: "LIGHT gate: criteria coverage complete",
      blockers: []
    },
    iteration: {
      fullRerun: true,
      status: "passed",
      rerunCommands: ["node vendor/lazygrok-hooks/ulw-loop/dist/cli.js status --json"],
      evidence: "LIGHT iteration: evidence already recorded in ledger"
    },
    criteriaCoverage: {
      totalCriteria: criteria2.length,
      passCount: criteria2.filter((c) => c.status === "pass").length,
      originalIntent: goal3.objective,
      desiredOutcome: goal3.objective,
      userOutcomeReview: "LIGHT path: all success criteria pass with captured evidence",
      adversarialClassesCovered: ["none-applicable: LIGHT tier"]
    }
  };
  const qualityGatePath = join6(attemptDir, "quality-gate.light.json");
  await safeWriteWorkspaceTextFile(repoRoot, join6(repoRoot, qualityGatePath), `${JSON.stringify(qualityGate, null, 2)}
`);
  return { qualityGatePath, attemptDir: absAttempt, qualityGate };
}
async function lightQualityGateCmd(repoRoot, argv, json, scope) {
  const goalId = (() => {
    const i = argv.indexOf("--goal-id");
    if (i >= 0 && argv[i + 1])
      return argv[i + 1];
    return;
  })();
  if (!goalId)
    throw new UlwLoopError("Missing --goal-id", "ULW_LOOP_GOAL_ID_REQUIRED");
  const result = await buildLightQualityGate(repoRoot, goalId, scope);
  if (json)
    printJson({ ok: true, ...result });
  else {
    process.stdout.write(`light quality gate written: ${result.qualityGatePath}
` + `attempt dir: ${result.attemptDir}
` + `Use: ulw-loop checkpoint --goal-id ${goalId} --status complete --evidence "..." \\
` + `  --codex-goal-json '<complete snapshot>' --quality-gate-json ${result.qualityGatePath}
`);
  }
  return 0;
}

// src/cli-commands.ts
var ULW_LOOP_SUBCOMMANDS = [
  "help",
  "create-goals",
  "status",
  "complete-goals",
  "checkpoint",
  "steer",
  "add-goal",
  "criteria",
  "record-evidence",
  "record-review-blockers",
  "light-quality-gate"
];
function isUlwLoopSubcommand(value) {
  return ULW_LOOP_SUBCOMMANDS.includes(value);
}
async function ulwLoopCommand(argv) {
  const head = argv[0] ?? "help";
  const command = head === "--help" || head === "-h" ? "help" : head;
  const rest = argv.slice(1);
  const repoRoot = process.cwd();
  const json = hasFlag(rest, "--json");
  try {
    const scope = commandScope(rest, repoRoot);
    if (!isUlwLoopSubcommand(command)) {
      if (json) {
        printJsonError(new UlwLoopError(`Unknown ulw-loop subcommand: ${command}.`, "ULW_LOOP_SUBCOMMAND_UNKNOWN", {
          details: { command }
        }));
        return 1;
      }
      process.stdout.write(`${ULW_LOOP_HELP}
`);
      return 1;
    }
    switch (command) {
      case "help":
        process.stdout.write(`${ULW_LOOP_HELP}
`);
        return 0;
      case "create-goals":
        return await createGoals(repoRoot, rest, json, scope);
      case "status":
        return await status(repoRoot, json, scope);
      case "complete-goals":
        return await completeGoals(repoRoot, rest, json, scope);
      case "checkpoint":
        return await checkpoint(repoRoot, rest, json, scope);
      case "steer":
        return await steer(repoRoot, rest, json, scope);
      case "add-goal":
        return await addGoal(repoRoot, rest, json, scope);
      case "criteria":
        return await criteria(repoRoot, rest, json, scope);
      case "record-evidence":
        return await captureEvidence(repoRoot, rest, json, scope);
      case "record-review-blockers":
        return await reviewBlockers(repoRoot, rest, json, scope);
      case "light-quality-gate":
        return await lightQualityGateCmd(repoRoot, rest, json, scope);
      default:
        return unhandledSubcommand(command);
    }
  } catch (error) {
    if (json) {
      printJsonError(error);
      return 1;
    }
    if (error instanceof UlwLoopError)
      process.stderr.write(`[ulw-loop] ${error.message}
`);
    else if (error instanceof Error)
      process.stderr.write(`[ulw-loop] unexpected: ${error.message}
`);
    else
      process.stderr.write(`[ulw-loop] unknown error
`);
    return 1;
  }
}
function unhandledSubcommand(command) {
  throw new UlwLoopError(`Unhandled ulw-loop subcommand: ${String(command)}.`, "ULW_LOOP_SUBCOMMAND_UNHANDLED");
}
var SESSION_ID_FLAG = "--session-id";
function sessionIdFlagPresent(argv) {
  return hasFlag(argv, SESSION_ID_FLAG) || argv.some((arg) => arg.startsWith(`${SESSION_ID_FLAG}=`));
}
function commandScope(argv, repoRoot) {
  const boundSessionId = resolveUlwLoopSessionIdFromBinding(repoRoot);
  if (sessionIdFlagPresent(argv)) {
    const sessionId2 = readValue(argv, SESSION_ID_FLAG);
    if (sessionId2 === undefined || sessionId2.length === 0) {
      throw new UlwLoopError(`${SESSION_ID_FLAG} requires a non-empty value.`, "ULW_LOOP_SESSION_ID_REQUIRED", {
        details: { flag: SESSION_ID_FLAG }
      });
    }
    if (normalizeUlwLoopSessionId(sessionId2) === null) {
      throw new UlwLoopError(`${SESSION_ID_FLAG} requires an exact safe session ID.`, "ULW_LOOP_SESSION_ID_INVALID");
    }
    if (boundSessionId !== null && sessionId2 !== boundSessionId) {
      throw new UlwLoopError(`The requested session ID does not match the current Grok session ${boundSessionId}.`, "ULW_LOOP_SESSION_MISMATCH");
    }
    return { sessionId: sessionId2 };
  }
  const sessionId = resolveUlwLoopSessionIdFromEnv() ?? boundSessionId;
  return sessionId === null ? undefined : { sessionId };
}

// src/ultrawork-directive.ts
import { closeSync as closeSync4, constants as constants3, fstatSync as fstatSync4, openSync as openSync2, readSync as readSync2 } from "node:fs";

// src/ultrawork-skill-pointer.ts
import { existsSync as existsSync5, readFileSync as readFileSync2 } from "node:fs";
import { dirname as dirname3, join as join7, resolve as resolve8 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var ULTRAWORK_SKILL_POINTER_TEMPLATE = `<ultrawork-mode>
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

5. CODING MULTI-AGENT — after reading the skill, use only Grok tools.
User switch is ONLY \`ulw\`/\`ultrawork\` — never ask them to run /workflow or name panels.
- Multi-file / unfamiliar: BEFORE product edits, auto-call the \`workflow\` tool with name \`ulw-discover\` (or script_path under GROK_PLUGIN_ROOT/docs/examples/). Fallback: same-turn \`spawn_subagent\` explore (+ librarian if external).
- Independent slices: one worker each (\`lazygrok:lazygrok-worker-*\` / hephaestus) via spawn_subagent.
- HEAVY after evidence: auto-call \`workflow\` name \`ulw-review\` (or script_path); fallback code-reviewer spawn. Parent owns goals, RED→GREEN, commits, done claim — panels never ship.
- Wait: \`get_command_or_subagent_output\` for spawns; wait for workflow run completion for panels. Kill: \`kill_command_or_subagent\`.
- Child prompt: TASK / DELIVERABLE / SCOPE / VERIFY / STOP WHEN. Depth 1. Barrier before dependent implement.
- Trivial single-file known fix may stay serial; record "no fan-out: trivial" in the notepad.
- Do not narrate harness internals (workflow/Rhai) to the user. Tool allowlist: rules/15-grok-tools-only.md.

Do not start the requested work until bootstrap is complete.
LIGHT complete: ulw-loop light-quality-gate then checkpoint. HEAVY: reviewer gate in the skill.
</ultrawork-mode>
`;
var ULTRAWORK_SKILL_PATH_PLACEHOLDER = "{{ULTRAWORK_SKILL_PATH}}";
function resolveUltraworkSkillFilePath() {
  const here = dirname3(fileURLToPath2(import.meta.url));
  const envRoot = process.env["GROK_PLUGIN_ROOT"]?.trim();
  const candidates = [
    join7(here, "../skills/ultrawork/SKILL.md"),
    join7(here, "../../../../skills/ultrawork/SKILL.md"),
    join7(here, "../../../skills/ultrawork/SKILL.md"),
    join7(here, "../../ultrawork/skills/ultrawork/SKILL.md"),
    envRoot ? join7(envRoot, "skills/ultrawork/SKILL.md") : "",
    envRoot ? join7(envRoot, "vendor/lazygrok-hooks/ultrawork/skills/ultrawork/SKILL.md") : ""
  ].filter(Boolean);
  for (const c of candidates) {
    const abs = resolve8(c);
    if (existsSync5(abs))
      return abs;
  }
  return resolve8(join7(here, "../../ultrawork/skills/ultrawork/SKILL.md"));
}
function buildUltraworkSkillPointer(skillFilePath) {
  return ULTRAWORK_SKILL_POINTER_TEMPLATE.replace(ULTRAWORK_SKILL_PATH_PLACEHOLDER, skillFilePath);
}
function buildUltraworkAdditionalContext(options = {}) {
  const skillFilePath = options.skillFilePath === undefined ? resolveUltraworkSkillFilePath() : options.skillFilePath;
  if (skillFilePath !== null && existsSync5(skillFilePath)) {
    return buildUltraworkSkillPointer(skillFilePath);
  }
  return readFileSync2(new URL("../directive.md", import.meta.url), "utf8");
}

// src/ultrawork-directive.ts
var ULTRAWORK_CURRENT_PROMPT_PATTERN = /(?:ultrawork|ulw)/i;
var ULTRAWORK_DIRECTIVE_MARKER = "<ultrawork-mode>";
var TRANSCRIPT_SEARCH_BYTES = 512000;
var CONTEXT_PRESSURE_MARKERS = [
  "context compacted",
  "context_length_exceeded",
  "skill descriptions were shortened",
  "context_too_large",
  "codex ran out of room in the model's context window",
  "your input exceeds the context window",
  "long threads and multiple compactions"
];
function buildUltraworkDirectiveOutput(input, options = {}) {
  if (isContextPressureRecoveryPrompt(input.prompt))
    return "";
  if (hasUltraworkDirectiveAlreadyInTranscript(input.transcript_path))
    return "";
  if (isContextPressureTranscript(input.transcript_path))
    return "";
  return isUltraworkPrompt(input.prompt) ? formatAdditionalContextOutput(buildUltraworkAdditionalContext(options)) : "";
}
function hasUltraworkDirectiveAlreadyInTranscript(transcriptPath) {
  if (transcriptPath === undefined || transcriptPath === null)
    return false;
  try {
    const rawTranscript = readTranscriptTail(transcriptPath);
    for (const line of rawTranscript.split(/\r?\n/)) {
      const parsed = parseJsonLine(line);
      if (!isRecord3(parsed))
        continue;
      const hookSpecificOutput = parsed["hookSpecificOutput"];
      if (!isRecord3(hookSpecificOutput))
        continue;
      if (hookSpecificOutput["hookEventName"] !== "UserPromptSubmit")
        continue;
      if (typeof hookSpecificOutput["additionalContext"] === "string" && hookSpecificOutput["additionalContext"].includes(ULTRAWORK_DIRECTIVE_MARKER)) {
        return true;
      }
    }
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
  return false;
}
function readTranscriptTail(transcriptPath) {
  const fileDescriptor = openSync2(transcriptPath, constants3.O_RDONLY | constants3.O_NOFOLLOW);
  try {
    const file = fstatSync4(fileDescriptor);
    if (!file.isFile())
      throw new Error("transcript is not a regular file");
    const length = Math.min(file.size, TRANSCRIPT_SEARCH_BYTES);
    const buffer = Buffer.alloc(length);
    const bytesRead = readSync2(fileDescriptor, buffer, 0, length, file.size - length);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    closeSync4(fileDescriptor);
  }
}
function isUltraworkPrompt(prompt) {
  return ULTRAWORK_CURRENT_PROMPT_PATTERN.test(prompt);
}
function isContextPressureRecoveryPrompt(prompt) {
  const normalizedPrompt = prompt.toLowerCase();
  return CONTEXT_PRESSURE_MARKERS.some((marker) => normalizedPrompt.includes(marker));
}
function isContextPressureTranscript(transcriptPath) {
  if (transcriptPath === undefined || transcriptPath === null)
    return false;
  try {
    return isContextPressureRecoveryPrompt(readTranscriptTail(transcriptPath));
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
}
function formatAdditionalContextOutput(additionalContext) {
  const normalizedContext = normalizeAdditionalContext(additionalContext);
  if (normalizedContext.length === 0)
    return "";
  const output = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: normalizedContext
    }
  };
  return `${JSON.stringify(output)}
`;
}
function normalizeAdditionalContext(additionalContext) {
  return additionalContext.replace(/\r\n/g, `
`).replace(/\r/g, `
`).trim();
}
function parseJsonLine(line) {
  if (line.trim().length === 0)
    return null;
  try {
    const parsed = JSON.parse(line);
    return parsed;
  } catch (error) {
    if (error instanceof Error)
      return null;
    throw error;
  }
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/codex-hook.ts
var CREATE_GOAL_TOOL_NAME = "create_goal";
var MAX_HOOK_INPUT_BYTES = 10 * 1024 * 1024;
var CREATE_GOAL_PAYLOAD_WARNING = "Use create_goal with objective only. Omit token_budget so the goal stays unlimited, and put lifecycle status changes on update_goal.";
function parseUserPromptSubmitPayload(raw) {
  if (raw.trim().length === 0)
    return null;
  try {
    const parsed = JSON.parse(raw);
    return isUserPromptSubmitPayload(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof SyntaxError)
      return null;
    return null;
  }
}
function parsePreToolUsePayload(raw) {
  if (raw.trim().length === 0)
    return null;
  try {
    const parsed = JSON.parse(raw);
    return isPreToolUsePayload(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof SyntaxError)
      return null;
    return null;
  }
}
async function applyUserPromptUlwLoopSteering(payload, options = {}) {
  try {
    if (payload.hook_event_name !== "UserPromptSubmit")
      return "";
    const proposal = parseUlwLoopSteeringDirective(payload.prompt);
    if (proposal === null) {
      if (hasSteeringDirectiveMarker(payload.prompt))
        return "";
      if (!options.includeUltraworkDirective)
        return "";
      return options.ultraworkSkillFilePath === undefined ? buildUltraworkDirectiveOutput(payload) : buildUltraworkDirectiveOutput(payload, { skillFilePath: options.ultraworkSkillFilePath });
    }
    const result = await steerUlwLoop(payload.cwd, proposal, payloadScope(payload));
    if (!result.accepted)
      return "";
    return JSON.stringify({
      status: "accepted",
      kind: result.audit.kind,
      source: result.audit.source,
      deduped: result.deduped
    });
  } catch (error) {
    if (error instanceof Error)
      return "";
    return "";
  }
}
function hasSteeringDirectiveMarker(prompt) {
  return /(?:^|\s)(?:OMO_ULW_LOOP_STEER|omo\.ulw-loop\.steer|omo ulw-loop steer):/u.test(prompt);
}
function payloadScope(payload) {
  return { sessionId: payload.session_id };
}
function applyPreToolUseGoalBudgetGuard(payload) {
  if (payload.hook_event_name !== "PreToolUse")
    return "";
  if (payload.tool_name !== CREATE_GOAL_TOOL_NAME)
    return "";
  if (!hasInvalidCreateGoalInput(payload.tool_input))
    return "";
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: CREATE_GOAL_PAYLOAD_WARNING,
      additionalContext: CREATE_GOAL_PAYLOAD_WARNING
    }
  };
  return `${JSON.stringify(output)}
`;
}
async function runUlwLoopHookCli(stdin, stdout, options = {}) {
  try {
    const raw = await readAll(stdin);
    if (raw === null)
      return;
    const payload = parseUserPromptSubmitPayload(raw);
    if (payload === null)
      return;
    const output = await applyUserPromptUlwLoopSteering(payload, options);
    if (output.length > 0)
      stdout.write(output);
  } catch (error) {
    if (error instanceof Error)
      return;
    return;
  }
}
async function runPreToolUseGoalBudgetGuardCli(stdin, stdout) {
  try {
    const raw = await readAll(stdin);
    if (raw === null)
      return;
    const payload = parsePreToolUsePayload(raw);
    if (payload === null)
      return;
    const output = applyPreToolUseGoalBudgetGuard(payload);
    if (output.length > 0)
      stdout.write(output);
  } catch (error) {
    if (error instanceof Error)
      return;
    return;
  }
}
function isUserPromptSubmitPayload(value) {
  if (!isRecord4(value))
    return false;
  return value["hook_event_name"] === "UserPromptSubmit" && typeof value["cwd"] === "string" && typeof value["prompt"] === "string" && typeof value["session_id"] === "string" && ["model", "permission_mode", "turn_id"].every((key) => optionalString(value[key])) && (value["transcript_path"] === undefined || value["transcript_path"] === null || typeof value["transcript_path"] === "string");
}
function isPreToolUsePayload(value) {
  if (!isRecord4(value))
    return false;
  return value["hook_event_name"] === "PreToolUse" && typeof value["cwd"] === "string" && typeof value["model"] === "string" && typeof value["permission_mode"] === "string" && typeof value["session_id"] === "string" && typeof value["tool_name"] === "string" && typeof value["tool_use_id"] === "string" && (value["transcript_path"] === null || typeof value["transcript_path"] === "string") && typeof value["turn_id"] === "string" && Object.hasOwn(value, "tool_input");
}
function hasInvalidCreateGoalInput(value) {
  return isRecord4(value) && Object.keys(value).some((key) => key !== "objective");
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalString(value) {
  return value === undefined || typeof value === "string";
}
async function readAll(stdin) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of stdin) {
    const bytes = Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > MAX_HOOK_INPUT_BYTES)
      return null;
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// src/spawn-guard.ts
import { readdirSync as readdirSync2 } from "node:fs";
import { join as join8 } from "node:path";
var SPAWN_TOOL_TOKENS = new Set([
  "spawn_subagent",
  "spawn_agent",
  "collaborationspawn_agent",
  "collaboration.spawn_agent",
  "task"
]);
var DEFAULT_FANOUT_LIMIT = 60;
var MAX_HOOK_INPUT_BYTES2 = 10 * 1024 * 1024;
var GATE_MESSAGE_PATTERN = /lazycodex-gate-reviewer|final gate review/i;
function applySpawnGuards(payload) {
  if (payload.hook_event_name !== "PreToolUse" || !SPAWN_TOOL_TOKENS.has(payload.tool_name))
    return "";
  let stateDir;
  try {
    stateDir = ulwLoopDir(payload.cwd, { sessionId: payload.session_id });
  } catch (error) {
    if (error instanceof Error)
      return deny("unsafe ulw-loop state path");
    throw error;
  }
  const plan = readPlan(payload.cwd, join8(stateDir, "goals.json"));
  if (plan === null)
    return "";
  const missingArtifact = missingGateArtifact(payload, plan);
  if (missingArtifact !== null)
    return deny(`spawn code-review + QA first; gate audits their artifacts: missing ${missingArtifact}`);
  const fanOutDenial = consumeFanOutBudget(payload.cwd, stateDir);
  if (fanOutDenial !== null)
    return deny(fanOutDenial);
  return "";
}
async function runSpawnGuardCli(stdin, stdout) {
  let payload;
  try {
    const chunks = [];
    let totalBytes = 0;
    let oversized = false;
    for await (const chunk of stdin) {
      const bytes = Buffer.from(chunk);
      totalBytes += bytes.length;
      if (totalBytes > MAX_HOOK_INPUT_BYTES2) {
        oversized = true;
        continue;
      }
      if (!oversized)
        chunks.push(bytes);
    }
    if (oversized) {
      stdout.write(deny("ulw-loop spawn guard denied oversized hook input"));
      return;
    }
    payload = parsePreToolUsePayload(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof Error) {
      stdout.write(deny("ulw-loop spawn guard denied invalid hook input"));
      return;
    }
    throw error;
  }
  if (payload === null) {
    stdout.write(deny("ulw-loop spawn guard denied invalid hook input"));
    return;
  }
  try {
    const output = applySpawnGuards(payload);
    if (output.length > 0)
      stdout.write(output);
  } catch (error) {
    if (error instanceof Error) {
      stdout.write(deny("ulw-loop spawn guard denied because budget could not be reserved safely"));
      return;
    }
    throw error;
  }
}
function consumeFanOutBudget(repoRoot, stateDir) {
  return withInterprocessLockSync(repoRoot, join8(stateDir, ".spawn-count.lock"), () => {
    const counterPath = join8(stateDir, "spawn-count.json");
    const count = readCount(repoRoot, counterPath) + 1;
    const limit = fanOutLimit();
    if (count > limit) {
      return `ulw-loop spawn fan-out cap reached (${count}/${limit}). Consolidate work into the agents already running, or raise OMO_SPAWN_FANOUT_LIMIT if this volume is intentional.`;
    }
    safeWriteWorkspaceTextFileSync(repoRoot, counterPath, JSON.stringify({ count }));
    return null;
  });
}
function missingGateArtifact(payload, plan) {
  if (!isGateReviewerSpawn(payload.tool_input))
    return null;
  const goal3 = plan.goals.find((candidate) => isFinalRunCompletionCandidate(plan, candidate));
  if (goal3 === undefined || goal3.status === "complete")
    return null;
  if (!goal3.successCriteria.every((criterion) => criterion.status === "pass"))
    return null;
  const scope = { sessionId: payload.session_id };
  if (plan.evidenceLayoutVersion === 2) {
    const attemptDir = ulwLoopAttemptEvidenceDir(payload.cwd, goal3.id, goal3.attempt, scope);
    for (const name of [`${goal3.id}-code-review.md`, `${goal3.id}-manual-qa.md`]) {
      const relative3 = `${attemptDir}/${name}`;
      if (!isNonEmptyFile(payload.cwd, join8(payload.cwd, relative3)))
        return relative3;
    }
    return null;
  }
  const evidenceRoot = ulwLoopEvidenceRoot(payload.cwd, scope);
  const flatReport = `${evidenceRoot}/${goal3.id}-code-review.md`;
  if (!isNonEmptyFile(payload.cwd, join8(payload.cwd, flatReport)))
    return flatReport;
  if (!hasOtherEvidenceFile(payload.cwd, join8(payload.cwd, evidenceRoot), `${goal3.id}-code-review.md`))
    return `${evidenceRoot}/<any manual-QA artifact besides ${goal3.id}-code-review.md>`;
  return null;
}
function isGateReviewerSpawn(toolInput) {
  if (typeof toolInput !== "object" || toolInput === null)
    return false;
  const record = toolInput;
  const agentType = record["agent_type"];
  if (typeof agentType === "string")
    return agentType === "lazycodex-gate-reviewer";
  const message = record["message"];
  return typeof message === "string" && GATE_MESSAGE_PATTERN.test(message);
}
function deny(reason) {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      additionalContext: reason
    }
  })}
`;
}
function fanOutLimit() {
  const raw = process.env["OMO_SPAWN_FANOUT_LIMIT"];
  if (raw === undefined)
    return DEFAULT_FANOUT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FANOUT_LIMIT;
}
function isNonEmptyFile(repoRoot, path) {
  try {
    return safeReadWorkspaceTextFile(repoRoot, path, 1024 * 1024).length > 0;
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
}
function hasOtherEvidenceFile(repoRoot, evidenceDir, excludedName) {
  try {
    const safeEvidenceDir = safeWorkspacePath(repoRoot, evidenceDir);
    return readdirSync2(safeEvidenceDir).some((name) => name !== excludedName && isNonEmptyFile(repoRoot, join8(safeEvidenceDir, name)));
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
}
function readCount(repoRoot, counterPath) {
  try {
    const parsed = JSON.parse(safeReadWorkspaceTextFile(repoRoot, counterPath, 64 * 1024));
    const count = parsed["count"];
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("invalid ulw-loop spawn counter");
    }
    return count;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return 0;
    throw error;
  }
}
function readPlan(repoRoot, goalsPath) {
  try {
    return JSON.parse(safeReadWorkspaceTextFile(repoRoot, goalsPath));
  } catch (error) {
    if (error instanceof Error)
      return null;
    throw error;
  }
}

// src/stop-resume-hook.ts
import { join as join10, resolve as resolve10 } from "node:path";

// src/resume-budget.ts
import { closeSync as closeSync5, fstatSync as fstatSync5, readSync as readSync3 } from "node:fs";
import { join as join9, resolve as resolve9, sep as sep3 } from "node:path";
var RESUME_CAP = 2;
var MAX_RESUME_LEDGER_BYTES = 64 * 1024 * 1024;
function consumeResumeBudget(repoRoot, stateDir, goalId) {
  try {
    assertSafeUlwLoopPathSegment(goalId, "goal id");
  } catch {
    return false;
  }
  const counterPath = resolve9(stateDir, `auto-resume-${goalId}.json`);
  const stuckPath = resolve9(stateDir, `auto-resume-${goalId}.stuck`);
  const lockPath = resolve9(stateDir, `auto-resume-${goalId}.lock`);
  if (!isInsideDir(stateDir, counterPath) || !isInsideDir(stateDir, stuckPath) || !isInsideDir(stateDir, lockPath))
    return false;
  try {
    return withInterprocessLockSync(repoRoot, lockPath, () => {
      const ledgerLineCount = countLedgerLines(repoRoot, join9(stateDir, "ledger.jsonl"));
      if (ledgerLineCount === null)
        return false;
      const previous = readCounter(repoRoot, counterPath);
      const count = previous !== null && previous.ledgerLineCount === ledgerLineCount ? previous.count : 0;
      if (count >= RESUME_CAP) {
        safeWriteWorkspaceTextFileSync(repoRoot, stuckPath, `no ledger progress after ${count} resumes
`);
        return false;
      }
      safeWriteWorkspaceTextFileSync(repoRoot, counterPath, JSON.stringify({ count: count + 1, ledgerLineCount }));
      return true;
    });
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
}
function isInsideDir(dir, candidate) {
  return candidate.startsWith(resolve9(dir) + sep3);
}
function countLedgerLines(repoRoot, ledgerPath) {
  let fileDescriptor = null;
  try {
    fileDescriptor = safeOpenWorkspaceReadFile(repoRoot, ledgerPath, MAX_RESUME_LEDGER_BYTES);
    const fileSize = fstatSync5(fileDescriptor).size;
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    let lineCount = 0;
    let lastByte = -1;
    while (offset < fileSize) {
      const requested = Math.min(buffer.length, fileSize - offset);
      const bytesRead = readSync3(fileDescriptor, buffer, 0, requested, offset);
      if (bytesRead <= 0)
        return null;
      for (let index = 0;index < bytesRead; index += 1) {
        if (buffer[index] === 10)
          lineCount += 1;
      }
      lastByte = buffer[bytesRead - 1] ?? lastByte;
      offset += bytesRead;
    }
    return fileSize > 0 && lastByte !== 10 ? lineCount + 1 : lineCount;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return 0;
    if (error instanceof Error)
      return null;
    throw error;
  } finally {
    if (fileDescriptor !== null)
      closeSync5(fileDescriptor);
  }
}
function readCounter(repoRoot, counterPath) {
  try {
    const parsed = JSON.parse(safeReadWorkspaceTextFile(repoRoot, counterPath));
    const count = parsed["count"];
    const ledgerLineCount = parsed["ledgerLineCount"];
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || typeof ledgerLineCount !== "number" || !Number.isSafeInteger(ledgerLineCount) || ledgerLineCount < 0) {
      throw new Error("Invalid ULW auto-resume counter.");
    }
    return { count, ledgerLineCount };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}

// src/stop-resume-hook.ts
var MAX_HOOK_INPUT_BYTES3 = 10 * 1024 * 1024;
var CONTEXT_PRESSURE_MARKERS2 = [
  "context compacted",
  "context_length_exceeded",
  "skill descriptions were shortened",
  "context_too_large",
  "codex ran out of room in the model's context window",
  "your input exceeds the context window",
  "long threads and multiple compactions"
];
function runStopResumeHook(input) {
  const payload = parseStopPayload(input);
  if (payload === null)
    return "";
  if (transcriptShowsContextPressure(payload.transcript_path))
    return "";
  if (boulderContinuationWillFire(payload.cwd, payload.session_id))
    return "";
  const stateDir = ulwLoopDir(payload.cwd, { sessionId: payload.session_id });
  const plan = readPlan2(payload.cwd, join10(stateDir, "goals.json"));
  if (plan === null || plan.aggregateCompletion?.status === "complete")
    return "";
  const goal3 = resumableGoal(plan) ?? incompleteAggregateGoal(plan);
  if (goal3 === undefined)
    return "";
  if (!consumeResumeBudget(payload.cwd, stateDir, goal3.id))
    return "";
  const output = {
    decision: "block",
    reason: renderResumeDirective(plan, goal3, payload.session_id)
  };
  return JSON.stringify(output);
}
async function runStopResumeHookCli(stdin, stdout) {
  try {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of stdin) {
      const bytes = Buffer.from(chunk);
      totalBytes += bytes.length;
      if (totalBytes > MAX_HOOK_INPUT_BYTES3)
        return;
      chunks.push(bytes);
    }
    const output = runStopResumeHook(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (output.length > 0)
      stdout.write(output);
  } catch (error) {
    if (error instanceof Error)
      return;
  }
}
function resumableGoal(plan) {
  const active = plan.goals.find((goal3) => goal3.id === plan.activeGoalId);
  if (active !== undefined && isResumableStatus(active.status))
    return active;
  return plan.goals.find((goal3) => isResumableStatus(goal3.status));
}
function isResumableStatus(status2) {
  return status2 === "pending" || status2 === "in_progress";
}
function incompleteAggregateGoal(plan) {
  if (plan.codexGoalMode !== "aggregate" || plan.aggregateCompletion?.status === "complete" || plan.goals.length === 0 || !plan.goals.every((goal3) => goal3.status === "complete")) {
    return;
  }
  return plan.goals.at(-1);
}
function renderResumeDirective(plan, goal3, sessionId) {
  const option = plan.goalsPath.includes(`/${sessionId}/`) ? ` --session-id ${sessionId}` : "";
  return [
    `The ulw-loop run in this session still has unfinished goals (next: ${goal3.id} — ${goal3.title}).`,
    "The turn ended before the loop completed. Resume it now:",
    `1. Run \`${grokUlwCli()} status${option} --json\` to reload the plan, the active goal, and currentAttemptDir.`,
    "2. Continue the active goal's remaining success criteria, recording evidence with record-evidence.",
    `3. Checkpoint through \`${grokUlwCli()} checkpoint${option}\` when the goal's criteria are proven; a complete checkpoint prints the next goal instruction.`,
    "If the loop is genuinely blocked on the user, checkpoint the goal as blocked with the reason instead."
  ].join(`
`);
}
function readPlan2(repoRoot, goalsPath) {
  try {
    const parsed = JSON.parse(safeReadWorkspaceTextFile(repoRoot, goalsPath));
    for (const goal3 of parsed.goals)
      assertSafeUlwLoopPathSegment(goal3.id, "goal id");
    return parsed;
  } catch (error) {
    if (error instanceof Error)
      return null;
    throw error;
  }
}
function boulderContinuationWillFire(cwd, sessionId) {
  for (const relativePath of [join10(".lazygrok", "boulder.json"), join10(".omo", "boulder.json")]) {
    try {
      const raw = JSON.parse(safeReadWorkspaceTextFile(cwd, join10(cwd, relativePath), 1024 * 1024));
      const works = raw["works"];
      const entries = typeof works === "object" && works !== null ? Object.values(works) : [raw];
      const continuationExists = entries.some((work) => {
        if (typeof work !== "object" || work === null)
          return false;
        const entry = work;
        const sessionIds = Array.isArray(entry["session_ids"]) ? entry["session_ids"] : [];
        const continuable = entry["status"] === "active" || entry["status"] === "paused";
        const ownsSession = sessionIds.some((candidate) => {
          if (typeof candidate !== "string")
            return false;
          return candidate === sessionId || candidate === `grok:${sessionId}` || candidate === `codex:${sessionId}`;
        });
        return continuable && ownsSession && boulderPlanHasChecklist(cwd, entry);
      });
      if (continuationExists)
        return true;
    } catch (error) {
      if (!(error instanceof Error))
        throw error;
    }
  }
  return false;
}
function transcriptShowsContextPressure(transcriptPath) {
  if (transcriptPath === null || transcriptPath.length === 0)
    return false;
  try {
    const transcript = readBoundedRegularTextFile(transcriptPath, 10 * 1024 * 1024).toLowerCase();
    return CONTEXT_PRESSURE_MARKERS2.some((marker) => transcript.includes(marker));
  } catch (error) {
    if (error instanceof Error)
      return false;
    throw error;
  }
}
function boulderPlanHasChecklist(cwd, entry) {
  const activePlan = entry["active_plan"];
  if (typeof activePlan !== "string" || activePlan.trim().length === 0)
    return false;
  try {
    return safeReadWorkspaceTextFile(cwd, resolve10(cwd, activePlan), 10 * 1024 * 1024).split(/\r?\n/).some((line) => line.startsWith("- [ ] ") || line.startsWith("- [x] ") || line.startsWith("- [X] "));
  } catch (error) {
    if (!(error instanceof Error))
      throw error;
  }
  return false;
}
function parseStopPayload(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value;
  const optionalMessage = record["last_assistant_message"];
  const transcriptPath = record["transcript_path"];
  const sessionId = record["session_id"];
  const valid = record["hook_event_name"] === "Stop" && typeof sessionId === "string" && normalizeUlwLoopSessionId(sessionId) === sessionId && typeof record["turn_id"] === "string" && (transcriptPath === undefined || transcriptPath === null || typeof transcriptPath === "string") && typeof record["cwd"] === "string" && typeof record["model"] === "string" && typeof record["permission_mode"] === "string" && typeof record["stop_hook_active"] === "boolean" && (optionalMessage === undefined || typeof optionalMessage === "string");
  if (!valid)
    return null;
  return {
    session_id: sessionId,
    cwd: record["cwd"],
    transcript_path: typeof transcriptPath === "string" ? transcriptPath : null,
    stop_hook_active: record["stop_hook_active"]
  };
}

// src/cli.ts
var TOP_LEVEL_HELP = `Usage:
  ulw-loop <subcommand> [args]
  ulw-loop hook user-prompt-submit [--with-ultrawork]  (Grok UserPromptSubmit hook)
  ulw-loop help | --help | -h                          (this message)

Run \`ulw-loop help\` for subcommands.
`;
async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(TOP_LEVEL_HELP);
    return 0;
  }
  if (command === "ulw-loop")
    return ulwLoopCommand(argv.slice(1));
  if (command === "hook") {
    const sub = argv[1];
    if (sub === "user-prompt-submit") {
      await runUlwLoopHookCli(process.stdin, process.stdout, {
        includeUltraworkDirective: argv.includes("--with-ultrawork")
      });
      return 0;
    }
    if (sub === "pre-tool-use") {
      await runPreToolUseGoalBudgetGuardCli(process.stdin, process.stdout);
      return 0;
    }
    if (sub === "stop") {
      await runStopResumeHookCli(process.stdin, process.stdout);
      return 0;
    }
    if (sub === "pre-tool-use-spawn") {
      await runSpawnGuardCli(process.stdin, process.stdout);
      return 0;
    }
    process.stderr.write(`[omo] unknown hook subcommand: ${sub ?? "(none)"}
`);
    return 1;
  }
  if (isUlwLoopSubcommand(command))
    return ulwLoopCommand(argv);
  process.stderr.write(`[omo] unknown command: ${command}
${TOP_LEVEL_HELP}`);
  return 1;
}
main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  process.stderr.write(`[omo] ${error instanceof Error ? error.message : String(error)}
`);
  process.exitCode = 1;
});
