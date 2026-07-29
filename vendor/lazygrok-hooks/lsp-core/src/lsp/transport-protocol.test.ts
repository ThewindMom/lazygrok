import { describe, expect, it } from "bun:test";

import { createLspSpawnEnv } from "./transport-protocol.js";

describe("LSP child process environment", () => {
	it("#given ambient secrets and an explicit server overlay #when building spawn env #then only safe ambient keys and configured values cross", () => {
		const env = createLspSpawnEnv(
			"/workspace",
			{
				PATH: "/toolchain/bin",
				HOME: "/home/test",
				LANG: "C.UTF-8",
				UNRELATED_SECRET: "must-not-cross",
			},
			{
				SERVER_LICENSE_TOKEN: "explicit-server-value",
				LANG: "server-locale",
			},
		);

		expect(env).toEqual({
			PATH: "/toolchain/bin",
			HOME: "/home/test",
			LANG: "server-locale",
			SERVER_LICENSE_TOKEN: "explicit-server-value",
		});
		expect(env["UNRELATED_SECRET"]).toBeUndefined();
	});
});
