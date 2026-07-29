package ralph

import (
	"os"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestRalphLoopCommandParsesRalphState(t *testing.T) {
	// Given: the one command owned by the legacy Ralph runtime.
	prompt := `/ralph-loop "fix bug" --max-iterations=42`

	// When: the UserPromptSubmit parser routes the command.
	args := parseLoopArgs(prompt)

	// Then: it yields the requested Ralph task and iteration limit.
	if args == nil {
		t.Fatal("parseLoopArgs(/ralph-loop) returned nil")
	}
	if args.Task != "fix bug" {
		t.Errorf("task = %q, want %q", args.Task, "fix bug")
	}
	if args.MaxIterations != 42 {
		t.Errorf("max iterations = %d, want 42", args.MaxIterations)
	}
}

func TestUlwRalphLoopCommandParsesVerifiedRalphState(t *testing.T) {
	// Given: the explicit Ralph-family Ultrawork verifier command.
	prompt := `/ulw-ralph-loop "fix bug" --max-iterations=500`

	// When: the UserPromptSubmit parser routes the command.
	args := parseLoopArgs(prompt)

	// Then: it yields Ralph state with the Ultrawork verifier strategy.
	if args == nil {
		t.Fatal("parseLoopArgs(/ulw-ralph-loop) returned nil")
	}
	if args.Task != "fix bug" {
		t.Errorf("task = %q, want %q", args.Task, "fix bug")
	}
	if args.MaxIterations != 500 {
		t.Errorf("max iterations = %d, want 500", args.MaxIterations)
	}
	if !args.Ultrawork {
		t.Fatal("Ultrawork = false, want true")
	}
}

func TestULWVerificationUsesGrokSubagentTools(t *testing.T) {
	prompt := buildULWVerification(&state{
		Iteration:                2,
		MaxIterations:            5,
		CompletionPromise:        "DONE",
		InitialCompletionPromise: "DONE",
		Prompt:                   "ship safely",
	})

	for _, token := range []string{"spawn_subagent", "get_command_or_subagent_output", "lazygrok:lazygrok-code-reviewer"} {
		if !strings.Contains(prompt, token) {
			t.Fatalf("verification prompt missing Grok token %q", token)
		}
	}
	for _, token := range []string{"task(", "Task(", "load_skills", "run_in_background"} {
		if strings.Contains(prompt, token) {
			t.Fatalf("verification prompt contains foreign token %q", token)
		}
	}
}

func TestULWTriggersDoNotRouteToLegacyRalph(t *testing.T) {
	triggers := []string{
		`/ulw "fix bug"`,
		`/ultrawork "fix bug"`,
		`/ulw-loop "fix bug"`,
		`ulw fix bug`,
		`ultrawork fix bug`,
	}
	for _, prompt := range triggers {
		t.Run(prompt, func(t *testing.T) {
			// Given: a trigger owned by the ULW goal-ledger contract.
			// When: the legacy Ralph parser sees the prompt.
			args := parseLoopArgs(prompt)

			// Then: it declines the prompt so ULW activation remains independent.
			if args != nil {
				t.Fatalf("parseLoopArgs(%q) = %#v, want nil", prompt, args)
			}
		})
	}
}

func TestULWTriggersDoNotMatchLegacyRalphCommand(t *testing.T) {
	triggers := []string{"/ulw", "/ultrawork", "/ulw-loop", "ulw", "ultrawork"}
	for _, prompt := range triggers {
		t.Run(prompt, func(t *testing.T) {
			// Given: a task-less ULW trigger.
			// When: the legacy Ralph command recognizer sees it.
			matched := matchedLoopCommand(prompt)

			// Then: Ralph does not claim the command or emit Ralph usage text.
			if matched {
				t.Fatalf("matchedLoopCommand(%q) = true, want false", prompt)
			}
		})
	}
}

func TestULWTriggersDoNotCreateRalphState(t *testing.T) {
	triggers := []string{"/ulw fix bug", "/ultrawork fix bug", "/ulw-loop fix bug", "ulw fix bug", "ultrawork fix bug"}
	for _, prompt := range triggers {
		t.Run(prompt, func(t *testing.T) {
			// Given: an isolated workspace and a ULW trigger.
			workspace := t.TempDir()
			event := hookenv.Event{WorkspaceRoot: workspace, Prompt: prompt}

			// When: the legacy Ralph collector handles UserPromptSubmit.
			context := CollectUserPrompt(event)

			// Then: it emits no Ralph context and persists no Ralph state.
			if context != "" {
				t.Fatalf("CollectUserPrompt(%q) = %q, want empty", prompt, context)
			}
			if _, err := os.Stat(StatePath(workspace)); !os.IsNotExist(err) {
				t.Fatalf("Ralph state after %q: os.Stat error = %v, want not exist", prompt, err)
			}
		})
	}
}

func TestUlwRalphLoopCreatesExplicitVerifiedRalphState(t *testing.T) {
	// Given: an isolated workspace and the explicit Ralph-family verifier command.
	workspace := t.TempDir()
	event := hookenv.Event{
		WorkspaceRoot: workspace,
		SessionID:     "session-explicit-ulw-ralph",
		Prompt:        `/ulw-ralph-loop "fix bug" --max-iterations=500`,
	}

	// When: the Ralph collector handles UserPromptSubmit.
	context := CollectUserPrompt(event)

	// Then: it initializes the Ralph continuation and identifies the verifier variant.
	if context == "" {
		t.Fatal("CollectUserPrompt(/ulw-ralph-loop) returned empty context")
	}
	data, err := os.ReadFile(StatePath(workspace))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "ultrawork: true") {
		t.Fatalf("Ralph state = %s, want ultrawork true", data)
	}
}
