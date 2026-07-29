package lsp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/safestate"
)

var (
	patchPrefixes = []string{"*** Add File: ", "*** Update File: ", "*** Move to: "}
	mutationTools = map[string]struct{}{
		"apply_patch": {}, "write": {}, "strreplace": {}, "str_replace": {},
		"edit": {}, "multiedit": {}, "multi_edit": {}, "editnotebook": {},
	}
	collectDiagnostics = runDiagnostics
)

// UpdateStashFromEvent runs diagnostics for mutated paths in a PostToolUse event.
func UpdateStashFromEvent(ev hookenv.Event) {
	paths := extractMutatedPaths(ev)
	if len(paths) == 0 {
		return
	}
	ws := ev.WorkspaceRoot
	if ws == "" {
		ws = os.Getenv("GROK_WORKSPACE_ROOT")
	}
	sid := ev.SessionID
	if sid == "" {
		return
	}
	stashPath := StashPath(sid)
	if stashPath == "" {
		return
	}
	for _, rel := range paths {
		abs := rel
		if !filepath.IsAbs(abs) && ws != "" {
			abs = filepath.Join(ws, strings.TrimPrefix(rel, "./"))
		}
		if _, err := os.Stat(abs); err != nil {
			continue
		}
		diagnosticRoot := ws
		if diagnosticRoot == "" {
			diagnosticRoot = filepath.Dir(abs)
		}
		diag, err := collectDiagnostics(abs, diagnosticRoot)
		if err != nil {
			continue
		}
		mergeDiagnostics(stashPath, abs, diag)
	}
}

func extractMutatedPaths(ev hookenv.Event) []string {
	name := strings.ToLower(strings.TrimSpace(ev.ToolName))
	if name != "" && !isMutationTool(name) {
		return nil
	}
	if isFailedResponse(ev) {
		return nil
	}
	block := ev.ToolInput
	if block == nil {
		return nil
	}
	set := make(map[string]struct{})
	for _, k := range []string{"path", "filePath", "file_path", "target_file", "targetFile"} {
		if v, ok := block[k].(string); ok && v != "" {
			set[v] = struct{}{}
		}
	}
	for _, k := range []string{"paths", "filePaths", "file_paths"} {
		if arr, ok := block[k].([]any); ok {
			for _, it := range arr {
				if s, ok := it.(string); ok && s != "" {
					set[s] = struct{}{}
				}
			}
		}
	}
	for _, k := range []string{"input", "patch", "command"} {
		if v, ok := block[k].(string); ok {
			addPatchPaths(set, v)
		}
	}
	for _, k := range []string{"files", "changes"} {
		if arr, ok := block[k].([]any); ok {
			for _, it := range arr {
				m, ok := it.(map[string]any)
				if !ok {
					continue
				}
				for _, pk := range []string{"path", "filePath", "file_path", "movePath", "move_path"} {
					if v, ok := m[pk].(string); ok && v != "" {
						set[v] = struct{}{}
					}
				}
			}
		}
	}
	var out []string
	for p := range set {
		out = append(out, p)
	}
	return out
}

func isMutationTool(name string) bool {
	_, ok := mutationTools[strings.ToLower(name)]
	return ok
}

func isFailedResponse(ev hookenv.Event) bool {
	// PostTool events may include response in raw map — not on Event struct; skip.
	return false
}

func addPatchPaths(set map[string]struct{}, payload string) {
	for _, line := range strings.Split(payload, "\n") {
		for _, prefix := range patchPrefixes {
			if strings.HasPrefix(line, prefix) {
				set[strings.TrimSpace(line[len(prefix):])] = struct{}{}
			}
		}
	}
}

func toolsModule() string {
	root, err := hookenv.PluginRoot()
	if err != nil {
		return ""
	}
	mod := filepath.Join(root, "vendor", "lazygrok-hooks", "lsp-tools-mcp", "dist", "cli.js")
	if _, err := os.Stat(mod); err != nil {
		return ""
	}
	return mod
}

