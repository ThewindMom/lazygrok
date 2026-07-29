// biome-ignore-all format: compact path tests predate this change.
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import {
	isWithinAttemptDir,
	normalizeUlwLoopSessionId,
	repoRelative,
	resolveUlwLoopSessionIdFromBinding,
	ulwLoopBriefPath,
	ulwLoopDir,
	ulwLoopGoalsPath,
	ulwLoopLedgerPath,
} from "../src/paths.ts";

function writeBinding(
	homeDir: string,
	workspace: string,
	sessionId: string,
	updatedAt: string,
): void {
	const workspaceHash = createHash("sha256").update(workspace).digest("hex");
	const directory = join(homeDir, ".grok", "state", "lazygrok", "session-bindings");
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	writeFileSync(
		join(directory, `${workspaceHash}-${sessionId}.json`),
		JSON.stringify({ version: 1, workspaceHash, sessionId, updatedAt }),
		{ mode: 0o600 },
	);
}

describe("ulwLoopDir(repo)", () => {
	it("returns the canonical .lazygrok state root for a new run", () => {
		// when/then
		expect(ulwLoopDir("/repo")).toBe(join("/repo", ".lazygrok", "ulw-loop"));
	});

	it("#given a session id #when resolving the loop dir #then scopes artifacts under that session", () => {
		// when/then
		expect(ulwLoopDir("/repo", { sessionId: "sess_abc" })).toBe(join("/repo", ".lazygrok", "ulw-loop", "sess_abc"));
	});
});

describe("ulw-loop*Path helpers", () => {
	it("compose artifact filenames under ulwLoopDir", () => {
		// when/then
		expect(ulwLoopBriefPath("/r")).toBe(join("/r", ".lazygrok", "ulw-loop", "brief.md"));
		expect(ulwLoopGoalsPath("/r")).toBe(join("/r", ".lazygrok", "ulw-loop", "goals.json"));
		expect(ulwLoopLedgerPath("/r")).toBe(join("/r", ".lazygrok", "ulw-loop", "ledger.jsonl"));
	});

	it("#given a session id #when composing artifact filenames #then returns session-scoped paths", () => {
		// when/then
		expect(ulwLoopBriefPath("/r", { sessionId: "session-A" })).toBe(join("/r", ".lazygrok", "ulw-loop", "session-A", "brief.md"));
		expect(ulwLoopGoalsPath("/r", { sessionId: "session-A" })).toBe(join("/r", ".lazygrok", "ulw-loop", "session-A", "goals.json"));
		expect(ulwLoopLedgerPath("/r", { sessionId: "session-A" })).toBe(join("/r", ".lazygrok", "ulw-loop", "session-A", "ledger.jsonl"));
	});
});

describe("normalizeUlwLoopSessionId", () => {
	it("#given a canonical session id #when parsed #then preserves the exact identity", () => {
		// when/then
		expect(normalizeUlwLoopSessionId("session-A_1.2")).toBe("session-A_1.2");
	});

	it.each(["../bad/id", "bad/id", " session-A", "session A", ".hidden"])(
		"#given noncanonical session id %s #when parsed #then rejects it instead of aliasing it",
		(sessionId) => {
			// when/then
			expect(normalizeUlwLoopSessionId(sessionId)).toBeNull();
		},
	);

	it("#given a hostile explicit scope #when resolving a loop directory #then rejects it instead of using shared state", () => {
		// when/then
		expect(() => ulwLoopDir("/repo", { sessionId: "../bad/id" })).toThrow("Invalid session id");
	});

	it("#given blank input #when normalized #then returns null", () => {
		// when/then
		expect(normalizeUlwLoopSessionId("  ")).toBeNull();
	});
});

describe("resolveUlwLoopSessionIdFromBinding", () => {
	it("returns the only recent exact Grok session for the workspace", () => {
		const homeDir = join(tmpdir(), `ulw-binding-home-${randomUUID()}`);
		const workspace = join(tmpdir(), `ulw-binding-workspace-${randomUUID()}`);
		mkdirSync(workspace);
		const nowMs = Date.now();
		writeBinding(homeDir, workspace, "exact-grok-session", new Date(nowMs).toISOString());

		expect(
			resolveUlwLoopSessionIdFromBinding(workspace, { homeDir, nowMs }),
		).toBe("exact-grok-session");
	});

	it("ignores stale bindings and rejects concurrent recent Grok sessions", () => {
		const homeDir = join(tmpdir(), `ulw-binding-home-${randomUUID()}`);
		const workspace = join(tmpdir(), `ulw-binding-workspace-${randomUUID()}`);
		mkdirSync(workspace);
		const nowMs = Date.now();
		writeBinding(
			homeDir,
			workspace,
			"stale-session",
			new Date(nowMs - 11 * 60 * 1000).toISOString(),
		);
		expect(
			resolveUlwLoopSessionIdFromBinding(workspace, { homeDir, nowMs }),
		).toBeNull();

		writeBinding(homeDir, workspace, "current-one", new Date(nowMs).toISOString());
		writeBinding(homeDir, workspace, "current-two", new Date(nowMs).toISOString());
		expect(() =>
			resolveUlwLoopSessionIdFromBinding(workspace, { homeDir, nowMs }),
		).toThrow("Multiple recent Grok sessions");
	});
});

describe("repoRelative", () => {
	it("strips repo prefix when path is inside repo", () => {
		// when/then
		expect(repoRelative("/repo/.omo/ulw-loop/goals.json", "/repo")).toBe(".omo/ulw-loop/goals.json");
	});

	it("returns absolute when path is outside repo", () => {
		// when/then
		expect(repoRelative("/elsewhere/file", "/repo")).toBe("/elsewhere/file");
	});
});

describe("isWithinAttemptDir", () => {
	const posixRoot = "/repo/.omo/evidence/ulw/s1/g1/a1";
	const win32Root = "C:\\repo\\.omo\\evidence\\ulw\\s1\\g1\\a1";

	it("#given a child artifact #when checked on posix #then it is contained", () => {
		expect(isWithinAttemptDir(`${posixRoot}/cli-pass.txt`, posixRoot, posix)).toBe(true);
	});

	it("#given a child artifact #when checked with win32 separators #then it is contained", () => {
		expect(isWithinAttemptDir(`${win32Root}\\cli-pass.txt`, win32Root, win32)).toBe(true);
	});

	it("#given the attempt root itself #when checked #then it is contained", () => {
		expect(isWithinAttemptDir(posixRoot, posixRoot, posix)).toBe(true);
		expect(isWithinAttemptDir(win32Root, win32Root, win32)).toBe(true);
	});

	it("#given a sibling dir sharing the prefix #when checked #then it is outside", () => {
		expect(isWithinAttemptDir("/repo/.omo/evidence/ulw/s1/g1/a1x/f.txt", posixRoot, posix)).toBe(false);
		expect(isWithinAttemptDir(`${win32Root}x\\f.txt`, win32Root, win32)).toBe(false);
	});

	it("#given a prior-attempt artifact #when checked #then it is outside", () => {
		expect(isWithinAttemptDir("/repo/.omo/evidence/ulw/s1/g1/a0/f.txt", posixRoot, posix)).toBe(false);
		expect(isWithinAttemptDir("C:\\repo\\.omo\\evidence\\ulw\\s1\\g1\\a0\\f.txt", win32Root, win32)).toBe(false);
	});

	it("#given a different-drive path #when checked on win32 #then it is outside", () => {
		expect(isWithinAttemptDir("D:\\elsewhere\\f.txt", win32Root, win32)).toBe(false);
	});
});
