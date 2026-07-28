package agents

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestLazygrokSkillsVendored verifies that all 22 lazygrok skills are
// present under vendor/lazygrok-skills/ with SKILL.md files.
func TestLazygrokSkillsVendored(t *testing.T) {
	skillsDir := filepath.Join("..", "..", "vendor", "lazygrok-skills")
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		t.Skipf("lazygrok-skills directory not found: %v", err)
	}

	expected := map[string]bool{
		"ast-grep": true, "comment-checker": true, "debugging": true,
		"frontend": true, "git-master": true, "init-deep": true,
		"lcx-contribute-bug-fix": true, "lcx-doctor": true, "lcx-report-bug": true,
		"lsp": true, "lsp-setup": true, "programming": true,
		"refactor": true, "remove-ai-slops": true, "review-work": true,
		"rules": true, "start-work": true, "teammode": true,
		"ultraresearch": true, "ulw-loop": true, "ulw-plan": true,
		"visual-qa": true,
	}

	found := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !expected[name] {
			continue
		}
		skillMD := filepath.Join(skillsDir, name, "SKILL.md")
		if _, err := os.Stat(skillMD); err != nil {
			t.Errorf("skill %q missing SKILL.md: %v", name, err)
			continue
		}
		found++
	}

	if found < 22 {
		t.Errorf("expected 22 lazygrok skills with SKILL.md, got %d", found)
	}
}

// TestLazygrokHookComponentsPresent verifies that all 15 lazygrok hook
// components have pre-built dist/cli.js files.
func TestLazygrokHookComponentsPresent(t *testing.T) {
	hooksDir := filepath.Join("..", "..", "vendor", "lazygrok-hooks")
	expected := []string{
		"bootstrap", "codegraph", "comment-checker", "git-bash",
		"git-bash-mcp", "lazygrok-executor-verify", "lsp", "lsp-daemon",
		"lsp-tools-mcp", "rules", "start-work-continuation", "teammode",
		"telemetry", "ultrawork", "ulw-loop",
	}

	for _, comp := range expected {
		cliJS := filepath.Join(hooksDir, comp, "dist", "cli.js")
		info, err := os.Stat(cliJS)
		if err != nil {
			t.Errorf("hook component %q missing dist/cli.js: %v", comp, err)
			continue
		}
		if info.Size() < 100 {
			t.Errorf("hook component %q dist/cli.js is suspiciously small (%d bytes)", comp, info.Size())
		}
	}
}

// TestLazygrokMcpServersRegistered verifies that .mcp.json registers all 6
// supported local MCP servers (2 Go-native + 4 lazygrok). git_bash is not
// supported by Grok on Linux and is intentionally not required here.
func TestLazygrokMcpServersRegistered(t *testing.T) {
	mcpPath := filepath.Join("..", "..", ".mcp.json")
	data, err := os.ReadFile(mcpPath)
	if err != nil {
		t.Fatalf("cannot read .mcp.json: %v", err)
	}

	var mcp struct {
		McpServers map[string]json.RawMessage `json:"mcpServers"`
	}
	if err := json.Unmarshal(data, &mcp); err != nil {
		t.Fatalf("invalid .mcp.json: %v", err)
	}

	expected := []string{
		"hashline", "lsp",
		"lazygrok-lsp", "lazygrok-lsp-tools", "lazygrok-lsp-daemon",
		"lazygrok-codegraph",
	}
	for _, name := range expected {
		if _, ok := mcp.McpServers[name]; !ok {
			t.Errorf("MCP server %q not registered in .mcp.json", name)
		}
	}
	if _, ok := mcp.McpServers["git_bash"]; ok {
		t.Error("git_bash must not be registered on Grok/Linux")
	}
	if len(mcp.McpServers) < 6 {
		t.Errorf("expected >= 6 MCP servers, got %d", len(mcp.McpServers))
	}
}

func TestUltraworkSkillCopiesMatch(t *testing.T) {
	root := filepath.Join("..", "..")
	paths := []string{
		filepath.Join(root, "skills", "ultrawork", "SKILL.md"),
		filepath.Join(root, "vendor", "lazygrok-hooks", "ultrawork", "skills", "ultrawork", "SKILL.md"),
		filepath.Join(root, "vendor", "lazygrok-skills", "ultrawork", "SKILL.md"),
	}
	canonical, err := os.ReadFile(paths[0])
	if err != nil {
		t.Fatalf("cannot read canonical Ultrawork skill: %v", err)
	}
	for _, path := range paths[1:] {
		copy, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("cannot read Ultrawork skill copy %s: %v", path, err)
		}
		if string(copy) != string(canonical) {
			t.Errorf("Ultrawork skill copy %s differs from %s", path, paths[0])
		}
	}
}

