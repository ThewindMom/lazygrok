package continuation

import (
	"os"
	"path/filepath"
	"testing"

	"lazygrok/internal/core/config"
)

func TestStartAndEvaluateLoop(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()

	err := StartLoop(ws, "ralph", "test objective", "DONE", "session1", cfg)
	if err != nil {
		t.Fatalf("StartLoop: %v", err)
	}

	result := EvaluateStop(ws, gh, "session1", cfg)
	if !result.ShouldContinue {
		t.Errorf("expected continuation, got reason: %s", result.Reason)
	}
}

func TestExplicitStop(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)

	// Stop continuation
	if err := StopContinuation(ws, gh, "session1"); err != nil {
		t.Fatalf("StopContinuation: %v", err)
	}

	result := EvaluateStop(ws, gh, "session1", cfg)
	if result.ShouldContinue {
		t.Error("should not continue after explicit stop")
	}
	if result.Reason != "explicit_stop" {
		t.Errorf("reason = %s, want explicit_stop", result.Reason)
	}
}

func TestResumeAfterStop(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)
	StopContinuation(ws, gh, "session1")

	// Resume
	if err := ResumeContinuation(gh, "session1", ws); err != nil {
		t.Fatalf("ResumeContinuation: %v", err)
	}

	result := EvaluateStop(ws, gh, "session1", cfg)
	if !result.ShouldContinue {
		t.Error("should continue after resume")
	}
}

func TestMaxIterations(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()
	cfg.MaxContinuations = 2

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)

	// First iteration
	r1 := EvaluateStop(ws, gh, "session1", cfg)
	if !r1.ShouldContinue {
		t.Error("first iteration should continue")
	}

	// Second iteration
	r2 := EvaluateStop(ws, gh, "session1", cfg)
	if !r2.ShouldContinue {
		t.Error("second iteration should continue")
	}

	// Third iteration — should hit max
	r3 := EvaluateStop(ws, gh, "session1", cfg)
	if r3.ShouldContinue {
		t.Error("third iteration should not continue (max reached)")
	}
	if r3.Reason != "max_iterations" {
		t.Errorf("reason = %s, want max_iterations", r3.Reason)
	}
}

func TestRepeatedStateDetection(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()
	cfg.RepeatedStateThreshold = 3

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)

	// Record same fingerprint 3 times
	fp := "abc123"
	for i := 0; i < 3; i++ {
		RecordStateFingerprint(ws, fp)
	}

	result := EvaluateStop(ws, gh, "session1", cfg)
	if result.ShouldContinue {
		t.Error("should not continue with repeated state")
	}
	if result.Reason != "repeated_state" {
		t.Errorf("reason = %s, want repeated_state", result.Reason)
	}
}

func TestFailureCount(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()
	cfg.RepeatedStateThreshold = 3

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)

	for i := 0; i < 3; i++ {
		RecordFailure(ws)
	}

	result := EvaluateStop(ws, gh, "session1", cfg)
	if result.ShouldContinue {
		t.Error("should not continue after failure threshold")
	}
	if result.Reason != "failure_threshold" {
		t.Errorf("reason = %s, want failure_threshold", result.Reason)
	}
}

func TestCompleteLoop(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)

	if err := CompleteLoop(ws); err != nil {
		t.Fatalf("CompleteLoop: %v", err)
	}

	result := EvaluateStop(ws, gh, "session1", cfg)
	if result.ShouldContinue {
		t.Error("should not continue after completion")
	}
}

func TestSessionMismatch(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)

	result := EvaluateStop(ws, gh, "session2", cfg)
	if result.ShouldContinue {
		t.Error("should not continue with different session")
	}
}

func TestContinuationDisabled(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()
	cfg.ContinuationEnabled = false

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)

	result := EvaluateStop(ws, gh, "session1", cfg)
	if result.ShouldContinue {
		t.Error("should not continue when disabled")
	}
	if result.Reason != "continuation_disabled" {
		t.Errorf("reason = %s, want continuation_disabled", result.Reason)
	}
}

func TestComputeFingerprint(t *testing.T) {
	fp1 := ComputeFingerprint([]byte("hello"))
	fp2 := ComputeFingerprint([]byte("hello"))
	fp3 := ComputeFingerprint([]byte("world"))
	if fp1 != fp2 {
		t.Error("same input should produce same fingerprint")
	}
	if fp1 == fp3 {
		t.Error("different input should produce different fingerprint")
	}
}

func TestListResumableWork(t *testing.T) {
	ws := t.TempDir()
	cfg := Defaults()

	StartLoop(ws, "ralph", "test objective", "DONE", "session1", cfg)

	items, err := ListResumableWork(ws)
	if err != nil {
		t.Fatalf("ListResumableWork: %v", err)
	}
	if len(items) == 0 {
		t.Error("expected at least one resumable item")
	}
}

func TestMigration(t *testing.T) {
	old := map[string]any{
		"active":               true,
		"type":                 "ralph",
		"objective":            "test",
		"completion_criteria":  "DONE",
		"iteration":            5,
		"max_iterations":       100,
		"session_id":           "old-session",
		"started_at":           "2026-01-01T00:00:00Z",
		"last_iteration_at":    "2026-01-01T00:01:00Z",
		"verification_pending": false,
		"paused":               false,
		"pause_reason":         "",
	}

	new := MigrateV1ToV2(old)
	if new["schemaVersion"].(int) != StateVersion {
		t.Errorf("schemaVersion = %v, want %d", new["schemaVersion"], StateVersion)
	}
	if new["objective"] != "test" {
		t.Errorf("objective = %v", new["objective"])
	}
	if new["maxIterations"].(int) != 100 {
		t.Errorf("maxIterations = %v", new["maxIterations"])
	}
}

func TestNoActiveLoop(t *testing.T) {
	ws := t.TempDir()
	gh := t.TempDir()
	cfg := Defaults()

	result := EvaluateStop(ws, gh, "session1", cfg)
	if result.ShouldContinue {
		t.Error("should not continue with no active loop")
	}
}

func TestStateFileAtomic(t *testing.T) {
	ws := t.TempDir()
	cfg := Defaults()

	StartLoop(ws, "ralph", "test", "DONE", "session1", cfg)

	// Verify state file exists and is valid JSON
	path := filepath.Join(ws, ".lazygrok", "continuation.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("state file should exist: %v", err)
	}
	if len(data) == 0 {
		t.Error("state file should not be empty")
	}
}

func Defaults() *config.Config {
	cfg := config.Defaults()
	cfg.CooldownSeconds = 0 // tests run fast
	return cfg
}
