package prometheus_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/prometheus"
)

func TestDenyWriteOutsideOmgDuringPlanMode(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("GROK_HOME", tmp)
	t.Setenv("LAZYGROK_PLAN_MODE", "1")

	ev := hookenv.Event{
		ToolName:      "Write",
		WorkspaceRoot: tmp,
		ToolInput: map[string]any{
			"path": filepath.Join(tmp, "src", "foo.ts"),
		},
	}
	got := prometheus.DenyIfPlanMode(ev)
	if got == "" {
		t.Fatal("expected deny")
	}
	if !strings.Contains(got, "foo.ts") {
		t.Fatalf("unexpected reason: %q", got)
	}
}

func TestAllowOmgMdDuringPlanMode(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("GROK_HOME", tmp)
	t.Setenv("LAZYGROK_PLAN_MODE", "1")

	ev := hookenv.Event{
		ToolName:      "Write",
		WorkspaceRoot: tmp,
		ToolInput: map[string]any{
			"path": filepath.Join(tmp, ".lazygrok", "plans", "auth.md"),
		},
	}
	if got := prometheus.DenyIfPlanMode(ev); got != "" {
		t.Fatalf("expected allow, got %q", got)
	}
}

func TestPlanModeFlagFile(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("GROK_HOME", tmp)
	t.Setenv("LAZYGROK_PLAN_MODE", "")
	session := "sess-1"
	flag := filepath.Join(tmp, "state", "plan-mode", session, "enabled")
	if err := os.MkdirAll(filepath.Dir(flag), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(flag, []byte("ok\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	ev := hookenv.Event{
		SessionID: session,
		ToolName:  "Write",
		ToolInput: map[string]any{"path": "src/foo.ts"},
	}
	if got := prometheus.DenyIfPlanMode(ev); got == "" {
		t.Fatal("expected deny from flag file")
	}
}

