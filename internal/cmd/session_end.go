package cmd

import (
	"lazygrok/internal/boulder"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/lsp"
	"lazygrok/internal/skillgate"
	"lazygrok/internal/spawnguard"
	"lazygrok/internal/usingpowers"
	"github.com/spf13/cobra"
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
			boulder.CleanupOMOSession(ws, sid)
			lsp.CleanupSession(sid)
			spawnguard.CleanupSession(sid)
			return nil
		},
	}
}