func TestUlwLoopSkillCopiesUseGrokFrontmatter(t *testing.T) {
	root := filepath.Join("..", "..")
	paths := []string{
		filepath.Join(root, "skills", "ulw-loop", "SKILL.md"),
		filepath.Join(root, "vendor", "lazygrok-hooks", "ulw-loop", "skills", "ulw-loop", "SKILL.md"),
		filepath.Join(root, "vendor", "lazygrok-skills", "ulw-loop", "SKILL.md"),
	}
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("cannot read ulw-loop skill copy %s: %v", path, err)
		}
		frontmatter := string(data)
		if end := strings.Index(frontmatter[3:], "---"); end >= 0 {
			frontmatter = frontmatter[:end+3]
		}
		if !strings.Contains(frontmatter, "user-invocable: true") {
			t.Errorf("%s missing user-invocable: true", path)
		}
		if strings.Contains(frontmatter, "user_invocable") {
			t.Errorf("%s uses unsupported user_invocable spelling", path)
		}
	}
}

func TestSkillFrontmatterUsesGrokKebabCase(t *testing.T) {
	root := filepath.Join("..", "..")
	patterns := []string{
		filepath.Join(root, "skills", "*", "SKILL.md"),
		filepath.Join(root, "vendor", "lazygrok-skills", "*", "SKILL.md"),
		filepath.Join(root, "vendor", "lazygrok-hooks", "*", "skills", "*", "SKILL.md"),
	}
	for _, pattern := range patterns {
		paths, err := filepath.Glob(pattern)
		if err != nil {
			t.Fatalf("invalid skill glob %q: %v", pattern, err)
		}
		for _, path := range paths {
			data, err := os.ReadFile(path)
			if err != nil {
				t.Fatalf("cannot read skill %s: %v", path, err)
			}
			if strings.Contains(string(data), "\nuser_invocable:") {
				t.Errorf("%s uses unsupported user_invocable spelling", path)
			}
		}
	}
}

func TestUlwWorkflowSkillIsNotUserInvocable(t *testing.T) {
	path := filepath.Join("..", "..", "skills", "ulw-workflow", "SKILL.md")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("cannot read %s: %v", path, err)
	}
	if !strings.Contains(string(data), "\nuser-invocable: false\n") {
		t.Error("internal ulw-workflow skill must not be user-invocable")
	}
}

// TestLazygrokHooksWired verifies hooks.json has lazygrok hooks across
// all 14 lifecycle events.
func TestLazygrokHooksWired(t *testing.T) {
	hooksPath := filepath.Join("..", "..", "hooks", "hooks.json")
	data, err := os.ReadFile(hooksPath)
	if err != nil {
		t.Fatalf("cannot read hooks.json: %v", err)
	}

	var hooks struct {
		Hooks map[string][]struct {
			Hooks []struct {
				Command string `json:"command"`
			} `json:"hooks"`
		} `json:"hooks"`
	}
	if err := json.Unmarshal(data, &hooks); err != nil {
		t.Fatalf("invalid hooks.json: %v", err)
	}

	expectedEvents := []string{
		"SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse",
		"PostToolUseFailure", "PermissionDenied", "Stop", "StopFailure",
		"Notification", "SubagentStart", "SubagentStop", "PreCompact",
		"PostCompact", "SessionEnd",
	}
	for _, ev := range expectedEvents {
		_, ok := hooks.Hooks[ev]
		if !ok {
			t.Errorf("hooks.json missing event %q", ev)
		}
	}
	if len(hooks.Hooks) != 14 {
		t.Errorf("expected 14 hook events, got %d", len(hooks.Hooks))
	}

	// Count lazygrok (node) hooks
	nodeCount := 0
	goCount := 0
	for _, evEntries := range hooks.Hooks {
		for _, entry := range evEntries {
			for _, h := range entry.Hooks {
				if strings.Contains(h.Command, "node") && strings.Contains(h.Command, "lazygrok") {
					nodeCount++
				}
				if strings.Contains(h.Command, "run-hook.sh") {
					goCount++
				}
			}
		}
	}
	if nodeCount < 15 {
		t.Errorf("expected >= 15 lazygrok node hooks, got %d", nodeCount)
	}
	if goCount < 14 {
		t.Errorf("expected >= 14 Go hooks, got %d", goCount)
	}
}

// TestPluginJsonIncludesLazygrokSkills verifies plugin.json references
// the lazygrok skills and hooks directories.
func TestPluginJsonIncludesLazygrokSkills(t *testing.T) {
	pluginPath := filepath.Join("..", "..", "plugin.json")
	data, err := os.ReadFile(pluginPath)
	if err != nil {
		t.Fatalf("cannot read plugin.json: %v", err)
	}

	var plugin struct {
		Skills []string `json:"skills"`
	}
	if err := json.Unmarshal(data, &plugin); err != nil {
		t.Fatalf("invalid plugin.json: %v", err)
	}

	hasLazycodexSkills := false
	hasLazycodexHooks := false
	for _, s := range plugin.Skills {
		if strings.Contains(s, "lazygrok-skills") {
			hasLazycodexSkills = true
		}
		if strings.Contains(s, "lazygrok-hooks") {
			hasLazycodexHooks = true
		}
	}
	if !hasLazycodexSkills {
		t.Error("plugin.json skills array does not include vendor/lazygrok-skills")
	}
	if !hasLazycodexHooks {
		t.Error("plugin.json skills array does not include vendor/lazygrok-hooks")
	}
}
