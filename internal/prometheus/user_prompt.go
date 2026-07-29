package prometheus

import (
	"encoding/json"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/safestate"
)

var (
	planRE       = regexp.MustCompile(`(?i)^/?(?:plan|prometheus)\b`)
	startWorkRE  = regexp.MustCompile(`(?i)^/?start-work\b`)
	cancelPlanRE = regexp.MustCompile(`(?i)^/?cancel-plan\b`)
	startWorkArg = regexp.MustCompile(`(?is)^/?start-work(?:\s+(.+))?$`)
)

func planModeFlag(sessionID string) string {
	if sessionID == "" {
		return ""
	}
	if _, err := hookenv.ParseSessionID(sessionID); err != nil {
		return ""
	}
	return filepath.Join(hookenv.GrokHome(), "state", "plan-mode", sessionID, "enabled")
}

func planModeOn(sessionID string) {
	f := planModeFlag(sessionID)
	if f == "" {
		return
	}
	_ = safestate.WriteFileBelow(hookenv.GrokHome(), f, []byte(time.Now().UTC().Format(time.RFC3339)+"\n"), 0o600)
}

func planModeOff(sessionID string) {
	f := planModeFlag(sessionID)
	if f != "" {
		_ = safestate.RemoveBelow(hookenv.GrokHome(), f)
	}
}

const planModeBanner = "<PROMETHEUS_PLAN_MODE>\n" +
	"You are in planning mode. ONLY create or edit files under `.lazygrok/` (plans, drafts).\n" +
	`Interview the user, then spawn_subagent({subagent_type: "lazygrok:metis", prompt: "TASK: identify planning gaps", background: true}) and wait with get_command_or_subagent_output; write the plan to ` + "`.lazygrok/plans/<name>.md`" + `; optionally review it with spawn_subagent using "lazygrok:momus".` + "\n" +
	"Implementation starts only after `/start-work <plan-file>`.\n" +
	"</PROMETHEUS_PLAN_MODE>"

// CollectUserPrompt handles /plan, /start-work, /cancel-plan on UserPromptSubmit.
func CollectUserPrompt(ev hookenv.Event) string {
	prompt := strings.TrimSpace(ev.Prompt)
	if prompt == "" {
		return ""
	}
	sid := ev.SessionID
	ws := hookenv.Workspace(ev)

	if planRE.MatchString(prompt) {
		planModeOn(sid)
		return planModeBanner
	}
	if startWorkRE.MatchString(prompt) {
		return handleStartWork(ws, sid, prompt)
	}
	if cancelPlanRE.MatchString(prompt) {
		planModeOff(sid)
		return "<PROMETHEUS_PLAN_MODE>Plan mode cancelled.</PROMETHEUS_PLAN_MODE>"
	}
	return ""
}

func handleStartWork(workspace, sessionID, prompt string) string {
	planModeOff(sessionID)
	if workspace == "" || sessionID == "" {
		return "<PROMETHEUS_PLAN_MODE>Start-work failed: missing workspace or session.</PROMETHEUS_PLAN_MODE>"
	}
	m := startWorkArg.FindStringSubmatch(strings.TrimSpace(prompt))
	raw := ""
	if len(m) > 1 {
		raw = strings.Trim(strings.TrimSpace(m[1]), "\"'")
	}
	if raw == "" {
		return "<PROMETHEUS_PLAN_MODE>Start-work failed: provide plan path, e.g. /start-work .lazygrok/plans/auth.md</PROMETHEUS_PLAN_MODE>"
	}

	base := workspace
	planPath := raw
	if !filepath.IsAbs(planPath) {
		planPath = filepath.Join(base, raw)
	}
	if _, err := safestate.ReadFile(planPath); err != nil {
		alt := filepath.Join(base, ".lazygrok", "plans", filepath.Base(raw))
		if _, err2 := safestate.ReadFile(alt); err2 == nil {
			planPath = alt
		} else {
			return "<PROMETHEUS_PLAN_MODE>Start-work failed: plan not found: " + raw + "</PROMETHEUS_PLAN_MODE>"
		}
	}

	absBase, _ := filepath.Abs(base)
	absPlan, _ := filepath.Abs(planPath)
	rel, err := filepath.Rel(absBase, absPlan)
	activePlan := rel
	if err != nil {
		activePlan = planPath
	}
	activePlan = strings.ReplaceAll(activePlan, "\\", "/")
	if !strings.HasPrefix(activePlan, ".lazygrok/") || !strings.HasSuffix(activePlan, ".md") {
		return "<PROMETHEUS_PLAN_MODE>Start-work failed: plan must be under .lazygrok/ and end with .md</PROMETHEUS_PLAN_MODE>"
	}

	planName := strings.TrimSuffix(filepath.Base(activePlan), filepath.Ext(activePlan))
	workID := planName + "-work"
	now := time.Now().UTC().Format("2006-01-02T15:04:05+00:00")

	state := map[string]any{
		"schema_version": 2,
		"active_work_id": workID,
		"active_plan":    activePlan,
		"plan_name":      planName,
		"status":         "active",
		"started_at":     now,
		"updated_at":     now,
		"session_ids":    []any{sessionID},
		"works": map[string]any{
			workID: map[string]any{
				"work_id":       workID,
				"active_plan":   activePlan,
				"plan_name":     planName,
				"status":        "active",
				"started_at":    now,
				"updated_at":    now,
				"session_ids":   []any{sessionID},
				"task_sessions": map[string]any{},
			},
		},
	}
	boulderFile := filepath.Join(base, ".lazygrok", "boulder.json")
	b, _ := json.MarshalIndent(state, "", "  ")
	if err := safestate.WriteFile(boulderFile, append(b, '\n'), 0o600); err != nil {
		return "<PROMETHEUS_PLAN_MODE>Start-work failed: unsafe workspace state path.</PROMETHEUS_PLAN_MODE>"
	}

	return "<PROMETHEUS_PLAN_MODE>Start-work: boulder.json activated. Execute the plan.</PROMETHEUS_PLAN_MODE>"
}
