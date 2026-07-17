// Package config provides typed configuration for lazygrok with
// environment, workspace, user, and default precedence.
//
// Configuration sources, highest priority first:
//  1. Explicit environment overrides (LAZYGROK_* variables)
//  2. Workspace config at .lazygrok/config.jsonc
//  3. User config at $GROK_HOME/lazygrok/config.jsonc (or ~/.grok/...)
//  4. Built-in defaults
//
// Unknown keys produce diagnostics rather than silently changing behavior.
// Invalid values fail with a precise message.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// SchemaVersion is the current configuration schema version.
const SchemaVersion = 1

// HashlineMode controls hashline enforcement behavior.
type HashlineMode string

const (
	HashlineOff    HashlineMode = "off"
	HashlinePrefer HashlineMode = "prefer"
	HashlineStrict HashlineMode = "strict"
)

// CommentPolicy controls how comments are handled in mutation checks.
type CommentPolicy string

const (
	CommentAllow CommentPolicy = "allow"
	CommentWarn  CommentPolicy = "warn"
	CommentDeny   CommentPolicy = "deny"
)

// LogLevel controls diagnostic log verbosity.
type LogLevel string

const (
	LogError LogLevel = "error"
	LogWarn  LogLevel = "warn"
	LogInfo  LogLevel = "info"
	LogDebug LogLevel = "debug"
)

// ContextLimits controls per-section and combined byte limits for injected context.
type ContextLimits struct {
	SectionBytes int `json:"sectionBytes"`
	MaxBytes      int `json:"maxBytes"`
}

// Config is the fully resolved, typed configuration.
type Config struct {
	SchemaVersion int `json:"schemaVersion"`

	// Feature toggles
	DisabledHooks     []string `json:"disabledHooks"`
	DisabledAgents    []string `json:"disabledAgents"`
	DisabledCommands  []string `json:"disabledCommands"`
	DisabledSkills    []string `json:"disabledSkills"`
	ContinuationEnabled bool  `json:"continuationEnabled"`
	MaxContinuations   int  `json:"maxContinuations"`
	CooldownSeconds    int  `json:"cooldownSeconds"`
	RepeatedStateThreshold int `json:"repeatedStateThreshold"`
	RalphEnabled       bool `json:"ralphEnabled"`
	UltraworkEnabled   bool `json:"ultraworkEnabled"`
	TodoEnforcement    bool `json:"todoEnforcement"`
	BoulderEnforcement bool `json:"boulderEnforcement"`
	PlanEnforcement    bool `json:"planEnforcement"`
	SkillGateEnabled   bool `json:"skillGateEnabled"`
	IntentGateEnabled  bool `json:"intentGateEnabled"`
	LSPEnabled         bool `json:"lspEnabled"`
	LSPStopEnforcement bool `json:"lspStopEnforcement"`

	// Hashline
	HashlineMode          HashlineMode `json:"hashlineMode"`
	NativeMutationStrict  bool         `json:"nativeMutationStrict"`

	// Policies
	CommentPolicy      CommentPolicy `json:"commentPolicy"`
	ProjectRuleInjection bool        `json:"projectRuleInjection"`

	// Context limits
	Context ContextLimits `json:"context"`

	// Orchestration
	SubagentConcurrency int  `json:"subagentConcurrency"`
	WorktreeIsolation   bool `json:"worktreeIsolation"`

	// State and logging
	StateRetention string   `json:"stateRetention"`
	LogLevel        LogLevel `json:"logLevel"`
	LogPath         string   `json:"logPath"`

	// Diagnostics
	UnknownKeys []string `json:"-"`
	Source      string   `json:"-"`
}

