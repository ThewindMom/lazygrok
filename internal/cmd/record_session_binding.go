package cmd

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/safestate"
)

func recordSessionBindingCmd() *cobra.Command {
	return &cobra.Command{
		Use:    "record-session-binding",
		Hidden: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			return recordSessionBinding(ev)
		},
	}
}

func recordSessionBinding(ev hookenv.Event) error {
	sessionID := sessionID(ev)
	workspace := workspace(ev)
	if sessionID == "" || workspace == "" {
		return nil
	}
	absoluteWorkspace, err := filepath.Abs(workspace)
	if err != nil {
		return err
	}
	canonicalWorkspace, err := filepath.EvalSymlinks(absoluteWorkspace)
	if err != nil {
		return err
	}
	sum := sha256.Sum256([]byte(canonicalWorkspace))
	workspaceHash := hex.EncodeToString(sum[:])
	payload, err := json.MarshalIndent(map[string]any{
		"version":       1,
		"workspaceHash": workspaceHash,
		"sessionId":     sessionID,
		"updatedAt":     time.Now().UTC().Format(time.RFC3339),
	}, "", "  ")
	if err != nil {
		return err
	}
	grokHome := hookenv.GrokHome()
	target := filepath.Join(
		grokHome,
		"state",
		"lazygrok",
		"session-bindings",
		workspaceHash+"-"+sessionID+".json",
	)
	return safestate.WriteFileBelow(grokHome, target, append(payload, '\n'), 0o600)
}
