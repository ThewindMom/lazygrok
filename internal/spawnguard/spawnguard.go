package spawnguard

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"lazygrok/internal/hookenv"
)

const defaultFanoutLimit = 60

// SpawnToolTokens are the tool names that spawn subagents.
var SpawnToolTokens = map[string]bool{
	"spawn_subagent":             true,
	"spawn_agent":                true,
	"collaborationspawn_agent":   true,
	"collaboration.spawn_agent":  true,
	"task":                       true,
}

// EvaluatePreToolUse checks if a spawn_subagent call exceeds the fan-out limit.
// Returns a deny reason string (empty = allow).
func EvaluatePreToolUse(ev hookenv.Event) string {
	toolName := strings.ToLower(strings.TrimSpace(ev.ToolName))
	if !SpawnToolTokens[toolName] {
		return ""
	}

	sid := ev.SessionID
	if sid == "" {
		sid = "unknown"
	}

	gh := hookenv.GrokHome()
	stateDir := filepath.Join(gh, "state", "spawn-count")
	countPath := filepath.Join(stateDir, sid+".json")

	_ = os.MkdirAll(stateDir, 0o755)

	count := readCount(countPath) + 1
	writeCount(countPath, count)

	limit := fanoutLimit()
	if count <= limit {
		return ""
	}

	return "Spawn guard: subagent fan-out limit reached (" + strconv.Itoa(count) + "/" + strconv.Itoa(limit) +
		"). Too many subagents spawned this session. Consolidate work or cancel the loop with /cancel-ralph."
}

func readCount(path string) int {
	b, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	var data struct {
		Count int `json:"count"`
	}
	if json.Unmarshal(b, &data) != nil {
		return 0
	}
	return data.Count
}

func writeCount(path string, count int) {
	data, _ := json.MarshalIndent(struct {
		Count int `json:"count"`
	}{Count: count}, "", "  ")
	_ = os.WriteFile(path, append(data, '\n'), 0o644)
}

func fanoutLimit() int {
	if v := os.Getenv("LAZYGROK_SPAWN_FANOUT_LIMIT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return defaultFanoutLimit
}

// CleanupSession removes the spawn count for a session.
func CleanupSession(sessionID string) {
	if sessionID == "" {
		return
	}
	gh := hookenv.GrokHome()
	countPath := filepath.Join(gh, "state", "spawn-count", sessionID+".json")
	_ = os.Remove(countPath)
}
