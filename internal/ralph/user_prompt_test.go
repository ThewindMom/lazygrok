package ralph

import "testing"

func TestUlwSlashAliasActivatesUltrawork(t *testing.T) {
	args := parseLoopArgs(`/ulw "fix bug" --max-iterations=42`)
	if args == nil {
		t.Fatal("parseLoopArgs(/ulw) returned nil")
	}
	if !args.Ultrawork {
		t.Error("/ulw did not activate Ultrawork")
	}
	if args.Task != "fix bug" {
		t.Errorf("task = %q, want %q", args.Task, "fix bug")
	}
	if args.MaxIterations != 42 {
		t.Errorf("max iterations = %d, want 42", args.MaxIterations)
	}
}

func TestUlwSlashAliasWithoutTaskIsRecognized(t *testing.T) {
	if !matchedLoopCommand("/ulw") {
		t.Error("/ulw should be recognized so the caller can request a task")
	}
}
