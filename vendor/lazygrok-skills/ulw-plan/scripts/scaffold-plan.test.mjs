import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";

import { scaffold } from "./scaffold-plan.mjs";

async function withWorkspace(run) {
	const workspace = await mkdtemp(join(os.tmpdir(), "lazygrok-ulw-plan-"));
	try {
		await run(workspace);
	} finally {
		await rm(workspace, { recursive: true, force: true });
	}
}

test("scaffold creates new draft and plan under .lazygrok and plain reruns are no-ops", async () => {
	await withWorkspace(async (workspace) => {
		assert.deepEqual(await scaffold(workspace, { slug: "new-plan", intent: "clear" }), [
			{ relPath: ".lazygrok/drafts/new-plan.md", status: "created" },
			{ relPath: ".lazygrok/plans/new-plan.md", status: "created" },
		]);
		assert.equal((await readFile(join(workspace, ".lazygrok/plans/new-plan.md"), "utf8")).startsWith("# new-plan"), true);
		assert.deepEqual(await scaffold(workspace, { slug: "new-plan", intent: "clear" }), [
			{ relPath: ".lazygrok/drafts/new-plan.md", status: "exists" },
			{ relPath: ".lazygrok/plans/new-plan.md", status: "exists" },
		]);
	});
});

test("scaffold keeps an existing legacy .omo run and reset needs force for edits", async () => {
	await withWorkspace(async (workspace) => {
		await mkdir(join(workspace, ".omo", "drafts"), { recursive: true });
		await writeFile(join(workspace, ".omo", "drafts", "legacy.md"), "# Draft: legacy\n\n## Approval gate\n", "utf8");
		assert.deepEqual(await scaffold(workspace, { slug: "legacy", intent: "clear" }), [
			{ relPath: ".omo/drafts/legacy.md", status: "exists" },
			{ relPath: ".omo/plans/legacy.md", status: "created" },
		]);
		await writeFile(join(workspace, ".omo", "plans", "legacy.md"), "hand edit", "utf8");
		await assert.rejects(() => scaffold(workspace, { slug: "legacy", intent: "clear", reset: true }), /pass --reset --force/);
		assert.equal((await scaffold(workspace, { slug: "legacy", intent: "clear", reset: true, force: true }))[1].status, "reset");
	});
});

test("scaffold refuses a symlinked .lazygrok root", async () => {
	await withWorkspace(async (workspace) => {
		const outside = await mkdtemp(join(os.tmpdir(), "lazygrok-ulw-plan-outside-"));
		try {
			await symlink(outside, join(workspace, ".lazygrok"));
			await assert.rejects(() => scaffold(workspace, { slug: "unsafe", intent: "clear" }), /symlink/);
		} finally {
			await rm(outside, { recursive: true, force: true });
		}
	});
});
