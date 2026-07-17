package agents

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestPromptVariantsExist verifies that prompt variant files exist for
// ultrawork and atlas with at least default, grok, and gpt variants.
func TestPromptVariantsExist(t *testing.T) {
	promptsDir := filepath.Join("..", "..", "prompts")

	cases := []struct {
		dir      string
		variants []string
	}{
		{"ultrawork", []string{"default", "grok", "gpt", "codex"}},
		{"atlas", []string{"default", "grok", "gpt"}},
		{"prometheus", []string{"default"}},
	}

	for _, tc := range cases {
		for _, variant := range tc.variants {
			path := filepath.Join(promptsDir, tc.dir, variant+".md")
			info, err := os.Stat(path)
			if err != nil {
				t.Errorf("prompt variant %s/%s.md missing: %v", tc.dir, variant, err)
				continue
			}
			if info.Size() < 100 {
				t.Errorf("prompt variant %s/%s.md is suspiciously small (%d bytes)", tc.dir, variant, info.Size())
			}
		}
	}
}

// TestGrokVariantHasNoCodexAPIs verifies that the grok prompt variants
// do not contain Codex-specific API references.
func TestGrokVariantHasNoCodexAPIs(t *testing.T) {
	promptsDir := filepath.Join("..", "..", "prompts")

	codexAPIs := []string{
		"multi_agent_v1",
		"fork_context",
		"apply_patch",
		"multi_edit",
		"codex_app",
	}

	checks := []string{
		filepath.Join(promptsDir, "ultrawork", "grok.md"),
		filepath.Join(promptsDir, "atlas", "grok.md"),
	}

	for _, path := range checks {
		data, err := os.ReadFile(path)
		if err != nil {
			t.Errorf("cannot read %s: %v", path, err)
			continue
		}
		content := string(data)
		for _, api := range codexAPIs {
			if strings.Contains(content, api) {
				t.Errorf("grok variant %s contains Codex API reference %q", path, api)
			}
		}
	}
}

// TestUltraworkDirectiveIsGrokVariant verifies that the ultrawork hook's
// directive.md is synced from the grok variant (not the codex variant).
func TestUltraworkDirectiveIsGrokVariant(t *testing.T) {
	directivePath := filepath.Join("..", "..", "vendor", "lazygrok-hooks", "ultrawork", "directive.md")
	grokVariantPath := filepath.Join("..", "..", "prompts", "ultrawork", "grok.md")

	directive, err := os.ReadFile(directivePath)
	if err != nil {
		t.Skipf("directive.md not found: %v", err)
	}

	grokVariant, err := os.ReadFile(grokVariantPath)
	if err != nil {
		t.Skipf("grok.md variant not found: %v", err)
	}

	if string(directive) != string(grokVariant) {
		t.Error("ultrawork directive.md is not synced from grok.md variant — run scripts/sync-prompts.sh grok")
	}
}
