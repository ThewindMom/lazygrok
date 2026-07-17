// Package boulder provides upgraded work state management with support for
// multiple work records, task dependencies, verification evidence, and
// session associations.
//
// This is an original implementation. It does not derive from any SUL-covered source.
package boulder

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"lazygrok/internal/core/state"
)

// SchemaVersion is the current boulder state schema version.
const SchemaVersion = 2

// TaskStatus represents the status of a single task.
type TaskStatus string

const (
	TaskPending    TaskStatus = "pending"
	TaskInProgress TaskStatus = "in_progress"
	TaskComplete   TaskStatus = "complete"
	TaskBlocked    TaskStatus = "blocked"
	TaskSkipped    TaskStatus = "skipped"
)

// WorkStatus represents the status of a work record.
type WorkStatus string

const (
	WorkActive    WorkStatus = "active"
	WorkPaused    WorkStatus = "paused"
	WorkComplete  WorkStatus = "complete"
	WorkAbandoned WorkStatus = "abandoned"
)

// Task represents a single task within a work record.
type Task struct {
	ID           string     `json:"id"`
	Description  string     `json:"description"`
	Status       TaskStatus `json:"status"`
	OwnerAgent   string     `json:"ownerAgent,omitempty"`
	Dependencies []string   `json:"dependencies,omitempty"`
	SubagentIDs  []string   `json:"subagentIds,omitempty"`
	AttemptCount int        `json:"attemptCount"`
	CompletedAt  string     `json:"completedAt,omitempty"`
	Evidence     string     `json:"evidence,omitempty"`
}

// WorkRecord represents a single unit of active work.
type WorkRecord struct {
	ID                 string            `json:"id"`
	Objective          string            `json:"objective"`
	PlanPath           string            `json:"planPath,omitempty"`
	Status             WorkStatus        `json:"status"`
	Tasks              []Task            `json:"tasks,omitempty"`
	OriginatingSession string            `json:"originatingSession"`
	CurrentSession     string            `json:"currentSession,omitempty"`
	SessionIDs         []string          `json:"sessionIds,omitempty"`
	StartedAt          string            `json:"startedAt"`
	UpdatedAt          string            `json:"updatedAt"`
	EndedAt            string            `json:"endedAt,omitempty"`
	ElapsedMs          int64             `json:"elapsedMs,omitempty"`
	WorktreePath       string            `json:"worktreePath,omitempty"`
	CompletionReason   string            `json:"completionReason,omitempty"`
	PauseReason        string            `json:"pauseReason,omitempty"`
	FailureReason      string            `json:"failureReason,omitempty"`
	ContinuationCount  int               `json:"continuationCount,omitempty"`
	VerificationEvidence string          `json:"verificationEvidence,omitempty"`
}

// BoulderState is the top-level state file.
type BoulderState struct {
	SchemaVersion int                    `json:"schemaVersion"`
	ActiveWorkID  string                 `json:"activeWorkId,omitempty"`
	Works         map[string]*WorkRecord `json:"works"`
	UpdatedAt     string                 `json:"updatedAt"`
}

// boulderPath returns the path to the boulder state file.
func boulderPath(workspace string) string {
	return filepath.Join(workspace, ".lazygrok", "boulder.json")
}

// Load reads the boulder state from disk.
func Load(workspace string) (*BoulderState, error) {
	var bs BoulderState
	err := state.ReadJSON(boulderPath(workspace), &bs)
	if err != nil {
		if os.IsNotExist(err) {
			return &BoulderState{
				SchemaVersion: SchemaVersion,
				Works:         map[string]*WorkRecord{},
			}, nil
		}
		return nil, err
	}
	if bs.Works == nil {
		bs.Works = map[string]*WorkRecord{}
	}
	if bs.SchemaVersion < SchemaVersion {
		// Run migration
		migrated := migrateV1ToV2(bs)
		state.WriteJSON(boulderPath(workspace), migrated)
		return &migrated, nil
	}
	return &bs, nil
}

// Save writes the boulder state atomically.
func (bs *BoulderState) Save(workspace string) error {
	bs.SchemaVersion = SchemaVersion
	bs.UpdatedAt = nowISO()
	return state.WriteJSON(boulderPath(workspace), bs)
}

// CreateWork creates a new work record and returns it.
func (bs *BoulderState) CreateWork(objective, planPath, sessionID string) *WorkRecord {
	id := generateWorkID()
	wr := &WorkRecord{
		ID:                 id,
		Objective:          objective,
		PlanPath:           planPath,
		Status:             WorkActive,
		OriginatingSession: sessionID,
		CurrentSession:     sessionID,
		SessionIDs:         []string{sessionID},
		StartedAt:          nowISO(),
		UpdatedAt:          nowISO(),
	}
	bs.Works[id] = wr
	bs.ActiveWorkID = id
	return wr
}

// GetWork returns a work record by ID.
func (bs *BoulderState) GetWork(id string) *WorkRecord {
	return bs.Works[id]
}

// GetActiveWork returns the currently active work record.
func (bs *BoulderState) GetActiveWork() *WorkRecord {
	if bs.ActiveWorkID == "" {
		return nil
	}
	return bs.Works[bs.ActiveWorkID]
}

// GetWorkForSession returns the work record associated with a session.
func (bs *BoulderState) GetWorkForSession(sessionID string) *WorkRecord {
	for _, wr := range bs.Works {
		for _, sid := range wr.SessionIDs {
			if sid == sessionID {
				return wr
			}
		}
	}
	return nil
}

// ListWorks returns all work records sorted by creation time.
func (bs *BoulderState) ListWorks() []*WorkRecord {
	var works []*WorkRecord
	for _, wr := range bs.Works {
		works = append(works, wr)
	}
	sort.Slice(works, func(i, j int) bool {
		return works[i].StartedAt < works[j].StartedAt
	})
	return works
}

