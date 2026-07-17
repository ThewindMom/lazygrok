package main

import (
	"fmt"
	"os"
	"path/filepath"

	"lazygrok/internal/mcp/hashline"
	lspsrv "lazygrok/internal/mcp/lsp"
)

func main() {
	serverName := "hashline"
	if len(os.Args) > 1 {
		serverName = os.Args[1]
	}

	workspaceRoot := os.Getenv("GROK_WORKSPACE_ROOT")
	if workspaceRoot == "" {
		workspaceRoot = os.Getenv("CLAUDE_PROJECT_DIR")
	}
	if workspaceRoot == "" {
		if cwd, err := os.Getwd(); err == nil {
			workspaceRoot = filepath.Clean(cwd)
		}
	}

	switch serverName {
	case "hashline":
		server := hashline.NewServer(workspaceRoot)
		if err := server.Run(); err != nil {
			os.Stderr.WriteString(fmt.Sprintf("hashline MCP server error: %v\n", err))
			os.Exit(1)
		}
	case "lsp":
		server := lspsrv.NewServer(workspaceRoot)
		if err := server.Run(); err != nil {
			os.Stderr.WriteString(fmt.Sprintf("lsp MCP server error: %v\n", err))
			os.Exit(1)
		}
	default:
		os.Stderr.WriteString(fmt.Sprintf("unknown MCP server: %s\n", serverName))
		os.Exit(2)
	}
}
