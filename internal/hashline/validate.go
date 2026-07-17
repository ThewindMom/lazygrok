package hashline

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"lazygrok/internal/hookenv"
)

var hashRefRE = regexp.MustCompile(`([0-9]+)#([ZPMQVRWSNKTXJBYH]{2})`)

var mutationTools = map[string]struct{}{
	"strreplace": {}, "str_replace": {}, "edit": {},
	"multiedit": {}, "multi_edit": {},
}

// ValidatePreTool returns a deny reason when LINE#ID anchors are stale, or "" to allow.
func ValidatePreTool(ev hookenv.Event) string {
	if !Enabled() {
		return ""
	}
	tool := strings.ToLower(strings.TrimSpace(ev.ToolName))
	if _, ok := mutationTools[tool]; !ok {
		return ""
	}
	block := ev.ToolInput
	if block == nil {
		return ""
	}
	filePath := pickString(block, "path", "file_path", "filePath", "target_file", "targetFile")
	if filePath == "" {
		return ""
	}
	oldString, _ := block["old_string"].(string)
	if oldString == "" {
		if s, ok := block["oldString"].(string); ok {
			oldString = s
		}
	}
	if oldString == "" {
		return ""
	}
	refs := hashRefRE.FindAllStringSubmatch(oldString, -1)
	if len(refs) == 0 {
		return ""
	}

	absPath := resolvePath(filePath, ev.WorkspaceRoot)
	if absPath == "" {
		return ""
	}
	cacheFile := cacheFilePath(hookenv.GrokHome(), ev.SessionID, absPath)
	data, err := os.ReadFile(cacheFile)
	if err != nil {
		return fmt.Sprintf(
			"Hashline: LINE#ID anchors in old_string but no read cache for this file. Read %s first, then retry with current tags.",
			filePath,
		)
	}
	var cache struct {
		Lines   map[string]string `json:"lines"`
		RelPath string            `json:"rel_path"`
	}
	if err := json.Unmarshal(data, &cache); err != nil || len(cache.Lines) == 0 {
		return "Hashline: corrupt read cache; re-read the file before editing."
	}

	type staleEntry struct {
		line     int
		expected string
		cached   *string
	}
	var stale []staleEntry
	for _, m := range refs {
		lineS, expected := m[1], m[2]
		cached, ok := cache.Lines[lineS]
		if !ok {
			lineNo, _ := strconv.Atoi(lineS)
			stale = append(stale, staleEntry{lineNo, expected, nil})
			continue
		}
		if cached != expected {
			lineNo, _ := strconv.Atoi(lineS)
			c := cached
			stale = append(stale, staleEntry{lineNo, expected, &c})
		}
	}
	if len(stale) == 0 {
		return ""
	}

	rel := cache.RelPath
	if rel == "" {
		rel = absPath
	}
	liveLines, _ := readLines(absPath)
	var parts []string
	parts = append(parts, fmt.Sprintf(
		"Hashline: stale LINE#ID in StrReplace for %s. File changed since last Read — re-read and copy fresh tags.",
		rel,
	))
	sort.Slice(stale, func(i, j int) bool { return stale[i].line < stale[j].line })
	for _, s := range stale {
		if s.cached != nil {
			parts = append(parts, fmt.Sprintf("  line %d: used %d#%s, cache has %d#%s", s.line, s.line, s.expected, s.line, *s.cached))
		} else {
			parts = append(parts, fmt.Sprintf("  line %d: used %d#%s, not in cache", s.line, s.line, s.expected))
		}
		if s.line >= 1 && s.line <= len(liveLines) {
			actual := ComputeLineHash(s.line, liveLines[s.line-1])
			parts = append(parts, fmt.Sprintf("    current: %d#%s", s.line, actual))
		}
	}
	return strings.Join(parts, "\n")
}

func pickString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok && strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func resolvePath(raw, workspace string) string {
	if raw == "" {
		return ""
	}
	candidate := raw
	if !filepath.IsAbs(candidate) && workspace != "" {
		candidate = filepath.Join(workspace, raw)
	}
	abs, err := filepath.Abs(candidate)
	if err != nil {
		return ""
	}
	return abs
}

func readLines(path string) ([]string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.ReplaceAll(string(b), "\r\n", "\n"), "\n"), nil
}

func cacheFilePath(grokHome, sessionID, absPath string) string {
	if sessionID == "" {
		sessionID = "unknown"
	}
	digest := sha256Hex(absPath)
	return filepath.Join(grokHome, "state", "hashline", sessionID, digest+".json")
}