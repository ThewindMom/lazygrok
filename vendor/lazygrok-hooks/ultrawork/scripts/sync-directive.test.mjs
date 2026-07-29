import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

const componentRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(dirname(componentRoot)));
const canonicalGrokPrompt = join(repositoryRoot, "prompts", "ultrawork", "grok.md");
const directive = join(componentRoot, "directive.md");
const syncScript = join(componentRoot, "scripts", "sync-directive.mjs");
const run = promisify(execFile);

test("sync-directive copies the canonical LazyGrok Grok prompt without prompts-core", async () => {
	const [source, synced, implementation] = await Promise.all([
		readFile(canonicalGrokPrompt, "utf8"),
		readFile(directive, "utf8"),
		readFile(syncScript, "utf8"),
	]);
	assert.equal(synced, source);
	assert.doesNotMatch(implementation, /prompts-core|codex\.md/);
	await run(process.execPath, [syncScript]);
	const once = await readFile(directive, "utf8");
	await run(process.execPath, [syncScript]);
	assert.equal(await readFile(directive, "utf8"), once);
});
