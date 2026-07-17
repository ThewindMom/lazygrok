package boulder

import (
	"testing"
)

func TestCreateWork(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test objective", ".lazygrok/plans/test.md", "session1")

	if wr.ID == "" {
		t.Error("work ID should not be empty")
	}
	if wr.Objective != "test objective" {
		t.Errorf("objective = %s", wr.Objective)
	}
	if wr.Status != WorkActive {
		t.Errorf("status = %s, want active", wr.Status)
	}
	if bs.ActiveWorkID != wr.ID {
		t.Error("active work ID should be set")
	}
}

func TestSaveLoad(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	bs.CreateWork("test", "", "session1")
	bs.Save(ws)

	bs2, err := Load(ws)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(bs2.Works) != 1 {
		t.Errorf("works = %d, want 1", len(bs2.Works))
	}
}

func TestAddTask(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")

	task := wr.AddTask("task1", "do something", nil)
	if task.ID != "task1" {
		t.Errorf("task ID = %s", task.ID)
	}
	if task.Status != TaskPending {
		t.Errorf("task status = %s, want pending", task.Status)
	}
}

func TestUpdateTaskStatus(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")
	wr.AddTask("task1", "do something", nil)

	err := wr.UpdateTaskStatus("task1", TaskInProgress)
	if err != nil {
		t.Fatalf("UpdateTaskStatus: %v", err)
	}
	if wr.GetTask("task1").Status != TaskInProgress {
		t.Error("status should be in_progress")
	}
	if wr.GetTask("task1").AttemptCount != 1 {
		t.Errorf("attempt count = %d, want 1", wr.GetTask("task1").AttemptCount)
	}

	wr.UpdateTaskStatus("task1", TaskComplete)
	if wr.GetTask("task1").CompletedAt == "" {
		t.Error("completedAt should be set")
	}
}

func TestTaskProgress(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")
	wr.AddTask("t1", "task 1", nil)
	wr.AddTask("t2", "task 2", nil)
	wr.AddTask("t3", "task 3", nil)

	wr.UpdateTaskStatus("t1", TaskComplete)
	wr.UpdateTaskStatus("t2", TaskComplete)

	completed, total := wr.TaskProgress()
	if completed != 2 || total != 3 {
		t.Errorf("progress = %d/%d, want 2/3", completed, total)
	}
}

func TestIsComplete(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")
	wr.AddTask("t1", "task 1", nil)
	wr.AddTask("t2", "task 2", nil)

	if wr.IsComplete() {
		t.Error("should not be complete with pending tasks")
	}

	wr.UpdateTaskStatus("t1", TaskComplete)
	wr.UpdateTaskStatus("t2", TaskComplete)

	if !wr.IsComplete() {
		t.Error("should be complete when all tasks done")
	}
}

func TestPauseResume(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")

	wr.Pause("user requested")
	if wr.Status != WorkPaused {
		t.Error("status should be paused")
	}
	if wr.PauseReason != "user requested" {
		t.Errorf("pause reason = %s", wr.PauseReason)
	}
}

func TestComplete(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")

	wr.Complete("all tasks done")
	if wr.Status != WorkComplete {
		t.Error("status should be complete")
	}
	if wr.CompletionReason != "all tasks done" {
		t.Errorf("completion reason = %s", wr.CompletionReason)
	}
	if wr.EndedAt == "" {
		t.Error("endedAt should be set")
	}
}

func TestGetWorkForSession(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")

	found := bs.GetWorkForSession("session1")
	if found == nil || found.ID != wr.ID {
		t.Error("should find work for session1")
	}

	notFound := bs.GetWorkForSession("session2")
	if notFound != nil {
		t.Error("should not find work for session2")
	}
}

func TestListResumableWorks(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	bs.CreateWork("test1", "", "session1")
	wr2 := bs.CreateWork("test2", "", "session2")
	wr2.Pause("testing")

	resumable := bs.ListResumableWorks()
	if len(resumable) != 2 {
		t.Errorf("resumable = %d, want 2", len(resumable))
	}
}

func TestAddSession(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")

	wr.AddSession("session2")
	if len(wr.SessionIDs) != 2 {
		t.Errorf("sessions = %d, want 2", len(wr.SessionIDs))
	}

	// Adding same session should not duplicate
	wr.AddSession("session2")
	if len(wr.SessionIDs) != 2 {
		t.Errorf("sessions = %d, want 2 (no dup)", len(wr.SessionIDs))
	}
}

func TestTaskDependencies(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test", "", "session1")
	wr.AddTask("t1", "first", nil)
	wr.AddTask("t2", "second", []string{"t1"})

	t2 := wr.GetTask("t2")
	if len(t2.Dependencies) != 1 || t2.Dependencies[0] != "t1" {
		t.Errorf("dependencies = %v", t2.Dependencies)
	}
}

func TestFormatSummary(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	wr := bs.CreateWork("test objective", ".lazygrok/plans/test.md", "session1")
	wr.AddTask("t1", "task 1", nil)
	wr.UpdateTaskStatus("t1", TaskComplete)

	s := wr.FormatSummary()
	if s == "" {
		t.Error("summary should not be empty")
	}
}

func TestMigrationFromEmpty(t *testing.T) {
	ws := t.TempDir()
	bs, err := Load(ws)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if bs.SchemaVersion != SchemaVersion {
		t.Errorf("schema version = %d, want %d", bs.SchemaVersion, SchemaVersion)
	}
	if bs.Works == nil {
		t.Error("works map should be initialized")
	}
}

func TestMultipleWorks(t *testing.T) {
	ws := t.TempDir()
	bs, _ := Load(ws)
	bs.CreateWork("objective 1", "", "session1")
	wr2 := bs.CreateWork("objective 2", "", "session2")

	if len(bs.Works) != 2 {
		t.Errorf("works = %d, want 2", len(bs.Works))
	}
	if bs.ActiveWorkID != wr2.ID {
		t.Error("active work should be the last created")
	}

	works := bs.ListWorks()
	if len(works) != 2 {
		t.Errorf("list works = %d, want 2", len(works))
	}
}
