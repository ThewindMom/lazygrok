package cmd

import (
	"io"
	"os"

	"github.com/spf13/cobra"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
)

// NewRoot returns the lazygrok-hook cobra root command.
func NewRoot() *cobra.Command {
	root := &cobra.Command{Use: "lazygrok-hook"}
	root.AddCommand(
		sessionStartCmd(),
		sessionEndCmd(),
		userPromptCmd(),
		preToolUseCmd(),
		postToolReadCmd(),
		postToolTodoWriteCmd(),
		postToolLSPCmd(),
		postToolFailureCmd(),
		permissionDeniedCmd(),
		stopCmd(),
		stopFailureCmd(),
		notificationCmd(),
		subagentStartCmd(),
		subagentStopCmd(),
		preCompactCmd(),
		postCompactCmd(),
		postToolCommentCheckCmd(),
		doctorCmd(),
		recordSessionBindingCmd(),
		stopContinuationCmd(),
		resumeContinuationCmd(),
		startLoopCmd(),
	)
	return root
}

// Execute runs the root command; exits 1 on error.
func Execute() {
	if err := NewRoot().Execute(); err != nil {
		os.Exit(1)
	}
}

func readEvent() (hookenv.Event, error) {
	ev, err := hookenv.ReadEvent(os.Stdin)
	if err != nil {
		return hookenv.Event{}, err
	}
	if ev.SessionID == "" {
		ev.SessionID, err = hookenv.ParseSessionID(os.Getenv("GROK_SESSION_ID"))
		if err != nil {
			return hookenv.Event{}, err
		}
	}
	return ev, nil
}

func sessionID(ev hookenv.Event) string {
	if ev.SessionID != "" {
		return ev.SessionID
	}
	if s := os.Getenv("GROK_SESSION_ID"); s != "" {
		return s
	}
	return ""
}

func workspace(ev hookenv.Event) string {
	return hookenv.Workspace(ev)
}

func denyPreTool(w io.Writer, reason, fallback string) {
	if reason == "" {
		reason = fallback
	}
	os.Exit(hookio.EmitDeny(w, reason))
}

func allowPreTool(w io.Writer) {
	hookio.EmitAllow(w)
	os.Exit(0)
}
