package hashline

type toolDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

func (s *Server) toolDefinitions() []toolDef {
	return []toolDef{
		{
			Name:        "hashline_read",
			Description: "Read a file and return each line with a stable LINE#ID anchor (e.g. 12#ZP|content). Used for precise line-anchored editing.",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path": map[string]any{
						"type":        "string",
						"description": "Workspace-relative or permitted absolute file path.",
					},
					"offset": map[string]any{
						"type":        "integer",
						"description": "1-based starting line. Defaults to 1.",
					},
					"limit": map[string]any{
						"type":        "integer",
						"description": "Maximum number of lines to return. 0 = all.",
					},
					"includeMetadata": map[string]any{
						"type":        "boolean",
						"description": "Include file identity metadata for stale detection.",
					},
				},
				"required": []string{"path"},
			},
		},
		{
			Name:        "hashline_edit",
			Description: "Edit a file using line anchors for precise, conflict-free modifications. Supports replace, insert, delete, prepend, and append operations.",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path": map[string]any{
						"type":        "string",
						"description": "Workspace-relative or permitted absolute file path.",
					},
					"edits": map[string]any{
						"type":        "array",
						"description": "Edit operations to apply.",
						"items": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"type": map[string]any{
									"type": "string",
									"enum": []string{
										"replace_line", "replace_range",
										"insert_before", "insert_after",
										"delete_line", "delete_range",
										"prepend", "append",
									},
								},
								"anchor": map[string]any{
									"type":        "string",
									"description": "Line anchor N#XX (e.g. 12#ZP).",
								},
								"endAnchor": map[string]any{
									"type":        "string",
									"description": "End line anchor for range operations.",
								},
								"content": map[string]any{
									"type":        "string",
									"description": "New content. Lines separated by \\n.",
								},
							},
							"required": []string{"type"},
						},
					},
					"dryRun": map[string]any{
						"type":        "boolean",
						"description": "If true, return the planned diff without writing.",
					},
					"expectedIdentity": map[string]any{
						"type":        "object",
						"description": "Expected file identity for race detection.",
					},
					"diffContext": map[string]any{
						"type":        "integer",
						"description": "Number of context lines in the unified diff. Default 3.",
					},
				},
				"required": []string{"path", "edits"},
			},
		},
	}
}
