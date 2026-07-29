package safestate

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var (
	ErrFileTooLarge        = errors.New("lazygrok state file exceeds read limit")
	ErrUnsafePath          = errors.New("unsafe lazygrok state path")
	ErrUnsafeTarget        = errors.New("unsafe lazygrok state target")
	ErrUnsupportedPlatform = errors.New("descriptor-anchored lazygrok state is unsupported on this platform")
)

const MaxReadBytes int64 = 10 << 20

func statePathParts(path string) (string, []string, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", nil, fmt.Errorf("%w: %v", ErrUnsafePath, err)
	}
	clean := filepath.Clean(absolute)
	volume := filepath.VolumeName(clean)
	withoutVolume := strings.TrimPrefix(clean, volume)
	parts := strings.FieldsFunc(withoutVolume, func(r rune) bool {
		return r == '/' || r == '\\'
	})
	stateIndex := -1
	for i, part := range parts {
		if part == ".lazygrok" {
			stateIndex = i
		}
	}
	if stateIndex < 0 || stateIndex == len(parts)-1 {
		return "", nil, fmt.Errorf("%w: %s", ErrUnsafePath, path)
	}
	for _, part := range parts[stateIndex:] {
		if !safeSegment(part) {
			return "", nil, fmt.Errorf("%w: %s", ErrUnsafePath, path)
		}
	}
	workspace := volume + string(filepath.Separator) + filepath.Join(parts[:stateIndex]...)
	return workspace, parts[stateIndex:], nil
}

func pathPartsBelow(root, path string) (string, []string, error) {
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return "", nil, fmt.Errorf("%w: %v", ErrUnsafePath, err)
	}
	absolutePath, err := filepath.Abs(path)
	if err != nil {
		return "", nil, fmt.Errorf("%w: %v", ErrUnsafePath, err)
	}
	cleanRoot := filepath.Clean(absoluteRoot)
	cleanPath := filepath.Clean(absolutePath)
	relative, err := filepath.Rel(cleanRoot, cleanPath)
	if err != nil || relative == "." || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", nil, fmt.Errorf("%w: %s is not below %s", ErrUnsafePath, path, root)
	}
	parts := strings.FieldsFunc(relative, func(r rune) bool {
		return r == '/' || r == '\\'
	})
	if len(parts) == 0 {
		return "", nil, fmt.Errorf("%w: %s", ErrUnsafePath, path)
	}
	for _, part := range parts {
		if !safeSegment(part) {
			return "", nil, fmt.Errorf("%w: %s", ErrUnsafePath, path)
		}
	}
	return cleanRoot, parts, nil
}

func safeSegment(segment string) bool {
	return segment != "" &&
		segment != "." &&
		segment != ".." &&
		!strings.ContainsAny(segment, `/\`)
}

func IsPath(path string) bool {
	_, _, err := statePathParts(path)
	return err == nil
}

func ReadFile(path string) ([]byte, error) {
	return readFile(path)
}

func WriteFile(path string, data []byte, perm os.FileMode) error {
	return writeFile(path, data, perm)
}

func Remove(path string) error {
	return removeFile(path)
}

func ReadFileBelow(root, path string) ([]byte, error) {
	return readFileBelow(root, path)
}

func WriteFileBelow(root, path string, data []byte, perm os.FileMode) error {
	return writeFileBelow(root, path, data, perm)
}

func AppendFileBelow(root, path string, data []byte, perm os.FileMode) error {
	return appendFileBelow(root, path, data, perm)
}

func WithFileLockBelow(root, path string, action func() error) error {
	return withFileLockBelow(root, path, action)
}

func RemoveBelow(root, path string) error {
	return removeFileBelow(root, path)
}

// ListFileNamesBelow returns regular-looking entry names from a directory
// opened through the descriptor-anchored state boundary. Callers must still
// use ReadFileBelow to validate each file before consuming it.
func ListFileNamesBelow(root, directory string) ([]string, error) {
	return listFileNamesBelow(root, directory)
}
