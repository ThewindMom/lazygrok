//go:build linux

package safestate

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"syscall"
)

const directoryFlags = syscall.O_RDONLY | syscall.O_DIRECTORY | syscall.O_NOFOLLOW | syscall.O_CLOEXEC

func openParent(path string, create bool) (int, string, error) {
	workspace, parts, err := statePathParts(path)
	if err != nil {
		return -1, "", err
	}
	return openParentParts(workspace, parts, create, true)
}

func openParentBelow(root, path string, create, protectExisting bool) (int, string, error) {
	anchoredRoot, parts, err := pathPartsBelow(root, path)
	if err != nil {
		return -1, "", err
	}
	return openParentParts(anchoredRoot, parts, create, protectExisting)
}

func openParentParts(root string, parts []string, create, protectExisting bool) (int, string, error) {
	fd, err := openDirectoryPath(root)
	if err != nil {
		if errors.Is(err, syscall.ENOENT) {
			return -1, "", fmt.Errorf("open state root: %w", err)
		}
		return -1, "", fmt.Errorf("%w: open state root: %v", ErrUnsafePath, err)
	}
	for _, part := range parts[:len(parts)-1] {
		next, openErr := syscall.Openat(fd, part, directoryFlags, 0)
		if errors.Is(openErr, syscall.ENOENT) && create {
			if mkdirErr := syscall.Mkdirat(fd, part, 0o700); mkdirErr != nil && !errors.Is(mkdirErr, syscall.EEXIST) {
				closeFD(fd)
				return -1, "", fmt.Errorf("create state directory %q: %w", part, mkdirErr)
			}
			next, openErr = syscall.Openat(fd, part, directoryFlags, 0)
		}
		if openErr != nil {
			closeFD(fd)
			if errors.Is(openErr, syscall.ENOENT) {
				return -1, "", fmt.Errorf("open state directory %q: %w", part, openErr)
			}
			return -1, "", fmt.Errorf("%w: open state directory %q: %v", ErrUnsafePath, part, openErr)
		}
		if protectExisting {
			if chmodErr := syscall.Fchmod(next, 0o700); chmodErr != nil {
				closeFD(next)
				closeFD(fd)
				return -1, "", fmt.Errorf("protect state directory %q: %w", part, chmodErr)
			}
		}
		closeFD(fd)
		fd = next
	}
	return fd, parts[len(parts)-1], nil
}

func openDirectoryPath(path string) (int, error) {
	clean := filepath.Clean(path)
	fd, err := syscall.Open(string(filepath.Separator), directoryFlags, 0)
	if err != nil {
		return -1, err
	}
	relative, err := filepath.Rel(string(filepath.Separator), clean)
	if err != nil {
		closeFD(fd)
		return -1, err
	}
	if relative == "." {
		return fd, nil
	}
	for _, part := range splitPath(relative) {
		next, openErr := syscall.Openat(fd, part, directoryFlags, 0)
		if openErr != nil {
			closeFD(fd)
			return -1, openErr
		}
		closeFD(fd)
		fd = next
	}
	return fd, nil
}

func splitPath(path string) []string {
	var parts []string
	for path != "." && path != "" {
		dir, leaf := filepath.Split(path)
		if leaf != "" {
			parts = append([]string{leaf}, parts...)
		}
		path = filepath.Clean(dir)
		if path == string(filepath.Separator) {
			break
		}
	}
	return parts
}

func readFile(path string) ([]byte, error) {
	parentFD, leaf, err := openParent(path, false)
	return readFileFromParent(path, parentFD, leaf, err)
}

func readFileBelow(root, path string) ([]byte, error) {
	parentFD, leaf, err := openParentBelow(root, path, false, false)
	return readFileFromParent(path, parentFD, leaf, err)
}

func listFileNamesBelow(root, directory string) ([]string, error) {
	parentFD, _, err := openParentBelow(root, filepath.Join(directory, ".entry"), false, false)
	if err != nil {
		return nil, err
	}
	file := os.NewFile(uintptr(parentFD), filepath.Base(directory))
	if file == nil {
		closeFD(parentFD)
		return nil, errors.New("open state directory: invalid descriptor")
	}
	defer file.Close()
	entries, err := file.ReadDir(-1)
	if err != nil {
		return nil, fmt.Errorf("read state directory: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 || !safeSegment(entry.Name()) {
			continue
		}
		names = append(names, entry.Name())
	}
	return names, nil
}

