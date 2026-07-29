package usingpowers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/safestate"
	"lazygrok/internal/skillgate"
)

func stateDir(sessionID string) string {
	if sessionID == "" {
		return ""
	}
	if _, err := hookenv.ParseSessionID(sessionID); err != nil {
		return ""
	}
	return filepath.Join(hookenv.GrokHome(), "state", "using-superpowers", sessionID)
}

func doneFile(sessionID string) string {
	dir := stateDir(sessionID)
	if dir == "" {
		return ""
	}
	return filepath.Join(dir, "first_prompt_done")
}

// ResetSession clears first-prompt state for a session (session-start).
func ResetSession(sessionID string) {
	path := doneFile(sessionID)
	if path != "" {
		_ = safestate.RemoveBelow(hookenv.GrokHome(), path)
	}
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
	path := doneFile(sessionID)
	if path == "" {
		return ""
	}
	if _, err := safestate.ReadFileBelow(hookenv.GrokHome(), path); err == nil {
		return ""
	}
	skillPath := resolveSkillPath()
	if skillPath == "" {
		return ""
	}
	_ = safestate.WriteFileBelow(hookenv.GrokHome(), path, []byte{}, 0o600)
	_ = skillgate.MarkSkillLoaded(sessionID, "agent-skill-gate")
	return buildContext(skillPath)
}
