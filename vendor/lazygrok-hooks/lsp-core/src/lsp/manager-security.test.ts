import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createStandaloneMcpRequestContext, runWithRequestContext } from "../request-context.js";
import { LspClient } from "./client.js";
import { LspManager } from "./manager.js";
import type { ResolvedServer } from "./types.js";

const tempDirectories: string[] = [];

afterEach(() => {
	for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("LSP manager client isolation", () => {
	it("#given two effective request contexts #when acquiring the same root and server #then clients are not shared", async () => {
		const root = tempRoot();
		const created: TestLspClient[] = [];
		const manager = new LspManager({
			clientFactory: (clientRoot, server) => {
				const client = new TestLspClient(clientRoot, server);
				created.push(client);
				return client;
			},
			reaperIntervalMs: 60_000,
		});
		const server = testServer();
		const firstContext = createStandaloneMcpRequestContext({
			cwd: root,
			env: { LSP_TOOLS_MCP_USER_CONFIG: join(root, "session-a.json") },
		});
		const secondContext = createStandaloneMcpRequestContext({
			cwd: root,
			env: { LSP_TOOLS_MCP_USER_CONFIG: join(root, "session-b.json") },
		});

		try {
			const first = await runWithRequestContext(firstContext, async () => {
				const client = await manager.getClient(root, server);
				manager.releaseClient(root, server);
				return client;
			});
			const second = await runWithRequestContext(secondContext, async () => {
				const client = await manager.getClient(root, server);
				manager.releaseClient(root, server);
				return client;
			});

			expect(second).not.toBe(first);
			expect(created).toHaveLength(2);
		} finally {
			await manager.stopAll();
		}
	});

	it("#given changed resolved server configuration #when acquiring the same root and id #then clients are not shared", async () => {
		const root = tempRoot();
		const created: TestLspClient[] = [];
		const manager = new LspManager({
			clientFactory: (clientRoot, server) => {
				const client = new TestLspClient(clientRoot, server);
				created.push(client);
				return client;
			},
			reaperIntervalMs: 60_000,
		});
		const context = createStandaloneMcpRequestContext({ cwd: root });
		const firstServer = testServer({ command: ["server-a"], env: { MODE: "a" } });
		const secondServer = testServer({ command: ["server-b"], env: { MODE: "b" } });

		try {
			const first = await runWithRequestContext(context, async () => {
				const client = await manager.getClient(root, firstServer);
				manager.releaseClient(root, firstServer);
				return client;
			});
			const second = await runWithRequestContext(context, async () => {
				const client = await manager.getClient(root, secondServer);
				manager.releaseClient(root, secondServer);
				return client;
			});

			expect(second).not.toBe(first);
			expect(created).toHaveLength(2);
		} finally {
			await manager.stopAll();
		}
	});
});

class TestLspClient extends LspClient {
	override async start(): Promise<void> {}
	override async initialize(): Promise<void> {}
	override async stop(): Promise<void> {}
	override isAlive(): boolean {
		return true;
	}
}

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "lsp-manager-isolation-"));
	tempDirectories.push(root);
	return root;
}

function testServer(overrides: Partial<ResolvedServer> = {}): ResolvedServer {
	return {
		id: "typescript",
		command: ["typescript-language-server"],
		extensions: [".ts"],
		priority: 1,
		...overrides,
	};
}
