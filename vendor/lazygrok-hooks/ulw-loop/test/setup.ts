for (const key of [
	"OMO_ULW_LOOP_SESSION_ID",
	"GROK_SESSION_ID",
	"GROK_THREAD_ID",
	"CODEX_SESSION_ID",
	"CODEX_THREAD_ID",
]) {
	delete process.env[key];
}
