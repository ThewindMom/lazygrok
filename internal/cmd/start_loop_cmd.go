package cmd

import (
	"fmt"
	"os"
	"strings"

	"lazygrok/internal/core/config"
	"lazygrok/internal/core/continuation"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
	"github.com/spf13/cobra"
)

// startLoopCmd implements the `lazygrok-hook start-loop` subcommand.
// It initializes a new continuation loop (ralph or ultrawork) by delegating
// to continuation.StartLoop.
//
// The loop type, objective, and completion criteria are read from the hook
// event prompt or environment variables:
//
//	LAZYGROK_LOOP_TYPE         "ralph" | "ultrawork"
//	LAZYGROK_LOOP_OBJECTIVE    free-text objective
//	LAZYGROK_LOOP_COMPLETION   completion criteria (default "DONE")
func startLoopCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "start-loop",
		Short: "Initialize a Ralph or Ultrawork continuation loop",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			ws := workspace(ev)
			gh := hookenv.GrokHome()
			sid := sessionID(ev)

			loopType := loopTypeFrom(ev)
			objective := loopObjectiveFrom(ev)
			completion := loopCompletionFrom(ev)

			cfg, err := config.Load(ws, gh)
			if err != nil {
				cfg = config.Defaults()
			}

			if err := continuation.StartLoop(ws, loopType, objective, completion, sid, cfg); err != nil {
				return fmt.Errorf("start-loop: %w", err)
			}

			msg := fmt.Sprintf(
				"[START-LOOP] Initialized %s loop for session %s.\n"+
					"Objective: %s\n"+
					"Completion criteria: %s\n"+
					"State persisted at %s/.lazygrok/continuation.json.",
				loopType, sid, objective, completion, ws,
			)
			hookio.EmitAdditionalContext(os.Stdout, msg, "UserPromptSubmit")
			return nil
		},
	}
}

// loopTypeFrom resolves the loop type from the event prompt or environment.
func loopTypeFrom(ev hookenv.Event) string {
	prompt := strings.ToLower(ev.Prompt)
	switch {
	case strings.Contains(prompt, "ulw-loop"), strings.Contains(prompt, "ultrawork"):
		return "ultrawork"
	case strings.Contains(prompt, "ralph-loop"), strings.Contains(prompt, "ralph"):
		return "ralph"
	}
	if v := strings.TrimSpace(os.Getenv("LAZYGROK_LOOP_TYPE")); v != "" {
		return v
	}
	return "ralph"
}

// loopObjectiveFrom resolves the objective from the event prompt or environment.
func loopObjectiveFrom(ev hookenv.Event) string {
	if v := strings.TrimSpace(os.Getenv("LAZYGROK_LOOP_OBJECTIVE")); v != "" {
		return v
	}
	if ev.Prompt != "" {
		return strings.TrimSpace(ev.Prompt)
	}
	return "(unspecified objective)"
}

// loopCompletionFrom resolves the completion criteria from the event or environment.
func loopCompletionFrom(ev hookenv.Event) string {
	if v := strings.TrimSpace(os.Getenv("LAZYGROK_LOOP_COMPLETION")); v != "" {
		return v
	}
	return "DONE"
}
