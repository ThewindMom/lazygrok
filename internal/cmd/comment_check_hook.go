package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	commentchecker "lazygrok/internal/core/policy"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
	"github.com/spf13/cobra"
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

			absPath := filePath
			if !filepath.IsAbs(absPath) && ev.WorkspaceRoot != "" {
				absPath = filepath.Join(ev.WorkspaceRoot, filePath)
			}

			data, err := os.ReadFile(absPath)
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

var _ = fmt.Sprintf
