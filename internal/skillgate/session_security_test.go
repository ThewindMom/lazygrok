package skillgate

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCleanupSession_rejectsTraversal(t *testing.T) {
	// Given: a traversal session that resolves to an external sentinel.
	root := t.TempDir()
	grokHome := filepath.Join(root, "grok-home")
	outside := filepath.Join(root, "escaped-dir")
	t.Setenv("GROK_HOME", grokHome)
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	sentinel := filepath.Join(outside, "sentinel.txt")
	if err := os.WriteFile(sentinel, []byte("preserve"), 0o600); err != nil {
		t.Fatal(err)
	}

	// When: skill-gate cleanup receives the hostile identifier directly.
	CleanupSession("../../../escaped-dir")

	// Then: no state path is returned and the external sentinel survives.
	if path := SessionDir("../../../escaped-dir"); path != "" {
		t.Fatalf("SessionDir returned unsafe path %q", path)
	}
	if got, err := os.ReadFile(sentinel); err != nil || string(got) != "preserve" {
		t.Fatalf("outside sentinel = %q, %v", got, err)
	}
}

func TestMarkSkillLoadedRejectsSymlinkedState(t *testing.T) {
	root := t.TempDir()
	t.Setenv("GROK_HOME", root)
	stateDir := filepath.Join(root, "state", "skill-gate", "session")
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "sentinel.txt")
	if err := os.WriteFile(outside, []byte("sentinel"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(stateDir, "skills.loaded")); err != nil {
		t.Fatal(err)
	}

	if err := MarkSkillLoaded("session", "ultrawork"); err == nil {
		t.Fatal("MarkSkillLoaded accepted a symlinked state file")
	}
	if got, err := os.ReadFile(outside); err != nil || string(got) != "sentinel" {
		t.Fatalf("outside sentinel = %q, %v", got, err)
	}
}
