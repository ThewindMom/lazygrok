package intentgate

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestCollectHonorsWorkspaceConfiguration(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	configDir := filepath.Join(workspace, ".lazygrok")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(configDir, "config.jsonc"),
		[]byte(`{"intentGateEnabled":false}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_HOME", home)

	context := Collect(hookenv.Event{WorkspaceRoot: workspace, Prompt: "analyze this"})
	if context != "" {
		t.Fatalf("disabled intent gate emitted context: %q", context)
	}
}

func TestCollectUsesTypedEnvironmentOverride(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	configDir := filepath.Join(workspace, ".lazygrok")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(configDir, "config.jsonc"),
		[]byte(`{"intentGateEnabled":false}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_HOME", home)
	t.Setenv("LAZYGROK_INTENT_GATE", "true")

	context := Collect(hookenv.Event{WorkspaceRoot: workspace, Prompt: "analyze this"})
	if !strings.Contains(context, "<INTENT_GATE>") {
		t.Fatalf("environment override did not enable intent gate: %q", context)
	}
}

func TestCollectFailsClosedOnInvalidConfiguration(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	configDir := filepath.Join(workspace, ".lazygrok")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(configDir, "config.jsonc"),
		[]byte(`{"intentGateEnabled":"invalid"}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_HOME", home)

	if context := Collect(hookenv.Event{WorkspaceRoot: workspace, Prompt: "analyze this"}); context != "" {
		t.Fatalf("invalid config emitted intent context: %q", context)
	}
}
