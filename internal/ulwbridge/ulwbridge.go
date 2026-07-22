package ulwbridge

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Goal represents a single ulw-loop goal.
type Goal struct {
	ID             string         `json:"id"`
	Objective      string         `json:"objective"`
	Status         string         `json:"status"`
	SuccessCriteria []Criterion   `json:"successCriteria"`
}

// Criterion represents a success criterion within a goal.
type Criterion struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

// Plan is the ulw-loop plan file structure.
type Plan struct {
	Goals []Goal `json:"goals"`
}

// EvaluateStop checks for an active ulw-loop plan with incomplete goals.
// Returns a block reason (empty = no block).
func EvaluateStop(workspace, sessionID string) string {
	plan := readPlan(workspace, sessionID)
	if plan == nil || len(plan.Goals) == 0 {
		return ""
	}

	var incomplete []Goal
	for _, g := range plan.Goals {
		if g.Status == "complete" || g.Status == "completed" {
			continue
		}
		allPass := true
		for _, c := range g.SuccessCriteria {
			if c.Status != "pass" {
				allPass = false
				break
			}
		}
		if !allPass {
			incomplete = append(incomplete, g)
		}
	}

	if len(incomplete) == 0 {
		return ""
	}

	var lines []string
	lines = append(lines, "[ULW-LOOP] Incomplete goals remain:")
	for _, g := range incomplete {
		pass, total := 0, len(g.SuccessCriteria)
		for _, c := range g.SuccessCriteria {
			if c.Status == "pass" {
				pass++
			}
		}
		lines = append(lines, "  - "+g.Objective+" ("+itoa(pass)+"/"+itoa(total)+" criteria passed)")
	}
	lines = append(lines, "\nRecord evidence for each criterion before emitting <promise>DONE</promise>.")
	return strings.Join(lines, "\n")
}

func readPlan(workspace, sessionID string) *Plan {
	// Try .omo/ulw-loop/<session>/goals.json first (omo-compatible)
	candidates := []string{
		filepath.Join(workspace, ".omo", "ulw-loop", sessionID, "goals.json"),
		filepath.Join(workspace, ".lazygrok", "ulw-loop", sessionID, "goals.json"),
		filepath.Join(workspace, ".omo", "ulw-loop", "goals.json"),
		filepath.Join(workspace, ".lazygrok", "ulw-loop", "goals.json"),
	}

	for _, p := range candidates {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		var plan Plan
		if json.Unmarshal(b, &plan) == nil && len(plan.Goals) > 0 {
			return &plan
		}
	}
	return nil
}

func itoa(n int) string {
	return strconv.Itoa(n)
}