package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefaults(t *testing.T) {
	cfg := Defaults()
	if cfg.SchemaVersion != SchemaVersion {
		t.Errorf("schema version = %d, want %d", cfg.SchemaVersion, SchemaVersion)
	}
	if cfg.HashlineMode != HashlinePrefer {
		t.Errorf("default hashlineMode = %q, want prefer", cfg.HashlineMode)
	}
	if cfg.MaxContinuations != 25 {
		t.Errorf("default maxContinuations = %d, want 25", cfg.MaxContinuations)
	}
	if !cfg.ContinuationEnabled {
		t.Error("continuation should be enabled by default")
	}
}

func TestValidate(t *testing.T) {
	cfg := Defaults()
	if err := cfg.Validate(); err != nil {
		t.Fatalf("defaults should validate: %v", err)
	}

	cfg.HashlineMode = "bogus"
	if err := cfg.Validate(); err == nil {
		t.Error("invalid hashlineMode should fail validation")
	}

	cfg = Defaults()
	cfg.CommentPolicy = "bogus"
	if err := cfg.Validate(); err == nil {
		t.Error("invalid commentPolicy should fail validation")
	}

	cfg = Defaults()
	cfg.LogLevel = "bogus"
	if err := cfg.Validate(); err == nil {
		t.Error("invalid logLevel should fail validation")
	}

	cfg = Defaults()
	cfg.MaxContinuations = -1
	if err := cfg.Validate(); err == nil {
		t.Error("negative maxContinuations should fail validation")
	}
}

func TestLoadDefaults(t *testing.T) {
	tmp := t.TempDir()
	cfg, err := Load(tmp, tmp)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.HashlineMode != HashlinePrefer {
		t.Errorf("hashlineMode = %q, want prefer", cfg.HashlineMode)
	}
}

func TestLoadWorkspaceConfig(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{
		// workspace override
		"hashlineMode": "strict",
		"maxContinuations": 50,
	}`), 0o644)

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.HashlineMode != HashlineStrict {
		t.Errorf("hashlineMode = %q, want strict", cfg.HashlineMode)
	}
	if cfg.MaxContinuations != 50 {
		t.Errorf("maxContinuations = %d, want 50", cfg.MaxContinuations)
	}
}

func TestLoadUserConfig(t *testing.T) {
	userHome := t.TempDir()
	userCfgDir := filepath.Join(userHome, "lazygrok")
	os.MkdirAll(userCfgDir, 0o755)
	os.WriteFile(filepath.Join(userCfgDir, "config.jsonc"), []byte(`{
		"maxContinuations": 10,
	}`), 0o644)

	cfg, err := Load(t.TempDir(), userHome)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.MaxContinuations != 10 {
		t.Errorf("maxContinuations = %d, want 10", cfg.MaxContinuations)
	}
}

func TestWorkspaceOverridesUser(t *testing.T) {
	userHome := t.TempDir()
	userCfgDir := filepath.Join(userHome, "lazygrok")
	os.MkdirAll(userCfgDir, 0o755)
	os.WriteFile(filepath.Join(userCfgDir, "config.jsonc"), []byte(`{"maxContinuations": 10}`), 0o644)

	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{"maxContinuations": 99}`), 0o644)

	cfg, err := Load(ws, userHome)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.MaxContinuations != 99 {
		t.Errorf("workspace should override user: got %d, want 99", cfg.MaxContinuations)
	}
}

func TestEnvOverridesAll(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{"maxContinuations": 50}`), 0o644)

	os.Setenv("LAZYGROK_MAX_CONTINUATIONS", "5")
	defer os.Unsetenv("LAZYGROK_MAX_CONTINUATIONS")

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.MaxContinuations != 5 {
		t.Errorf("env should override workspace: got %d, want 5", cfg.MaxContinuations)
	}
}

func TestUnknownKeys(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{
		"hashlineMode": "off",
		"bogusKey": true,
		"anotherUnknown": "value",
	}`), 0o644)

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if !cfg.HasUnknownKeys() {
		t.Error("expected unknown keys")
	}
	report := cfg.UnknownKeysReport()
	if report == "" {
		t.Error("unknown keys report should not be empty")
	}
}

func TestJSONCComments(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{
		// line comment
		"hashlineMode": "off", /* block comment */
		"maxContinuations": 7,
	}`), 0o644)

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.HashlineMode != HashlineOff {
		t.Errorf("hashlineMode = %q, want off", cfg.HashlineMode)
	}
	if cfg.MaxContinuations != 7 {
		t.Errorf("maxContinuations = %d, want 7", cfg.MaxContinuations)
	}
}

func TestTrailingComma(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{
		"hashlineMode": "strict",
		"maxContinuations": 3,
	}`), 0o644)

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.HashlineMode != HashlineStrict {
		t.Errorf("hashlineMode = %q, want strict", cfg.HashlineMode)
	}
}

func TestInvalidValue(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{"hashlineMode": "bogus"}`), 0o644)

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load should not fail on invalid value (validate separately): %v", err)
	}
	if verr := cfg.Validate(); verr == nil {
		t.Error("Validate should reject bogus hashlineMode")
	}
}

func TestMissingFile(t *testing.T) {
	cfg, err := Load("/nonexistent", "/nonexistent")
	if err != nil {
		t.Fatalf("missing files should not error: %v", err)
	}
	if cfg.HashlineMode != HashlinePrefer {
		t.Errorf("should fall back to defaults: %q", cfg.HashlineMode)
	}
}

func TestDeprecatedEnvCompat(t *testing.T) {
	os.Setenv("LAZYGROK_HASHLINE", "off")
	defer os.Unsetenv("LAZYGROK_HASHLINE")

	cfg, err := Load(t.TempDir(), t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.HashlineMode != HashlineOff {
		t.Errorf("LAZYGROK_HASHLINE=off should set mode to off: got %q", cfg.HashlineMode)
	}
}
