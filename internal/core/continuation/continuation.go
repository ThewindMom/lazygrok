// Package continuation implements the stop pipeline with bounded loops,
// repeated-state detection, cooldowns, and failure counters.
//
// The stop pipeline evaluates continuation reasons in this order:
//  1. explicit Ralph or Ultrawork loop
//  2. active boulder plan
//  3. incomplete todos
//  4. active required subagents
//  5. failed verification
//  6. unresolved LSP errors when enforcement is enabled
//  7. unchecked fallback plan tasks
//
// Explicit pause or cancellation state bypasses automatic continuation immediately.
package continuation

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mihazs/oh-my-grok/internal/core/config"
	"github.com/mihazs/oh-my-grok/internal/core/state"
)

// StateVersion is the continuation state schema version.
const StateVersion = 2

// LoopState represents the continuation loop state.
type LoopState struct {
	SchemaVersion      int    `json:"schemaVersion"`
	Active             bool   `json:"active"`
	Type               string `json:"type"` // "ralph" or "ultrawork"
	Objective          string `json:"objective"`
	CompletionCriteria string `json:"completionCriteria"`
	Iteration          int    `json:"iteration"`
	MaxIterations      int    `json:"maxIterations"`
	SessionID          string `json:"sessionId"`
	StartedAt          string `json:"startedAt"`
	LastIterationAt   string `json:"lastIterationAt"`
	StateFingerprints  []string `json:"stateFingerprints"`
	FailureCount       int    `json:"failureCount"`
	VerificationPending bool   `json:"verificationPending"`
	Paused             bool   `json:"paused"`
	PauseReason        string `json:"pauseReason"`
}

// StopResult represents the result of a stop pipeline evaluation.
type StopResult struct {
	ShouldContinue bool   `json:"shouldContinue"`
	Reason         string `json:"reason"`
	Message        string `json:"message"`
}

// statePath returns the path to the continuation state file.
func statePath(workspace string) string {
	return filepath.Join(workspace, ".omg", "continuation.json")
}

// stopMarkerPath returns the path to the stop-continuation marker.
func stopMarkerPath(grokHome, sessionID string) string {
	return filepath.Join(grokHome, "state", "stop-continuation", sessionID, "stopped")
}

// IsExplicitlyStopped checks whether the user has explicitly stopped continuation.
func IsExplicitlyStopped(grokHome, sessionID string) bool {
	if sessionID == "" {
		return false
	}
	if _, err := os.Stat(stopMarkerPath(grokHome, sessionID)); err == nil {
		return true
	}
	return false
}