func runDiagnostics(absPath, workspace string) (string, error) {
	mod := toolsModule()
	if mod == "" {
		return "", os.ErrNotExist
	}
	if _, err := exec.LookPath("node"); err != nil {
		return "", err
	}
	requests := []map[string]any{
		{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "initialize",
			"params": map[string]any{
				"protocolVersion": "2024-11-05",
				"capabilities":    map[string]any{},
				"clientInfo":      map[string]string{"name": "lazygrok-hook", "version": "1"},
			},
		},
		{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  "tools/call",
			"params": map[string]any{
				"name":      "diagnostics",
				"arguments": map[string]any{"filePath": absPath, "severity": "error"},
			},
		},
	}
	var input strings.Builder
	for _, request := range requests {
		data, err := json.Marshal(request)
		if err != nil {
			return "", err
		}
		input.Write(data)
		input.WriteByte('\n')
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "node", mod, "mcp")
	cmd.Dir = workspace
	cmd.Env = append(os.Environ(), "CODEX_HOME="+codexHome())
	cmd.Stdin = strings.NewReader(input.String())
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("run LSP diagnostics: %w: %s", err, strings.TrimSpace(string(out)))
	}
	decoder := json.NewDecoder(strings.NewReader(string(out)))
	for {
		var response struct {
			ID     int `json:"id"`
			Result struct {
				Content []struct {
					Text string `json:"text"`
				} `json:"content"`
				IsError bool `json:"isError"`
			} `json:"result"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := decoder.Decode(&response); err != nil {
			if err == io.EOF {
				break
			}
			return "", fmt.Errorf("decode LSP response: %w", err)
		}
		if response.ID != 2 {
			continue
		}
		if response.Error != nil {
			return "", fmt.Errorf("LSP diagnostics request: %s", response.Error.Message)
		}
		var text []string
		for _, block := range response.Result.Content {
			if block.Text != "" {
				text = append(text, block.Text)
			}
		}
		diagnostics := strings.TrimSpace(strings.Join(text, "\n"))
		if response.Result.IsError {
			return "", fmt.Errorf("LSP diagnostics: %s", diagnostics)
		}
		return diagnostics, nil
	}
	return "", fmt.Errorf("LSP diagnostics response missing")
}

func codexHome() string {
	if ch := os.Getenv("CODEX_HOME"); ch != "" {
		return ch
	}
	if home, err := os.UserHomeDir(); err == nil {
		return filepath.Join(home, ".codex")
	}
	return ""
}

const cleanText = "No diagnostics found"
const unsupportedPrefix = "No LSP server configured for extension:"

func isUnavailable(text string) bool {
	normalized := strings.TrimSpace(text)
	if normalized == "" {
		return false
	}
	markers := []string{
		"LSP request timeout (method: initialize)",
		"LSP server is still initializing",
		"NOT INSTALLED",
		"Command not found:",
	}
	for _, m := range markers {
		if strings.Contains(normalized, m) {
			return true
		}
	}
	return false
}

func hasErrors(text string) bool {
	normalized := strings.TrimSpace(text)
	if normalized == "" {
		return false
	}
	if normalized == cleanText {
		return false
	}
	if strings.HasPrefix(normalized, unsupportedPrefix) {
		return false
	}
	if isUnavailable(normalized) {
		return false
	}
	if errorPattern.MatchString(normalized) {
		return true
	}
	lower := strings.ToLower(normalized)
	return strings.HasPrefix(lower, "error") || strings.Contains(lower, "error[")
}

func mergeDiagnostics(stashPath, filePath, diagnostics string) {
	var stash stashFile
	b, err := safestate.ReadFileBelow(stashRoot(), stashPath)
	if err == nil {
		_ = json.Unmarshal(b, &stash)
	}
	if stash.Files == nil {
		stash.Files = make(map[string]stashFileEntry)
	}
	if stash.Version == 0 {
		stash.Version = 1
	}
	entry := stashFileEntry{
		Diagnostics: diagnostics,
		HasErrors:   hasErrors(diagnostics),
	}
	if entry.HasErrors {
		stash.Files[filePath] = entry
	} else {
		delete(stash.Files, filePath)
	}
	out, _ := json.MarshalIndent(stash, "", "  ")
	_ = safestate.WriteFileBelow(stashRoot(), stashPath, append(out, '\n'), 0o600)
}

// CleanupSession removes LSP stash for session-end.
func CleanupSession(sessionID string) {
	path := StashPath(sessionID)
	if path == "" {
		return
	}
	_ = safestate.RemoveBelow(stashRoot(), path)
}
