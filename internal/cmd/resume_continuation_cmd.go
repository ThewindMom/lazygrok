package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"lazygrok/internal/core/continuation"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
	"github.com/spf13/cobra"
)

// resumeContinuationCmd implements the `lazygrok-hook resume-continuation` subcommand.
// It clears the stop marker, resumes any paused loop, and lists resumable work.
func resumeContinuationCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "resume-continuation",
		Short: "Clear the stop marker and resume paused continuation loops",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			ws := workspace(ev)
			gh := hookenv.GrokHome()
			sid := sessionID(ev)

			if err := continuation.ResumeContinuation(gh, sid, ws); err != nil {
				return fmt.Errorf("resume-continuation: %w", err)
			}

			var sb strings.Builder
			sb.WriteString(fmt.Sprintf(
				"[RESUME-CONTINUATION] Stop marker cleared for session %s.\n",
				sid,
			))

			items, listErr := continuation.ListResumableWork(ws)
			if listErr != nil {
				sb.WriteString(fmt.Sprintf("Warning: could not list resumable work: %v\n", listErr))
			} else if len(items) == 0 {
				sb.WriteString("No resumable work found.\n")
			} else {
				sb.WriteString(fmt.Sprintf("Resumable work (%d item(s)):\n", len(items)))
				data, _ := json.MarshalIndent(items, "", "  ")
				sb.Write(data)
				sb.WriteString("\n")
			}
			sb.WriteString("Continuation resumed. The stop pipeline will evaluate on the next Stop event.")
			hookio.EmitAdditionalContext(os.Stdout, sb.String(), "UserPromptSubmit")
			return nil
		},
	}
}
