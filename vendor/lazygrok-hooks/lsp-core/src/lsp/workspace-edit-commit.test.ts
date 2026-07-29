// allow: SIZE_OK — commit-barrier and adversarial parent-swap scenarios share one mutation fixture and cleanup lifecycle.
import { afterEach, describe, expect, it } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
	applyWorkspaceEditDetailed,
	commitWorkspaceEditPlan,
	planWorkspaceEdit,
} from "./workspace-edit.js";

const tempDirectories: string[] = [];
const linuxIt = process.platform === "linux" ? it : it.skip;

afterEach(() => {
	for (const directory of tempDirectories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

describe("workspace edit commit barrier", () => {
	it("#given cancellation before commit #when a valid plan is applied #then no mutation begins", () => {
		const fixture = makeFixture();
		const controller = new AbortController();
		controller.abort();

		const commit = applyWorkspaceEditDetailed(
			textEdit(fixture.source, "before", "after"),
			{
				workspaceRoot: fixture.workspace,
				signal: controller.signal,
			},
		);

		expect(commit.result.success).toBe(false);
		expect(commit.result.errors.join("\n")).toContain(
			"cancelled before commit",
		);
		expect(commit.delta.operations).toEqual([]);
		expect(readFileSync(fixture.source, "utf-8")).toBe("const before = 1;\n");
	});

	it("#given repeated pre-gate interruptions #when retried #then every attempt leaves the snapshot untouched", () => {
		const fixture = makeFixture();
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const controller = new AbortController();
			controller.abort();
			const commit = applyWorkspaceEditDetailed(
				textEdit(fixture.source, "before", "after"),
				{
					workspaceRoot: fixture.workspace,
					signal: controller.signal,
				},
			);
			expect(commit.result.success).toBe(false);
			expect(commit.delta.operations).toEqual([]);
		}
		expect(readFileSync(fixture.source, "utf-8")).toBe("const before = 1;\n");
	});

	it("#given cancellation after the first write #when commit has crossed the barrier #then all operations finish once", () => {
		const fixture = makeFixture();
		const second = join(fixture.workspace, "second.ts");
		writeFileSync(second, "const second = 2;\n", "utf-8");
		const controller = new AbortController();
		let writes = 0;

		const commit = applyWorkspaceEditDetailed(
			{
				changes: {
					[pathToFileURL(fixture.source).href]: [
						replacement("before", "after"),
					],
					[pathToFileURL(second).href]: [replacement("second", "later_")],
				},
			},
			{
				workspaceRoot: fixture.workspace,
				signal: controller.signal,
				io: {
					writeFile(path, content) {
						writes += 1;
						writeFileSync(path, content, "utf-8");
						if (writes === 1) controller.abort();
					},
				},
			},
		);

		expect(commit.result).toMatchObject({
			success: true,
			lateAbort: true,
			totalEdits: 2,
		});
		expect(writes).toBe(2);
		expect(readFileSync(fixture.source, "utf-8")).toBe("const after = 1;\n");
		expect(readFileSync(second, "utf-8")).toBe("const later_ = 2;\n");
	});

	it("#given an injected write failure #when commit begins #then the result reports real I/O failure", () => {
		const fixture = makeFixture();

		const commit = applyWorkspaceEditDetailed(
			textEdit(fixture.source, "before", "after"),
			{
				workspaceRoot: fixture.workspace,
				io: {
					writeFile() {
						throw new InjectedWriteError();
					},
				},
			},
		);

		expect(commit.result).toMatchObject({ success: false, failedChange: 0 });
		expect(commit.result.errors.join("\n")).toContain(
			"I/O failure during text: injected write failure",
		);
		expect(commit.delta.operations).toEqual([]);
		expect(readFileSync(fixture.source, "utf-8")).toBe("const before = 1;\n");
	});

	it("#given a stale file snapshot #when a prepared plan commits #then the newer bytes are preserved", () => {
		const fixture = makeFixture();
		const planned = planWorkspaceEdit(
			textEdit(fixture.source, "before", "after"),
			fixture.workspace,
		);
		expect(planned.success).toBe(true);
		if (!planned.success) return;
		writeFileSync(fixture.source, "const external = 2;\n", "utf-8");

		const commit = commitWorkspaceEditPlan(planned.plan);

		expect(commit.result.success).toBe(false);
		expect(commit.result.errors.join("\n")).toContain(
			"workspace state changed before commit",
		);
		expect(commit.delta.operations).toEqual([]);
		expect(readFileSync(fixture.source, "utf-8")).toBe("const external = 2;\n");
	});

	linuxIt(
		"#given a verified text parent is swapped #when commit writes #then the outside file is unchanged",
		() => {
			const fixture = makeParentSwapFixture("source.ts", "const before = 1;\n");

			const commit = applyWorkspaceEditDetailed(
				textEdit(fixture.target, "before", "after"),
				{
					workspaceRoot: fixture.workspace,
					io: {
						writeFile(path, content) {
							swapParent(fixture);
							writeFileSync(path, content, "utf-8");
						},
					},
				},
			);

			expect(commit.result.success).toBe(true);
			expect(readFileSync(fixture.outsideTarget, "utf-8")).toBe(
				"outside sentinel\n",
			);
			expect(
				readFileSync(join(fixture.movedParent, "source.ts"), "utf-8"),
			).toBe("const after = 1;\n");
		},
	);

	linuxIt(
		"#given a verified rename parent is swapped #when commit renames #then outside files are unchanged",
		() => {
			const fixture = makeParentSwapFixture("before.ts", "inside source\n");
			writeFileSync(
				join(fixture.outside, "after.ts"),
				"outside destination\n",
				"utf-8",
			);

			const commit = applyWorkspaceEditDetailed(
				{
					documentChanges: [
						{
							kind: "rename",
							oldUri: pathToFileURL(fixture.target).href,
							newUri: pathToFileURL(join(fixture.parent, "after.ts")).href,
						},
					],
				},
				{
					workspaceRoot: fixture.workspace,
					io: {
						rename(oldPath, newPath) {
							swapParent(fixture);
							renameSync(oldPath, newPath);
						},
					},
				},
			);

			expect(commit.result.success).toBe(true);
			expect(readFileSync(fixture.outsideTarget, "utf-8")).toBe(
				"outside sentinel\n",
			);
			expect(readFileSync(join(fixture.outside, "after.ts"), "utf-8")).toBe(
				"outside destination\n",
			);
			expect(readFileSync(join(fixture.movedParent, "after.ts"), "utf-8")).toBe(
				"inside source\n",
			);
		},
	);

	linuxIt(
		"#given a verified delete parent is swapped #when commit removes #then the outside file is unchanged",
		() => {
			const fixture = makeParentSwapFixture("target.ts", "inside target\n");

			const commit = applyWorkspaceEditDetailed(
				{
					documentChanges: [
						{ kind: "delete", uri: pathToFileURL(fixture.target).href },
					],
				},
				{
					workspaceRoot: fixture.workspace,
					io: {
						remove(path, recursive) {
							swapParent(fixture);
							rmSync(path, { recursive, force: false });
						},
					},
				},
			);

			expect(commit.result.success).toBe(true);
			expect(readFileSync(fixture.outsideTarget, "utf-8")).toBe(
				"outside sentinel\n",
			);
			expect(existsSync(join(fixture.movedParent, "target.ts"))).toBe(false);
		},
	);
});

class InjectedWriteError extends Error {
	override readonly name = "InjectedWriteError";

	constructor() {
		super("injected write failure");
	}
}

function makeFixture(): {
	readonly workspace: string;
	readonly source: string;
} {
	const workspace = mkdtempSync(join(tmpdir(), "lsp-workspace-commit-"));
	tempDirectories.push(workspace);
	const source = join(workspace, "source.ts");
	writeFileSync(source, "const before = 1;\n", "utf-8");
	return { workspace, source };
}

interface ParentSwapFixture {
	readonly workspace: string;
	readonly parent: string;
	readonly movedParent: string;
	readonly outside: string;
	readonly target: string;
	readonly outsideTarget: string;
}

function makeParentSwapFixture(
	name: string,
	content: string,
): ParentSwapFixture {
	const workspace = mkdtempSync(join(tmpdir(), "lsp-workspace-parent-swap-"));
	tempDirectories.push(workspace);
	const parent = join(workspace, "parent");
	const movedParent = join(workspace, "verified-parent");
	const outside = join(workspace, "outside");
	mkdirSync(parent);
	mkdirSync(outside);
	const target = join(parent, name);
	const outsideTarget = join(outside, name);
	writeFileSync(target, content, "utf-8");
	writeFileSync(outsideTarget, "outside sentinel\n", "utf-8");
	return { workspace, parent, movedParent, outside, target, outsideTarget };
}

function swapParent(fixture: ParentSwapFixture): void {
	renameSync(fixture.parent, fixture.movedParent);
	symlinkSync(fixture.outside, fixture.parent, "dir");
}

function textEdit(path: string, before: string, after: string) {
	return {
		changes: { [pathToFileURL(path).href]: [replacement(before, after)] },
	};
}

function replacement(before: string, after: string) {
	return {
		range: {
			start: { line: 0, character: 6 },
			end: { line: 0, character: 6 + before.length },
		},
		newText: after,
	};
}
