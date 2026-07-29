package hashline

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func writeWorkspaceConfig(t *testing.T, workspace, content string) {
	t.Helper()
	configDir := filepath.Join(workspace, ".lazygrok")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(configDir, "config.jsonc"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func mutationEvent(workspace, tool, path string) hookenv.Event {
	return hookenv.Event{
		SessionID:     "session",
		WorkspaceRoot: workspace,
		ToolName:      tool,
		ToolInput:     map[string]any{"path": path},
	}
}

func TestHashlineOffDisablesCacheContextAndValidation(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	source := filepath.Join(workspace, "source.go")
	if err := os.WriteFile(source, []byte("package source\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	writeWorkspaceConfig(t, workspace, `{"hashlineMode":"off"}`)
	t.Setenv("GROK_HOME", home)

	if err := UpdateCacheFromRead(home, "session", workspace, source); err != nil {
		t.Fatal(err)
	}
	if context := CollectContext("session", workspace); context != "" {
		t.Fatalf("off mode emitted context: %q", context)
	}
	if reason := ValidatePreTool(mutationEvent(workspace, "write", source)); reason != "" {
		t.Fatalf("off mode denied native mutation: %q", reason)
	}
}

func TestHashlinePreferCachesButAllowsUnanchoredNativeMutation(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	source := filepath.Join(workspace, "source.go")
	if err := os.WriteFile(source, []byte("package source\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_HOME", home)

	if err := UpdateCacheFromRead(home, "session", workspace, source); err != nil {
		t.Fatal(err)
	}
	if context := CollectContext("session", workspace); !strings.Contains(context, "source.go") {
		t.Fatalf("prefer mode did not emit cache context: %q", context)
	}
	if reason := ValidatePreTool(mutationEvent(workspace, "write", source)); reason != "" {
		t.Fatalf("prefer mode denied unanchored native mutation: %q", reason)
	}
}

func TestHashlineStrictDeniesNativeWorkspaceMutations(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	writeWorkspaceConfig(t, workspace, `{"hashlineMode":"strict"}`)
	t.Setenv("GROK_HOME", home)

	for _, tool := range []string{"write", "search_replace", "str_replace"} {
		reason := ValidatePreTool(mutationEvent(workspace, tool, filepath.Join(workspace, "source.go")))
		if !strings.Contains(reason, "Hashline strict mode") {
			t.Fatalf("%s was not denied by strict mode: %q", tool, reason)
		}
	}
	if reason := ValidatePreTool(mutationEvent(
		workspace,
		"write",
		filepath.Join(workspace, ".lazygrok", "state.json"),
	)); reason != "" {
		t.Fatalf("strict mode denied plugin state mutation: %q", reason)
	}
	if reason := ValidatePreTool(mutationEvent(workspace, "hashline_edit", filepath.Join(workspace, "source.go"))); reason != "" {
		t.Fatalf("strict mode denied Hashline MCP mutation: %q", reason)
	}
}

func TestNativeMutationStrictPromotesPreferToStrict(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	writeWorkspaceConfig(t, workspace, `{
		"hashlineMode":"prefer",
		"nativeMutationStrict":true
	}`)
	t.Setenv("GROK_HOME", home)

	reason := ValidatePreTool(mutationEvent(workspace, "write", filepath.Join(workspace, "source.go")))
	if !strings.Contains(reason, "Hashline strict mode") {
		t.Fatalf("nativeMutationStrict did not enforce strict behavior: %q", reason)
	}
}

func TestInvalidHashlineConfigFailsClosed(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	writeWorkspaceConfig(t, workspace, `{"hashlineMode":"invalid"}`)
	t.Setenv("GROK_HOME", home)

	reason := ValidatePreTool(mutationEvent(workspace, "write", filepath.Join(workspace, "source.go")))
	if !strings.Contains(reason, "invalid configuration") {
		t.Fatalf("invalid config did not fail closed: %q", reason)
	}
}
