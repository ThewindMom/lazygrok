package cmd

import (
	"lazygrok/internal/hookenv"
	"lazygrok/internal/lsp"
	"github.com/spf13/cobra"
)

func postToolLSPCmd() *cobra.Command {
	return &cobra.Command{
		Use: "post-tool-lsp",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			lsp.UpdateStashFromEvent(ev)
			return nil
		},
	}
}