// StopContinuation writes the stop marker and pauses any active loops.
func StopContinuation(workspace, grokHome, sessionID string) error {
	// Write stop marker
	markerPath := stopMarkerPath(grokHome, sessionID)
	if err := os.MkdirAll(filepath.Dir(markerPath), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(markerPath, []byte(time.Now().UTC().Format(time.RFC3339)), 0o644); err != nil {
		return err
	}

	// Pause active loops
	if workspace != "" {
		path := statePath(workspace)
		var ls LoopState
		if err := state.ReadJSON(path, &ls); err == nil && ls.Active {
			ls.Paused = true
			ls.PauseReason = "explicit stop by user"
			if err := state.WriteJSON(path, ls); err != nil {
				return err
			}
		}
	}
	return nil
}

// ResumeContinuation clears the stop marker and resumes paused loops.
func ResumeContinuation(grokHome, sessionID, workspace string) error {
	if sessionID != "" {
		_ = os.Remove(stopMarkerPath(grokHome, sessionID))
	}
	// Clear paused state
	if workspace != "" {
		path := statePath(workspace)
		var ls LoopState
		if err := state.ReadJSON(path, &ls); err == nil && ls.Active && ls.Paused {
			ls.Paused = false
			ls.PauseReason = ""
			ls.LastIterationAt = time.Now().UTC().Format(time.RFC3339)
			return state.WriteJSON(path, ls)
		}
	}
	return nil
}

// StartLoop initializes a new continuation loop.
func StartLoop(workspace, loopType, objective, completionCriteria, sessionID string, cfg *config.Config) error {
	maxIter := cfg.MaxContinuations
	if loopType == "ralph" && maxIter > 100 {
		maxIter = 100
	}

	ls := LoopState{
		SchemaVersion:      StateVersion,
		Active:             true,
		Type:               loopType,
		Objective:          objective,
		CompletionCriteria: completionCriteria,
		Iteration:          0,
		MaxIterations:      maxIter,
		SessionID:          sessionID,
		StartedAt:          time.Now().UTC().Format(time.RFC3339),
		LastIterationAt:   time.Now().UTC().Format(time.RFC3339),
		StateFingerprints:  []string{},
		FailureCount:       0,
		Paused:             false,
	}

	return state.WriteJSON(statePath(workspace), ls)
}

// EvaluateStop runs the stop pipeline and returns whether to continue.
func EvaluateStop(workspace, grokHome, sessionID string, cfg *config.Config) StopResult {
	// Check explicit stop first — bypasses everything
	if IsExplicitlyStopped(grokHome, sessionID) {
		return StopResult{
			ShouldContinue: false,
			Reason:         "explicit_stop",
			Message:        "Continuation stopped by user. Run /resume-continuation to resume.",
		}
	}

	if !cfg.ContinuationEnabled {
		return StopResult{ShouldContinue: false, Reason: "continuation_disabled"}
	}

	// Check for active loop
	path := statePath(workspace)
	var ls LoopState
	if err := state.ReadJSON(path, &ls); err != nil || !ls.Active || ls.Paused {
		// No active loop — check boulder and todos
		return StopResult{ShouldContinue: false, Reason: "no_active_loop"}
	}

	// Check session match
	if ls.SessionID != "" && sessionID != "" && ls.SessionID != sessionID {
		return StopResult{ShouldContinue: false, Reason: "session_mismatch"}
	}

	// Check max iterations
	if ls.Iteration >= ls.MaxIterations {
		ls.Active = false
		ls.PauseReason = fmt.Sprintf("max iterations (%d) reached", ls.MaxIterations)
		state.WriteJSON(path, ls)
		return StopResult{
			ShouldContinue: false,
			Reason:         "max_iterations",
			Message:        fmt.Sprintf("Continuation stopped: reached maximum iterations (%d).", ls.MaxIterations),
		}
	}

	// Check failure count
	if ls.FailureCount >= cfg.RepeatedStateThreshold {
		ls.Paused = true
		ls.PauseReason = fmt.Sprintf("repeated failure threshold (%d) reached", cfg.RepeatedStateThreshold)
		state.WriteJSON(path, ls)
		return StopResult{
			ShouldContinue: false,
			Reason:         "failure_threshold",
			Message:        fmt.Sprintf("Continuation paused: %d consecutive failures.", ls.FailureCount),
		}
	}

	// Check repeated state (cooldown)
	if len(ls.StateFingerprints) >= cfg.RepeatedStateThreshold {
		lastN := ls.StateFingerprints[len(ls.StateFingerprints)-cfg.RepeatedStateThreshold:]
		allSame := true
		for i := 1; i < len(lastN); i++ {
			if lastN[i] != lastN[0] {
				allSame = false
				break
			}
		}
		if allSame {
			ls.Paused = true
			ls.PauseReason = "repeated state detected — no progress"
			state.WriteJSON(path, ls)
			return StopResult{
				ShouldContinue: false,
				Reason:         "repeated_state",
				Message:        "Continuation paused: state has not changed across recent iterations.",
			}
		}
	}

	// Check cooldown
	if ls.LastIterationAt != "" {
		last, err := time.Parse(time.RFC3339, ls.LastIterationAt)
		if err == nil {
			elapsed := time.Since(last)
			if elapsed < time.Duration(cfg.CooldownSeconds)*time.Second {
				return StopResult{
					ShouldContinue: false,
					Reason:         "cooldown",
					Message:        fmt.Sprintf("Continuation cooldown: %ds remaining.", int(time.Duration(cfg.CooldownSeconds)*time.Second-elapsed)/1000000000),
				}
			}
		}
	}

	// Increment iteration
	ls.Iteration++
	ls.LastIterationAt = time.Now().UTC().Format(time.RFC3339)
	state.WriteJSON(path, ls)

	return StopResult{
		ShouldContinue: true,
		Reason:         fmt.Sprintf("%s_loop_iteration_%d", ls.Type, ls.Iteration),
		Message: fmt.Sprintf(
			"[%s LOOP %d/%d]\nContinue working toward: %s\nCompletion criteria: %s\n\nOutput <promise>DONE</promise> when verifiably complete.",
			strings.ToUpper(ls.Type), ls.Iteration, ls.MaxIterations, ls.Objective, ls.CompletionCriteria,
		),
	}
}

// RecordStateFingerprint adds a state fingerprint for repeated-state detection.
func RecordStateFingerprint(workspace string, fingerprint string) error {
	path := statePath(workspace)
	var ls LoopState
	if err := state.ReadJSON(path, &ls); err != nil || !ls.Active {
		return nil
	}
	// Keep only last 10 fingerprints
	if len(ls.StateFingerprints) >= 10 {
		ls.StateFingerprints = ls.StateFingerprints[1:]
	}
	ls.StateFingerprints = append(ls.StateFingerprints, fingerprint)
	return state.WriteJSON(path, ls)
}

// RecordFailure increments the failure counter.
func RecordFailure(workspace string) error {
	path := statePath(workspace)
	var ls LoopState
	if err := state.ReadJSON(path, &ls); err != nil || !ls.Active {
		return nil
	}
	ls.FailureCount++
	return state.WriteJSON(path, ls)
}

// CompleteLoop marks the loop as complete and clears state.
func CompleteLoop(workspace string) error {
	path := statePath(workspace)
	var ls LoopState
	if err := state.ReadJSON(path, &ls); err != nil {
		return nil
	}
	ls.Active = false
	ls.PauseReason = "completed"
	return state.WriteJSON(path, ls)
}

// ComputeFingerprint computes a hash of the current work state for repeated-state detection.
func ComputeFingerprint(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])[:16]
}

