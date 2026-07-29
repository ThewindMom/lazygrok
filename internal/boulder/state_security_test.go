package boulder

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestSetContinuationStopped_rejectsSymlinkMarkerDirectory(t *testing.T) {
	// Given: the workspace continuation marker directory redirects outside.
	root := t.TempDir()
	grokHome := filepath.Join(root, "grok-home")
	t.Setenv("GROK_HOME", grokHome)
	if err := os.MkdirAll(grokHome, 0o700); err != nil {
		t.Fatal(err)
	}
	workspace := filepath.Join(root, "workspace")
	outside := filepath.Join(root, "outside")
	if err := os.MkdirAll(filepath.Join(workspace, ".lazygrok"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(workspace, ".lazygrok", "run-continuation")); err != nil {
		t.Fatal(err)
	}

	// When: continuation is stopped.
	err := SetContinuationStopped(workspace, "session-safe")

	// Then: the workspace marker write fails and creates no external file.
	if err == nil {
		t.Fatal("SetContinuationStopped accepted an intermediate symlink")
	}
	if _, err := os.Stat(filepath.Join(outside, "session-safe.json")); !os.IsNotExist(err) {
		t.Fatalf("external continuation marker exists: %v", err)
	}
}

func TestMirrorTodos_rejectsHardlinkTarget(t *testing.T) {
	t.Parallel()

	// Given: the todo mirror target is a hard link to an external sentinel.
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	target := filepath.Join(workspace, ".lazygrok", "todos", "session-safe.json")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(root, "outside.json")
	if err := os.WriteFile(outside, []byte("sentinel"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Link(outside, target); err != nil {
		t.Fatal(err)
	}

	// When: todos are mirrored.
	err := MirrorTodos(workspace, "session-safe", []map[string]any{{"status": "pending"}})

	// Then: the unsafe target is rejected and the external inode is unchanged.
	if err == nil {
		t.Fatal("MirrorTodos accepted a hardlink target")
	}
	got, err := os.ReadFile(outside)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "sentinel" {
		t.Fatalf("outside sentinel changed to %q", got)
	}
}

func TestStopContinuationPreservesSharedBoulderState(t *testing.T) {
	root := t.TempDir()
	grokHome := filepath.Join(root, "grok-home")
	t.Setenv("GROK_HOME", grokHome)
	if err := os.MkdirAll(filepath.Join(grokHome, "state", "stop-continuation", "other-session"), 0o700); err != nil {
		t.Fatal(err)
	}
	workspace := filepath.Join(root, "workspace")
	if err := os.MkdirAll(filepath.Join(workspace, ".lazygrok", continuationMarkerDir), 0o700); err != nil {
		t.Fatal(err)
	}
	if !writeBoulder(workspace, map[string]any{
		"active_work_id": "work-1",
		"session_ids":    []any{"owner-session"},
		"works": map[string]any{
			"work-1": map[string]any{"session_ids": []any{"owner-session"}},
		},
	}) {
		t.Fatal("writeBoulder failed")
	}

	message := CollectStopContinuation(hookenv.Event{
		WorkspaceRoot: workspace,
		SessionID:     "other-session",
		Prompt:        "/stop-continuation",
	})

	if !strings.Contains(message, "Shared boulder state remains intact") {
		t.Fatalf("message = %q, want shared-state notice", message)
	}
	if state := readBoulder(workspace); state == nil {
		t.Fatal("session-local stop removed shared boulder state")
	}
}
