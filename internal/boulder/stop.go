package boulder

import (
	"fmt"
	"strings"

	"lazygrok/internal/hookenv"
)

const todoContinuationPrompt = `[TODO CONTINUATION]

Incomplete tasks remain in your todo list. Continue working on the next pending task.

- Proceed without asking for permission
- Mark each task complete when finished
- Do not stop until all tasks are done
- If you believe all work is already complete, critically re-examine each todo item and update the list accordingly.`

const boulderContinuationPrompt = `[BOULDER CONTINUATION]

You have an active work plan with incomplete tasks. Continue working.

RULES:
- FIRST: Read the plan file NOW. If the last completed task is still unchecked, mark it ` + "`- [x]`" + ` IMMEDIATELY before anything else
- Proceed without asking for permission
- Use the notepad at .lazygrok/notepads/{plan_name}/ to record learnings
- Do not stop until all tasks are complete
- If a task is blocked, edit the plan and change that checkbox from ` + "`- [ ]`" + ` to ` + "`- [~]`" + ` via a real file edit`

const boulderCompletePrompt = `<system-reminder>
BOULDER COMPLETE: plan "{plan_name}" is fully checked.

Total elapsed: {elapsed_human}

Per-task breakdown:
{task_breakdown}

Per your boulder_completion_response instructions, print the final ORCHESTRATION COMPLETE summary in your next turn. This nudge fires at most once.
</system-reminder>`

// EvaluateTodoStop returns block=true and a continuation message when todos remain.
func EvaluateTodoStop(ev hookenv.Event) (bool, string) {
	if ShouldAllowStop(ev.StopReason, ev.StopHookActive, ev.BackgroundTasks) {
		return false, ""
	}
	sid := ev.SessionID
	ws := hookenv.Workspace(ev)
	if sid == "" {
		return false, ""
	}
	if AutoContinuePaused(ws, sid) {
		return false, ""
	}
	sessionDir := findSessionDir(sid)
	if sessionDir == "" {
		return false, ""
	}
	todos := todosFromResources(sessionDir)
	incomplete := incompleteTodos(todos)
	if ws != "" {
		MirrorTodos(ws, sid, todos)
	}
	if len(incomplete) == 0 {
		return false, ""
	}
	if skip := ShouldSkipTodoContinuation(sid, ev.StopReason); skip != "" {
		return false, ""
	}
	recordTodoContinuationFire(sid)
	total := len(todos)
	done := total - len(incomplete)
	var todoLines []string
	for _, t := range incomplete {
		status := stringField(t, "status")
		if status == "" {
			status = "pending"
		}
		content := stringField(t, "content")
		if content == "" {
			content = stringField(t, "id")
		}
		if content == "" {
			content = "todo"
		}
		if len(content) > 200 {
			content = content[:200]
		}
		todoLines = append(todoLines, fmt.Sprintf("- [%s] %s", status, content))
	}
	msg := fmt.Sprintf(
		"%s\n\n[Status: %d/%d completed, %d remaining]\n\nRemaining tasks:\n%s",
		todoContinuationPrompt, done, total, len(incomplete), strings.Join(todoLines, "\n"),
	)
	return true, strings.TrimSpace(msg)
}

// EvaluateBoulderStop returns block=true when boulder work remains or completion nudge needed.
func EvaluateBoulderStop(ev hookenv.Event) (bool, string) {
	if ShouldAllowStop(ev.StopReason, ev.StopHookActive, ev.BackgroundTasks) {
		return false, ""
	}
	sid := ev.SessionID
	ws := hookenv.Workspace(ev)
	if sid == "" || ws == "" {
		return false, ""
	}
	if AutoContinuePaused(ws, sid) {
		return false, ""
	}
	state := readBoulder(ws)
	if state == nil {
		return false, ""
	}
	work := getWorkForSession(state, sid)
	inSession := false
	for _, id := range stringSlice(state["session_ids"]) {
		if id == sid {
			inSession = true
			break
		}
	}
	if work == nil && !inSession {
		return false, ""
	}
	appendSessionToBoulder(ws, sid)
	target := work
	if target == nil {
		target = state
	}
	status := strings.ToLower(strings.TrimSpace(stringField(target, "status")))
	if status == "paused" || status == "abandoned" {
		return false, ""
	}
	planPath := resolvePlanPath(ws, state, work)
	progress := getPlanProgress(planPath)
	planName := stringField(target, "plan_name")
	if planName == "" {
		planName = "plan"
	}
	workID := stringField(target, "work_id")
	if workID == "" {
		workID, _ = state["active_work_id"].(string)
	}
	if workID == "" {
		workID = "default"
	}

	if progress.IsComplete {
		completeBoulder(ws, workID)
		if wasBoulderNudged(workID, sid) {
			return false, ""
		}
		elapsed := int64(0)
		if v, ok := target["elapsed_ms"].(float64); ok {
			elapsed = int64(v)
		} else {
			sm := parseISOMs(stringField(target, "started_at"))
			em := parseISOMs(stringField(target, "ended_at"))
			if em == nil {
				now := nowISO()
				em = parseISOMs(now)
			}
			if sm != nil && em != nil {
				elapsed = *em - *sm
			}
		}
		msg := strings.NewReplacer(
			"{plan_name}", planName,
			"{elapsed_human}", formatDurationHuman(elapsed),
			"{task_breakdown}", taskBreakdown(target),
		).Replace(boulderCompletePrompt)
		markBoulderNudged(workID, sid)
		return true, strings.TrimSpace(msg)
	}

	remaining := progress.Total - progress.Completed
	activePlan := stringField(target, "active_plan")
	msg := boulderContinuationPrompt + fmt.Sprintf(
		"\n\n[Status: %d/%d completed, %d remaining]\n\nPlan file: %s",
		progress.Completed, progress.Total, remaining, activePlan,
	)
	if wt := worktreePath(work, state); wt != "" {
		msg += "\n\n[Worktree: " + wt + "]"
	}
	return true, strings.TrimSpace(msg)
}