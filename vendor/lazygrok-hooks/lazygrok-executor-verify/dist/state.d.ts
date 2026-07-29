import type { HookFileSystem } from "./types.js";
export declare const MAX_ATTEMPTS = 3;
export type AttemptState = {
    readonly attempts: number;
};
export declare function readAttemptState(cwd: string, sessionId: string, agentId: string, fs: HookFileSystem): AttemptState;
export declare function writeAttemptState(cwd: string, sessionId: string, agentId: string, state: AttemptState): void;
export declare function clearAttemptState(cwd: string, sessionId: string, agentId: string): void;
export declare function getStatePath(cwd: string, sessionId: string, agentId: string): string;
export declare function isNonEmptyWorkspaceRegularFile(cwd: string, path: string, maxBytes: number): boolean;
export declare function isNonEmptyWorkspaceRegularFileInsideDirectory(cwd: string, path: string, directory: string, maxBytes: number, expectedIdentity: {
    readonly dev?: number;
    readonly ino?: number;
}): boolean;
export declare function readBoundedWorkspaceRegularFile(cwd: string, path: string, maxBytes: number): string;
export declare function sanitizeKey(value: string): string;
