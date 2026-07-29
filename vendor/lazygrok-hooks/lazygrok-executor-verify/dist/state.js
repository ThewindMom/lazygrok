import { closeSync, constants, existsSync, fstatSync, ftruncateSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, writeFileSync, } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
export const MAX_ATTEMPTS = 3;
class UnsafeHardLinkedStateError extends Error {
}
export function readAttemptState(cwd, sessionId, agentId, fs) {
    let readableStatePath;
    try {
        const statePath = safeStatePath(cwd, getStatePath(cwd, sessionId, agentId));
        const legacyStatePath = safeStatePath(cwd, getLegacyStatePath(cwd, sessionId, agentId));
        readableStatePath = fs.existsSync(statePath) ? statePath : legacyStatePath;
        if (!fs.existsSync(readableStatePath))
            return { attempts: 0 };
    }
    catch (error) {
        if (error instanceof Error)
            return { attempts: 0 };
        throw error;
    }
    try {
        const parsed = JSON.parse(readBoundedWorkspaceRegularFile(cwd, readableStatePath, 64 * 1024));
        if (isAttemptState(parsed))
            return parsed;
        return { attempts: 0 };
    }
    catch (error) {
        if (error instanceof UnsafeHardLinkedStateError) {
            try {
                const parsed = JSON.parse(readBoundedWorkspaceRegularFile(cwd, recoveryStatePath(readableStatePath), 64 * 1024));
                if (isAttemptState(parsed))
                    return parsed;
            }
            catch (recoveryError) {
                if (!(recoveryError instanceof Error))
                    throw recoveryError;
            }
            return { attempts: 0 };
        }
        if (error instanceof SyntaxError || error instanceof Error)
            return { attempts: 0 };
        throw error;
    }
}
export function writeAttemptState(cwd, sessionId, agentId, state) {
    try {
        const stateDir = safeStatePath(cwd, getStateDir(cwd));
        ensureWorkspaceDirectory(cwd, stateDir);
        const statePath = safeStatePath(cwd, getStatePath(cwd, sessionId, agentId));
        try {
            writeRegularFile(cwd, statePath, `${JSON.stringify(state)}\n`);
        }
        catch (error) {
            if (!(error instanceof UnsafeHardLinkedStateError))
                throw error;
            writeRegularFile(cwd, recoveryStatePath(statePath), `${JSON.stringify(state)}\n`);
        }
    }
    catch (error) {
        if (error instanceof Error)
            return;
        throw error;
    }
}
export function clearAttemptState(cwd, sessionId, agentId) {
    writeAttemptState(cwd, sessionId, agentId, { attempts: 0 });
}
export function getStatePath(cwd, sessionId, agentId) {
    return join(getStateDir(cwd), `${sanitizeKey(sessionId)}-${sanitizeKey(agentId)}.json`);
}
function getStateDir(cwd) {
    return join(cwd, ".lazygrok", "lazygrok-executor-verify");
}
function getLegacyStatePath(cwd, sessionId, agentId) {
    return join(cwd, ".omo", "lazycodex-executor-verify", `${sanitizeKey(sessionId)}-${sanitizeKey(agentId)}.json`);
}
function recoveryStatePath(path) {
    return `${path}.recovery`;
}
function safeStatePath(cwd, candidate) {
    const lexicalRoot = resolve(cwd);
    const lexicalCandidate = resolve(candidate);
    if (!isInside(lexicalRoot, lexicalCandidate))
        throw new Error("executor state path escapes the workspace");
    const canonicalRoot = realpathSync(lexicalRoot);
    const canonicalCandidate = resolve(canonicalRoot, relative(lexicalRoot, lexicalCandidate));
    let current = canonicalRoot;
    for (const component of relative(canonicalRoot, canonicalCandidate)
        .split(/[\\/]+/u)
        .filter(Boolean)) {
        current = join(current, component);
        if (!existsSync(current))
            break;
        if (lstatSync(current).isSymbolicLink())
            throw new Error("executor state paths may not contain symlinks");
        if (!isInside(canonicalRoot, realpathSync(current))) {
            throw new Error("executor state path escapes the workspace");
        }
    }
    return canonicalCandidate;
}
function isInside(root, candidate) {
    const pathFromRoot = relative(root, candidate);
    return (pathFromRoot === "" ||
        (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot)));
}
function assertDescriptorInsideWorkspace(cwd, fileDescriptor, expectedKind = "file") {
    const canonicalRoot = realpathSync(cwd);
    const procPath = `/proc/self/fd/${fileDescriptor}`;
    if (existsSync(procPath) && !isInside(canonicalRoot, realpathSync(procPath))) {
        throw new Error("executor state file changed identity");
    }
    const opened = fstatSync(fileDescriptor);
    if ((expectedKind === "file" && !opened.isFile()) || (expectedKind === "directory" && !opened.isDirectory())) {
        throw new Error("executor state target has the wrong file type");
    }
    if (expectedKind === "file" && opened.nlink !== 1) {
        throw new UnsafeHardLinkedStateError("executor state files may not be hard linked");
    }
}
function ensureWorkspaceDirectory(cwd, directory) {
    const canonicalRoot = realpathSync(resolve(cwd));
    const safeDirectory = safeStatePath(cwd, directory);
    const components = relative(canonicalRoot, safeDirectory)
        .split(/[\\/]+/u)
        .filter(Boolean);
    let currentDescriptor = openSync(canonicalRoot, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
        assertDescriptorInsideWorkspace(cwd, currentDescriptor, "directory");
        let fallbackPath = canonicalRoot;
        for (const component of components) {
            const procParent = `/proc/self/fd/${currentDescriptor}`;
            const entryPath = existsSync(procParent) ? join(procParent, component) : join(fallbackPath, component);
            try {
                mkdirSync(entryPath, { mode: 0o700 });
            }
            catch (error) {
                if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST")
                    throw error;
            }
            const childDescriptor = openSync(entryPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
            try {
                assertDescriptorInsideWorkspace(cwd, childDescriptor, "directory");
            }
            catch (error) {
                closeSync(childDescriptor);
                throw error;
            }
            closeSync(currentDescriptor);
            currentDescriptor = childDescriptor;
            fallbackPath = join(fallbackPath, component);
        }
    }
    finally {
        closeSync(currentDescriptor);
    }
}
function openAnchoredParent(cwd, path) {
    const parentPath = safeStatePath(cwd, dirname(path));
    const fileDescriptor = openSync(parentPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
        assertDescriptorInsideWorkspace(cwd, fileDescriptor, "directory");
        const procPath = `/proc/self/fd/${fileDescriptor}`;
        return {
            fileDescriptor,
            path: existsSync(procPath) ? join(procPath, basename(path)) : path,
        };
    }
    catch (error) {
        closeSync(fileDescriptor);
        throw error;
    }
}
function openWorkspaceRegularFile(cwd, path) {
    const parent = openAnchoredParent(cwd, path);
    let fileDescriptor;
    try {
        fileDescriptor = openSync(parent.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    }
    finally {
        closeSync(parent.fileDescriptor);
    }
    try {
        assertDescriptorInsideWorkspace(cwd, fileDescriptor);
        return fileDescriptor;
    }
    catch (error) {
        closeSync(fileDescriptor);
        throw error;
    }
}
export function isNonEmptyWorkspaceRegularFile(cwd, path, maxBytes) {
    const fileDescriptor = openWorkspaceRegularFile(cwd, path);
    try {
        const size = fstatSync(fileDescriptor).size;
        return Number.isSafeInteger(size) && size > 0 && size <= maxBytes;
    }
    finally {
        closeSync(fileDescriptor);
    }
}
export function isNonEmptyWorkspaceRegularFileInsideDirectory(cwd, path, directory, maxBytes, expectedIdentity) {
    const safeDirectory = safeStatePath(cwd, directory);
    const safePath = safeStatePath(cwd, path);
    if (!isInside(safeDirectory, safePath) || safeDirectory === safePath)
        return false;
    const fileDescriptor = openWorkspaceRegularFile(cwd, safePath);
    try {
        const opened = fstatSync(fileDescriptor);
        if ((expectedIdentity.dev !== undefined && opened.dev !== expectedIdentity.dev) ||
            (expectedIdentity.ino !== undefined && opened.ino !== expectedIdentity.ino))
            return false;
        const procPath = `/proc/self/fd/${fileDescriptor}`;
        if (existsSync(procPath) && !isInside(realpathSync(safeDirectory), realpathSync(procPath)))
            return false;
        return Number.isSafeInteger(opened.size) && opened.size > 0 && opened.size <= maxBytes;
    }
    finally {
        closeSync(fileDescriptor);
    }
}
export function readBoundedWorkspaceRegularFile(cwd, path, maxBytes) {
    const fileDescriptor = openWorkspaceRegularFile(cwd, path);
    try {
        const snapshotBytes = fstatSync(fileDescriptor).size;
        if (!Number.isSafeInteger(snapshotBytes) || snapshotBytes < 0 || snapshotBytes > maxBytes) {
            throw new Error("executor state input is too large");
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
    finally {
        closeSync(fileDescriptor);
    }
}
function openForWrite(path) {
    try {
        return openSync(path, constants.O_WRONLY | constants.O_NOFOLLOW);
    }
    catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
            throw error;
        return openSync(path, constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_CREAT | constants.O_EXCL, 0o600);
    }
}
function writeRegularFile(cwd, path, data) {
    const parent = openAnchoredParent(cwd, path);
    let fileDescriptor;
    try {
        fileDescriptor = openForWrite(parent.path);
    }
    finally {
        closeSync(parent.fileDescriptor);
    }
    try {
        assertDescriptorInsideWorkspace(cwd, fileDescriptor);
        ftruncateSync(fileDescriptor, 0);
        writeFileSync(fileDescriptor, data, "utf8");
    }
    finally {
        closeSync(fileDescriptor);
    }
}
export function sanitizeKey(value) {
    const sanitized = value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return sanitized.length > 0 ? sanitized : "missing";
}
function isAttemptState(value) {
    return isRecord(value) && typeof value["attempts"] === "number" && Number.isInteger(value["attempts"]);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
