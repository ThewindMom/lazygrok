package safestate

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPrivateStateConsumersDoNotUseRawOSMutations(t *testing.T) {
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	files := []string{
		"internal/spawnguard/spawnguard.go",
		"internal/skillgate/gate.go",
		"internal/skillgate/catalog.go",
		"internal/hashline/cache.go",
		"internal/hashline/context.go",
		"internal/stoppending/planmd.go",
		"internal/usingpowers/first.go",
		"internal/core/continuation/continuation.go",
		"internal/prometheus/user_prompt.go",
		"internal/prometheus/plan.go",
		"internal/boulder/prompt.go",
		"internal/boulder/state.go",
		"internal/boulder/todos.go",
		"internal/boulder/continuation.go",
		"internal/ulwbridge/ulwbridge.go",
	}
	forbidden := []string{
		"os.WriteFile(",
		"os.OpenFile(",
		"os.Remove(",
		"os.RemoveAll(",
		"os.MkdirAll(",
	}
	for _, relative := range files {
		data, err := os.ReadFile(filepath.Join(root, relative))
		if err != nil {
			t.Fatal(err)
		}
		for _, token := range forbidden {
			if strings.Contains(string(data), token) {
				t.Errorf("%s contains raw private-state mutation %s", relative, token)
			}
		}
	}
}

func TestPrivateStateReadersUseAnchoredBoundary(t *testing.T) {
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	files := []string{
		"internal/spawnguard/spawnguard.go",
		"internal/skillgate/gate.go",
		"internal/hashline/context.go",
		"internal/core/continuation/continuation.go",
		"internal/prometheus/user_prompt.go",
		"internal/prometheus/plan.go",
		"internal/boulder/continuation.go",
		"internal/ulwbridge/ulwbridge.go",
	}
	for _, relative := range files {
		data, err := os.ReadFile(filepath.Join(root, relative))
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(data), "os.ReadFile(") {
			t.Errorf("%s contains raw private-state read", relative)
		}
	}
}
