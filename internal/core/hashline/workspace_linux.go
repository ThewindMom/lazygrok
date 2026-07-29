//go:build linux

package hashline

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

const workspaceDirectoryFlags = syscall.O_RDONLY | syscall.O_DIRECTORY | syscall.O_NOFOLLOW | syscall.O_CLOEXEC

type linuxWorkspaceTarget struct {
	parentFD int
	file     *os.File
	leaf     string
	device   uint64
	inode    uint64
}

func openWorkspaceTarget(workspaceRoot, path string) (workspaceTarget, error) {
	root, parts, err := workspacePathParts(workspaceRoot, path)
	if err != nil {
		return nil, err
	}
	parentFD, err := openWorkspaceDirectory(root)
	if err != nil {
		return nil, fmt.Errorf("%w: open workspace root: %v", ErrUnsafeWorkspacePath, err)
	}
	for _, part := range parts[:len(parts)-1] {
		nextFD, openErr := syscall.Openat(parentFD, part, workspaceDirectoryFlags, 0)
		_ = syscall.Close(parentFD)
		if openErr != nil {
			return nil, fmt.Errorf("%w: open workspace directory %q: %v", ErrUnsafeWorkspacePath, part, openErr)
		}
		parentFD = nextFD
	}
	leaf := parts[len(parts)-1]
	fd, err := syscall.Openat(
		parentFD,
		leaf,
		syscall.O_RDONLY|syscall.O_NONBLOCK|syscall.O_NOFOLLOW|syscall.O_CLOEXEC,
		0,
	)
	if err != nil {
		_ = syscall.Close(parentFD)
		return nil, fmt.Errorf("%w: open workspace file: %v", ErrUnsafeWorkspacePath, err)
	}
	stat, err := validateWorkspaceFD(fd)
	if err != nil {
		_ = syscall.Close(fd)
		_ = syscall.Close(parentFD)
		return nil, err
	}
	file := os.NewFile(uintptr(fd), leaf)
	if file == nil {
		_ = syscall.Close(fd)
		_ = syscall.Close(parentFD)
		return nil, fmt.Errorf("%w: invalid workspace file descriptor", ErrUnsafeWorkspacePath)
	}
	return &linuxWorkspaceTarget{
		parentFD: parentFD,
		file:     file,
		leaf:     leaf,
		device:   uint64(stat.Dev),
		inode:    stat.Ino,
	}, nil
}

func openWorkspaceDirectory(path string) (int, error) {
	clean := filepath.Clean(path)
	fd, err := syscall.Open(string(filepath.Separator), workspaceDirectoryFlags, 0)
	if err != nil {
		return -1, fmt.Errorf("%w: open filesystem root: %v", ErrUnsafeWorkspacePath, err)
	}
	relative := strings.TrimPrefix(clean, string(filepath.Separator))
	if relative == "" {
		return fd, nil
	}
	for _, part := range strings.Split(relative, string(filepath.Separator)) {
		nextFD, openErr := syscall.Openat(fd, part, workspaceDirectoryFlags, 0)
		_ = syscall.Close(fd)
		if openErr != nil {
			return -1, fmt.Errorf("%w: open workspace root component %q: %v", ErrUnsafeWorkspacePath, part, openErr)
		}
		fd = nextFD
	}
	return fd, nil
}

func workspacePathParts(workspaceRoot, path string) (string, []string, error) {
	if workspaceRoot == "" {
		return "", nil, fmt.Errorf("%w: workspace root is empty", ErrUnsafeWorkspacePath)
	}
	resolved, err := ResolvePath(path, workspaceRoot)
	if err != nil {
		return "", nil, fmt.Errorf("%w: %v", ErrUnsafeWorkspacePath, err)
	}
	root, err := filepath.Abs(workspaceRoot)
	if err != nil {
		return "", nil, fmt.Errorf("%w: resolve workspace root: %v", ErrUnsafeWorkspacePath, err)
	}
	relative, err := filepath.Rel(filepath.Clean(root), filepath.Clean(resolved))
	if err != nil || relative == "." || relative == ".." ||
		strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", nil, fmt.Errorf("%w: %s", ErrUnsafeWorkspacePath, path)
	}
	parts := strings.Split(relative, string(filepath.Separator))
	for _, part := range parts {
		if part == "" || part == "." || part == ".." || strings.ContainsAny(part, `/\`) {
			return "", nil, fmt.Errorf("%w: %s", ErrUnsafeWorkspacePath, path)
		}
	}
	return filepath.Clean(root), parts, nil
}

func validateWorkspaceFD(fd int) (syscall.Stat_t, error) {
	var stat syscall.Stat_t
	if err := syscall.Fstat(fd, &stat); err != nil {
		return stat, fmt.Errorf("%w: stat workspace file: %v", ErrUnsafeWorkspacePath, err)
	}
	if stat.Mode&syscall.S_IFMT != syscall.S_IFREG {
		return stat, fmt.Errorf("%w: target is not a regular file", ErrUnsafeWorkspacePath)
	}
	if stat.Nlink != 1 {
		return stat, fmt.Errorf("%w: target has %d links", ErrUnsafeWorkspacePath, stat.Nlink)
	}
	return stat, nil
}

func (target *linuxWorkspaceTarget) readBounded(maxBytes int64) (workspaceSnapshot, error) {
	stat, err := validateWorkspaceFD(int(target.file.Fd()))
	if err != nil {
		return workspaceSnapshot{}, err
	}
	if stat.Size > maxBytes {
		return workspaceSnapshot{}, fmt.Errorf("file size %d exceeds limit %d", stat.Size, maxBytes)
	}
	if _, err := target.file.Seek(0, io.SeekStart); err != nil {
		return workspaceSnapshot{}, fmt.Errorf("seek workspace file: %w", err)
	}
	data, err := io.ReadAll(io.LimitReader(target.file, maxBytes+1))
	if err != nil {
		return workspaceSnapshot{}, fmt.Errorf("read workspace file: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return workspaceSnapshot{}, fmt.Errorf("file exceeds limit %d", maxBytes)
	}
	return workspaceSnapshot{
		data: data,
		mode: os.FileMode(stat.Mode).Perm(),
		size: int64(len(data)),
	}, nil
}

func (target *linuxWorkspaceTarget) close() error {
	fileErr := target.file.Close()
	parentErr := syscall.Close(target.parentFD)
	if fileErr != nil {
		return fileErr
	}
	return parentErr
}
