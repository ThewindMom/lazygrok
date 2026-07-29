import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function grokUlwCli(): string {
	const modulePath = fileURLToPath(import.meta.url);
	const moduleDir = dirname(modulePath);
	const cliPath =
		basename(moduleDir) === "src"
			? resolve(moduleDir, "../dist/cli.js")
			: basename(modulePath) === "runtime-command.js"
				? join(moduleDir, "cli.js")
				: modulePath;
	return `node ${shellQuote(cliPath)}`;
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