// ListResumableWorks returns all works that can be resumed.
func (bs *BoulderState) ListResumableWorks() []*WorkRecord {
	var resumable []*WorkRecord
	for _, wr := range bs.Works {
		if wr.Status == WorkPaused || wr.Status == WorkActive {
			resumable = append(resumable, wr)
		}
	}
	sort.Slice(resumable, func(i, j int) bool {
		return resumable[i].UpdatedAt > resumable[j].UpdatedAt
	})
	return resumable
}

// AddTask adds a task to a work record.
func (wr *WorkRecord) AddTask(id, description string, dependencies []string) *Task {
	t := Task{
		ID:           id,
		Description:  description,
		Status:       TaskPending,
		Dependencies: dependencies,
	}
	wr.Tasks = append(wr.Tasks, t)
	return &wr.Tasks[len(wr.Tasks)-1]
}

// GetTask returns a task by ID.
func (wr *WorkRecord) GetTask(id string) *Task {
	for i := range wr.Tasks {
		if wr.Tasks[i].ID == id {
			return &wr.Tasks[i]
		}
	}
	return nil
}

// UpdateTaskStatus updates a task's status.
func (wr *WorkRecord) UpdateTaskStatus(id string, status TaskStatus) error {
	t := wr.GetTask(id)
	if t == nil {
		return fmt.Errorf("task %s not found", id)
	}
	t.Status = status
	if status == TaskComplete {
		t.CompletedAt = nowISO()
	}
	if status == TaskInProgress {
		t.AttemptCount++
	}
	wr.UpdatedAt = nowISO()
	return nil
}

// TaskProgress returns completed and total task counts.
func (wr *WorkRecord) TaskProgress() (completed, total int) {
	total = len(wr.Tasks)
	for _, t := range wr.Tasks {
		if t.Status == TaskComplete {
			completed++
		}
	}
	return
}

// IsComplete returns true if all tasks are complete.
func (wr *WorkRecord) IsComplete() bool {
	if len(wr.Tasks) == 0 {
		return false
	}
	for _, t := range wr.Tasks {
		if t.Status != TaskComplete && t.Status != TaskSkipped {
			return false
		}
	}
	return true
}

// AddSession associates a session with the work record.
func (wr *WorkRecord) AddSession(sessionID string) {
	for _, sid := range wr.SessionIDs {
		if sid == sessionID {
			return
		}
	}
	wr.SessionIDs = append(wr.SessionIDs, sessionID)
	wr.CurrentSession = sessionID
	wr.UpdatedAt = nowISO()
}

// Pause pauses the work record.
func (wr *WorkRecord) Pause(reason string) {
	wr.Status = WorkPaused
	wr.PauseReason = reason
	wr.UpdatedAt = nowISO()
}

// Complete marks the work record as complete.
func (wr *WorkRecord) Complete(reason string) {
	wr.Status = WorkComplete
	wr.CompletionReason = reason
	wr.EndedAt = nowISO()
	wr.UpdatedAt = nowISO()
	if wr.StartedAt != "" {
		start, err := time.Parse(time.RFC3339, wr.StartedAt)
		if err == nil {
			wr.ElapsedMs = time.Since(start).Milliseconds()
		}
	}
}

// Fail marks the work record as failed.
func (wr *WorkRecord) Fail(reason string) {
	wr.Status = WorkAbandoned
	wr.FailureReason = reason
	wr.EndedAt = nowISO()
	wr.UpdatedAt = nowISO()
}

// migrateV1ToV2 migrates old boulder format to v2.
func migrateV1ToV2(old BoulderState) BoulderState {
	new := BoulderState{
		SchemaVersion: SchemaVersion,
		ActiveWorkID:  old.ActiveWorkID,
		Works:         map[string]*WorkRecord{},
		UpdatedAt:     nowISO(),
	}

	// If old format had a single active plan, convert to a work record
	if old.ActiveWorkID != "" {
		wr := &WorkRecord{
			ID:         old.ActiveWorkID,
			Objective:  "migrated work",
			Status:     WorkActive,
			StartedAt:  nowISO(),
			UpdatedAt:  nowISO(),
		}
		new.Works[old.ActiveWorkID] = wr
	}

	return new
}

// generateWorkID generates a unique work ID.
var workCounter int

func generateWorkID() string {
	t := time.Now().UTC()
	workCounter++
	return fmt.Sprintf("work-%s-%d", t.Format("20060102-150405"), workCounter)
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// FormatProgress returns a human-readable progress string.
func (wr *WorkRecord) FormatProgress() string {
	completed, total := wr.TaskProgress()
	return fmt.Sprintf("%d/%d tasks completed", completed, total)
}

// FormatSummary returns a human-readable summary of the work record.
func (wr *WorkRecord) FormatSummary() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Work: %s\n", wr.ID))
	sb.WriteString(fmt.Sprintf("  Objective: %s\n", wr.Objective))
	sb.WriteString(fmt.Sprintf("  Status: %s\n", wr.Status))
	sb.WriteString(fmt.Sprintf("  Progress: %s\n", wr.FormatProgress()))
	if wr.PlanPath != "" {
		sb.WriteString(fmt.Sprintf("  Plan: %s\n", wr.PlanPath))
	}
	if wr.PauseReason != "" {
		sb.WriteString(fmt.Sprintf("  Pause reason: %s\n", wr.PauseReason))
	}
	if wr.FailureReason != "" {
		sb.WriteString(fmt.Sprintf("  Failure reason: %s\n", wr.FailureReason))
	}
	return sb.String()
}

// Ensure the old package compiles — re-export for backward compat
var _ = json.Marshal
