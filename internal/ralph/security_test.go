package ralph

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestWriteStateJSON_rejectsIntermediateSymlink(t *testing.T) {
	t.Parallel()

	// Given: .lazygrok redirects to an external directory.
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	outside := filepath.Join(root, "outside")
	if err := os.MkdirAll(workspace, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(workspace, ".lazygrok")); err != nil {
		t.Fatal(err)
	}

	// When: Ralph persists loop state.
	err := WriteStateJSON(workspace, []byte(`{"prompt":"work","session_id":"session-safe"}`))

	// Then: the write is rejected and no external state file is created.
	if err == nil {
		t.Fatal("WriteStateJSON accepted an intermediate symlink")
	}
	if _, err := os.Stat(filepath.Join(outside, "ralph-loop.local.md")); !os.IsNotExist(err) {
		t.Fatalf("external Ralph state exists: %v", err)
	}
}

func TestWriteStateJSON_usesPrivatePermissions(t *testing.T) {
	t.Parallel()

	workspace := t.TempDir()
	if err := WriteStateJSON(
		workspace,
		[]byte(`{"prompt":"private objective","session_id":"session-safe"}`),
	); err != nil {
		t.Fatal(err)
	}
	stateDir := filepath.Join(workspace, ".lazygrok")
	dirInfo, err := os.Stat(stateDir)
	if err != nil {
		t.Fatal(err)
	}
	if got := dirInfo.Mode().Perm(); got != 0o700 {
		t.Fatalf("state directory mode = %o, want 700", got)
	}
	fileInfo, err := os.Stat(filepath.Join(stateDir, "ralph-loop.local.md"))
	if err != nil {
		t.Fatal(err)
	}
	if got := fileInfo.Mode().Perm(); got != 0o600 {
		t.Fatalf("Ralph state mode = %o, want 600", got)
	}
}

func TestEvaluateStop_blocksWithoutContinuingWhenStateWriteFails(t *testing.T) {
	workspace := t.TempDir()
	if err := WriteStateJSON(workspace, []byte(`{
		"iteration": 1,
		"max_iterations": 3,
		"completion_promise": "DONE",
		"session_id": "session-write-failure",
		"prompt": "must not be reinjected"
	}`)); err != nil {
		t.Fatal(err)
	}

	blocked, message := evaluateStop(hookenv.Event{
		WorkspaceRoot: workspace,
		SessionID:     "session-write-failure",
	}, stateMutations{
		write: func(string, *state) error { return errors.New("injected write failure") },
		clear: clearState,
	})

	if !blocked {
		t.Fatal("EvaluateStop allowed exit after a state write failure")
	}
	if !strings.Contains(message, "[RALPH LOOP STATE ERROR]") {
		t.Fatalf("message = %q, want state error", message)
	}
	if strings.Contains(message, "must not be reinjected") {
		t.Fatalf("state failure reinjected the task: %q", message)
	}
	data, err := os.ReadFile(StatePath(workspace))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "iteration: 1") {
		t.Fatalf("failed write changed persisted iteration: %s", data)
	}
}

func TestEvaluateStop_doesNotClaimTerminalStateWhenClearFails(t *testing.T) {
	tests := []struct {
		name    string
		state   state
		lastMsg string
	}{
		{
			name: "ralph completion",
			state: state{
				Active:            true,
				Iteration:         1,
				MaxIterations:     3,
				CompletionPromise: "DONE",
				SessionID:         "session-clear-failure",
				Prompt:            "finish",
			},
			lastMsg: "<promise>DONE</promise>",
		},
		{
			name: "ultrawork verification",
			state: state{
				Active:              true,
				Iteration:           1,
				MaxIterations:       3,
				CompletionPromise:   "DONE",
				SessionID:           "session-clear-failure",
				Prompt:              "verify",
				Ultrawork:           true,
				VerificationPending: true,
			},
			lastMsg: "Agent: oracle\n<promise>VERIFIED</promise>",
		},
		{
			name: "iteration exhaustion",
			state: state{
				Active:            true,
				Iteration:         3,
				MaxIterations:     3,
				CompletionPromise: "DONE",
				SessionID:         "session-clear-failure",
				Prompt:            "bounded",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			workspace := t.TempDir()
			if err := writeState(StatePath(workspace), &tt.state); err != nil {
				t.Fatal(err)
			}
			blocked, message := evaluateStop(hookenv.Event{
				WorkspaceRoot:        workspace,
				SessionID:            "session-clear-failure",
				LastAssistantMessage: tt.lastMsg,
			}, stateMutations{
				write: writeState,
				clear: func(string) error { return errors.New("injected clear failure") },
			})

			if !blocked {
				t.Fatal("EvaluateStop claimed a terminal state after clear failure")
			}
			if !strings.Contains(message, "[RALPH LOOP STATE ERROR]") {
				t.Fatalf("message = %q, want state error", message)
			}
		})
	}
}

