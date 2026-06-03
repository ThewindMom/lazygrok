package cmd

import (
	"strings"

	"github.com/mihazs/oh-my-grok/internal/hashline"
	"github.com/mihazs/oh-my-grok/internal/hookenv"
	"github.com/mihazs/oh-my-grok/internal/skillgate"
	"github.com/spf13/cobra"
)

func postToolReadCmd() *cobra.Command {
	return &cobra.Command{
		Use: "post-tool-read",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			if !strings.EqualFold(ev.ToolName, "read") {
				return nil
			}
			readPath := skillgate.ReadPathFromEvent(ev)
			if readPath == "" {
				return nil
			}
			sid := sessionID(ev)
			ws := workspace(ev)
			_ = hashline.UpdateCacheFromRead(hookenv.GrokHome(), sid, ws, readPath)
			if hashline.IsSkillPath(readPath) {
				if id := skillgate.SkillIDForPath(sid, readPath); id != "" {
					_ = skillgate.MarkSkillLoaded(sid, id)
				}
			}
			return nil
		},
	}
}