package prometheus

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestPlanModeBannerUsesGrokSubagentTools(t *testing.T) {
	response := CollectUserPrompt(hookenv.Event{SessionID: "plan-tools", Prompt: "/plan"})

	for _, token := range []string{"spawn_subagent", "get_command_or_subagent_output", "lazygrok:metis", "lazygrok:momus"} {
		if !strings.Contains(response, token) {
			t.Fatalf("plan prompt missing Grok token %q", token)
		}
	}
	for _, token := range []string{"Task(", "task(", "load_skills", "run_in_background"} {
		if strings.Contains(response, token) {
			t.Fatalf("plan prompt contains foreign token %q", token)
		}
	}
}

func TestHandleStartWork_rejectsSymlinkBoulderTarget(t *testing.T) {
	t.Parallel()

	// Given: a valid plan and boulder.json symlinked to an external sentinel.
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	plan := filepath.Join(workspace, ".lazygrok", "plans", "demo.md")
	if err := os.MkdirAll(filepath.Dir(plan), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(plan, []byte("# Demo\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(root, "outside.json")
	if err := os.WriteFile(outside, []byte("sentinel"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(workspace, ".lazygrok", "boulder.json")); err != nil {
		t.Fatal(err)
	}

	// When: /start-work activates the plan.
	response := handleStartWork(workspace, "session-safe", "/start-work .lazygrok/plans/demo.md")

	// Then: activation fails closed and the external file is unchanged.
	if !strings.Contains(response, "failed") {
		t.Fatalf("response = %q, want failure", response)
	}
	got, err := os.ReadFile(outside)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "sentinel" {
		t.Fatalf("outside sentinel changed to %q", got)
	}
}
