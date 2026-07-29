//go:build linux

package safestate

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestWriteFile_rejectsSymlinkAndHardlinkTargets(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		setup func(t *testing.T, workspace, outside, target string)
	}{
		{
			name: "direct symlink",
			setup: func(t *testing.T, workspace, outside, target string) {
				t.Helper()
				if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink(outside, target); err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			name: "intermediate symlink",
			setup: func(t *testing.T, workspace, outside, target string) {
				t.Helper()
				if err := os.Mkdir(filepath.Join(workspace, ".lazygrok"), 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink(filepath.Dir(outside), filepath.Join(workspace, ".lazygrok", "todos")); err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			name: "hardlink",
			setup: func(t *testing.T, workspace, outside, target string) {
				t.Helper()
				if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.Link(outside, target); err != nil {
					t.Fatal(err)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Given: a workspace state target redirected to an external sentinel.
			root := t.TempDir()
			workspace := filepath.Join(root, "workspace")
			outsideDir := filepath.Join(root, "outside")
			if err := os.MkdirAll(workspace, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.MkdirAll(outsideDir, 0o755); err != nil {
				t.Fatal(err)
			}
			outside := filepath.Join(outsideDir, "sentinel.json")
			if err := os.WriteFile(outside, []byte("sentinel"), 0o600); err != nil {
				t.Fatal(err)
			}
			target := filepath.Join(workspace, ".lazygrok", "todos", "session.json")
			tt.setup(t, workspace, outside, target)

			// When: state code attempts to overwrite the workspace target.
			err := WriteFile(target, []byte("changed"), 0o600)

			// Then: the unsafe target is rejected and the external inode is unchanged.
			if err == nil {
				t.Fatal("WriteFile accepted an unsafe target")
			}
			got, readErr := os.ReadFile(outside)
			if readErr != nil {
				t.Fatal(readErr)
			}
			if string(got) != "sentinel" {
				t.Fatalf("outside sentinel changed to %q", got)
			}
		})
	}
}

func TestWriteFile_repairsStatePermissions(t *testing.T) {
	t.Parallel()

	workspace := t.TempDir()
	stateDir := filepath.Join(workspace, ".lazygrok")
	target := filepath.Join(stateDir, "continuation.json")
	if err := os.Mkdir(stateDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := WriteFile(target, []byte("new"), 0o600); err != nil {
		t.Fatal(err)
	}
	dirInfo, err := os.Stat(stateDir)
	if err != nil {
		t.Fatal(err)
	}
	if got := dirInfo.Mode().Perm(); got != 0o700 {
		t.Fatalf("state directory mode = %o, want 700", got)
	}
	fileInfo, err := os.Stat(target)
	if err != nil {
		t.Fatal(err)
	}
	if got := fileInfo.Mode().Perm(); got != 0o600 {
		t.Fatalf("state file mode = %o, want 600", got)
	}
}

func TestReadAndRemove_rejectHardlinkTarget(t *testing.T) {
	t.Parallel()

	// Given: a workspace state entry hard-linked to an external inode.
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	target := filepath.Join(workspace, ".lazygrok", "boulder.json")
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

	// When: state code attempts to read and delete the hard-linked entry.
	_, readErr := ReadFile(target)
	removeErr := Remove(target)

	// Then: both operations reject the multi-link inode and preserve both names.
	if readErr == nil || removeErr == nil {
		t.Fatalf("ReadFile error = %v, Remove error = %v", readErr, removeErr)
	}
	if _, err := os.Stat(target); err != nil {
		t.Fatalf("workspace hardlink removed: %v", err)
	}
	if got, err := os.ReadFile(outside); err != nil || string(got) != "sentinel" {
		t.Fatalf("outside sentinel = %q, %v", got, err)
	}
}

func TestReadFile_rejectsOversizedRegularFile(t *testing.T) {
	t.Parallel()

	// Given: a private state file larger than the global state read cap.
	workspace := t.TempDir()
	target := filepath.Join(workspace, ".lazygrok", "oversized.json")
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		t.Fatal(err)
	}
	file, err := os.Create(target)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Truncate(MaxReadBytes + 1); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	// When: safestate loads the file.
	_, err = ReadFile(target)

	// Then: it rejects the file at the descriptor boundary.
	if !errors.Is(err, ErrFileTooLarge) {
		t.Fatalf("error = %v, want ErrFileTooLarge", err)
	}
}

func TestWriteFileAt_remainsAnchoredWhenParentPathIsSwapped(t *testing.T) {
	t.Parallel()

	// Given: a verified parent descriptor, then a hostile path swap to an outside symlink.
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	stateDir := filepath.Join(workspace, ".lazygrok")
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatal(err)
	}
	parentFD, leaf, err := openParent(filepath.Join(stateDir, "boulder.json"), true)
	if err != nil {
		t.Fatalf("openParent: %v", err)
	}
	defer closeFD(parentFD)

	heldDir := filepath.Join(workspace, ".lazygrok-held")
	if err := os.Rename(stateDir, heldDir); err != nil {
		t.Fatal(err)
	}
	outsideDir := filepath.Join(root, "outside")
	if err := os.Mkdir(outsideDir, 0o755); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(outsideDir, "boulder.json")
	if err := os.WriteFile(outside, []byte("sentinel"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outsideDir, stateDir); err != nil {
		t.Fatal(err)
	}

	// When: the mutation runs relative to the already-open parent descriptor.
	err = writeFileAt(parentFD, leaf, []byte("safe"), 0o600)

	// Then: the held directory receives the write and the swapped path is untouched.
	if err != nil {
		t.Fatalf("writeFileAt: %v", err)
	}
	if got, err := os.ReadFile(outside); err != nil || string(got) != "sentinel" {
		t.Fatalf("outside sentinel = %q, %v", got, err)
	}
	got, err := os.ReadFile(filepath.Join(heldDir, "boulder.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "safe" {
		t.Fatalf("anchored write = %q", got)
	}
}

func TestWriteFile_rejectsPathOutsideWorkspaceState(t *testing.T) {
	t.Parallel()

	err := WriteFile(filepath.Join(t.TempDir(), "ordinary.json"), []byte("{}"), 0o600)
	if !errors.Is(err, ErrUnsafePath) {
		t.Fatalf("error = %v, want ErrUnsafePath", err)
	}
}

func TestWriteFileBelowRepairsPermissionsAndRejectsEscapes(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	stateDir := filepath.Join(root, "state", "lsp-diagnostics")
	target := filepath.Join(stateDir, "session.json")
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := WriteFileBelow(root, target, []byte("safe"), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, directory := range []string{filepath.Join(root, "state"), stateDir} {
		info, err := os.Stat(directory)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != 0o700 {
			t.Fatalf("%s mode = %o, want 700", directory, got)
		}
	}
	info, err := os.Stat(target)
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("file mode = %o, want 600", got)
	}
	if err := WriteFileBelow(root, filepath.Join(root, "..", "escaped.json"), []byte("bad"), 0o600); !errors.Is(err, ErrUnsafePath) {
		t.Fatalf("escape error = %v, want ErrUnsafePath", err)
	}
}

func TestListFileNamesBelowRejectsSymlinkedDirectory(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "secret.json"), []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	stateRoot := filepath.Join(root, "state")
	if err := os.Mkdir(stateRoot, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(stateRoot, "cache")); err != nil {
		t.Fatal(err)
	}

	if _, err := ListFileNamesBelow(root, filepath.Join(stateRoot, "cache")); err == nil {
		t.Fatal("ListFileNamesBelow accepted a symlinked state directory")
	}
}

func TestWriteFileBelow_rejectsSymlinkAndHardlinkTargets(t *testing.T) {
	t.Parallel()

	for _, kind := range []string{"symlink", "hardlink"} {
		t.Run(kind, func(t *testing.T) {
			root := t.TempDir()
			stateDir := filepath.Join(root, "state", "lsp-diagnostics")
			if err := os.MkdirAll(stateDir, 0o700); err != nil {
				t.Fatal(err)
			}
			outside := filepath.Join(t.TempDir(), "sentinel.json")
			if err := os.WriteFile(outside, []byte("sentinel"), 0o600); err != nil {
				t.Fatal(err)
			}
			target := filepath.Join(stateDir, "session.json")
			var err error
			if kind == "symlink" {
				err = os.Symlink(outside, target)
			} else {
				err = os.Link(outside, target)
			}
			if err != nil {
				t.Fatal(err)
			}

			err = WriteFileBelow(root, target, []byte("changed"), 0o600)
			if err == nil {
				t.Fatal("WriteFileBelow accepted an unsafe target")
			}
			got, readErr := os.ReadFile(outside)
			if readErr != nil {
				t.Fatal(readErr)
			}
			if string(got) != "sentinel" {
				t.Fatalf("outside sentinel changed to %q", got)
			}
		})
	}
}

func TestAppendFileBelow_repairsPermissionsAndRejectsUnsafeTargets(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	stateDir := filepath.Join(root, "state", "lazygrok", "diagnostics", "session")
	target := filepath.Join(stateDir, "events.jsonl")
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("first\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := AppendFileBelow(root, target, []byte("second\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(target)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "first\nsecond\n" {
		t.Fatalf("appended bytes = %q", got)
	}
	for _, path := range []string{
		filepath.Join(root, "state"),
		filepath.Join(root, "state", "lazygrok"),
		filepath.Join(root, "state", "lazygrok", "diagnostics"),
		stateDir,
	} {
		info, statErr := os.Stat(path)
		if statErr != nil {
			t.Fatal(statErr)
		}
		if mode := info.Mode().Perm(); mode != 0o700 {
			t.Fatalf("%s mode = %o, want 700", path, mode)
		}
	}
	info, err := os.Stat(target)
	if err != nil {
		t.Fatal(err)
	}
	if mode := info.Mode().Perm(); mode != 0o600 {
		t.Fatalf("file mode = %o, want 600", mode)
	}

	for _, kind := range []string{"symlink", "hardlink"} {
		t.Run(kind, func(t *testing.T) {
			unsafeRoot := t.TempDir()
			unsafeDir := filepath.Join(unsafeRoot, "state")
			if err := os.Mkdir(unsafeDir, 0o700); err != nil {
				t.Fatal(err)
			}
			outside := filepath.Join(t.TempDir(), "sentinel.jsonl")
			if err := os.WriteFile(outside, []byte("sentinel\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			unsafeTarget := filepath.Join(unsafeDir, "events.jsonl")
			var linkErr error
			if kind == "symlink" {
				linkErr = os.Symlink(outside, unsafeTarget)
			} else {
				linkErr = os.Link(outside, unsafeTarget)
			}
			if linkErr != nil {
				t.Fatal(linkErr)
			}
			if err := AppendFileBelow(unsafeRoot, unsafeTarget, []byte("changed\n"), 0o600); err == nil {
				t.Fatal("AppendFileBelow accepted an unsafe target")
			}
			if got, err := os.ReadFile(outside); err != nil || string(got) != "sentinel\n" {
				t.Fatalf("outside sentinel = %q, %v", got, err)
			}
		})
	}
}
