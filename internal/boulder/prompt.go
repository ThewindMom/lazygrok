package boulder

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/ralph"
	"lazygrok/internal/safestate"
)

var (
	stopContRE   = regexp.MustCompile(`(?i)^/?stop-continuation\b`)
	resumeContRE = regexp.MustCompile(`(?i)^/?resume-continuation\b`)
)

func markerPath(workspace, sessionID string) string {
	return filepath.Join(workspace, continuationMarkerDir, sessionID+".json")
}

// SetContinuationStopped marks auto-continue paused for this session.
func SetContinuationStopped(workspace, sessionID string) error {
	if sessionID == "" {
		return nil
	}
	root := hookenv.GrokHome()
	flag := filepath.Join(root, "state", "stop-continuation", sessionID, "stopped")
	if err := safestate.WriteFileBelow(root, flag, []byte(nowISO()+"\n"), 0o600); err != nil {
		return err
	}
	if workspace == "" {
		return nil
	}
	mp := markerPath(workspace, sessionID)
	existing := map[string]any{}
	if b, err := safestate.ReadFile(mp); err == nil {
		_ = json.Unmarshal(b, &existing)
	}
	sources, _ := existing["sources"].(map[string]any)
	if sources == nil {
		sources = map[string]any{}
	}
	sources["stop"] = map[string]any{
		"state":     "stopped",
		"reason":    "Continuation stopped via /stop-continuation",
		"updatedAt": nowISO(),
	}
	existing["sessionID"] = sessionID
	existing["updatedAt"] = nowISO()
	existing["sources"] = sources
	b, _ := json.MarshalIndent(existing, "", "  ")
	return safestate.WriteFile(mp, append(b, '\n'), 0o600)
}

// ClearContinuationStopped resumes auto-continue.
func ClearContinuationStopped(workspace, sessionID string) {
	if sessionID == "" {
		return
	}
	root := hookenv.GrokHome()
	flag := filepath.Join(root, "state", "stop-continuation", sessionID, "stopped")
	_ = safestate.RemoveBelow(root, flag)
	if workspace == "" {
		return
	}
	mp := markerPath(workspace, sessionID)
	b, err := safestate.ReadFile(mp)
	if err != nil {
		return
	}
	var data map[string]any
	if json.Unmarshal(b, &data) != nil {
		return
	}
	sources, _ := data["sources"].(map[string]any)
	if sources == nil {
		return
	}
	sources["stop"] = map[string]any{"state": "idle", "updatedAt": nowISO()}
	data["sources"] = sources
	data["updatedAt"] = nowISO()
	out, _ := json.MarshalIndent(data, "", "  ")
	_ = safestate.WriteFile(mp, append(out, '\n'), 0o600)
}

// ClearBoulder removes .lazygrok/boulder.json in workspace.
func ClearBoulder(workspace string) error {
	if workspace == "" {
		return nil
	}
	return safestate.Remove(boulderPath(workspace))
}

// CollectStopContinuation handles /stop-continuation and /resume-continuation.
func CollectStopContinuation(ev hookenv.Event) string {
	prompt := strings.TrimSpace(ev.Prompt)
	if prompt == "" {
		return ""
	}
	ws := hookenv.Workspace(ev)
	sid := ev.SessionID

	if stopContRE.MatchString(prompt) {
		if ws != "" {
			if err := ralph.ClearStateForSession(ralph.StatePath(ws), sid); err != nil {
				return "<STOP_CONTINUATION>Unable to stop safely: Ralph/ultrawork loop state could not be cleared. Repair workspace state storage, then retry.</STOP_CONTINUATION>"
			}
			if err := ClearBoulder(ws); err != nil {
				return "<STOP_CONTINUATION>Unable to stop safely: boulder state could not be cleared. Repair workspace state storage, then retry.</STOP_CONTINUATION>"
			}
		}
		if err := SetContinuationStopped(ws, sid); err != nil {
			return "<STOP_CONTINUATION>Unable to persist the stop marker. Repair continuation state storage, then retry.</STOP_CONTINUATION>"
		}
		return "<STOP_CONTINUATION>Stopped: todo continuation, Ralph/ultrawork loop, and boulder.json cleared. Auto-continue resumes on SessionEnd or /resume-continuation.</STOP_CONTINUATION>"
	}
	if resumeContRE.MatchString(prompt) {
		ClearContinuationStopped(ws, sid)
		return "<STOP_CONTINUATION>Auto-continuation resumed for this session.</STOP_CONTINUATION>"
	}
	return ""
}

// CollectPromptContext returns active boulder state summary.
func CollectPromptContext(workspace, sessionID string) string {
	return BuildBoulderContext(workspace, sessionID)
}

// BuildBoulderContext mirrors omo_state build_boulder_context.
func BuildBoulderContext(workspace, sessionID string) string {
	state := readBoulder(workspace)
	if state == nil {
		return ""
	}
	work := getWorkForSession(state, sessionID)
	ids := stringSlice(state["session_ids"])
	if work == nil && !containsStr(ids, sessionID) {
		return ""
	}
	subject := state
	if work != nil {
		subject = work
	}
	status, _ := subject["status"].(string)
	if status == "paused" || status == "abandoned" {
		return ""
	}
	planPath := resolvePlanPath(workspace, state, work)
	planName, _ := subject["plan_name"].(string)
	if planName == "" {
		planName = "plan"
	}
	progress := getPlanProgress(planPath)
	remaining := progress.Total - progress.Completed
	activePlan, _ := subject["active_plan"].(string)
	if activePlan == "" {
		if ap, ok := state["active_plan"].(string); ok {
			activePlan = ap
		}
	}
	var lines []string
	lines = append(lines,
		"<BOULDER_STATE>",
		"Active plan: "+planName,
		"Plan file: "+activePlan,
		fmt.Sprintf("Progress: %d/%d tasks", progress.Completed, progress.Total),
		"Status: "+orDefault(status, "active"),
	)
	if wt, ok := subject["worktree_path"].(string); ok && wt != "" {
		lines = append(lines, "Worktree: "+wt)
	}
	if remaining > 0 {
		lines = append(lines, fmt.Sprintf("%d task(s) remaining — read the plan and continue.", remaining))
	}
	lines = append(lines, "</BOULDER_STATE>")
	return strings.Join(lines, "\n")
}

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

// CleanupOMOSession clears continuation + nudge state on session-end.
func CleanupOMOSession(workspace, sessionID string) {
	if sessionID == "" {
		return
	}
	ClearContinuationStopped(workspace, sessionID)
	root := hookenv.GrokHome()
	nudge := filepath.Join(root, "state", "boulder-nudge", sessionID, "nudged.json")
	_ = safestate.RemoveBelow(root, nudge)
}
