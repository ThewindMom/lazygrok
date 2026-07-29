//go:build linux

package ulwbridge

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadPlanUsesExactSessionAndRejectsSymlink(t *testing.T) {
	workspace := t.TempDir()
	foreignDir := filepath.Join(workspace, ".lazygrok", "ulw-loop", "foreign")
	if err := os.MkdirAll(foreignDir, 0o700); err != nil {
		t.Fatal(err)
	}
	foreign := `{"goals":[{"id":"foreign","objective":"foreign objective","status":"active"}]}`
	if err := os.WriteFile(filepath.Join(foreignDir, "goals.json"), []byte(foreign), 0o600); err != nil {
		t.Fatal(err)
	}
	if plan := readPlan(workspace, "current"); plan != nil {
		t.Fatalf("current session consumed foreign plan: %#v", plan)
	}

	currentDir := filepath.Join(workspace, ".lazygrok", "ulw-loop", "current")
	if err := os.MkdirAll(currentDir, 0o700); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "goals.json")
	if err := os.WriteFile(outside, []byte(foreign), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(currentDir, "goals.json")); err != nil {
		t.Fatal(err)
	}
	if plan := readPlan(workspace, "current"); plan != nil {
		t.Fatalf("symlinked plan was consumed: %#v", plan)
	}
}
