package cmd

import (
	"fmt"
	"os"

	"lazygrok/internal/core/continuation"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
	"github.com/spf13/cobra"
)

// stopContinuationCmd implements the `lazygrok-hook stop-continuation` subcommand.
// It writes the explicit stop marker and pauses any active continuation loop
// by delegating to continuation.StopContinuation.
func stopContinuationCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stop-continuation",
		Short: "Stop active continuation loops and persist the stop marker",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			ws := workspace(ev)
			gh := hookenv.GrokHome()
			sid := sessionID(ev)

			if err := continuation.StopContinuation(ws, gh, sid); err != nil {
				return fmt.Errorf("stop-continuation: %w", err)
			}

			msg := fmt.Sprintf(
				"[STOP-CONTINUATION] Continuation stopped for session %s.\n"+
					"Marker written at %s/state/stop-continuation/%s/stopped.\n"+
					"Active loops paused. Run /resume-continuation to resume.",
				sid, gh, sid,
			)
			hookio.EmitAdditionalContext(os.Stdout, msg, "UserPromptSubmit")
			return nil
		},
	}
}
