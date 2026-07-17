package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
	"github.com/spf13/cobra"
)

// postToolFailureCmd records tool failures for diagnostics.
func postToolFailureCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "post-tool-failure",
		Short: "Handle PostToolUseFailure events",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)
			recordDiagnostic(ev, "post_tool_failure")
			return nil
		},
	}
}

// permissionDeniedCmd records permission denials.
func permissionDeniedCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "permission-denied",
		Short: "Handle PermissionDenied events",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)
			recordDiagnostic(ev, "permission_denied")
			return nil
		},
	}
}

// stopFailureCmd handles StopFailure events.
func stopFailureCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stop-failure",
		Short: "Handle StopFailure events",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)
			recordDiagnostic(ev, "stop_failure")
			return nil
		},
	}
}

// notificationCmd handles Notification events.
func notificationCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "notification",
		Short: "Handle Notification events",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)
			recordDiagnostic(ev, "notification")
			return nil
		},
	}
}

// subagentStartCmd records subagent lifecycle start.
func subagentStartCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "subagent-start",
		Short: "Handle SubagentStart events",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)
			recordSubagentEvent(ev, "start")
			return nil
		},
	}
}

// subagentStopCmd records subagent lifecycle stop.
func subagentStopCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "subagent-stop",
		Short: "Handle SubagentStop events",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)
			recordSubagentEvent(ev, "stop")
			return nil
		},
	}
}

// preCompactCmd preserves state before compaction.
func preCompactCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "pre-compact",
		Short: "Handle PreCompact events",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)
			recordDiagnostic(ev, "pre_compact")
			return nil
		},
	}
}

// postCompactCmd restores context after compaction.
func postCompactCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "post-compact",
		Short: "Handle PostCompact events",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)
			recordDiagnostic(ev, "post_compact")
			return nil
		},
	}
}

// recordDiagnostic writes a diagnostic entry for the event.
func recordDiagnostic(ev hookenv.Event, eventType string) {
	grokHome := hookenv.GrokHome()
	if grokHome == "" || ev.SessionID == "" {
		return
	}
	logDir := filepath.Join(grokHome, "state", "lazygrok", "diagnostics", ev.SessionID)
	_ = os.MkdirAll(logDir, 0o755)
	entry := map[string]any{
		"event":      eventType,
		"timestamp":  ev.HookEventName,
		"toolName":   ev.ToolName,
		"stopReason": ev.StopReason,
	}
	data, _ := json.Marshal(entry)
	logPath := filepath.Join(logDir, "events.jsonl")
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintln(f, string(data))
}

// recordSubagentEvent records subagent start/stop for lifecycle tracking.
func recordSubagentEvent(ev hookenv.Event, phase string) {
	grokHome := hookenv.GrokHome()
	if grokHome == "" || ev.SessionID == "" {
		return
	}
	stateDir := filepath.Join(grokHome, "state", "lazygrok", "subagents", ev.SessionID)
	_ = os.MkdirAll(stateDir, 0o755)
	entry := map[string]any{
		"phase":     phase,
		"timestamp": ev.HookEventName,
	}
	data, _ := json.Marshal(entry)
	logPath := filepath.Join(stateDir, "lifecycle.jsonl")
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintln(f, string(data))
}

// silence unused import warning
var _ = hookio.EmitAllow
