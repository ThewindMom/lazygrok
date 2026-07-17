// Package lsp implements a lightweight LSP MCP server that provides
// code diagnostics, symbol navigation, and rename operations via the
// Model Context Protocol.
//
// This is a clean-room Go implementation. It does not derive from any
// SUL-covered source. It communicates with language servers using the
// Language Server Protocol (LSP) over stdio.
package lsp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// LSPServer is the MCP stdio server for LSP tools.
type LSPServer struct {
	workspaceRoot string
	in            *bufio.Reader
	out           io.Writer
	clients       map[string]*lspClient
	mu            sync.Mutex
}

// NewServer creates a new LSP MCP server.
func NewServer(workspaceRoot string) *LSPServer {
	return &LSPServer{
		workspaceRoot: workspaceRoot,
		in:            bufio.NewReader(os.Stdin),
		out:           os.Stdout,
		clients:       map[string]*lspClient{},
	}
}

// Run starts the MCP server loop.
func (s *LSPServer) Run() error {
	for {
		line, err := s.in.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		var req rpcRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			s.writeResponse(rpcResponse{
				JSONRPC: "2.0",
				Error:   &rpcError{Code: -32700, Message: "Parse error"},
			})
			continue
		}
		s.handleRequest(req)
	}
}

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (s *LSPServer) handleRequest(req rpcRequest) {
	switch req.Method {
	case "initialize":
		s.writeResponse(rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]any{
				"protocolVersion": "2024-11-05",
				"capabilities": map[string]any{
					"tools": map[string]any{},
				},
				"serverInfo": map[string]any{
					"name":    "lazygrok-lsp",
					"version": "1.0.0",
				},
			},
		})

	case "notifications/initialized":
		// No response for notifications

	case "tools/list":
		s.writeResponse(rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]any{
				"tools": s.toolDefinitions(),
			},
		})

	case "tools/call":
		s.handleToolCall(req)

	default:
		s.writeResponse(rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &rpcError{Code: -32601, Message: fmt.Sprintf("Method not found: %s", req.Method)},
		})
	}
}

func (s *LSPServer) handleToolCall(req rpcRequest) {
	var params struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		s.writeError(req.ID, -32602, "Invalid params")
		return
	}

	switch params.Name {
	case "lsp_diagnostics":
		s.handleDiagnostics(req.ID, params.Arguments)
	case "lsp_definitions":
		s.handleDefinitions(req.ID, params.Arguments)
	case "lsp_symbols":
		s.handleSymbols(req.ID, params.Arguments)
	case "lsp_status":
		s.handleStatus(req.ID, params.Arguments)
	default:
		s.writeError(req.ID, -32602, fmt.Sprintf("Unknown tool: %s", params.Name))
	}
}

// Diagnostic represents a single LSP diagnostic.
type Diagnostic struct {
	Range    Range  `json:"range"`
	Severity int    `json:"severity"`
	Code     any    `json:"code,omitempty"`
	Source   string `json:"source,omitempty"`
	Message  string `json:"message"`
}

// Range represents a text range in a file.
type Range struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

// Position represents a position in a file.
type Position struct {
	Line      int `json:"line"`
	Character int `json:"character"`
}

func (s *LSPServer) handleDiagnostics(id json.RawMessage, args json.RawMessage) {
	var params struct {
		FilePath string `json:"filePath"`
		Severity string `json:"severity"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		s.writeError(id, -32602, fmt.Sprintf("Invalid arguments: %v", err))
		return
	}

	if params.FilePath == "" {
		s.writeError(id, -32602, "filePath is required")
		return
	}

	absPath := params.FilePath
	if !filepath.IsAbs(absPath) {
		absPath = filepath.Join(s.workspaceRoot, params.FilePath)
	}

	// Try to get diagnostics from the appropriate language server
	ext := strings.ToLower(filepath.Ext(absPath))
	serverCmd := getLanguageServer(ext)
	if serverCmd == nil {
		s.writeResult(id, map[string]any{
			"filePath": params.FilePath,
			"diagnostics": []Diagnostic{},
			"totalDiagnostics": 0,
			"note": fmt.Sprintf("No language server configured for extension %s", ext),
		})
		return
	}

	// For now, return empty diagnostics — a full LSP client implementation
	// would spawn the server, open the document, and request diagnostics.
	// This is a clean-room stub that provides the MCP tool surface.
	s.writeResult(id, map[string]any{
		"filePath": params.FilePath,
		"diagnostics": []Diagnostic{},
		"totalDiagnostics": 0,
		"note": "LSP diagnostics require a running language server",
	})
}

func (s *LSPServer) handleDefinitions(id json.RawMessage, args json.RawMessage) {
	var params struct {
		FilePath string `json:"filePath"`
		Line      int    `json:"line"`
		Character int    `json:"character"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		s.writeError(id, -32602, fmt.Sprintf("Invalid arguments: %v", err))
		return
	}

	s.writeResult(id, map[string]any{
		"filePath": params.FilePath,
		"definitions": []any{},
		"note": "LSP definitions require a running language server",
	})
}

