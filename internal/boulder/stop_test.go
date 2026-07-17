package boulder_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"lazygrok/internal/boulder"
	"lazygrok/internal/hookenv"
)

func TestShouldSkipTodoContinuationCooldown(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("GROK_HOME", tmp)
	session := "sess-cooldown"

	stateDir := filepath.Join(tmp, "state", "todo-enforcer", session)
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatal(err)
	}
	nowMs := time.Now().UTC().UnixMilli()
	payload := map[string]any{
		"cooldown_until_ms": float64(nowMs + 5000),
	}
	b, _ := json.MarshalIndent(payload, "", "  ")
	if err := os.WriteFile(filepath.Join(stateDir, "state.json"), append(b, '\n'), 0o644); err != nil {
		t.Fatal(err)
	}

	if got := boulder.ShouldSkipTodoContinuation(session, "end_turn"); got != "cooldown" {
		t.Fatalf("expected cooldown, got %q", got)
	}
}

func TestEvaluateTodoStopBlocksWithIncompleteTodos(t *testing.T) {
	tmp := t.TempDir()
	grokHome := filepath.Join(tmp, "grok")
	t.Setenv("GROK_HOME", grokHome)
	session := "sess-todo"
	ws := filepath.Join(tmp, "workspace")
	if err := os.MkdirAll(ws, 0o755); err != nil {
		t.Fatal(err)
	}

	sessDir := filepath.Join(grokHome, "sessions", "ws", session)
	if err := os.MkdirAll(sessDir, 0o755); err != nil {
		t.Fatal(err)
	}
	resources := map[string]any{
		"TodoState_1": map[string]any{
			"state": `{"todos":[{"id":"1","content":"fix tests","status":"pending"}]}`,
		},
	}
	rb, _ := json.Marshal(resources)
	if err := os.WriteFile(filepath.Join(sessDir, "resources_state.json"), rb, 0o644); err != nil {
		t.Fatal(err)
	}

	ev := hookenv.Event{
		SessionID:     session,
		WorkspaceRoot: ws,
		StopReason:    "end_turn",
	}
	block, msg := boulder.EvaluateTodoStop(ev)
	if !block {
		t.Fatal("expected block")
	}
	if msg == "" || !contains(msg, "TODO CONTINUATION") {
		t.Fatalf("unexpected msg: %q", msg)
	}
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && findSub(s, sub))
}

func findSub(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}