// Defaults returns the built-in default configuration.
func Defaults() *Config {
	return &Config{
		SchemaVersion:           SchemaVersion,
		ContinuationEnabled:     true,
		MaxContinuations:        25,
		CooldownSeconds:         10,
		RepeatedStateThreshold: 3,
		RalphEnabled:            true,
		UltraworkEnabled:        true,
		TodoEnforcement:         true,
		BoulderEnforcement:      true,
		PlanEnforcement:         true,
		SkillGateEnabled:        true,
		IntentGateEnabled:       true,
		LSPEnabled:              true,
		LSPStopEnforcement:      false,
		HashlineMode:            HashlinePrefer,
		NativeMutationStrict:    false,
		CommentPolicy:           CommentAllow,
		ProjectRuleInjection:    true,
		Context: ContextLimits{
			SectionBytes: 4096,
			MaxBytes:     32768,
		},
		SubagentConcurrency: 4,
		WorktreeIsolation:   false,
		StateRetention:      "7d",
		LogLevel:            LogInfo,
		LogPath:             "",
		UnknownKeys:         nil,
		Source:              "defaults",
	}
}

// Load resolves configuration from all sources with proper precedence.
// workspaceRoot is the current workspace root (for .lazygrok/config.jsonc).
// grokHome is the Grok home directory (for user config).
func Load(workspaceRoot, grokHome string) (*Config, error) {
	cfg := Defaults()

	// 3. User config
	userPath := userConfigPath(grokHome)
	if userPath != "" {
		if err := loadJSONCInto(cfg, userPath, "user"); err != nil {
			return nil, fmt.Errorf("user config %s: %w", userPath, err)
		}
	}

	// 2. Workspace config
	if workspaceRoot != "" {
		wsPath := filepath.Join(workspaceRoot, ".lazygrok", "config.jsonc")
		if err := loadJSONCInto(cfg, wsPath, "workspace"); err != nil {
			return nil, fmt.Errorf("workspace config %s: %w", wsPath, err)
		}
	}

	// 1. Environment overrides
	applyEnvOverrides(cfg)

	return cfg, nil
}

func userConfigPath(grokHome string) string {
	if grokHome == "" {
		grokHome = defaultGrokHome()
	}
	if grokHome == "" {
		return ""
	}
	return filepath.Join(grokHome, "lazygrok", "config.jsonc")
}

func defaultGrokHome() string {
	if gh := os.Getenv("GROK_HOME"); gh != "" && filepath.IsAbs(gh) {
		return gh
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return filepath.Join(home, ".grok")
	}
	return ""
}

// loadJSONCInto parses a JSONC file (JSON with comments and trailing commas)
// and merges known fields into cfg. Unknown keys are collected into cfg.UnknownKeys.
func loadJSONCInto(cfg *Config, path, source string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	cleaned := stripJSONC(string(data))
	if strings.TrimSpace(cleaned) == "" {
		return nil
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(cleaned), &raw); err != nil {
		return fmt.Errorf("parse error: %w", err)
	}

	known := knownKeys()
	for key := range raw {
		if !known[key] {
			cfg.UnknownKeys = append(cfg.UnknownKeys, key)
		}
	}

	var typed Config
	if err := json.Unmarshal([]byte(cleaned), &typed); err != nil {
		return fmt.Errorf("field error: %w", err)
	}

	// Merge non-zero fields from typed into cfg
	mergeNonZero(cfg, &typed)
	cfg.Source = source
	return nil
}

// knownKeys returns the set of valid configuration keys.
func knownKeys() map[string]bool {
	return map[string]bool{
		"schemaVersion":            true,
		"disabledHooks":            true,
		"disabledAgents":           true,
		"disabledCommands":         true,
		"disabledSkills":           true,
		"continuationEnabled":      true,
		"maxContinuations":         true,
		"cooldownSeconds":          true,
		"repeatedStateThreshold":   true,
		"ralphEnabled":             true,
		"ultraworkEnabled":         true,
		"todoEnforcement":          true,
		"boulderEnforcement":       true,
		"planEnforcement":          true,
		"skillGateEnabled":         true,
		"intentGateEnabled":        true,
		"lspEnabled":               true,
		"lspStopEnforcement":       true,
		"hashlineMode":             true,
		"nativeMutationStrict":     true,
		"commentPolicy":            true,
		"projectRuleInjection":     true,
		"context":                  true,
		"subagentConcurrency":      true,
		"worktreeIsolation":        true,
		"stateRetention":           true,
		"logLevel":                 true,
		"logPath":                  true,
	}
}

