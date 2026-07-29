package cmd

import (
	"github.com/spf13/cobra"
	"lazygrok/internal/boulder"
	"lazygrok/internal/core/continuation"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/lsp"
	"lazygrok/internal/skillgate"
	"lazygrok/internal/spawnguard"
	"lazygrok/internal/usingpowers"
)

func sessionEndCmd() *cobra.Command {
	return &cobra.Command{
		Use: "session-end",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			sid := sessionID(ev)
			ws := workspace(ev)

			skillgate.CleanupSession(sid)
			skillgate.CleanupStopVerify(sid)
			usingpowers.CleanupSession(sid)
			if continuation.IsExplicitlyStopped(hookenv.GrokHome(), sid) {
				_ = continuation.ResumeContinuation(hookenv.GrokHome(), sid, ws)
			}
			boulder.CleanupOMOSession(ws, sid)
			lsp.CleanupSession(sid)
			spawnguard.CleanupSession(sid)
			return nil
		},
	}
}
