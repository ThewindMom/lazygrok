package cmd

import (
	"fmt"
	"os"

	"lazygrok/internal/boulder"
	coreboulder "lazygrok/internal/core/boulder"
	"lazygrok/internal/core/config"
	"lazygrok/internal/core/continuation"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
	"lazygrok/internal/lsp"
	"lazygrok/internal/ralph"
	"lazygrok/internal/stoppending"
	"lazygrok/internal/ulwbridge"
	"github.com/spf13/cobra"
)

func stopCmd() *cobra.Command {
	return &cobra.Command{
		Use: "stop",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			w := os.Stdout

			ws := workspace(ev)
			sid := sessionID(ev)
			gh := hookenv.GrokHome()

			// --- NEW core pipeline (tried first) ---

			// 1. core/continuation: bounded loops, cooldowns, repeated-state detection
			if cfg, err := config.Load(ws, gh); err == nil {
				if result := continuation.EvaluateStop(ws, gh, sid, cfg); result.ShouldContinue {
					hookio.EmitStopBlock(w, result.Message)
					os.Exit(0)
				}
			} else {
				fmt.Fprintf(os.Stderr, "lazygrok-hook: config load failed: %v\n", err)
			}

			// 2. core/boulder: active work record with incomplete tasks
			if bs, err := coreboulder.Load(ws); err == nil {
				if wr := bs.GetActiveWork(); wr != nil && wr.Status == coreboulder.WorkActive && !wr.IsComplete() {
					completed, total := wr.TaskProgress()
					msg := fmt.Sprintf(
						"[BOULDER] Active work record %q has incomplete tasks (%d/%d complete).\nObjective: %s\nContinue working until all tasks are complete.",
						wr.ID, completed, total, wr.Objective,
					)
					hookio.EmitStopBlock(w, msg)
					os.Exit(0)
				}
			}

			// --- LEGACY pipeline (kept for backward compatibility) ---

			// ULW-Loop evidence bridge: check for incomplete ulw-loop goals
			if msg := ulwbridge.EvaluateStop(ws, sid); msg != "" {
				hookio.EmitStopBlock(w, msg)
				os.Exit(0)
			}

			if block, msg := ralph.EvaluateStop(ev); block {
				hookio.EmitStopBlock(w, msg)
				os.Exit(0)
			}

			if !boulder.AutoContinuePaused(ws, sid) {
				if block, msg := boulder.EvaluateBoulderStop(ev); block {
					hookio.EmitStopBlock(w, msg)
					os.Exit(0)
				}
				if block, msg := boulder.EvaluateTodoStop(ev); block {
					hookio.EmitStopBlock(w, msg)
					os.Exit(0)
				}
				if block, msg := lsp.EvaluateStop(sid); block {
					hookio.EmitStopBlock(w, msg)
					os.Exit(0)
				}
				if block, msg := stoppending.EvaluateStop(ev); block {
					hookio.EmitStopBlock(w, msg)
					os.Exit(0)
				}
			}

			hookio.EmitStopAllow(w)
			os.Exit(0)
			return nil
		},
	}
}