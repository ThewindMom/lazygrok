//go:build !linux

package safestate

import (
	"fmt"
	"os"
)

func readFile(path string) ([]byte, error) {
	return nil, fmt.Errorf("%w: read %s", ErrUnsupportedPlatform, path)
}

func writeFile(path string, data []byte, perm os.FileMode) error {
	return fmt.Errorf("%w: write %s", ErrUnsupportedPlatform, path)
}

func removeFile(path string) error {
	return fmt.Errorf("%w: remove %s", ErrUnsupportedPlatform, path)
}

func readFileBelow(root, path string) ([]byte, error) {
	return nil, fmt.Errorf("%w: read %s below %s", ErrUnsupportedPlatform, path, root)
}

func writeFileBelow(root, path string, data []byte, perm os.FileMode) error {
	return fmt.Errorf("%w: write %s below %s", ErrUnsupportedPlatform, path, root)
}

func appendFileBelow(root, path string, data []byte, perm os.FileMode) error {
	return fmt.Errorf("%w: append %s below %s", ErrUnsupportedPlatform, path, root)
}

func withFileLockBelow(root, path string, action func() error) error {
	return fmt.Errorf("%w: lock %s below %s", ErrUnsupportedPlatform, path, root)
}

func removeFileBelow(root, path string) error {
	return fmt.Errorf("%w: remove %s below %s", ErrUnsupportedPlatform, path, root)
}

func listFileNamesBelow(root, directory string) ([]string, error) {
	return nil, fmt.Errorf("%w: list %s below %s", ErrUnsupportedPlatform, directory, root)
}
