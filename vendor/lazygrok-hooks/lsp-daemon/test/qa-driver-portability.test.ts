import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const runtimeDependencies = ["scripts/qa/cancellation-smoke.mjs", "scripts/qa/commit-barrier-smoke.mjs"] as const;
const cancellationSmoke = runtimeDependencies[0];

describe("LSP QA driver portability", () => {
	it("#given the vendored package #when cancellation QA runs #then every runtime dependency ships outside evidence", () => {
		for (const dependency of runtimeDependencies) {
			const path = join(packageRoot, dependency);
			expect(existsSync(path)).toBe(true);
			expect(readFileSync(path, "utf8")).not.toContain(".omo/evidence");
		}
	});

	it("#given the native platform #when the cancellation smoke runs #then it binds the production endpoint kind", () => {
		const output = execFileSync("bun", [join(packageRoot, cancellationSmoke), packageRoot], {
			cwd: packageRoot,
			encoding: "utf8",
			timeout: 10_000,
		});
		const expectedEndpointKind = process.platform === "win32" ? "named-pipe" : "unix-socket";

		expect(JSON.parse(output)).toMatchObject({ daemonEndpointKind: expectedEndpointKind });
	});

	it("#given a closed output reader #when the cancellation smoke reports its result #then it cannot exit successfully", async () => {
		const result = await new Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }>(
			(resolve, reject) => {
				const child = spawn("bun", [join(packageRoot, cancellationSmoke), packageRoot], {
					cwd: packageRoot,
					stdio: ["ignore", "pipe", "ignore"],
				});
				const output = child.stdout;
				if (output === null) {
					reject(new Error("cancellation smoke stdout pipe was not created"));
					return;
				}
				const timeout = setTimeout(() => {
					child.kill();
					reject(new Error("cancellation smoke did not settle after its output reader closed"));
				}, 10_000);
				child.once("error", (error) => {
					clearTimeout(timeout);
					reject(error);
				});
				child.once("close", (code, signal) => {
					clearTimeout(timeout);
					resolve({ code, signal });
				});
				output.destroy();
			},
		);

		expect(result.code === 0 && result.signal === null).toBe(false);
	});
});
