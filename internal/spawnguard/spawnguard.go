package spawnguard

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/safestate"
)

const defaultFanoutLimit = 60

// SpawnToolTokens are the tool names that spawn subagents.
var SpawnToolTokens = map[string]bool{
	"spawn_subagent":            true,
	"spawn_agent":               true,
	"collaborationspawn_agent":  true,
	"collaboration.spawn_agent": true,
	"task":                      true,
}

// EvaluatePreToolUse checks if a spawn_subagent call exceeds the fan-out limit.
// Returns a deny reason string (empty = allow).
func EvaluatePreToolUse(ev hookenv.Event) string {
	toolName := strings.ToLower(strings.TrimSpace(ev.ToolName))
	if !SpawnToolTokens[toolName] {
		return ""
	}

	sid := ev.SessionID
	if _, err := hookenv.ParseSessionID(sid); err != nil || sid == "" {
		return ""
	}

	gh := hookenv.GrokHome()
	countPath := filepath.Join(gh, "state", "spawn-count", sid+".json")
	limit := fanoutLimit()
	count := 0
	denied := false
	lockPath := filepath.Join(gh, "state", "spawn-count", sid+".lock")
	err := safestate.WithFileLockBelow(gh, lockPath, func() error {
		current, readErr := readCount(gh, countPath)
		if readErr != nil {
			return readErr
		}
		count = current + 1
		if count > limit {
			denied = true
			return nil
		}
		return writeCount(gh, countPath, count)
	})
	if err != nil {
		return "Spawn guard: denied because the fan-out budget could not be reserved safely."
	}
	if !denied {
		return ""
	}

	return "Spawn guard: subagent fan-out limit reached (" + strconv.Itoa(count) + "/" + strconv.Itoa(limit) +
		"). Too many subagents spawned this session. Consolidate work or cancel the loop with /cancel-ralph."
}

func readCount(root, path string) (int, error) {
	b, err := safestate.ReadFileBelow(root, path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return 0, nil
		}
		return 0, err
	}
	var data struct {
		Count int `json:"count"`
	}
	if err := json.Unmarshal(b, &data); err != nil {
		return 0, fmt.Errorf("parse spawn counter: %w", err)
	}
	if data.Count < 0 {
		return 0, errors.New("parse spawn counter: count must be non-negative")
	}
	return data.Count, nil
}

func writeCount(root, path string, count int) error {
	data, err := json.MarshalIndent(struct {
		Count int `json:"count"`
	}{Count: count}, "", "  ")
	if err != nil {
		return err
	}
	return safestate.WriteFileBelow(root, path, append(data, '\n'), 0o600)
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
	lockPath := filepath.Join(gh, "state", "spawn-count", sessionID+".lock")
	_ = safestate.RemoveBelow(gh, countPath)
	_ = safestate.RemoveBelow(gh, lockPath)
}
