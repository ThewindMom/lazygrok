package boulder

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"lazygrok/internal/hookenv"
)

const continuationMarkerDir = ".lazygrok/run-continuation"

// AutoContinuePaused reports whether /stop-continuation paused auto-continue.
func AutoContinuePaused(workspace, sessionID string) bool {
	if workspace == "" || sessionID == "" {
		return false
	}
	flag := filepath.Join(hookenv.GrokHome(), "state", "stop-continuation", sessionID, "stopped")
	if _, err := os.Stat(flag); err == nil {
		return true
	}
	mp := filepath.Join(workspace, continuationMarkerDir, sessionID+".json")
	b, err := os.ReadFile(mp)
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