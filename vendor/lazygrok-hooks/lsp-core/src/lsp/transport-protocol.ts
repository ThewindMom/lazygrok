import type { Diagnostic } from "./types.js";

interface ConfigurationItem {
	readonly section?: string;
}

interface DiagnosticsParams {
	readonly uri: string;
	readonly diagnostics: Diagnostic[];
	readonly version?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseConfigurationItems(params: unknown): ConfigurationItem[] {
	if (!isRecord(params) || !Array.isArray(params["items"])) return [];
	const items: ConfigurationItem[] = [];
	for (const item of params["items"]) {
		if (!isRecord(item)) continue;
		const section = item["section"];
		items.push(section === undefined || typeof section !== "string" ? {} : { section });
	}
	return items;
}

export function parseDiagnosticsParams(params: unknown): DiagnosticsParams | null {
	if (!isRecord(params) || typeof params["uri"] !== "string") return null;
	const diagnostics = Array.isArray(params["diagnostics"]) ? params["diagnostics"].filter(isDiagnostic) : [];
	const version = typeof params["version"] === "number" ? params["version"] : undefined;
	return { uri: params["uri"], diagnostics, ...(version === undefined ? {} : { version }) };
}

export function createLspSpawnEnv(
	_root: string,
	ambient: Record<string, string | undefined>,
	configured: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
	const safeAmbient: Record<string, string> = {};
	for (const [key, value] of Object.entries(ambient)) {
		if (value !== undefined && isAllowedAmbientEnv(key)) safeAmbient[key] = value;
	}
	return { ...safeAmbient, ...configured };
}

const SAFE_AMBIENT_ENV = new Set([
	"PATH",
	"PATHEXT",
	"SYSTEMROOT",
	"WINDIR",
	"COMSPEC",
	"HOME",
	"USERPROFILE",
	"TMPDIR",
	"TMP",
	"TEMP",
	"LANG",
	"SHELL",
	"XDG_CACHE_HOME",
	"XDG_CONFIG_HOME",
	"XDG_DATA_HOME",
	"XDG_STATE_HOME",
	"CARGO_HOME",
	"RUSTUP_HOME",
	"GOPATH",
	"GOROOT",
	"GOMODCACHE",
	"GOCACHE",
	"GOTOOLCHAIN",
	"GOENV",
	"VIRTUAL_ENV",
	"PYENV_ROOT",
	"CONDA_PREFIX",
	"NVM_BIN",
	"VOLTA_HOME",
	"BUN_INSTALL",
	"DENO_INSTALL",
	"JAVA_HOME",
	"GRADLE_USER_HOME",
	"MAVEN_HOME",
	"DOTNET_ROOT",
	"NUGET_PACKAGES",
	"GEM_HOME",
	"GEM_PATH",
	"RBENV_ROOT",
]);

function isAllowedAmbientEnv(key: string): boolean {
	const normalized = key.toUpperCase();
	return SAFE_AMBIENT_ENV.has(normalized) || normalized.startsWith("LC_");
}

function isDiagnostic(value: unknown): value is Diagnostic {
	return isRecord(value) && isRange(value["range"]) && typeof value["message"] === "string";
}

function isRange(value: unknown): value is Diagnostic["range"] {
	return isRecord(value) && isPosition(value["start"]) && isPosition(value["end"]);
}

function isPosition(value: unknown): value is Diagnostic["range"]["start"] {
	return isRecord(value) && typeof value["line"] === "number" && typeof value["character"] === "number";
}
