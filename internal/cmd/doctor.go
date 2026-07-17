package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"lazygrok/internal/agents"
	"lazygrok/internal/core/config"
	"lazygrok/internal/hookenv"
	"github.com/spf13/cobra"
)

// doctorCmd returns the doctor command.
func doctorCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Report plugin diagnostics (no secrets)",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runDoctor()
		},
	}
}

func runDoctor() error {
	report := map[string]any{}

	// Plugin version
	report["pluginVersion"] = "0.2.0"

	// Runtime info
	report["runtime"] = map[string]any{
		"goVersion": runtime.Version(),
		"os":       runtime.GOOS,
		"arch":     runtime.GOARCH,
	}

	// Grok home
	grokHome := hookenv.GrokHome()
	report["grokHome"] = grokHome

	// Configuration
	workspace, _ := os.Getwd()
	cfg, err := config.Load(workspace, grokHome)
	if err != nil {
		report["configError"] = err.Error()
	} else {
		report["config"] = map[string]any{
			"source":              cfg.Source,
			"hashlineMode":        cfg.HashlineMode,
			"continuationEnabled": cfg.ContinuationEnabled,
			"maxContinuations":    cfg.MaxContinuations,
			"ralphEnabled":        cfg.RalphEnabled,
			"ultraworkEnabled":    cfg.UltraworkEnabled,
			"skillGateEnabled":    cfg.SkillGateEnabled,
			"intentGateEnabled":   cfg.IntentGateEnabled,
		}
		if cfg.HasUnknownKeys() {
			report["unknownConfigKeys"] = cfg.UnknownKeys
		}
	}

	// Agent validation
	pluginRoot, _ := hookenv.PluginRoot()
	if pluginRoot != "" {
		agentsDir := filepath.Join(pluginRoot, "agents")
		if _, err := os.Stat(agentsDir); err == nil {
			result := agents.ValidateDir(agentsDir)
			report["agents"] = map[string]any{
				"count":   len(result.Agents),
				"errors":  result.Errors,
				"warnings": result.Warnings,
			}
		}
	}

	// MCP servers
	if pluginRoot != "" {
		mcpPath := filepath.Join(pluginRoot, ".mcp.json")
		if data, err := os.ReadFile(mcpPath); err == nil {
			var mcp map[string]any
			if json.Unmarshal(data, &mcp) == nil {
				if servers, ok := mcp["mcpServers"].(map[string]any); ok {
					names := []string{}
					for name := range servers {
						names = append(names, name)
					}
					report["mcpServers"] = names
				}
			}
		}
	}

	// Hooks
	if pluginRoot != "" {
		hooksPath := filepath.Join(pluginRoot, "hooks", "hooks.json")
		if data, err := os.ReadFile(hooksPath); err == nil {
			var hooks map[string]any
			if json.Unmarshal(data, &hooks) == nil {
				if hookMap, ok := hooks["hooks"].(map[string]any); ok {
					events := []string{}
					for event := range hookMap {
						events = append(events, event)
					}
					report["hookEvents"] = events
				}
			}
		}
	}

	// Binary check
	binDir := filepath.Join(pluginRoot, "bin")
	if entries, err := os.ReadDir(binDir); err == nil {
		binaries := []string{}
		for _, e := range entries {
			if !e.IsDir() && (strings.HasPrefix(e.Name(), "lazygrok-hook-") || strings.HasPrefix(e.Name(), "lazygrok-mcp-")) {
				binaries = append(binaries, e.Name())
			}
		}
		report["binaries"] = binaries
	}

	// No secrets are reported
	report["noSecretsReported"] = true

	// Output as JSON
	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	return nil
}
