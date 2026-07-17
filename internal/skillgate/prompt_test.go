package skillgate

import (
	"strings"
	"testing"

	"lazygrok/internal/hookenv"
)

func TestMatchUnloadedSkills(t *testing.T) {
	catalog := []catalogEntry{
		{ID: "brainstorming", Path: "/p/brainstorming/SKILL.md", Description: "Use before creative work and new features"},
		{ID: "ralph-loop", Path: "/p/ralph-loop/SKILL.md", Description: "Autonomous work-until-done ralph loop"},
		{ID: "help", Path: "/p/help/SKILL.md", Description: "Grok setup help"},
	}
	loaded := map[string]struct{}{"help": {}}
	matches := matchUnloadedSkills("design a new feature for hooks", catalog, loaded, 5)
	if len(matches) == 0 || matches[0].ID != "brainstorming" {
		t.Fatalf("expected brainstorming first, got %v", ids(matches))
	}
}

func TestCollectForPromptSkillInformationWarning(t *testing.T) {
	t.Setenv("GROK_HOME", t.TempDir())
	sid := "test-collect"
	EnsureCatalog(sid, "")
	// empty catalog still warns on skill_information
	out := CollectForPrompt(sid, hookenv.Event{
		Prompt: "<skill_information><skills_referenced></skills_referenced></skill_information>",
	})
	if !strings.Contains(out, "skill_information") {
		t.Fatal("expected skill_information warning")
	}
	if !strings.Contains(out, "AGENT_SKILL_GATE_PROACTIVE") {
		t.Fatal("expected proactive gate block")
	}
}

func ids(entries []catalogEntry) []string {
	var out []string
	for _, e := range entries {
		out = append(out, e.ID)
	}
	return out
}