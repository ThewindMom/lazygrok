package continuation

import (
	"os"
	"path/filepath"
	"testing"

	"lazygrok/internal/core/config"
)

func TestStartLoop_rejectsIntermediateSymlink(t *testing.T) {
	t.Parallel()

	// Given: workspace continuation state is redirected outside.
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	outside := filepath.Join(root, "outside")
	if err := os.MkdirAll(workspace, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(workspace, ".lazygrok")); err != nil {
		t.Fatal(err)
	}

	// When: the core continuation layer starts a loop.
	err := StartLoop(workspace, "ralph", "work", "done", "session-safe", config.Defaults())

	// Then: persistence fails and no outside continuation state is created.
	if err == nil {
		t.Fatal("StartLoop accepted an intermediate symlink")
	}
	if _, err := os.Stat(filepath.Join(outside, "continuation.json")); !os.IsNotExist(err) {
		t.Fatalf("external continuation state exists: %v", err)
	}
}

func TestStartLoop_usesPrivatePermissions(t *testing.T) {
	t.Parallel()

	workspace := t.TempDir()
	if err := StartLoop(
		workspace,
		"ralph",
		"private objective",
		"done",
		"session-safe",
		config.Defaults(),
	); err != nil {
		t.Fatal(err)
	}
	stateDir := filepath.Join(workspace, ".lazygrok")
	dirInfo, err := os.Stat(stateDir)
	if err != nil {
		t.Fatal(err)
	}
	if got := dirInfo.Mode().Perm(); got != 0o700 {
		t.Fatalf("state directory mode = %o, want 700", got)
	}
	fileInfo, err := os.Stat(filepath.Join(stateDir, "continuation.json"))
	if err != nil {
		t.Fatal(err)
	}
	if got := fileInfo.Mode().Perm(); got != 0o600 {
		t.Fatalf("continuation state mode = %o, want 600", got)
	}
}

func TestEvaluateStop_failsClosedOnMalformedState(t *testing.T) {
	workspace := t.TempDir()
	stateDir := filepath.Join(workspace, ".lazygrok")
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stateDir, "continuation.json"), []byte("{malformed"), 0o600); err != nil {
		t.Fatal(err)
	}

	result := EvaluateStop(workspace, t.TempDir(), "session-safe", config.Defaults())

	if !result.ShouldContinue || result.Reason != "state_persistence_failed" {
		t.Fatalf("result = %#v, want fail-closed persistence result", result)
	}
}
