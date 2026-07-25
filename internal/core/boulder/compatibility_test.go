package boulder

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadCurrent_whenLegacyStateExists_preservesFile(t *testing.T) {
	// Given: a legacy snake_case state file owned by the compatibility pipeline.
	workspace := t.TempDir()
	path := filepath.Join(workspace, ".lazygrok", "boulder.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create state dir: %v", err)
	}
	original := []byte("{\"schema_version\":2,\"active_work_id\":\"legacy\"}\n")
	if err := os.WriteFile(path, original, 0o644); err != nil {
		t.Fatalf("write legacy state: %v", err)
	}

	// When: the current-format loader reaches the compatibility boundary.
	_, err := LoadCurrent(workspace)

	// Then: it defers without modifying the legacy state.
	if !errors.Is(err, errLegacyStateFormat) {
		t.Fatalf("LoadCurrent error = %v, want %v", err, errLegacyStateFormat)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read legacy state: %v", err)
	}
	if !bytes.Equal(got, original) {
		t.Fatalf("legacy state was modified:\ngot  %s\nwant %s", got, original)
	}
}
