//go:build !linux

package hashline

import "fmt"

func openWorkspaceTarget(workspaceRoot, path string) (workspaceTarget, error) {
	return nil, fmt.Errorf("%w: %s below %s", ErrUnsupportedSecureMutation, path, workspaceRoot)
}
