package usingpowers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/skillgate"
)

func stateDir(sessionID string) string {
	if sessionID == "" {
		sessionID = "unknown"
	}
	return filepath.Join(hookenv.GrokHome(), "state", "using-superpowers", sessionID)
}

func doneFile(sessionID string) string {
	return filepath.Join(stateDir(sessionID), "first_prompt_done")
}

// ResetSession clears first-prompt state for a session (session-start).
func ResetSession(sessionID string) {
	_ = os.RemoveAll(stateDir(sessionID))
}

// CleanupSession removes first-prompt state (session-end).
func CleanupSession(sessionID string) {
	ResetSession(sessionID)
}

// resolveSkillPath returns the LazyCodex-for-Grok meta skill (agent-skill-gate), not superpowers.
func resolveSkillPath() string {
	if p := os.Getenv("USING_SUPERPOWERS_SKILL"); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if p := os.Getenv("LAZYGROK_FIRST_PROMPT_SKILL"); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if root, err := hookenv.PluginRoot(); err == nil {
		for _, rel := range []string{
			"skills/agent-skill-gate/SKILL.md",
			"rules/00-agent-skill-gate.md",
		} {
			candidate := filepath.Join(root, rel)
			if _, err := os.Stat(candidate); err == nil {
				return candidate
			}
		}
	}
	return ""
}

func buildContext(skillPath string) string {
	body, err := os.ReadFile(skillPath)
	if err != nil {
		body = []byte(fmt.Sprintf("(first-prompt skill unavailable: %v)", err))
	}
	return strings.TrimSpace(fmt.Sprintf(
		"<LAZYGROK_FIRST_PROMPT>\n"+
			"MANDATORY: You are starting this session's first user turn.\n"+
			"Load LazyCodex-for-Grok skills via **read_file** on matching SKILL.md paths before mutating tools.\n"+
			"Primary meta-skill (skill gate) content:\n\n%s\n"+
			"Prefer skills: ultrawork, ulw-loop, ulw-evidence, ulw-plan, programming, debugging, frontend, start-work, hashline-edit.\n"+
			"</LAZYGROK_FIRST_PROMPT>",
		string(body),
	))
}

// Collect returns first-prompt LazyGrok skill-gate context or "".
func Collect(sessionID string) string {
	if _, err := os.Stat(doneFile(sessionID)); err == nil {
		return ""
	}
	skillPath := resolveSkillPath()
	if skillPath == "" {
		return ""
	}
	_ = os.MkdirAll(stateDir(sessionID), 0o755)
	_ = os.WriteFile(doneFile(sessionID), []byte{}, 0o644)
	_ = skillgate.MarkSkillLoaded(sessionID, "agent-skill-gate")
	return buildContext(skillPath)
}
