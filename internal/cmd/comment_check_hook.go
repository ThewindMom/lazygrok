package cmd

import (
	"os"
	"strings"

	"github.com/spf13/cobra"
	corehashline "lazygrok/internal/core/hashline"
	commentchecker "lazygrok/internal/core/policy"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
)

// postToolCommentCheckCmd checks for AI-generated comments after edits.
func postToolCommentCheckCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "post-tool-comment-check",
		Short: "Check for AI-generated comments after edits",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return nil
			}
			hookenv.ApplyEvent(ev)

			filePath := pickFilePath(ev.ToolInput)
			if filePath == "" {
				return nil
			}

			data, err := readCommentCheckFile(workspace(ev), filePath)
			if err != nil {
				return nil
			}

			results := commentchecker.CheckContent(string(data), commentchecker.PolicyWarn)
			if len(results) == 0 {
				return nil
			}

			report := commentchecker.FormatResults(results)
			hookio.EmitAdditionalContext(os.Stdout, report, "post_tool_use")
			return nil
		},
	}
}

func pickFilePath(input map[string]any) string {
	keys := []string{"path", "file_path", "filePath", "target_file", "targetFile"}
	for _, k := range keys {
		if v, ok := input[k].(string); ok && strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func readCommentCheckFile(workspaceRoot, path string) ([]byte, error) {
	return corehashline.ReadWorkspaceFileBytes(path, workspaceRoot)
}
