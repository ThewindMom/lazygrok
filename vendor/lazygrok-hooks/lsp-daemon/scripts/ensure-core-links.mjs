import { lstatSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packagesRoot = dirname(packageRoot);
const linkPath = join(
	packagesRoot,
	"lsp-core",
	"node_modules",
	"@oh-my-opencode",
	"mcp-stdio-core",
);
const targetPath = join(packagesRoot, "mcp-stdio-core");

mkdirSync(dirname(linkPath), { recursive: true });
if (!pathExists(linkPath)) {
	const linkTarget = relative(dirname(linkPath), targetPath);
	symlinkSync(linkTarget, linkPath, process.platform === "win32" ? "junction" : "dir");
}

function pathExists(path) {
	try {
		lstatSync(path);
		return true;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return false;
		}
		throw error;
	}
}
