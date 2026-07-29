package boulder

import (
	"encoding/json"
	"path/filepath"
	"time"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/safestate"
)

const continuationMarkerDir = ".lazygrok/run-continuation"

// AutoContinuePaused reports whether /stop-continuation paused auto-continue.
func AutoContinuePaused(workspace, sessionID string) bool {
	if workspace == "" || sessionID == "" {
		return false
	}
	root := hookenv.GrokHome()
	flag := filepath.Join(root, "state", "stop-continuation", sessionID, "stopped")
	if _, err := safestate.ReadFileBelow(root, flag); err == nil {
		return true
	}
	mp := filepath.Join(workspace, continuationMarkerDir, sessionID+".json")
	b, err := safestate.ReadFile(mp)
	if err != nil {
		return false
	}
	var data struct {
		Sources map[string]struct {
			State string `json:"state"`
		} `json:"sources"`
	}
	if json.Unmarshal(b, &data) != nil {
		return false
	}
	if stop, ok := data.Sources["stop"]; ok && stop.State == "stopped" {
		return true
	}
	return false
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}
