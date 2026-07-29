//go:build linux

package hashline

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUpdateCacheFromReadRejectsFilesOutsideWorkspace(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	external := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(external, []byte("external-secret\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_HOME", home)

	if err := UpdateCacheFromRead(home, "session", workspace, external); err != nil {
		t.Fatal(err)
	}
	if context := CollectContext("session", workspace); context != "" {
		t.Fatalf("external file reached model context: %q", context)
	}
}

func TestUpdateCacheFromReadRejectsLinkedWorkspaceTargets(t *testing.T) {
	for _, kind := range []string{"symlink", "hardlink"} {
		t.Run(kind, func(t *testing.T) {
			home := t.TempDir()
			workspace := t.TempDir()
			external := filepath.Join(t.TempDir(), "secret.txt")
			if err := os.WriteFile(external, []byte("external-secret\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			target := filepath.Join(workspace, "linked.txt")
			var err error
			if kind == "symlink" {
				err = os.Symlink(external, target)
			} else {
				err = os.Link(external, target)
			}
			if err != nil {
				t.Fatal(err)
			}
			t.Setenv("GROK_HOME", home)

			if err := UpdateCacheFromRead(home, "session", workspace, target); err != nil {
				t.Fatal(err)
			}
			if context := CollectContext("session", workspace); context != "" {
				t.Fatalf("%s target reached model context: %q", kind, context)
			}
		})
	}
}

func TestUpdateCacheFromReadCachesBoundedRegularWorkspaceFile(t *testing.T) {
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
	context := CollectContext("session", workspace)
	if !strings.Contains(context, "source.go") {
		t.Fatalf("workspace file missing from context: %q", context)
	}
	if strings.Contains(context, workspace) {
		t.Fatalf("context exposed absolute workspace path: %q", context)
	}
}

func TestUpdateCacheFromReadPreservesWorkspaceDirectoryPermissions(t *testing.T) {
	home := t.TempDir()
	workspace := t.TempDir()
	nested := filepath.Join(workspace, "public", "source")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(nested, "source.go")
	if err := os.WriteFile(source, []byte("package source\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_HOME", home)

	if err := UpdateCacheFromRead(home, "session", workspace, source); err != nil {
		t.Fatal(err)
	}
	for _, directory := range []string{filepath.Join(workspace, "public"), nested} {
		info, err := os.Stat(directory)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != 0o755 {
			t.Fatalf("%s mode changed to %o, want 755", directory, got)
		}
	}
}

func TestCollectContextRejectsLegacyExternalCachePath(t *testing.T) {
	home := t.TempDir()
	t.Setenv("GROK_HOME", home)
	cacheDir := filepath.Join(home, "state", "hashline", "session")
	if err := os.MkdirAll(cacheDir, 0o700); err != nil {
		t.Fatal(err)
	}
	payload := `{"rel_path":"../../etc/hostname","path":"/etc/hostname","updated_at":"2026-07-29T00:00:00+00:00","lines":{"1":"AB"}}`
	if err := os.WriteFile(filepath.Join(cacheDir, "legacy.json"), []byte(payload), 0o600); err != nil {
		t.Fatal(err)
	}

	if context := CollectContext("session", t.TempDir()); context != "" {
		t.Fatalf("legacy external cache reached model context: %q", context)
	}
}
