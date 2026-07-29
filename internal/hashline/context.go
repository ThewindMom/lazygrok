package hashline

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/safestate"
)

type cachePayload struct {
	RelPath string            `json:"rel_path"`
	Path    string            `json:"path"`
	Updated string            `json:"updated_at"`
	Lines   map[string]string `json:"lines"`
}

// CollectContext returns hashline cache summary for UserPromptSubmit.
func CollectContext(sessionID, workspace string) string {
	mode, err := resolveMode(workspace, hookenv.GrokHome())
	if err != nil || mode == "off" {
		return ""
	}
	if sessionID == "" {
		return ""
	}
	root := hookenv.GrokHome()
	cacheDir := filepath.Join(hookenv.GrokHome(), "state", "hashline", sessionID)
	names, err := safestate.ListFileNamesBelow(root, cacheDir)
	if err != nil {
		return ""
	}
	maxFiles := 5
	if v := strings.TrimSpace(os.Getenv("HASHLINE_CONTEXT_MAX_FILES")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxFiles = n
		}
	}

	type item struct {
		mtime   int64
		rel     string
		samples []string
		total   int
	}
	var items []item

	for _, name := range names {
		if !strings.HasSuffix(name, ".json") {
			continue
		}
		b, err := safestate.ReadFileBelow(root, filepath.Join(cacheDir, name))
		if err != nil {
			continue
		}
		var data cachePayload
		if json.Unmarshal(b, &data) != nil || len(data.Lines) == 0 {
			continue
		}
		rel := strings.ReplaceAll(data.RelPath, "\\", "/")
		if rel == "" || filepath.IsAbs(rel) || rel == ".." || strings.HasPrefix(rel, "../") {
			continue
		}
		var lineNos []int
		for k := range data.Lines {
			if n, err := strconv.Atoi(k); err == nil {
				lineNos = append(lineNos, n)
			}
		}
		sort.Ints(lineNos)
		var samples []string
		for _, n := range lineNos {
			samples = append(samples, strconv.Itoa(n)+"#"+data.Lines[strconv.Itoa(n)])
			if len(samples) >= 4 {
				break
			}
		}
		var mtime int64
		if updated, err := time.Parse(time.RFC3339, data.Updated); err == nil {
			mtime = updated.Unix()
		}
		items = append(items, item{mtime, rel, samples, len(data.Lines)})
	}
	if len(items) == 0 {
		return ""
	}
	sort.Slice(items, func(i, j int) bool { return items[i].mtime > items[j].mtime })
	if len(items) > maxFiles {
		items = items[:maxFiles]
	}

	var out []string
	out = append(out,
		"<HASHLINE_CACHE>",
		"Hash-anchored edits: copy LINE#ID tags from Read output; PreToolUse blocks stale tags.",
		"",
	)
	for _, it := range items {
		sampleText := strings.Join(it.samples, ", ")
		extra := ""
		if it.total > len(it.samples) {
			extra = " (+" + strconv.Itoa(it.total-len(it.samples)) + " more)"
		}
		out = append(out, "- "+it.rel+": "+sampleText+extra)
	}
	out = append(out, "", "Re-read a file before StrReplace if its content changed since cache.", "</HASHLINE_CACHE>")
	return strings.Join(out, "\n")
}