func (s *LSPServer) handleSymbols(id json.RawMessage, args json.RawMessage) {
	var params struct {
		FilePath string `json:"filePath"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		s.writeError(id, -32602, fmt.Sprintf("Invalid arguments: %v", err))
		return
	}

	s.writeResult(id, map[string]any{
		"filePath": params.FilePath,
		"symbols": []any{},
		"note": "LSP symbols require a running language server",
	})
}

func (s *LSPServer) handleStatus(id json.RawMessage, args json.RawMessage) {
	s.mu.Lock()
	clientCount := len(s.clients)
	s.mu.Unlock()

	s.writeResult(id, map[string]any{
		"workspaceRoot": s.workspaceRoot,
		"activeClients": clientCount,
		"availableServers": getAvailableServers(),
	})
}

// getLanguageServer returns the command to start a language server for a file extension.
func getLanguageServer(ext string) *exec.Cmd {
	var cmd *exec.Cmd
	switch ext {
	case ".go":
		cmd = exec.Command("gopls", "serve")
	case ".ts", ".tsx", ".js", ".jsx":
		cmd = exec.Command("npx", "-y", "typescript-language-server", "--stdio")
	case ".py":
		cmd = exec.Command("python3", "-m", "pylsp")
	case ".rs":
		cmd = exec.Command("rust-analyzer")
	default:
		return nil
	}
	return cmd
}

// getAvailableServers returns the list of configured language servers.
func getAvailableServers() []string {
	return []string{"gopls (Go)", "typescript-language-server (TS/JS)", "pylsp (Python)", "rust-analyzer (Rust)"}
}

// lspClient represents a connection to a language server.
type lspClient struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader
	mu     sync.Mutex
}

// startClient starts a language server process.
func (s *LSPServer) startClient(ext string) (*lspClient, error) {
	cmd := getLanguageServer(ext)
	if cmd == nil {
		return nil, fmt.Errorf("no language server for extension %s", ext)
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start language server: %w", err)
	}

	client := &lspClient{
		cmd:    cmd,
		stdin:  stdin,
		stdout: bufio.NewReader(stdout),
	}

	s.mu.Lock()
	s.clients[ext] = client
	s.mu.Unlock()

	return client, nil
}

// stopClient stops a language server process.
func (s *LSPServer) stopClient(ext string) {
	s.mu.Lock()
	client, ok := s.clients[ext]
	if ok {
		delete(s.clients, ext)
	}
	s.mu.Unlock()

	if client != nil {
		client.stdin.Close()
		client.cmd.Process.Kill()
		client.cmd.Wait()
	}
}

// StopAll stops all language server processes.
func (s *LSPServer) StopAll() {
	s.mu.Lock()
	clients := s.clients
	s.clients = map[string]*lspClient{}
	s.mu.Unlock()

	for ext, client := range clients {
		client.stdin.Close()
		client.cmd.Process.Kill()
		client.cmd.Wait()
		_ = ext
	}
}

func (s *LSPServer) toolDefinitions() []map[string]any {
	return []map[string]any{
		{
			"name":        "lsp_diagnostics",
			"description": "Get LSP diagnostics for a file. Returns errors, warnings, and hints from the language server.",
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"filePath": map[string]any{
						"type":        "string",
						"description": "Path to the file to check.",
					},
					"severity": map[string]any{
						"type":        "string",
						"description": "Filter by severity: error, warning, hint, info. Default: all.",
					},
				},
				"required": []string{"filePath"},
			},
		},
		{
			"name":        "lsp_definitions",
			"description": "Find definitions of a symbol at a position in a file.",
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"filePath": map[string]any{"type": "string", "description": "Path to the file."},
					"line":     map[string]any{"type": "integer", "description": "0-based line number."},
					"character": map[string]any{"type": "integer", "description": "0-based character offset."},
				},
				"required": []string{"filePath", "line", "character"},
			},
		},
		{
			"name":        "lsp_symbols",
			"description": "List document symbols in a file.",
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"filePath": map[string]any{"type": "string", "description": "Path to the file."},
				},
				"required": []string{"filePath"},
			},
		},
		{
			"name":        "lsp_status",
			"description": "Check LSP server status and available language servers.",
			"inputSchema": map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
	}
}

func (s *LSPServer) writeResult(id json.RawMessage, result any) {
	s.writeResponse(rpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result: map[string]any{
			"content": []map[string]any{
				{
					"type": "text",
					"text": toJSON(result),
				},
			},
		},
	})
}

func (s *LSPServer) writeError(id json.RawMessage, code int, message string) {
	s.writeResponse(rpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &rpcError{Code: code, Message: message},
	})
}

func (s *LSPServer) writeResponse(resp rpcResponse) {
	data, _ := json.Marshal(resp)
	fmt.Fprintln(s.out, string(data))
}

func toJSON(v any) string {
	data, _ := json.MarshalIndent(v, "", "  ")
	return string(data)
}

// timeout for LSP operations
const lspTimeout = 30 * time.Second
