package cmd

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestHookCommands_rejectHostileSessionBeforeStateAccess(t *testing.T) {
	for _, command := range []string{
		"session-start",
		"session-end",
		"user-prompt",
		"pre-tool-use",
		"subagent-start",
	} {
		t.Run(command, func(t *testing.T) {
			// Given: the original traversal payload resolves to a controlled external directory.
			root := t.TempDir()
			grokHome := filepath.Join(root, "grok-home")
			outsideDir := filepath.Join(root, "escaped-dir")
			if err := os.MkdirAll(grokHome, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.MkdirAll(outsideDir, 0o755); err != nil {
				t.Fatal(err)
			}
			sentinel := filepath.Join(outsideDir, "sentinel.txt")
			if err := os.WriteFile(sentinel, []byte("preserve"), 0o600); err != nil {
				t.Fatal(err)
			}
			process := exec.Command(os.Args[0], "-test.run=TestHookCommandHelper", "--", command)
			process.Env = append(os.Environ(),
				"LAZYGROK_HOOK_HELPER=1",
				"GROK_HOME="+grokHome,
				"GROK_SESSION_ID=",
			)
			process.Stdin = strings.NewReader(
				`{"sessionId":"../../../escaped-dir","hookEventName":"SessionEnd","prompt":"/plan"}`,
			)

			// When: the real hook command processes the hostile envelope.
			err := process.Run()

			// Then: the command rejects the event and preserves the external directory.
			if err == nil {
				t.Fatal("hook command accepted a hostile session ID")
			}
			got, readErr := os.ReadFile(sentinel)
			if readErr != nil {
				t.Fatalf("outside sentinel removed: %v", readErr)
			}
			if string(got) != "preserve" {
				t.Fatalf("outside sentinel changed to %q", got)
			}
		})
	}
}

func TestHookCommand_rejectsHostileEnvironmentSession(t *testing.T) {
	// Given: an envelope without a session and a hostile environment fallback.
	root := t.TempDir()
	grokHome := filepath.Join(root, "grok-home")
	outsideDir := filepath.Join(root, "escaped-dir")
	if err := os.MkdirAll(grokHome, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outsideDir, 0o755); err != nil {
		t.Fatal(err)
	}
	sentinel := filepath.Join(outsideDir, "sentinel.txt")
	if err := os.WriteFile(sentinel, []byte("preserve"), 0o600); err != nil {
		t.Fatal(err)
	}
	process := exec.Command(os.Args[0], "-test.run=TestHookCommandHelper", "--", "session-end")
	process.Env = append(os.Environ(),
		"LAZYGROK_HOOK_HELPER=1",
		"GROK_HOME="+grokHome,
		"GROK_SESSION_ID=../../../escaped-dir",
	)
	process.Stdin = strings.NewReader(`{"hookEventName":"SessionEnd"}`)

	// When: session-end resolves the environment fallback.
	err := process.Run()

	// Then: the fallback is rejected and the external directory survives.
	if err == nil {
		t.Fatal("session-end accepted a hostile GROK_SESSION_ID")
	}
	if got, readErr := os.ReadFile(sentinel); readErr != nil || string(got) != "preserve" {
		t.Fatalf("outside sentinel = %q, %v", got, readErr)
	}
}

func TestHookCommandsDoNotCreateSharedUnknownSessionState(t *testing.T) {
	for _, command := range []string{
		"session-start",
		"session-end",
		"user-prompt",
		"pre-tool-use",
		"post-tool-lsp",
	} {
		t.Run(command, func(t *testing.T) {
			grokHome := t.TempDir()
			process := exec.Command(os.Args[0], "-test.run=TestHookCommandHelper", "--", command)
			process.Env = append(os.Environ(),
				"LAZYGROK_HOOK_HELPER=1",
				"GROK_HOME="+grokHome,
				"GROK_SESSION_ID=",
			)
			process.Stdin = strings.NewReader(
				`{"hookEventName":"UserPromptSubmit","prompt":"/plan","toolName":"spawn_agent","toolInput":{"path":"missing.ts"}}`,
			)
			_ = process.Run()

			var unknown []string
			_ = filepath.WalkDir(grokHome, func(path string, entry os.DirEntry, err error) error {
				if err == nil && (entry.Name() == "unknown" || entry.Name() == "unknown.json") {
					unknown = append(unknown, path)
				}
				return nil
			})
			if len(unknown) != 0 {
				t.Fatalf("missing session created shared state: %v", unknown)
			}
		})
	}
}

func TestLifecycleRecordersRepairPrivateModes(t *testing.T) {
	grokHome := t.TempDir()
	t.Setenv("GROK_HOME", grokHome)
	ev := hookenv.Event{SessionID: "session", HookEventName: "PostToolUseFailure"}
	targets := []struct {
		path   string
		record func()
	}{
		{
			path: filepath.Join(
				grokHome,
				"state",
				"lazygrok",
				"diagnostics",
				"session",
				"events.jsonl",
			),
			record: func() { recordDiagnostic(ev, "post_tool_failure") },
		},
		{
			path: filepath.Join(
				grokHome,
				"state",
				"lazygrok",
				"subagents",
				"session",
				"lifecycle.jsonl",
			),
			record: func() { recordSubagentEvent(ev, "start") },
		},
	}
	for _, target := range targets {
		if err := os.MkdirAll(filepath.Dir(target.path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(target.path, []byte("existing\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		target.record()
		info, err := os.Stat(target.path)
		if err != nil {
			t.Fatal(err)
		}
		if mode := info.Mode().Perm(); mode != 0o600 {
			t.Fatalf("%s mode = %o, want 600", target.path, mode)
		}
		for dir := filepath.Dir(target.path); dir != grokHome; dir = filepath.Dir(dir) {
			info, err = os.Stat(dir)
			if err != nil {
				t.Fatal(err)
			}
			if mode := info.Mode().Perm(); mode != 0o700 {
				t.Fatalf("%s mode = %o, want 700", dir, mode)
			}
		}
	}
}

func TestHookCommandHelper(t *testing.T) {
	if os.Getenv("LAZYGROK_HOOK_HELPER") != "1" {
		return
	}
	separator := -1
	for i, arg := range os.Args {
		if arg == "--" {
			separator = i
			break
		}
	}
	if separator < 0 || separator+1 >= len(os.Args) {
		os.Exit(2)
	}
	os.Args = []string{"lazygrok-hook", os.Args[separator+1]}
	Execute()
	os.Exit(0)
}
