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

func TestWorkspaceCanDisableDefaultEnabledPolicy(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{
		"lspStopEnforcement": false,
		"continuationEnabled": false
	}`), 0o644)

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.LSPStopEnforcement {
		t.Error("workspace should disable LSP stop enforcement")
	}
	if cfg.ContinuationEnabled {
		t.Error("workspace should disable continuation")
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

func TestJSONCCommentDelimitersInsideStrings(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	os.MkdirAll(lazygrokDir, 0o755)
	os.WriteFile(filepath.Join(lazygrokDir, "config.jsonc"), []byte(`{
		"logPath": "/tmp//lazygrok/*active*/.log",
		"lspStopEnforcement": false,
		"cooldownSeconds": 0,
	}`), 0o644)

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.LogPath != "/tmp//lazygrok/*active*/.log" {
		t.Errorf("logPath = %q", cfg.LogPath)
	}
	if cfg.LSPStopEnforcement {
		t.Error("workspace should disable LSP stop enforcement")
	}
	if cfg.CooldownSeconds != 0 {
		t.Errorf("cooldownSeconds = %d, want 0", cfg.CooldownSeconds)
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

	if _, err := Load(ws, t.TempDir()); err == nil {
		t.Error("Load should reject bogus hashlineMode")
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

func TestHashlineEnvironmentModes(t *testing.T) {
	for _, test := range []struct {
		value string
		want  HashlineMode
	}{
		{value: "1", want: HashlinePrefer},
		{value: "strict", want: HashlineStrict},
		{value: "false", want: HashlineOff},
	} {
		t.Run(test.value, func(t *testing.T) {
			t.Setenv("LAZYGROK_HASHLINE", test.value)
			cfg, err := Load(t.TempDir(), t.TempDir())
			if err != nil {
				t.Fatalf("Load failed: %v", err)
			}
			if cfg.HashlineMode != test.want {
				t.Fatalf("hashlineMode = %q, want %q", cfg.HashlineMode, test.want)
			}
		})
	}
}

func TestHashlineEnvironmentOverridesWorkspace(t *testing.T) {
	ws := t.TempDir()
	lazygrokDir := filepath.Join(ws, ".lazygrok")
	if err := os.MkdirAll(lazygrokDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(lazygrokDir, "config.jsonc"),
		[]byte(`{"hashlineMode":"strict"}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	t.Setenv("LAZYGROK_HASHLINE", "off")

	cfg, err := Load(ws, t.TempDir())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.HashlineMode != HashlineOff {
		t.Fatalf("environment did not override workspace: got %q", cfg.HashlineMode)
	}
}

func TestInvalidSecurityEnvironmentFailsClosed(t *testing.T) {
	t.Setenv("LAZYGROK_LSP_ENFORCE", "typo")
	if _, err := Load(t.TempDir(), t.TempDir()); err == nil {
		t.Fatal("invalid LSP enforcement environment value was accepted")
	}
}

func TestInvalidNumericEnvironmentIsRejected(t *testing.T) {
	for _, name := range []string{"LAZYGROK_MAX_CONTINUATIONS", "LAZYGROK_COOLDOWN_SECONDS"} {
		t.Run(name, func(t *testing.T) {
			t.Setenv(name, "invalid")
			if _, err := Load(t.TempDir(), t.TempDir()); err == nil {
				t.Fatalf("invalid %s was accepted", name)
			}
		})
	}
}
