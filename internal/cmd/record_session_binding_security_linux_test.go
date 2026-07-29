//go:build linux

package cmd

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestRecordSessionBindingUsesConfiguredGrokHome(t *testing.T) {
	grokHome := t.TempDir()
	workspace := t.TempDir()
	t.Setenv("GROK_HOME", grokHome)

	if err := recordSessionBinding(hookenv.Event{
		SessionID:     "configured-home",
		WorkspaceRoot: workspace,
	}); err != nil {
		t.Fatal(err)
	}
	matches, err := filepath.Glob(filepath.Join(grokHome, "state", "lazygrok", "session-bindings", "*.json"))
	if err != nil {
		t.Fatal(err)
	}
	if len(matches) != 1 {
		t.Fatalf("binding files = %d, want 1", len(matches))
	}
	info, err := os.Stat(matches[0])
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("binding mode = %v, want 600", info.Mode().Perm())
	}
}

func TestRecordSessionBindingRejectsSymlinkedStateRoot(t *testing.T) {
	grokHome := t.TempDir()
	workspace := t.TempDir()
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(grokHome, "state")); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_HOME", grokHome)

	err := recordSessionBinding(hookenv.Event{
		SessionID:     "symlink-state",
		WorkspaceRoot: workspace,
	})
	if err == nil {
		t.Fatal("symlinked state root was accepted")
	}
	entries, err := os.ReadDir(outside)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("outside entries = %d, want 0", len(entries))
	}
}

func TestRecordSessionBindingRejectsHardlinkedTarget(t *testing.T) {
	grokHome := t.TempDir()
	workspace := t.TempDir()
	outside := filepath.Join(t.TempDir(), "outside.json")
	const original = "do not replace"
	if err := os.WriteFile(outside, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(workspace))
	workspaceHash := hex.EncodeToString(sum[:])
	bindingDir := filepath.Join(grokHome, "state", "lazygrok", "session-bindings")
	if err := os.MkdirAll(bindingDir, 0o700); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(bindingDir, workspaceHash+"-hardlink-target.json")
	if err := os.Link(outside, target); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_HOME", grokHome)

	err := recordSessionBinding(hookenv.Event{
		SessionID:     "hardlink-target",
		WorkspaceRoot: workspace,
	})
	if err == nil {
		t.Fatal("hardlinked binding target was accepted")
	}
	got, err := os.ReadFile(outside)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != original {
		t.Fatalf("outside file changed to %q", got)
	}
}
