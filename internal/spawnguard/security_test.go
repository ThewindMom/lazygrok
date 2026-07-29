//go:build linux

package spawnguard

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestEvaluatePreToolUseRejectsSymlinkedCounter(t *testing.T) {
	root := t.TempDir()
	t.Setenv("GROK_HOME", root)
	stateDir := filepath.Join(root, "state", "spawn-count")
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "sentinel.json")
	if err := os.WriteFile(outside, []byte("sentinel"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(stateDir, "victim.json")); err != nil {
		t.Fatal(err)
	}

	EvaluatePreToolUse(hookenv.Event{SessionID: "victim", ToolName: "spawn_agent"})

	if got, err := os.ReadFile(outside); err != nil || string(got) != "sentinel" {
		t.Fatalf("outside sentinel = %q, %v", got, err)
	}
}

func TestEvaluatePreToolUseRequiresSessionID(t *testing.T) {
	root := t.TempDir()
	t.Setenv("GROK_HOME", root)

	EvaluatePreToolUse(hookenv.Event{ToolName: "spawn_agent"})

	if _, err := os.Stat(filepath.Join(root, "state", "spawn-count", "unknown.json")); !os.IsNotExist(err) {
		t.Fatalf("missing session created shared counter: %v", err)
	}
}

func TestEvaluatePreToolUseCountsConcurrentGrokSpawns(t *testing.T) {
	root := t.TempDir()
	t.Setenv("GROK_HOME", root)
	t.Setenv("LAZYGROK_SPAWN_FANOUT_LIMIT", "100")
	const workers = 64

	var group sync.WaitGroup
	group.Add(workers)
	for range workers {
		go func() {
			defer group.Done()
			if reason := EvaluatePreToolUse(hookenv.Event{SessionID: "parallel", ToolName: "spawn_subagent"}); reason != "" {
				t.Errorf("concurrent spawn denied: %s", reason)
			}
		}()
	}
	group.Wait()

	data, err := os.ReadFile(filepath.Join(root, "state", "spawn-count", "parallel.json"))
	if err != nil {
		t.Fatal(err)
	}
	var counter struct {
		Count int `json:"count"`
	}
	if err := json.Unmarshal(data, &counter); err != nil {
		t.Fatal(err)
	}
	if counter.Count != workers {
		t.Fatalf("spawn count = %d, want %d", counter.Count, workers)
	}
}

func TestEvaluatePreToolUseRejectsMalformedCounterWithoutReset(t *testing.T) {
	root := t.TempDir()
	t.Setenv("GROK_HOME", root)
	stateDir := filepath.Join(root, "state", "spawn-count")
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		t.Fatal(err)
	}
	counterPath := filepath.Join(stateDir, "corrupt.json")
	if err := os.WriteFile(counterPath, []byte("not-json"), 0o600); err != nil {
		t.Fatal(err)
	}

	reason := EvaluatePreToolUse(hookenv.Event{SessionID: "corrupt", ToolName: "spawn_subagent"})

	if reason == "" {
		t.Fatal("malformed counter allowed spawn")
	}
	data, err := os.ReadFile(counterPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "not-json" {
		t.Fatalf("malformed counter changed to %q", data)
	}
}
