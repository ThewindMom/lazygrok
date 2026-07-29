//go:build linux

package hashline

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"syscall"
)

func (target *linuxWorkspaceTarget) replace(data []byte, mode os.FileMode, expectedSHA256 string) error {
	if err := target.verifyNamedTarget(expectedSHA256); err != nil {
		return err
	}
	tempName, err := workspaceTempName()
	if err != nil {
		return fmt.Errorf("create workspace temp name: %w", err)
	}
	tempFD, err := syscall.Openat(
		target.parentFD,
		tempName,
		syscall.O_WRONLY|syscall.O_CREAT|syscall.O_EXCL|syscall.O_NOFOLLOW|syscall.O_CLOEXEC,
		uint32(mode.Perm()),
	)
	if err != nil {
		return fmt.Errorf("create workspace temp file: %w", err)
	}
	temp := os.NewFile(uintptr(tempFD), tempName)
	if temp == nil {
		_ = syscall.Close(tempFD)
		return errors.New("create workspace temp file: invalid descriptor")
	}
	renamed := false
	defer func() {
		_ = temp.Close()
		if !renamed {
			_ = syscall.Unlinkat(target.parentFD, tempName)
		}
	}()
	if _, err := temp.Write(data); err != nil {
		return fmt.Errorf("write workspace temp file: %w", err)
	}
	if err := temp.Chmod(mode.Perm()); err != nil {
		return fmt.Errorf("chmod workspace temp file: %w", err)
	}
	if err := temp.Sync(); err != nil {
		return fmt.Errorf("sync workspace temp file: %w", err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close workspace temp file: %w", err)
	}
	if err := target.verifyNamedTarget(expectedSHA256); err != nil {
		return err
	}
	if err := syscall.Renameat(target.parentFD, tempName, target.parentFD, target.leaf); err != nil {
		return fmt.Errorf("replace workspace file: %w", err)
	}
	renamed = true
	if err := syscall.Fsync(target.parentFD); err != nil {
		return fmt.Errorf("sync workspace directory: %w", err)
	}
	return nil
}

func (target *linuxWorkspaceTarget) verifyNamedTarget(expectedSHA256 string) error {
	fd, err := syscall.Openat(
		target.parentFD,
		target.leaf,
		syscall.O_RDONLY|syscall.O_NONBLOCK|syscall.O_NOFOLLOW|syscall.O_CLOEXEC,
		0,
	)
	if err != nil {
		return fmt.Errorf("%w: reopen workspace file: %v", ErrUnsafeWorkspacePath, err)
	}
	file := os.NewFile(uintptr(fd), target.leaf)
	if file == nil {
		_ = syscall.Close(fd)
		return fmt.Errorf("%w: invalid workspace file descriptor", ErrUnsafeWorkspacePath)
	}
	defer file.Close()
	stat, err := validateWorkspaceFD(fd)
	if err != nil {
		return err
	}
	if uint64(stat.Dev) != target.device || stat.Ino != target.inode {
		return fmt.Errorf("%w: target changed during edit", ErrUnsafeWorkspacePath)
	}
	if expectedSHA256 == "" {
		return nil
	}
	data, err := io.ReadAll(io.LimitReader(file, MaxFileSize+1))
	if err != nil {
		return fmt.Errorf("race check read: %w", err)
	}
	if len(data) > MaxFileSize {
		return fmt.Errorf("race check file exceeds limit %d", MaxFileSize)
	}
	sum := sha256.Sum256(data)
	if hex.EncodeToString(sum[:]) != expectedSHA256 {
		return errors.New("file changed between validation and write (race detected)")
	}
	return nil
}

func workspaceTempName() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	return ".lazygrok-mcp-tmp-" + hex.EncodeToString(value[:]), nil
}
