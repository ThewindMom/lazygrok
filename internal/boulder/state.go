package boulder

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"lazygrok/internal/hookenv"
)

const boulderFile = ".lazygrok/boulder.json"

func boulderPath(workspace string) string {
	return filepath.Join(workspace, boulderFile)
}

func readBoulder(workspace string) map[string]any {
	b, err := os.ReadFile(boulderPath(workspace))
	if err != nil {
		return nil
	}
	var state map[string]any
	if json.Unmarshal(b, &state) != nil {
		return nil
	}
	return state
}

func writeBoulder(workspace string, state map[string]any) bool {
	path := boulderPath(workspace)
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	b, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return false
	}
	return os.WriteFile(path, append(b, '\n'), 0o644) == nil
}

func getWorks(state map[string]any) []map[string]any {
	works, ok := state["works"].(map[string]any)
	if !ok {
		return nil
	}
	var out []map[string]any
	for _, w := range works {
		if m, ok := w.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out
}

func getWorkForSession(state map[string]any, sessionID string) map[string]any {
	for _, work := range getWorks(state) {
		ids, _ := work["session_ids"].([]any)
		for _, id := range ids {
			if s, ok := id.(string); ok && s == sessionID {
				return work
			}
		}
	}
	ids, _ := state["session_ids"].([]any)
	for _, id := range ids {
		if s, ok := id.(string); ok && s == sessionID {
			return map[string]any{
				"work_id":        state["active_work_id"],
				"active_plan":    state["active_plan"],
				"plan_name":      state["plan_name"],
				"status":         state["status"],
				"started_at":     state["started_at"],
				"ended_at":       state["ended_at"],
				"elapsed_ms":     state["elapsed_ms"],
				"session_ids":    state["session_ids"],
				"task_sessions":  state["task_sessions"],
				"worktree_path":  state["worktree_path"],
			}
		}
	}
	return nil
}

func appendSessionToBoulder(workspace, sessionID string) {
	state := readBoulder(workspace)
	if state == nil {
		return
	}
	ids := stringSlice(state["session_ids"])
	if !containsStr(ids, sessionID) {
		ids = append(ids, sessionID)
		state["session_ids"] = toAnySlice(ids)
		state["updated_at"] = nowISO()
		wid, _ := state["active_work_id"].(string)
		if works, ok := state["works"].(map[string]any); ok && wid != "" {
			if w, ok := works[wid].(map[string]any); ok {
				wids := stringSlice(w["session_ids"])
				if !containsStr(wids, sessionID) {
					wids = append(wids, sessionID)
					w["session_ids"] = toAnySlice(wids)
					w["updated_at"] = nowISO()
					works[wid] = w
				}
			}
		}
		writeBoulder(workspace, state)
	}
}

func stringSlice(v any) []string {
	arr, ok := v.([]any)
	if !ok {
		return nil
	}
	var out []string
	for _, x := range arr {
		if s, ok := x.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func toAnySlice(ss []string) []any {
	out := make([]any, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}

func containsStr(ss []string, s string) bool {
	for _, x := range ss {
		if x == s {
			return true
		}
	}
	return false
}

func parseISOMs(value string) *int64 {
	if value == "" {
		return nil
	}
	v := strings.ReplaceAll(value, "Z", "+00:00")
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05+00:00", v)
	}
	if err != nil {
		return nil
	}
	ms := t.UnixMilli()
	return &ms
}

func formatDurationHuman(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	sec := ms / 1000
	if sec < 60 {
		return formatInt(sec) + "s"
	}
	min := sec / 60
	sec %= 60
	if min < 60 {
		return formatInt(min) + "m " + formatInt(sec) + "s"
	}
	hour := min / 60
	min %= 60
	if hour < 24 {
		return formatInt(hour) + "h " + formatInt(min) + "m"
	}
	day := hour / 24
	hour %= 24
	return formatInt(day) + "d " + formatInt(hour) + "h"
}

func formatInt(n int64) string {
	if n == 0 {
		return "0"
	}
	var digits []byte
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	if neg {
		return "-" + string(digits)
	}
	return string(digits)
}

func nudgeStatePath(sessionID string) string {
	return filepath.Join(hookenv.GrokHome(), "state", "boulder-nudge", sessionID, "nudged.json")
}

func wasBoulderNudged(workID, sessionID string) bool {
	b, err := os.ReadFile(nudgeStatePath(sessionID))
	if err != nil {
		return false
	}
	var data struct {
		WorkIDs []string `json:"work_ids"`
	}
	if json.Unmarshal(b, &data) != nil {
		return false
	}
	for _, id := range data.WorkIDs {
		if id == workID {
			return true
		}
	}
	return false
}

func markBoulderNudged(workID, sessionID string) {
	path := nudgeStatePath(sessionID)
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	data := map[string]any{"work_ids": []string{}}
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &data)
	}
	ids, _ := data["work_ids"].([]any)
	var strIDs []string
	for _, x := range ids {
		if s, ok := x.(string); ok {
			strIDs = append(strIDs, s)
		}
	}
	if !containsStr(strIDs, workID) {
		strIDs = append(strIDs, workID)
	}
	data["work_ids"] = toAnySlice(strIDs)
	data["updated_at"] = nowISO()
	b, _ := json.MarshalIndent(data, "", "  ")
	_ = os.WriteFile(path, append(b, '\n'), 0o644)
}