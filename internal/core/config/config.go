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
	"strconv"
	"strings"

	"lazygrok/internal/safestate"
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
	CommentDeny  CommentPolicy = "deny"
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
	MaxBytes     int `json:"maxBytes"`
}

// Config is the fully resolved, typed configuration.
type Config struct {
	SchemaVersion int `json:"schemaVersion"`

	// Feature toggles
	DisabledHooks          []string `json:"disabledHooks"`
	DisabledAgents         []string `json:"disabledAgents"`
	DisabledCommands       []string `json:"disabledCommands"`
	DisabledSkills         []string `json:"disabledSkills"`
	ContinuationEnabled    bool     `json:"continuationEnabled"`
	MaxContinuations       int      `json:"maxContinuations"`
	CooldownSeconds        int      `json:"cooldownSeconds"`
	RepeatedStateThreshold int      `json:"repeatedStateThreshold"`
	RalphEnabled           bool     `json:"ralphEnabled"`
	UltraworkEnabled       bool     `json:"ultraworkEnabled"`
	TodoEnforcement        bool     `json:"todoEnforcement"`
	BoulderEnforcement     bool     `json:"boulderEnforcement"`
	PlanEnforcement        bool     `json:"planEnforcement"`
	SkillGateEnabled       bool     `json:"skillGateEnabled"`
	IntentGateEnabled      bool     `json:"intentGateEnabled"`
	LSPEnabled             bool     `json:"lspEnabled"`
	LSPStopEnforcement     bool     `json:"lspStopEnforcement"`

	// Hashline
	HashlineMode         HashlineMode `json:"hashlineMode"`
	NativeMutationStrict bool         `json:"nativeMutationStrict"`

	// Policies
	CommentPolicy        CommentPolicy `json:"commentPolicy"`
	ProjectRuleInjection bool          `json:"projectRuleInjection"`

	// Context limits
	Context ContextLimits `json:"context"`

	// Orchestration
	SubagentConcurrency int  `json:"subagentConcurrency"`
	WorktreeIsolation   bool `json:"worktreeIsolation"`

	// State and logging
	StateRetention string   `json:"stateRetention"`
	LogLevel       LogLevel `json:"logLevel"`
	LogPath        string   `json:"logPath"`

	// Diagnostics
	UnknownKeys []string `json:"-"`
	Source      string   `json:"-"`
}

// Defaults returns the built-in default configuration.
func Defaults() *Config {
	return &Config{
		SchemaVersion:          SchemaVersion,
		ContinuationEnabled:    true,
		MaxContinuations:       25,
		CooldownSeconds:        10,
		RepeatedStateThreshold: 3,
		RalphEnabled:           true,
		UltraworkEnabled:       true,
		TodoEnforcement:        true,
		BoulderEnforcement:     true,
		PlanEnforcement:        true,
		SkillGateEnabled:       true,
		IntentGateEnabled:      true,
		LSPEnabled:             true,
		LSPStopEnforcement:     true,
		HashlineMode:           HashlinePrefer,
		NativeMutationStrict:   false,
		CommentPolicy:          CommentAllow,
		ProjectRuleInjection:   true,
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
	if err := applyEnvOverrides(cfg); err != nil {
		return nil, err
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}
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
	var data []byte
	var err error
	if safestate.IsPath(path) {
		data, err = safestate.ReadFile(path)
	} else {
		data, err = os.ReadFile(path)
	}
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

	if err := json.Unmarshal([]byte(cleaned), cfg); err != nil {
		return fmt.Errorf("field error: %w", err)
	}
	cfg.Source = source
	return nil
}

// knownKeys returns the set of valid configuration keys.
func knownKeys() map[string]bool {
	return map[string]bool{
		"schemaVersion":          true,
		"disabledHooks":          true,
		"disabledAgents":         true,
		"disabledCommands":       true,
		"disabledSkills":         true,
		"continuationEnabled":    true,
		"maxContinuations":       true,
		"cooldownSeconds":        true,
		"repeatedStateThreshold": true,
		"ralphEnabled":           true,
		"ultraworkEnabled":       true,
		"todoEnforcement":        true,
		"boulderEnforcement":     true,
		"planEnforcement":        true,
		"skillGateEnabled":       true,
		"intentGateEnabled":      true,
		"lspEnabled":             true,
		"lspStopEnforcement":     true,
		"hashlineMode":           true,
		"nativeMutationStrict":   true,
		"commentPolicy":          true,
		"projectRuleInjection":   true,
		"context":                true,
		"subagentConcurrency":    true,
		"worktreeIsolation":      true,
		"stateRetention":         true,
		"logLevel":               true,
		"logPath":                true,
	}
}

// --- Environment overrides ---

func applyEnvOverrides(cfg *Config) error {
	applied := false
	if v := os.Getenv("LAZYGROK_HASHLINE"); v != "" {
		cfg.HashlineMode = parseHashlineMode(v)
		applied = true
	}
	if v := os.Getenv("LAZYGROK_INTENT_GATE"); v != "" {
		value, err := parseEnvBool("LAZYGROK_INTENT_GATE", v)
		if err != nil {
			return err
		}
		cfg.IntentGateEnabled = value
		applied = true
	}
	if v := os.Getenv("LAZYGROK_LSP_ENFORCE"); v != "" {
		value, err := parseEnvBool("LAZYGROK_LSP_ENFORCE", v)
		if err != nil {
			return err
		}
		cfg.LSPStopEnforcement = value
		cfg.LSPEnabled = value
		applied = true
	}
	if v := os.Getenv("LAZYGROK_PLAN_MODE"); v != "" {
		_ = v
	}
	if v := os.Getenv("LAZYGROK_MAX_CONTINUATIONS"); v != "" {
		n, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil || n <= 0 {
			return fmt.Errorf("invalid LAZYGROK_MAX_CONTINUATIONS %q: must be a positive integer", v)
		}
		cfg.MaxContinuations = n
		applied = true
	}
	if v := os.Getenv("LAZYGROK_COOLDOWN_SECONDS"); v != "" {
		n, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil || n < 0 {
			return fmt.Errorf("invalid LAZYGROK_COOLDOWN_SECONDS %q: must be a non-negative integer", v)
		}
		cfg.CooldownSeconds = n
		applied = true
	}
	if v := os.Getenv("LAZYGROK_RALPH"); v != "" {
		value, err := parseEnvBool("LAZYGROK_RALPH", v)
		if err != nil {
			return err
		}
		cfg.RalphEnabled = value
		applied = true
	}
	if v := os.Getenv("LAZYGROK_ULTRAWORK"); v != "" {
		value, err := parseEnvBool("LAZYGROK_ULTRAWORK", v)
		if err != nil {
			return err
		}
		cfg.UltraworkEnabled = value
		applied = true
	}
	if v := os.Getenv("LAZYGROK_CONTINUATION"); v != "" {
		value, err := parseEnvBool("LAZYGROK_CONTINUATION", v)
		if err != nil {
			return err
		}
		cfg.ContinuationEnabled = value
		applied = true
	}
	if applied {
		cfg.Source = "env"
	}
	return nil
}

func parseHashlineMode(v string) HashlineMode {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "off", "0", "false", "no":
		return HashlineOff
	case "strict":
		return HashlineStrict
	case "prefer", "1", "true", "yes", "on":
		return HashlinePrefer
	default:
		return HashlineMode(strings.ToLower(strings.TrimSpace(v)))
	}
}

