package lsp

import (
	"encoding/json"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"lazygrok/internal/config"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/safestate"
)

var errorPattern = regexp.MustCompile(`(?m)^(?:error|warning|information|hint)\[[^\]\r\n]+\] \(\d+:\d+:`)

// StashPath returns ~/.grok/state/lsp-diagnostics/<session>.json
func StashPath(sessionID string) string {
	validated, err := hookenv.ParseSessionID(sessionID)
	if err != nil || validated == "" {
		return ""
	}
	return filepath.Join(stashRoot(), "state", "lsp-diagnostics", validated+".json")
}

func stashRoot() string {
	return hookenv.GrokHome()
}

// EnforceEnabled reports whether LSP stop enforcement is on (LAZYGROK_LSP_ENFORCE, default on).
func EnforceEnabled() bool {
	return config.LSPEnforceEnabled()
}

type stashFile struct {
	Version int                       `json:"version"`
	Files   map[string]stashFileEntry `json:"files"`
}

type stashFileEntry struct {
	Diagnostics string `json:"diagnostics"`
	HasErrors   bool   `json:"has_errors"`
}

// EvaluateStop blocks when the LSP stash has unresolved errors.
func EvaluateStop(sessionID string) (bool, string) {
	return EvaluateStopWithPolicy(sessionID, EnforceEnabled())
}

// EvaluateStopWithPolicy blocks when enabled and the LSP stash has unresolved errors.
func EvaluateStopWithPolicy(sessionID string, enabled bool) (bool, string) {
	if !enabled {
		return false, ""
	}
	path := StashPath(sessionID)
	if path == "" {
		return false, ""
	}
	b, err := safestate.ReadFileBelow(stashRoot(), path)
	if err != nil {
		return false, ""
	}
	var stash stashFile
	if json.Unmarshal(b, &stash) != nil || len(stash.Files) == 0 {
		return false, ""
	}
	var filePaths []string
	for p, e := range stash.Files {
		if e.HasErrors {
			filePaths = append(filePaths, p)
		}
	}
	if len(filePaths) == 0 {
		return false, ""
	}
	sort.Strings(filePaths)
	var blocks []string
	for _, filePath := range filePaths {
		entry := stash.Files[filePath]
		lines := []string{"LSP diagnostics for " + filePath + ":"}
		diag := strings.TrimSpace(entry.Diagnostics)
		if diag != "" {
			for _, chunk := range strings.Split(strings.ReplaceAll(diag, "\r\n", "\n"), "\n") {
				chunk = strings.TrimSpace(chunk)
				if chunk == "" {
					continue
				}
				if errorPattern.MatchString(chunk) {
					lines = append(lines, "- "+chunk)
				} else {
					lines = append(lines, chunk)
				}
			}
		} else {
			lines = append(lines, "(empty)")
		}
		blocks = append(blocks, strings.Join(lines, "\n"))
	}
	body := strings.Join(blocks, "\n\n")
	msg := "Stop blocked: LSP errors remain in files you edited this session.\n" +
		"Run diagnostics on each file and fix errors before stopping.\n\n" + body
	return true, strings.TrimSpace(msg)
}
