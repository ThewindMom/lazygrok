import { resolve } from "node:path";
import { assertSafeEvidenceArtifact } from "./file-safety.js";
import { isWithinAttemptDir } from "./paths.js";
import { invalid } from "./quality-gate-fields.js";

export interface QualityGateFs {
	readonly existsSync: (path: string) => boolean;
	readonly lstatSync: (path: string) => { readonly isSymbolicLink: () => boolean };
	readonly realpathSync: (path: string) => string;
	readonly statSync: (path: string) => { readonly size: number };
}

export interface ValidateQualityGateOptions {
	readonly repoRoot: string;
	readonly fs: QualityGateFs;
	readonly currentAttemptDir?: string;
}

export function checkArtifactFile(path: string, field: string, opts?: ValidateQualityGateOptions): void {
	if (opts === undefined) return;
	const absolute = resolve(opts.repoRoot, path);
	if (!opts.fs.existsSync(absolute)) invalid(`${field} must point to an existing artifact.`, field);
	if (opts.fs.lstatSync(absolute).isSymbolicLink()) invalid(`${field} must not point to a symbolic link.`, field);
	if (opts.fs.statSync(absolute).size <= 0) invalid(`${field} must point to a non-empty artifact.`, field);
	if (opts.currentAttemptDir !== undefined) {
		const attemptRoot = resolve(opts.repoRoot, opts.currentAttemptDir);
		const attemptError = `${field} (${path}) must point to an artifact from the current attempt (${opts.currentAttemptDir}).`;
		if (!opts.fs.existsSync(attemptRoot)) invalid(attemptError, field);
		if (!isWithinAttemptDir(opts.fs.realpathSync(absolute), opts.fs.realpathSync(attemptRoot))) {
			invalid(attemptError, field);
		}
	}
	try {
		assertSafeEvidenceArtifact(
			opts.repoRoot,
			absolute,
			opts.currentAttemptDir === undefined ? undefined : resolve(opts.repoRoot, opts.currentAttemptDir),
			10 * 1024 * 1024,
		);
	} catch (error) {
		if (error instanceof Error) invalid(`${field} must point to a non-empty single-link regular artifact.`, field);
		throw error;
	}
}