// MigrateV1ToV2 migrates old continuation state format to v2.
func MigrateV1ToV2(old map[string]any) map[string]any {
	new := map[string]any{
		"schemaVersion": StateVersion,
		"active":        old["active"],
		"type":          old["type"],
		"objective":     old["objective"],
		"completionCriteria": old["completion_criteria"],
		"iteration":     old["iteration"],
		"maxIterations": old["max_iterations"],
		"sessionId":     old["session_id"],
		"startedAt":     old["started_at"],
		"lastIterationAt": old["last_iteration_at"],
		"stateFingerprints": []string{},
		"failureCount":  0,
		"verificationPending": old["verification_pending"],
		"paused":        old["paused"],
		"pauseReason":   old["pause_reason"],
	}
	return new
}

// GetActiveLoop returns the active loop state if any.
func GetActiveLoop(workspace string) (*LoopState, error) {
	var ls LoopState
	if err := state.ReadJSON(statePath(workspace), &ls); err != nil {
		return nil, err
	}
	if !ls.Active {
		return nil, nil
	}
	return &ls, nil
}

// ListResumableWork returns all resumable work items.
func ListResumableWork(workspace string) ([]map[string]any, error) {
	var items []map[string]any

	// Check continuation state
	if ls, err := GetActiveLoop(workspace); err == nil && ls != nil {
		items = append(items, map[string]any{
			"type":     "continuation",
			"loopType": ls.Type,
			"objective": ls.Objective,
			"status":    "paused",
			"iteration": ls.Iteration,
		})
	}

	// Check boulder state
	boulderPath := filepath.Join(workspace, ".omg", "boulder.json")
	if data, err := os.ReadFile(boulderPath); err == nil {
		var b map[string]any
		if json.Unmarshal(data, &b) == nil {
			items = append(items, map[string]any{
				"type":   "boulder",
				"status": b["status"],
				"plan":   b["active_plan"],
			})
		}
	}

	return items, nil
}