func TestClearState_reportsHardLinkedState(t *testing.T) {
	workspace := t.TempDir()
	path := StatePath(workspace)
	if err := WriteStateJSON(workspace, []byte(`{"prompt":"work"}`)); err != nil {
		t.Fatal(err)
	}
	if err := os.Link(path, filepath.Join(workspace, "ralph-state-alias")); err != nil {
		t.Fatal(err)
	}

	if err := ClearState(path); err == nil {
		t.Fatal("ClearState hid a guarded remove failure")
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("failed clear removed state unexpectedly: %v", err)
	}
}

func TestClearState_allowsMissingState(t *testing.T) {
	workspace := t.TempDir()
	if err := os.Mkdir(filepath.Join(workspace, ".lazygrok"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := ClearState(StatePath(workspace)); err != nil {
		t.Fatalf("ClearState(missing) = %v, want nil", err)
	}
}

func TestEvaluateStop_rejectsMissingSessionForBoundLoop(t *testing.T) {
	workspace := t.TempDir()
	if err := WriteStateJSON(workspace, []byte(`{
		"iteration": 1,
		"max_iterations": 3,
		"session_id": "owner-session",
		"prompt": "owned work"
	}`)); err != nil {
		t.Fatal(err)
	}

	blocked, message := EvaluateStop(hookenv.Event{WorkspaceRoot: workspace})

	if blocked || message != "" {
		t.Fatalf("sessionless event mutated a bound loop: blocked=%t message=%q", blocked, message)
	}
	data, err := os.ReadFile(StatePath(workspace))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "iteration: 1") {
		t.Fatalf("sessionless event changed persisted state: %s", data)
	}
}

func TestCancelRalph_requiresOwningSession(t *testing.T) {
	for _, tc := range []struct {
		name      string
		sessionID string
	}{
		{name: "different session", sessionID: "other-session"},
		{name: "missing session"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			workspace := t.TempDir()
			if err := WriteStateJSON(workspace, []byte(`{
				"session_id": "owner-session",
				"prompt": "owned work"
			}`)); err != nil {
				t.Fatal(err)
			}

			message := CollectUserPrompt(hookenv.Event{
				WorkspaceRoot: workspace,
				SessionID:     tc.sessionID,
				Prompt:        "/cancel-ralph",
			})

			if !strings.Contains(message, "belongs to another session") {
				t.Fatalf("message = %q, want ownership rejection", message)
			}
			if _, err := os.Stat(StatePath(workspace)); err != nil {
				t.Fatalf("cross-session cancellation removed state: %v", err)
			}
		})
	}
}

func TestCancelRalph_reportsGuardedRemoveFailure(t *testing.T) {
	workspace := t.TempDir()
	path := StatePath(workspace)
	if err := WriteStateJSON(workspace, []byte(`{
		"session_id": "owner-session",
		"prompt": "owned work"
	}`)); err != nil {
		t.Fatal(err)
	}
	if err := os.Link(path, filepath.Join(workspace, "ralph-state-alias")); err != nil {
		t.Fatal(err)
	}

	message := CollectUserPrompt(hookenv.Event{
		WorkspaceRoot: workspace,
		SessionID:     "owner-session",
		Prompt:        "/cancel-ralph",
	})

	if !strings.Contains(message, "Unable to cancel safely") {
		t.Fatalf("message = %q, want guarded failure", message)
	}
	if strings.Contains(message, "Canceled active") {
		t.Fatalf("cancellation falsely claimed success: %q", message)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("guarded cancellation removed state: %v", err)
	}
}

func TestCancelRalph_ownerCanClearState(t *testing.T) {
	workspace := t.TempDir()
	if err := WriteStateJSON(workspace, []byte(`{
		"session_id": "owner-session",
		"prompt": "owned work"
	}`)); err != nil {
		t.Fatal(err)
	}

	message := CollectUserPrompt(hookenv.Event{
		WorkspaceRoot: workspace,
		SessionID:     "owner-session",
		Prompt:        "/cancel-ralph",
	})

	if !strings.Contains(message, "Canceled active") {
		t.Fatalf("message = %q, want cancellation success", message)
	}
	if _, err := os.Stat(StatePath(workspace)); !os.IsNotExist(err) {
		t.Fatalf("owner cancellation left state: %v", err)
	}
}
