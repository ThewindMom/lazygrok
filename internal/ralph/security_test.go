package ralph

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteStateJSON_rejectsIntermediateSymlink(t *testing.T) {
	t.Parallel()

	// Given: .lazygrok redirects to an external directory.
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

	// When: Ralph persists loop state.
	err := WriteStateJSON(workspace, []byte(`{"prompt":"work","session_id":"session-safe"}`))

	// Then: the write is rejected and no external state file is created.
	if err == nil {
		t.Fatal("WriteStateJSON accepted an intermediate symlink")
	}
	if _, err := os.Stat(filepath.Join(outside, "ralph-loop.local.md")); !os.IsNotExist(err) {
		t.Fatalf("external Ralph state exists: %v", err)
	}
}

func TestWriteStateJSON_usesPrivatePermissions(t *testing.T) {
	t.Parallel()

	workspace := t.TempDir()
	if err := WriteStateJSON(
		workspace,
		[]byte(`{"prompt":"private objective","session_id":"session-safe"}`),
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
	fileInfo, err := os.Stat(filepath.Join(stateDir, "ralph-loop.local.md"))
	if err != nil {
		t.Fatal(err)
	}
	if got := fileInfo.Mode().Perm(); got != 0o600 {
		t.Fatalf("Ralph state mode = %o, want 600", got)
	}
}
