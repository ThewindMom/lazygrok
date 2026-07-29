package hashline

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"lazygrok/internal/safestate"
)

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// IsSkillPath reports whether path refers to a SKILL.md file (skip hashline cache).
func IsSkillPath(path string) bool {
	p := strings.ReplaceAll(path, "\\", "/")
	return strings.HasSuffix(p, "/SKILL.md") || strings.HasSuffix(p, "SKILL.md")
}

// UpdateCacheFromRead populates the session hashline cache for a workspace file read.
func UpdateCacheFromRead(grokHome, sessionID, workspace, readPath string) error {
	mode, err := resolveMode(workspace, grokHome)
	if err != nil || mode == "off" {
		return nil
	}
	if sessionID == "" || readPath == "" {
		return nil
	}
	if IsSkillPath(readPath) {
		return nil
	}
	absPath := resolvePath(readPath, workspace)
	if absPath == "" {
		return nil
	}
	relPath := relWorkspacePath(absPath, workspace)
	if relPath == "" || IsSkillPath(relPath) {
		return nil
	}
	text, err := safestate.ReadFileBelow(workspace, absPath)
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.ReplaceAll(string(text), "\r\n", "\n"), "\n")
	// Drop trailing empty from final newline for consistent line numbers
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	lineHashes := make(map[string]string, len(lines))
	for i, line := range lines {
		lineHashes[fmt.Sprintf("%d", i+1)] = ComputeLineHash(i+1, line)
	}
	payload := map[string]any{
		"path":       absPath,
		"rel_path":   relPath,
		"updated_at": time.Now().UTC().Format("2006-01-02T15:04:05+00:00"),
		"lines":      lineHashes,
	}
	cacheFile := cacheFilePath(grokHome, sessionID, absPath)
	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return safestate.WriteFileBelow(grokHome, cacheFile, append(b, '\n'), 0o600)
}

func relWorkspacePath(absPath, workspace string) string {
	if workspace == "" {
		return ""
	}
	ws, err := filepath.Abs(workspace)
	if err != nil {
		return ""
	}
	abs, err := filepath.Abs(absPath)
	if err != nil {
		return ""
	}
	rel, err := filepath.Rel(ws, abs)
	if err != nil {
		return ""
	}
	if rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return ""
	}
	return strings.ReplaceAll(rel, "\\", "/")
}