// mergeNonZero copies non-zero fields from src into dst.
func mergeNonZero(dst, src *Config) {
	if src.SchemaVersion != 0 {
		dst.SchemaVersion = src.SchemaVersion
	}
	if len(src.DisabledHooks) > 0 {
		dst.DisabledHooks = src.DisabledHooks
	}
	if len(src.DisabledAgents) > 0 {
		dst.DisabledAgents = src.DisabledAgents
	}
	if len(src.DisabledCommands) > 0 {
		dst.DisabledCommands = src.DisabledCommands
	}
	if len(src.DisabledSkills) > 0 {
		dst.DisabledSkills = src.DisabledSkills
	}
	if src.ContinuationEnabled {
		dst.ContinuationEnabled = true
	}
	if src.MaxContinuations != 0 {
		dst.MaxContinuations = src.MaxContinuations
	}
	if src.CooldownSeconds != 0 {
		dst.CooldownSeconds = src.CooldownSeconds
	}
	if src.RepeatedStateThreshold != 0 {
		dst.RepeatedStateThreshold = src.RepeatedStateThreshold
	}
	if src.RalphEnabled {
		dst.RalphEnabled = true
	}
	if src.UltraworkEnabled {
		dst.UltraworkEnabled = true
	}
	if src.TodoEnforcement {
		dst.TodoEnforcement = true
	}
	if src.BoulderEnforcement {
		dst.BoulderEnforcement = true
	}
	if src.PlanEnforcement {
		dst.PlanEnforcement = true
	}
	if src.SkillGateEnabled {
		dst.SkillGateEnabled = true
	}
	if src.IntentGateEnabled {
		dst.IntentGateEnabled = true
	}
	if src.LSPEnabled {
		dst.LSPEnabled = true
	}
	if src.LSPStopEnforcement {
		dst.LSPStopEnforcement = true
	}
	if src.HashlineMode != "" {
		dst.HashlineMode = src.HashlineMode
	}
	if src.NativeMutationStrict {
		dst.NativeMutationStrict = true
	}
	if src.CommentPolicy != "" {
		dst.CommentPolicy = src.CommentPolicy
	}
	if src.ProjectRuleInjection {
		dst.ProjectRuleInjection = true
	}
	if src.Context.SectionBytes != 0 {
		dst.Context.SectionBytes = src.Context.SectionBytes
	}
	if src.Context.MaxBytes != 0 {
		dst.Context.MaxBytes = src.Context.MaxBytes
	}
	if src.SubagentConcurrency != 0 {
		dst.SubagentConcurrency = src.SubagentConcurrency
	}
	if src.WorktreeIsolation {
		dst.WorktreeIsolation = true
	}
	if src.StateRetention != "" {
		dst.StateRetention = src.StateRetention
	}
	if src.LogLevel != "" {
		dst.LogLevel = src.LogLevel
	}
	if src.LogPath != "" {
		dst.LogPath = src.LogPath
	}
}

// --- Environment overrides ---

func applyEnvOverrides(cfg *Config) {
	if v := os.Getenv("LAZYGROK_HASHLINE"); v != "" {
		cfg.HashlineMode = parseHashlineMode(v)
	}
	if v := os.Getenv("LAZYGROK_INTENT_GATE"); v != "" {
		cfg.IntentGateEnabled = envTruthy(v, true)
	}
	if v := os.Getenv("LAZYGROK_LSP_ENFORCE"); v != "" {
		cfg.LSPStopEnforcement = envTruthy(v, false)
		cfg.LSPEnabled = envTruthy(v, true)
	}
	if v := os.Getenv("LAZYGROK_PLAN_MODE"); v != "" {
		// Deprecated: plan mode is now controlled by config; env forces on.
		_ = v
	}
	if v := os.Getenv("LAZYGROK_MAX_CONTINUATIONS"); v != "" {
		if n := parseInt(v); n > 0 {
			cfg.MaxContinuations = n
		}
	}
	if v := os.Getenv("LAZYGROK_COOLDOWN_SECONDS"); v != "" {
		if n := parseInt(v); n >= 0 {
			cfg.CooldownSeconds = n
		}
	}
	if v := os.Getenv("LAZYGROK_RALPH"); v != "" {
		cfg.RalphEnabled = envTruthy(v, true)
	}
	if v := os.Getenv("LAZYGROK_ULTRAWORK"); v != "" {
		cfg.UltraworkEnabled = envTruthy(v, true)
	}
	if v := os.Getenv("LAZYGROK_CONTINUATION"); v != "" {
		cfg.ContinuationEnabled = envTruthy(v, true)
	}
	cfg.Source = "env"
}

