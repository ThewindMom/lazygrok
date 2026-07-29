//go:build linux

package hashline

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestReadFileInWorkspace_rejectsLinkEscapes(t *testing.T) {
	t.Parallel()

	for _, kind := range []string{"symlink", "hardlink", "parent symlink"} {
		t.Run(kind, func(t *testing.T) {
			// Given: a workspace path that aliases an outside regular file.
			root := t.TempDir()
			workspace := filepath.Join(root, "workspace")
			outsideDir := filepath.Join(root, "outside")
			if err := os.MkdirAll(workspace, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.MkdirAll(outsideDir, 0o755); err != nil {
				t.Fatal(err)
			}
			outside := filepath.Join(outsideDir, "secret.txt")
			if err := os.WriteFile(outside, []byte("outside secret\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			target := filepath.Join(workspace, "target.txt")
			switch kind {
			case "symlink":
				if err := os.Symlink(outside, target); err != nil {
					t.Fatal(err)
				}
			case "hardlink":
				if err := os.Link(outside, target); err != nil {
					t.Fatal(err)
				}
			case "parent symlink":
				if err := os.Symlink(outsideDir, filepath.Join(workspace, "linked")); err != nil {
					t.Fatal(err)
				}
				target = filepath.Join(workspace, "linked", "secret.txt")
			}

			// When: hashline reads through the workspace boundary.
			_, err := ReadFileInWorkspace(target, workspace, ReadOptions{Offset: 1})

			// Then: no linked inode outside the workspace is accepted.
			if !errors.Is(err, ErrUnsafeWorkspacePath) {
				t.Fatalf("error = %v, want ErrUnsafeWorkspacePath", err)
			}
		})
	}
}

func TestApplyEdits_rejectsLinkEscapes(t *testing.T) {
	t.Parallel()

	for _, kind := range []string{"symlink", "hardlink", "parent symlink"} {
		t.Run(kind, func(t *testing.T) {
			// Given: an editable-looking workspace path redirected outside.
			root := t.TempDir()
			workspace := filepath.Join(root, "workspace")
			outsideDir := filepath.Join(root, "outside")
			if err := os.MkdirAll(workspace, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.MkdirAll(outsideDir, 0o755); err != nil {
				t.Fatal(err)
			}
			outside := filepath.Join(outsideDir, "sentinel.txt")
			if err := os.WriteFile(outside, []byte("sentinel\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			target := filepath.Join(workspace, "target.txt")
			switch kind {
			case "symlink":
				if err := os.Symlink(outside, target); err != nil {
					t.Fatal(err)
				}
			case "hardlink":
				if err := os.Link(outside, target); err != nil {
					t.Fatal(err)
				}
			case "parent symlink":
				if err := os.Symlink(outsideDir, filepath.Join(workspace, "linked")); err != nil {
					t.Fatal(err)
				}
				target = filepath.Join(workspace, "linked", "sentinel.txt")
			}

			// When: hashline attempts a content-only edit.
			_, err := ApplyEdits(EditRequest{
				Path:  target,
				Edits: []EditOp{{Type: OpAppend, Content: "changed"}},
			}, workspace)

			// Then: the alias is rejected and the outside inode is unchanged.
			if !errors.Is(err, ErrUnsafeWorkspacePath) {
				t.Fatalf("error = %v, want ErrUnsafeWorkspacePath", err)
			}
			got, readErr := os.ReadFile(outside)
			if readErr != nil {
				t.Fatal(readErr)
			}
			if string(got) != "sentinel\n" {
				t.Fatalf("outside sentinel changed to %q", got)
			}
		})
	}
}

func TestWorkspaceTarget_replaceRemainsAnchoredAfterParentSwap(t *testing.T) {
	t.Parallel()

	// Given: an opened workspace target whose parent pathname is later swapped.
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	originalDir := filepath.Join(workspace, "safe")
	if err := os.MkdirAll(originalDir, 0o755); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(originalDir, "target.txt")
	if err := os.WriteFile(target, []byte("old\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	opened, err := openWorkspaceTarget(workspace, target)
	if err != nil {
		t.Fatal(err)
	}
	defer opened.close()

	heldDir := filepath.Join(workspace, "held")
	if err := os.Rename(originalDir, heldDir); err != nil {
		t.Fatal(err)
	}
	outsideDir := filepath.Join(root, "outside")
	if err := os.Mkdir(outsideDir, 0o755); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(outsideDir, "target.txt")
	if err := os.WriteFile(outside, []byte("sentinel\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outsideDir, originalDir); err != nil {
		t.Fatal(err)
	}

	// When: the replacement is committed through the held descriptor.
	err = opened.replace([]byte("safe\n"), 0o600, "")

	// Then: the swapped outside pathname is untouched.
	if err != nil {
		t.Fatalf("replace: %v", err)
	}
	if got, readErr := os.ReadFile(outside); readErr != nil || string(got) != "sentinel\n" {
		t.Fatalf("outside sentinel = %q, %v", got, readErr)
	}
	if got, readErr := os.ReadFile(filepath.Join(heldDir, "target.txt")); readErr != nil || string(got) != "safe\n" {
		t.Fatalf("anchored target = %q, %v", got, readErr)
	}
}

func TestWorkspaceTarget_readRemainsAnchoredAfterParentSwap(t *testing.T) {
	t.Parallel()

	// Given: an opened workspace file whose parent pathname is later swapped.
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	originalDir := filepath.Join(workspace, "safe")
	if err := os.MkdirAll(originalDir, 0o755); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(originalDir, "target.txt")
	if err := os.WriteFile(target, []byte("safe\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	opened, err := openWorkspaceTarget(workspace, target)
	if err != nil {
		t.Fatal(err)
	}
	defer opened.close()

	heldDir := filepath.Join(workspace, "held")
	if err := os.Rename(originalDir, heldDir); err != nil {
		t.Fatal(err)
	}
	outsideDir := filepath.Join(root, "outside")
	if err := os.Mkdir(outsideDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outsideDir, "target.txt"), []byte("outside\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outsideDir, originalDir); err != nil {
		t.Fatal(err)
	}

	// When: content is read through the held file descriptor.
	snapshot, err := opened.readBounded(MaxFileSize)

	// Then: the read remains on the original inode.
	if err != nil {
		t.Fatalf("readBounded: %v", err)
	}
	if string(snapshot.data) != "safe\n" {
		t.Fatalf("anchored content = %q", snapshot.data)
	}
}
