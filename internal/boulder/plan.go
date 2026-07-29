package boulder

import (
	"path/filepath"
	"regexp"
	"strings"

	"lazygrok/internal/safestate"
)

type planProgress struct {
	Total      int
	Completed  int
	IsComplete bool
}

func resolvePlanPath(workspace string, state, work map[string]any) string {
	plan := ""
	if work != nil {
		if p, ok := work["active_plan"].(string); ok {
			plan = p
		}
	}
	if plan == "" {
		if p, ok := state["active_plan"].(string); ok {
			plan = p
		}
	}
	if plan == "" {
		return ""
	}
	base := workspace
	planPath := plan
	if !filepath.IsAbs(planPath) {
		planPath = filepath.Join(base, plan)
	}
	if wt := worktreePath(work, state); wt != "" {
		wtPath := wt
		if !filepath.IsAbs(wtPath) {
			wtPath = filepath.Join(base, wt)
		}
		absPlan, _ := filepath.Abs(planPath)
		absBase, _ := filepath.Abs(base)
		rel, err := filepath.Rel(absBase, absPlan)
		if err == nil {
			candidate := filepath.Join(wtPath, rel)
			if _, err := safestate.ReadFile(candidate); err == nil {
				return candidate
			}
		}
	}
	if _, err := safestate.ReadFile(planPath); err == nil {
		return planPath
	}
	return ""
}

func worktreePath(work, state map[string]any) string {
	if work != nil {
		if p, ok := work["worktree_path"].(string); ok && p != "" {
			return p
		}
	}
	if state != nil {
		if p, ok := state["worktree_path"].(string); ok {
			return p
		}
	}
	return ""
}

func getPlanProgress(planPath string) planProgress {
	if planPath == "" {
		return planProgress{}
	}
	b, err := safestate.ReadFile(planPath)
	if err != nil {
		return planProgress{}
	}
	lines := strings.Split(strings.ReplaceAll(string(b), "\r\n", "\n"), "\n")
	todoH := regexp.MustCompile(`(?i)^##\s+TODOs\b`)
	finalH := regexp.MustCompile(`(?i)^##\s+Final Verification Wave\b`)
	h2 := regexp.MustCompile(`^##\s+`)
	unchecked := regexp.MustCompile(`^(\s*)[-*]\s*\[\s*\]\s*(.+)$`)
	checked := regexp.MustCompile(`^(\s*)[-*]\s*\[[xX]\]\s*(.+)$`)
	todoTask := regexp.MustCompile(`^\d+\.\s+`)
	finalTask := regexp.MustCompile(`(?i)^F\d+\.\s+`)

	hasSections := false
	for _, ln := range lines {
		if todoH.MatchString(ln) || finalH.MatchString(ln) {
			hasSections = true
			break
		}
	}
	if hasSections {
		section := "other"
		total, completed := 0, 0
		for _, line := range lines {
			if h2.MatchString(line) {
				switch {
				case todoH.MatchString(line):
					section = "todo"
				case finalH.MatchString(line):
					section = "final-wave"
				default:
					section = "other"
				}
				continue
			}
			if section != "todo" && section != "final-wave" {
				continue
			}
			cm := checked.FindStringSubmatch(line)
			um := unchecked.FindStringSubmatch(line)
			var m []string
			if cm != nil {
				m = cm
			} else if um != nil {
				m = um
			} else {
				continue
			}
			if m[1] != "" {
				continue
			}
			body := strings.TrimSpace(m[2])
			pat := todoTask
			if section == "final-wave" {
				pat = finalTask
			}
			if !pat.MatchString(body) {
				continue
			}
			total++
			if cm != nil {
				completed++
			}
		}
		return planProgress{total, completed, total > 0 && completed == total}
	}
	content := strings.Join(lines, "\n")
	u := len(regexp.MustCompile(`(?m)^[-*]\s*\[\s*\]`).FindAllString(content, -1))
	c := len(regexp.MustCompile(`(?m)^[-*]\s*\[[xX]\]`).FindAllString(content, -1))
	total := u + c
	return planProgress{total, c, total > 0 && c == total}
}

func completeBoulder(workspace, workID, sessionID string) error {
	return withBoulderLock(workspace, func() error {
		state, exists, err := readBoulderForMutation(workspace)
		if err != nil || !exists {
			return err
		}
		ownedWork := getWorkForSession(state, sessionID)
		if ownedWork == nil || stringField(ownedWork, "work_id") != workID {
			return ErrSessionMismatch
		}
		end := nowISO()
		var work map[string]any
		if works, ok := state["works"].(map[string]any); ok && workID != "" {
			if w, ok := works[workID].(map[string]any); ok {
				work = w
			}
		}
		if work == nil {
			work = state
		}
		if s, _ := work["status"].(string); s == "completed" {
			return nil
		}
		work["ended_at"] = end
		work["status"] = "completed"
		work["updated_at"] = end
		if works, ok := state["works"].(map[string]any); ok && workID != "" {
			works[workID] = work
		}
		state["status"] = "completed"
		state["ended_at"] = end
		state["updated_at"] = end
		return writeBoulderState(workspace, state)
	})
}

func taskBreakdown(work map[string]any) string {
	sessions, _ := work["task_sessions"].(map[string]any)
	if len(sessions) == 0 {
		return "- (no task timings)"
	}
	var lines []string
	for _, v := range sessions {
		task, ok := v.(map[string]any)
		if !ok {
			continue
		}
		label, _ := task["task_label"].(string)
		title, _ := task["task_title"].(string)
		if elapsed, ok := task["elapsed_ms"].(float64); ok {
			lines = append(lines, "- "+label+" "+title+": "+formatDurationHuman(int64(elapsed)))
		} else {
			lines = append(lines, "- "+label+" "+title+": (no timing)")
		}
	}
	if len(lines) == 0 {
		return "- (no task timings)"
	}
	return strings.Join(lines, "\n")
}