func parseHashlineMode(v string) HashlineMode {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "off", "0", "false", "no":
		return HashlineOff
	case "strict", "1", "true", "yes":
		return HashlineStrict
	default:
		return HashlinePrefer
	}
}

func envTruthy(key string, defaultOn bool) bool {
	v := strings.ToLower(strings.TrimSpace(key))
	if v == "" {
		return defaultOn
	}
	switch v {
	case "0", "false", "no", "off":
		return false
	case "1", "true", "yes", "on":
		return true
	default:
		return defaultOn
	}
}

func parseInt(s string) int {
	n := 0
	negative := false
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "-") {
		negative = true
		s = s[1:]
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	if negative {
		return -n
	}
	return n
}

// --- JSONC parsing ---

var (
	jsoncLineComment = regexp.MustCompile(`(?m)//.*$`)
	jsoncBlockComment = regexp.MustCompile(`(?s)/\*.*?\*/`)
	jsoncTrailingComma = regexp.MustCompile(`,(\s*[}\]])`)
)

// stripJSONC removes // line comments, /* block */ comments, and trailing commas
// from JSONC text, producing valid JSON.
func stripJSONC(s string) string {
	s = jsoncBlockComment.ReplaceAllString(s, "")
	s = jsoncLineComment.ReplaceAllString(s, "")
	s = jsoncTrailingComma.ReplaceAllString(s, "$1")
	return s
}

// Validate checks the config for invalid values and returns an error with
// a precise message if any are found.
func (c *Config) Validate() error {
	switch c.HashlineMode {
	case HashlineOff, HashlinePrefer, HashlineStrict:
	default:
		return fmt.Errorf("invalid hashlineMode %q: must be off, prefer, or strict", c.HashlineMode)
	}
	switch c.CommentPolicy {
	case CommentAllow, CommentWarn, CommentDeny:
	default:
		return fmt.Errorf("invalid commentPolicy %q: must be allow, warn, or deny", c.CommentPolicy)
	}
	switch c.LogLevel {
	case LogError, LogWarn, LogInfo, LogDebug:
	default:
		return fmt.Errorf("invalid logLevel %q: must be error, warn, info, or debug", c.LogLevel)
	}
	if c.MaxContinuations < 0 {
		return fmt.Errorf("maxContinuations must be >= 0, got %d", c.MaxContinuations)
	}
	if c.CooldownSeconds < 0 {
		return fmt.Errorf("cooldownSeconds must be >= 0, got %d", c.CooldownSeconds)
	}
	if c.RepeatedStateThreshold < 0 {
		return fmt.Errorf("repeatedStateThreshold must be >= 0, got %d", c.RepeatedStateThreshold)
	}
	if c.Context.SectionBytes < 0 {
		return fmt.Errorf("context.sectionBytes must be >= 0")
	}
	if c.Context.MaxBytes < 0 {
		return fmt.Errorf("context.maxBytes must be >= 0")
	}
	if c.SubagentConcurrency < 0 {
		return fmt.Errorf("subagentConcurrency must be >= 0")
	}
	return nil
}

// HasUnknownKeys reports whether any unknown keys were encountered.
func (c *Config) HasUnknownKeys() bool {
	return len(c.UnknownKeys) > 0
}

// UnknownKeysReport returns a human-readable diagnostic of unknown keys.
func (c *Config) UnknownKeysReport() string {
	if len(c.UnknownKeys) == 0 {
		return ""
	}
	return fmt.Sprintf("unknown config keys (ignored): %s", strings.Join(c.UnknownKeys, ", "))
}
