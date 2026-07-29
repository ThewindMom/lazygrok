package hashline

import (
	"errors"
	"os"
)

var (
	ErrUnsafeWorkspacePath       = errors.New("unsafe workspace file path")
	ErrUnsupportedSecureMutation = errors.New("descriptor-anchored workspace mutation is unsupported on this platform")
)

type workspaceSnapshot struct {
	data []byte
	mode os.FileMode
	size int64
}

type workspaceTarget interface {
	readBounded(maxBytes int64) (workspaceSnapshot, error)
	replace(data []byte, mode os.FileMode, expectedSHA256 string) error
	close() error
}
