//go:build linux

package lsp

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestUpdateStashFromEventRequiresSessionID(t *testing.T) {
	home := t.TempDir()
	t.Setenv("GROK_HOME", home)
	stubDiagnostics(t)
	source := filepath.Join(t.TempDir(), "source.go")
	if err := os.WriteFile(source, []byte("package source\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	UpdateStashFromEvent(hookenv.Event{
		ToolName:  "write",
		ToolInput: map[string]any{"path": source},
	})

	if _, err := os.Stat(filepath.Join(home, "state", "lsp-diagnostics", "unknown.json")); !os.IsNotExist(err) {
		t.Fatalf("missing session created an unknown stash: %v", err)
	}
}

func TestUpdateStashFromEventRejectsUnsafeStashTargets(t *testing.T) {
	for _, kind := range []string{"symlink", "hardlink"} {
		t.Run(kind, func(t *testing.T) {
			home := t.TempDir()
			t.Setenv("GROK_HOME", home)
			stubDiagnostics(t)
			source := filepath.Join(t.TempDir(), "source.go")
			if err := os.WriteFile(source, []byte("package source\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			stateDir := filepath.Join(home, "state", "lsp-diagnostics")
			if err := os.MkdirAll(stateDir, 0o700); err != nil {
				t.Fatal(err)
			}
			outside := filepath.Join(t.TempDir(), "sentinel.json")
			if err := os.WriteFile(outside, []byte("sentinel"), 0o600); err != nil {
				t.Fatal(err)
			}
			target := filepath.Join(stateDir, "session.json")
			var err error
			if kind == "symlink" {
				err = os.Symlink(outside, target)
			} else {
				err = os.Link(outside, target)
			}
			if err != nil {
				t.Fatal(err)
			}

			UpdateStashFromEvent(hookenv.Event{
				SessionID: "session",
				ToolName:  "write",
				ToolInput: map[string]any{"path": source},
			})

			got, err := os.ReadFile(outside)
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != "sentinel" {
				t.Fatalf("outside sentinel changed to %q", got)
			}
		})
	}
}

func TestUpdateStashFromEventRepairsPrivateModes(t *testing.T) {
	home := t.TempDir()
	t.Setenv("GROK_HOME", home)
	stubDiagnostics(t)
	source := filepath.Join(t.TempDir(), "source.go")
	if err := os.WriteFile(source, []byte("package source\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	stateDir := filepath.Join(home, "state", "lsp-diagnostics")
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatal(err)
	}

	UpdateStashFromEvent(hookenv.Event{
		SessionID: "session",
		ToolName:  "write",
		ToolInput: map[string]any{"path": source},
	})

	for _, directory := range []string{filepath.Join(home, "state"), stateDir} {
		info, err := os.Stat(directory)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != 0o700 {
			t.Fatalf("%s mode = %o, want 700", directory, got)
		}
	}
	info, err := os.Stat(filepath.Join(stateDir, "session.json"))
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("stash mode = %o, want 600", got)
	}
}

func TestEvaluateStopWithPolicyHonorsResolvedConfiguration(t *testing.T) {
	home := t.TempDir()
	t.Setenv("GROK_HOME", home)
	path := StashPath("session")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	writeJSON(t, path, stashFile{
		Version: 1,
		Files: map[string]stashFileEntry{
			"broken.go": {Diagnostics: "error[type] (1:1): broken", HasErrors: true},
		},
	})

	if block, _ := EvaluateStopWithPolicy("session", false); block {
		t.Fatal("disabled policy blocked Stop")
	}
	if block, _ := EvaluateStopWithPolicy("session", true); !block {
		t.Fatal("enabled policy allowed unresolved errors")
	}
}

func TestRunDiagnosticsInstallsRequestContext(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node unavailable")
	}
	packageDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	root, err := filepath.Abs(filepath.Join(packageDir, "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("GROK_PLUGIN_ROOT", root)
	workspace := t.TempDir()
	source := filepath.Join(workspace, "broken.ts")
	if err := os.WriteFile(source, []byte("const value: string = 1;\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	fixture := filepath.Join(root, "vendor", "lazygrok-hooks", "lsp-core", "src", "lsp", "fixtures", "workspace-edit-server.mjs")
	scenario := filepath.Join(workspace, "scenario.json")
	events := filepath.Join(workspace, "events.jsonl")
	config := filepath.Join(workspace, "lsp-client.json")
	writeJSON(t, scenario, map[string]any{
		"capabilities": map[string]any{"textDocumentSync": 1},
		"publishDiagnostics": []any{map[string]any{
			"trigger": "didOpen",
			"version": 1,
			"diagnostics": []any{map[string]any{
				"range": map[string]any{
					"start": map[string]any{"line": 0, "character": 0},
					"end":   map[string]any{"line": 0, "character": 5},
				},
				"severity": 1,
				"source":   "fixture",
				"message":  "controlled diagnostic",
			}},
		}},
	})
	writeJSON(t, config, map[string]any{
		"lsp": map[string]any{
			"fixture": map[string]any{
				"command":    []string{"node", fixture, scenario, events},
				"extensions": []string{".ts"},
				"priority":   100,
			},
		},
	})
	t.Setenv("LSP_TOOLS_MCP_USER_CONFIG", config)

	output, err := runDiagnostics(source, workspace)
	if err != nil {
		t.Fatalf("runDiagnostics: %v", err)
	}
	if strings.Contains(output, "LspRequestContextUnavailableError") {
		t.Fatalf("request context was not installed: %s", output)
	}
	if !strings.Contains(output, "controlled diagnostic") {
		t.Fatalf("packaged LSP runtime did not return fixture diagnostic: %s", output)
	}
}

func writeJSON(t *testing.T, path string, value any) {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
}

func stubDiagnostics(t *testing.T) {
	t.Helper()
	original := collectDiagnostics
	collectDiagnostics = func(string, string) (string, error) {
		return "error[test] (1:1): broken", nil
	}
	t.Cleanup(func() {
		collectDiagnostics = original
	})
}
