package cmd

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	corehashline "lazygrok/internal/core/hashline"
)

func TestReadCommentCheckFile_rejectsWorkspaceEscapes(t *testing.T) {
	t.Parallel()

	for _, kind := range []string{"outside", "symlink", "hardlink", "directory"} {
		t.Run(kind, func(t *testing.T) {
			// Given: a comment-check path that is not a regular, unique workspace file.
			root := t.TempDir()
			workspace := filepath.Join(root, "workspace")
			if err := os.Mkdir(workspace, 0o755); err != nil {
				t.Fatal(err)
			}
			outside := filepath.Join(root, "outside.go")
			if err := os.WriteFile(outside, []byte("// outside\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			target := outside
			switch kind {
			case "symlink":
				target = filepath.Join(workspace, "link.go")
				if err := os.Symlink(outside, target); err != nil {
					t.Fatal(err)
				}
			case "hardlink":
				target = filepath.Join(workspace, "hard.go")
				if err := os.Link(outside, target); err != nil {
					t.Fatal(err)
				}
			case "directory":
				target = filepath.Join(workspace, "directory")
				if err := os.Mkdir(target, 0o755); err != nil {
					t.Fatal(err)
				}
			}

			// When: the comment hook attempts to load it.
			_, err := readCommentCheckFile(workspace, target)

			// Then: the unsafe file is ignored at the workspace boundary.
			if !errors.Is(err, corehashline.ErrUnsafeWorkspacePath) {
				t.Fatalf("error = %v, want ErrUnsafeWorkspacePath", err)
			}
		})
	}
}

func TestReadCommentCheckFile_rejectsOversizedFile(t *testing.T) {
	t.Parallel()

	// Given: a regular workspace file larger than the comment-check cap.
	workspace := t.TempDir()
	target := filepath.Join(workspace, "large.go")
	file, err := os.Create(target)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Truncate(corehashline.MaxFileSize + 1); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	// When: the hook attempts to read it.
	_, err = readCommentCheckFile(workspace, target)

	// Then: it is rejected before a whole-file allocation.
	if err == nil {
		t.Fatal("oversized comment-check file was accepted")
	}
}