func readFileFromParent(path string, parentFD int, leaf string, err error) ([]byte, error) {
	if err != nil {
		if errors.Is(err, syscall.ENOENT) {
			return nil, &os.PathError{Op: "open", Path: path, Err: syscall.ENOENT}
		}
		return nil, err
	}
	defer closeFD(parentFD)

	fd, err := syscall.Openat(parentFD, leaf, syscall.O_RDONLY|syscall.O_NONBLOCK|syscall.O_NOFOLLOW|syscall.O_CLOEXEC, 0)
	if err != nil {
		if errors.Is(err, syscall.ENOENT) {
			return nil, &os.PathError{Op: "open", Path: path, Err: syscall.ENOENT}
		}
		return nil, fmt.Errorf("open state file: %w", err)
	}
	file := os.NewFile(uintptr(fd), leaf)
	if file == nil {
		closeFD(fd)
		return nil, errors.New("open state file: invalid descriptor")
	}
	defer file.Close()
	if err := validateRegularFile(fd); err != nil {
		return nil, err
	}
	var stat syscall.Stat_t
	if err := syscall.Fstat(fd, &stat); err != nil {
		return nil, fmt.Errorf("stat state file: %w", err)
	}
	if stat.Size > MaxReadBytes {
		return nil, fmt.Errorf("%w: %d bytes", ErrFileTooLarge, stat.Size)
	}
	data, err := io.ReadAll(io.LimitReader(file, MaxReadBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read state file: %w", err)
	}
	if int64(len(data)) > MaxReadBytes {
		return nil, fmt.Errorf("%w: more than %d bytes", ErrFileTooLarge, MaxReadBytes)
	}
	return data, nil
}

func writeFile(path string, data []byte, perm os.FileMode) error {
	parentFD, leaf, err := openParent(path, true)
	return writeFileFromParent(parentFD, leaf, data, perm, err)
}

func writeFileBelow(root, path string, data []byte, perm os.FileMode) error {
	parentFD, leaf, err := openParentBelow(root, path, true, true)
	return writeFileFromParent(parentFD, leaf, data, perm, err)
}

func appendFileBelow(root, path string, data []byte, perm os.FileMode) error {
	parentFD, leaf, err := openParentBelow(root, path, true, true)
	if err != nil {
		return err
	}
	defer closeFD(parentFD)
	fd, err := syscall.Openat(
		parentFD,
		leaf,
		syscall.O_WRONLY|syscall.O_APPEND|syscall.O_CREAT|syscall.O_NOFOLLOW|syscall.O_CLOEXEC,
		uint32(perm.Perm()),
	)
	if err != nil {
		return fmt.Errorf("%w: open state file for append: %v", ErrUnsafeTarget, err)
	}
	file := os.NewFile(uintptr(fd), leaf)
	if file == nil {
		closeFD(fd)
		return errors.New("open state file for append: invalid descriptor")
	}
	defer file.Close()
	if err := validateRegularFile(fd); err != nil {
		return err
	}
	if err := file.Chmod(perm.Perm()); err != nil {
		return fmt.Errorf("protect appended state file: %w", err)
	}
	if _, err := file.Write(data); err != nil {
		return fmt.Errorf("append state file: %w", err)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync appended state file: %w", err)
	}
	if err := syscall.Fsync(parentFD); err != nil {
		return fmt.Errorf("sync state directory: %w", err)
	}
	return nil
}

func withFileLockBelow(root, path string, action func() error) error {
	parentFD, leaf, err := openParentBelow(root, path, true, true)
	if err != nil {
		return err
	}
	defer closeFD(parentFD)
	fd, err := syscall.Openat(
		parentFD,
		leaf,
		syscall.O_RDWR|syscall.O_CREAT|syscall.O_NOFOLLOW|syscall.O_CLOEXEC,
		0o600,
	)
	if err != nil {
		return fmt.Errorf("%w: open state lock: %v", ErrUnsafeTarget, err)
	}
	defer closeFD(fd)
	if err := validateRegularFile(fd); err != nil {
		return err
	}
	if err := syscall.Fchmod(fd, 0o600); err != nil {
		return fmt.Errorf("protect state lock: %w", err)
	}
	if err := syscall.Flock(fd, syscall.LOCK_EX); err != nil {
		return fmt.Errorf("lock state file: %w", err)
	}
	defer func() {
		_ = syscall.Flock(fd, syscall.LOCK_UN)
	}()
	return action()
}

func writeFileFromParent(parentFD int, leaf string, data []byte, perm os.FileMode, err error) error {
	if err != nil {
		return err
	}
	defer closeFD(parentFD)
	return writeFileAt(parentFD, leaf, data, perm)
}

func writeFileAt(parentFD int, leaf string, data []byte, perm os.FileMode) error {
	mode, err := existingMode(parentFD, leaf, perm)
	if err != nil {
		return err
	}
	tempName, err := randomTempName()
	if err != nil {
		return fmt.Errorf("create state temp name: %w", err)
	}
	tempFD, err := syscall.Openat(
		parentFD,
		tempName,
		syscall.O_WRONLY|syscall.O_CREAT|syscall.O_EXCL|syscall.O_NOFOLLOW|syscall.O_CLOEXEC,
		uint32(mode.Perm()),
	)
	if err != nil {
		return fmt.Errorf("create state temp file: %w", err)
	}
	temp := os.NewFile(uintptr(tempFD), tempName)
	if temp == nil {
		closeFD(tempFD)
		return errors.New("create state temp file: invalid descriptor")
	}
	renamed := false
	defer func() {
		_ = temp.Close()
		if !renamed {
			_ = syscall.Unlinkat(parentFD, tempName)
		}
	}()
	if err := temp.Chmod(mode.Perm()); err != nil {
		return fmt.Errorf("set state temp mode: %w", err)
	}
	if _, err := temp.Write(data); err != nil {
		return fmt.Errorf("write state temp file: %w", err)
	}
	if err := temp.Sync(); err != nil {
		return fmt.Errorf("sync state temp file: %w", err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close state temp file: %w", err)
	}
	if err := syscall.Renameat(parentFD, tempName, parentFD, leaf); err != nil {
		return fmt.Errorf("replace state file: %w", err)
	}
	renamed = true
	if err := syscall.Fsync(parentFD); err != nil {
		return fmt.Errorf("sync state directory: %w", err)
	}
	return nil
}

func existingMode(parentFD int, leaf string, fallback os.FileMode) (os.FileMode, error) {
	fd, err := syscall.Openat(parentFD, leaf, syscall.O_RDONLY|syscall.O_NONBLOCK|syscall.O_NOFOLLOW|syscall.O_CLOEXEC, 0)
	if errors.Is(err, syscall.ENOENT) {
		return fallback.Perm(), nil
	}
	if err != nil {
		return 0, fmt.Errorf("%w: open existing state file: %v", ErrUnsafeTarget, err)
	}
	defer closeFD(fd)
	if err := validateRegularFile(fd); err != nil {
		return 0, err
	}
	var stat syscall.Stat_t
	if err := syscall.Fstat(fd, &stat); err != nil {
		return 0, fmt.Errorf("stat existing state file: %w", err)
	}
	return fallback.Perm(), nil
}

func validateRegularFile(fd int) error {
	var stat syscall.Stat_t
	if err := syscall.Fstat(fd, &stat); err != nil {
		return fmt.Errorf("stat state file: %w", err)
	}
	if stat.Mode&syscall.S_IFMT != syscall.S_IFREG {
		return fmt.Errorf("%w: target is not a regular file", ErrUnsafeTarget)
	}
	if stat.Nlink != 1 {
		return fmt.Errorf("%w: target has %d links", ErrUnsafeTarget, stat.Nlink)
	}
	return nil
}

func removeFile(path string) error {
	parentFD, leaf, err := openParent(path, false)
	return removeFileFromParent(parentFD, leaf, err)
}

func removeFileBelow(root, path string) error {
	parentFD, leaf, err := openParentBelow(root, path, false, true)
	return removeFileFromParent(parentFD, leaf, err)
}

func removeFileFromParent(parentFD int, leaf string, err error) error {
	if err != nil {
		if errors.Is(err, syscall.ENOENT) {
			return nil
		}
		return err
	}
	defer closeFD(parentFD)
	fd, err := syscall.Openat(parentFD, leaf, syscall.O_RDONLY|syscall.O_NONBLOCK|syscall.O_NOFOLLOW|syscall.O_CLOEXEC, 0)
	if err != nil {
		if errors.Is(err, syscall.ENOENT) {
			return nil
		}
		return fmt.Errorf("open state file for removal: %w", err)
	}
	if err := validateRegularFile(fd); err != nil {
		closeFD(fd)
		return err
	}
	closeFD(fd)
	if err := syscall.Unlinkat(parentFD, leaf); err != nil {
		return fmt.Errorf("remove state file: %w", err)
	}
	return nil
}

func randomTempName() (string, error) {
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", err
	}
	return ".lazygrok-tmp-" + hex.EncodeToString(random[:]), nil
}

func closeFD(fd int) {
	if fd >= 0 {
		_ = syscall.Close(fd)
	}
}
