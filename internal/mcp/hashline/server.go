// Package hashline implements the MCP stdio server for hashline_read and
// hashline_edit tools. It speaks the Model Context Protocol over stdin/stdout.
package hashline

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"lazygrok/internal/core/hashline"
)

// JSON-RPC 2.0 message types

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
	Data    any    `json:"data,omitempty"`
}

// Server is the MCP stdio server.
type Server struct {
	workspaceRoot string
	in            *bufio.Reader
	out           io.Writer
}

// NewServer creates a new MCP server.
func NewServer(workspaceRoot string) *Server {
	return &Server{
		workspaceRoot: workspaceRoot,
		in:            bufio.NewReader(os.Stdin),
		out:           os.Stdout,
	}
}

// Run starts the MCP server loop, reading JSON-RPC from stdin and writing to stdout.
func (s *Server) Run() error {
	for {
		message, err := s.readMessage()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		if len(message) == 0 {
			continue
		}

		var req rpcRequest
		if err := json.Unmarshal(message, &req); err != nil {
			s.writeResponse(rpcResponse{
				JSONRPC: "2.0",
				Error:   &rpcError{Code: -32700, Message: "Parse error"},
			})
			continue
		}

		s.handleRequest(req)
	}
}

func (s *Server) handleRequest(req rpcRequest) {
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
					"name":    "lazygrok-hashline",
					"version": "1.0.0",
				},
			},
		})

	case "notifications/initialized":
		// No response needed for notifications
		// (notifications have no ID)

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

func (s *Server) handleToolCall(req rpcRequest) {
	var params struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		s.writeResponse(rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &rpcError{Code: -32602, Message: "Invalid params"},
		})
		return
	}

	switch params.Name {
	case "hashline_read":
		s.handleRead(req.ID, params.Arguments)
	case "hashline_edit":
		s.handleEdit(req.ID, params.Arguments)
	default:
		s.writeResponse(rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &rpcError{Code: -32602, Message: fmt.Sprintf("Unknown tool: %s", params.Name)},
		})
	}
}

func (s *Server) handleRead(id json.RawMessage, args json.RawMessage) {
	var params struct {
		Path            string `json:"path"`
		Offset          int    `json:"offset"`
		Limit           int    `json:"limit"`
		IncludeMetadata bool   `json:"includeMetadata"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		s.writeError(id, -32602, fmt.Sprintf("Invalid arguments: %v", err))
		return
	}

	if params.Path == "" {
		s.writeError(id, -32602, "path is required")
		return
	}

	absPath, err := hashline.ResolvePath(params.Path, s.workspaceRoot)
	if err != nil {
		s.writeError(id, -32602, err.Error())
		return
	}

	result, err := hashline.ReadFileInWorkspace(absPath, s.workspaceRoot, hashline.ReadOptions{
		Offset: params.Offset,
		Limit:  params.Limit,
	})
	if err != nil {
		s.writeError(id, -32603, err.Error())
		return
	}

	s.writeResult(id, result)
}

func (s *Server) handleEdit(id json.RawMessage, args json.RawMessage) {
	var params hashline.EditRequest
	if err := json.Unmarshal(args, &params); err != nil {
		s.writeError(id, -32602, fmt.Sprintf("Invalid arguments: %v", err))
		return
	}

	if params.Path == "" {
		s.writeError(id, -32602, "path is required")
		return
	}

	result, err := hashline.ApplyEdits(params, s.workspaceRoot)
	if err != nil {
		// Return structured error with stale anchor info if available
		if sae, ok := err.(*hashline.StaleAnchorError); ok {
			s.writeErrorWithData(id, -32603, sae.Error(), map[string]any{
				"type":         "stale_anchor",
				"editIndex":    sae.EditIndex,
				"line":         sae.Line,
				"expectedHash": sae.Expected,
				"actualHash":   sae.Actual,
				"nearbyLines":  sae.NearbyLines,
			})
			return
		}
		s.writeError(id, -32603, err.Error())
		return
	}

	s.writeResult(id, result)
}

func (s *Server) writeResult(id json.RawMessage, result any) {
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

func (s *Server) writeError(id json.RawMessage, code int, message string) {
	s.writeResponse(rpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &rpcError{Code: code, Message: message},
	})
}

func (s *Server) writeErrorWithData(id json.RawMessage, code int, message string, data any) {
	s.writeResponse(rpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &rpcError{Code: code, Message: message, Data: data},
	})
}

func (s *Server) writeResponse(resp rpcResponse) {
	data, _ := json.Marshal(resp)
	fmt.Fprintln(s.out, string(data))
}

func toJSON(v any) string {
	data, _ := json.MarshalIndent(v, "", "  ")
	return string(data)
}