func parseEnvBool(name, raw string) (bool, error) {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch v {
	case "0", "false", "no", "off":
		return false, nil
	case "1", "true", "yes", "on":
		return true, nil
	default:
		return false, fmt.Errorf("invalid %s %q: must be true/on/1 or false/off/0", name, raw)
	}
}

// --- JSONC parsing ---

// stripJSONC removes // line comments, /* block */ comments, and trailing commas
// from JSONC text, producing valid JSON.
func stripJSONC(s string) string {
	var withoutComments strings.Builder
	withoutComments.Grow(len(s))
	inString := false
	escaped := false
	for index := 0; index < len(s); index++ {
		current := s[index]
		if inString {
			withoutComments.WriteByte(current)
			if escaped {
				escaped = false
			} else if current == '\\' {
				escaped = true
			} else if current == '"' {
				inString = false
			}
			continue
		}
		if current == '"' {
			inString = true
			withoutComments.WriteByte(current)
			continue
		}
		if current == '/' && index+1 < len(s) && s[index+1] == '/' {
			index += 2
			for index < len(s) && s[index] != '\n' {
				index++
			}
			if index < len(s) {
				withoutComments.WriteByte('\n')
			}
			continue
		}
		if current == '/' && index+1 < len(s) && s[index+1] == '*' {
			index += 2
			for index+1 < len(s) && !(s[index] == '*' && s[index+1] == '/') {
				if s[index] == '\n' {
					withoutComments.WriteByte('\n')
				}
				index++
			}
			if index+1 < len(s) {
				index++
			}
			continue
		}
		withoutComments.WriteByte(current)
	}

	cleaned := withoutComments.String()
	var withoutTrailingCommas strings.Builder
	withoutTrailingCommas.Grow(len(cleaned))
	inString = false
	escaped = false
	for index := 0; index < len(cleaned); index++ {
		current := cleaned[index]
		if inString {
			withoutTrailingCommas.WriteByte(current)
			if escaped {
				escaped = false
			} else if current == '\\' {
				escaped = true
			} else if current == '"' {
				inString = false
			}
			continue
		}
		if current == '"' {
			inString = true
			withoutTrailingCommas.WriteByte(current)
			continue
		}
		if current == ',' {
			next := index + 1
			for next < len(cleaned) && strings.ContainsRune(" \t\r\n", rune(cleaned[next])) {
				next++
			}
			if next < len(cleaned) && (cleaned[next] == '}' || cleaned[next] == ']') {
				continue
			}
		}
		withoutTrailingCommas.WriteByte(current)
	}
	return withoutTrailingCommas.String()
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
