package hashline

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// OpType represents the kind of edit operation.
type OpType string

const (
	OpReplaceLine   OpType = "replace_line"
	OpReplaceRange  OpType = "replace_range"
	OpInsertBefore  OpType = "insert_before"
	OpInsertAfter   OpType = "insert_after"
	OpDeleteLine    OpType = "delete_line"
	OpDeleteRange   OpType = "delete_range"
	OpPrepend       OpType = "prepend"
	OpAppend        OpType = "append"
)

// EditOp represents a single edit operation.
type EditOp struct {
	Type     OpType  `json:"type"`
	Anchor   string  `json:"anchor,omitempty"`   // "N#XX" for anchored ops
	EndAnchor string `json:"endAnchor,omitempty"` // for range ops
	Content  string  `json:"content,omitempty"`  // new content (lines separated by \n)
}

// EditRequest is the input for hashline_edit.
type EditRequest struct {
	Path             string   `json:"path"`
	Edits            []EditOp `json:"edits"`
	DryRun           bool     `json:"dryRun,omitempty"`
	ExpectedIdentity *FileIdentity `json:"expectedIdentity,omitempty"`
	DiffContext      int      `json:"diffContext,omitempty"`
}

// EditResult is the output of hashline_edit.
type EditResult struct {
	Path          string       `json:"path"`
	CanonicalPath string       `json:"canonicalPath"`
	OldIdentity   FileIdentity `json:"oldIdentity"`
	NewIdentity   FileIdentity `json:"newIdentity"`
	Diff          string       `json:"diff"`
	ChangedLines  []LineRange  `json:"changedLines"`
	NewAnchors    []Line       `json:"newAnchors"`
	DryRun        bool         `json:"dryRun"`
}

// LineRange represents a range of changed lines.
type LineRange struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

// fileLocks serializes concurrent writes to the same file.
var (
	fileLockMu sync.Mutex
	fileLocks  = map[string]*sync.Mutex{}
)

func fileLock(path string) *sync.Mutex {
	fileLockMu.Lock()
	defer fileLockMu.Unlock()
	if m, ok := fileLocks[path]; ok {
		return m
	}
	m := &sync.Mutex{}
	fileLocks[path] = m
	return m
}

// ApplyEdits validates and applies edit operations to a file.
// It reads the file once, validates all anchors, rejects overlaps,
// applies operations, and writes atomically.
func ApplyEdits(req EditRequest, workspaceRoot string) (*EditResult, error) {
	if len(req.Edits) == 0 {
		return nil, fmt.Errorf("no edits provided")
	}
	if len(req.Edits) > MaxOperations {
		return nil, fmt.Errorf("too many operations: %d (max %d)", len(req.Edits), MaxOperations)
	}

	absPath, err := ResolvePath(req.Path, workspaceRoot)
	if err != nil {
		return nil, err
	}

	mu := fileLock(absPath)
	mu.Lock()
	defer mu.Unlock()

	// Read file once
	info, err := os.Stat(absPath)
	if err != nil {
		return nil, fmt.Errorf("stat: %w", err)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("path is a directory")
	}
	if info.Size() > MaxFileSize {
		return nil, fmt.Errorf("file size %d exceeds limit %d", info.Size(), MaxFileSize)
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("read: %w", err)
	}
	if isBinary(data) {
		return nil, fmt.Errorf("binary file not supported")
	}

	oldIdentity := computeIdentity(data, info.Size())

	// Verify expected identity if provided
	if req.ExpectedIdentity != nil {
		if req.ExpectedIdentity.SHA256 != oldIdentity.SHA256 {
			return nil, fmt.Errorf("file identity mismatch: expected sha256 %s, got %s (file changed)",
				req.ExpectedIdentity.SHA256, oldIdentity.SHA256)
		}
	}

	lines := splitLines(data, oldIdentity.Newline)

	// Parse and validate all operations
	ops, err := normalizeOps(req.Edits, lines)
	if err != nil {
		return nil, err
	}

	// Check for overlaps
	if err := checkOverlaps(ops); err != nil {
		return nil, err
	}

	// Apply operations (from highest line to lowest to preserve indices)
	newLines, changedRanges := applyOps(lines, ops)

	// Reconstruct file content
	newContent := joinLines(newLines, oldIdentity.Newline, oldIdentity.HasFinalNL)

	// Verify the file hasn't changed since we read it (race detection)
	currentData, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("race check read: %w", err)
	}
	currentSum := sha256.Sum256(currentData)
	if hex.EncodeToString(currentSum[:]) != oldIdentity.SHA256 {
		return nil, fmt.Errorf("file changed between validation and write (race detected)")
	}

	newIdentity := computeIdentity([]byte(newContent), int64(len(newContent)))

	// Generate diff
	diff := generateUnifiedDiff(lines, newLines, req.DiffContext)

	// Generate new anchors around changed ranges
	newAnchors := generateNewAnchors(newLines, changedRanges)

	result := &EditResult{
		Path:          req.Path,
		CanonicalPath: canonicalize(absPath),
		OldIdentity:   oldIdentity,
		NewIdentity:   newIdentity,
		Diff:          diff,
		ChangedLines:  changedRanges,
		NewAnchors:    newAnchors,
		DryRun:        req.DryRun,
	}

	if req.DryRun {
		return result, nil
	}

	// Atomic write
	if err := atomicWrite(absPath, []byte(newContent), info.Mode()); err != nil {
		return nil, fmt.Errorf("write: %w", err)
	}

	return result, nil
}

// normalizedOp is an internal representation of an edit operation
// with parsed anchors and resolved line indices.
type normalizedOp struct {
	opType    OpType
	startLine int // 1-based, inclusive
	endLine   int // 1-based, inclusive (for ranges)
	content   []string
	anchor    Anchor
	endAnchor Anchor
}

func normalizeOps(edits []EditOp, lines []string) ([]normalizedOp, error) {
	ops := make([]normalizedOp, 0, len(edits))

	for i, edit := range edits {
		var nop normalizedOp
		nop.opType = edit.Type
		nop.content = splitContent(edit.Content)

		switch edit.Type {
		case OpPrepend, OpAppend:
			nop.startLine = 0 // placeholder
			if edit.Type == OpAppend {
				nop.startLine = len(lines) + 1
			}

		case OpReplaceLine, OpInsertBefore, OpInsertAfter, OpDeleteLine:
			anchor, err := ParseAnchor(edit.Anchor)
			if err != nil {
				return nil, fmt.Errorf("edit %d: %w", i, err)
			}
			nop.anchor = anchor
			if anchor.Line < 1 || anchor.Line > len(lines) {
				return nil, fmt.Errorf("edit %d: anchor line %d out of range (file has %d lines)", i, anchor.Line, len(lines))
			}
			// Validate hash
			actualHash := ComputeLineHash(anchor.Line, lines[anchor.Line-1])
			if actualHash != anchor.Hash {
				return nil, &StaleAnchorError{
					EditIndex:   i,
					Line:        anchor.Line,
					Expected:    anchor.Hash,
					Actual:      actualHash,
					NearbyLines: nearbyAnchors(lines, anchor.Line),
				}
			}
			nop.startLine = anchor.Line
			if edit.Type == OpInsertAfter {
				nop.startLine = anchor.Line + 1
			}
			if edit.Type == OpReplaceLine {
				nop.endLine = anchor.Line
			}

		case OpReplaceRange, OpDeleteRange:
			anchor, err := ParseAnchor(edit.Anchor)
			if err != nil {
				return nil, fmt.Errorf("edit %d (start): %w", i, err)
			}
			endAnchor, err := ParseAnchor(edit.EndAnchor)
			if err != nil {
				return nil, fmt.Errorf("edit %d (end): %w", i, err)
			}
			nop.anchor = anchor
			nop.endAnchor = endAnchor
			if anchor.Line < 1 || anchor.Line > len(lines) {
				return nil, fmt.Errorf("edit %d: start anchor line %d out of range", i, anchor.Line)
			}
			if endAnchor.Line < 1 || endAnchor.Line > len(lines) {
				return nil, fmt.Errorf("edit %d: end anchor line %d out of range", i, endAnchor.Line)
			}
			if endAnchor.Line < anchor.Line {
				return nil, fmt.Errorf("edit %d: end anchor line %d before start line %d", i, endAnchor.Line, anchor.Line)
			}
			// Validate both hashes
			actualStart := ComputeLineHash(anchor.Line, lines[anchor.Line-1])
			if actualStart != anchor.Hash {
				return nil, &StaleAnchorError{
					EditIndex:   i,
					Line:        anchor.Line,
					Expected:    anchor.Hash,
					Actual:      actualStart,
					NearbyLines: nearbyAnchors(lines, anchor.Line),
				}
			}
			actualEnd := ComputeLineHash(endAnchor.Line, lines[endAnchor.Line-1])
			if actualEnd != endAnchor.Hash {
				return nil, &StaleAnchorError{
					EditIndex:   i,
					Line:        endAnchor.Line,
					Expected:    endAnchor.Hash,
					Actual:      actualEnd,
					NearbyLines: nearbyAnchors(lines, endAnchor.Line),
				}
			}
			nop.startLine = anchor.Line
			nop.endLine = endAnchor.Line

		default:
			return nil, fmt.Errorf("edit %d: unknown operation type %q", i, edit.Type)
		}

		ops = append(ops, nop)
	}

	// Sort by start line descending (apply from bottom to top)
	sort.SliceStable(ops, func(i, j int) bool {
		return ops[i].startLine > ops[j].startLine
	})

	return ops, nil
}

// StaleAnchorError provides detailed information about a stale anchor.
type StaleAnchorError struct {
	EditIndex   int
	Line        int
	Expected    string
	Actual      string
	NearbyLines []Line
}

func (e *StaleAnchorError) Error() string {
	return fmt.Sprintf("stale anchor at edit %d: line %d expected %d#%s but file has %d#%s",
		e.EditIndex, e.Line, e.Line, e.Expected, e.Line, e.Actual)
}

// nearbyAnchors returns anchors for lines around the given line number.
func nearbyAnchors(lines []string, lineNo int) []Line {
	start := lineNo - 2
	if start < 1 {
		start = 1
	}
	end := lineNo + 2
	if end > len(lines) {
		end = len(lines)
	}
	out := make([]Line, 0, end-start+1)
	for i := start; i <= end; i++ {
		out = append(out, Line{
			Number:  i,
			Hash:    ComputeLineHash(i, lines[i-1]),
			Content: lines[i-1],
		})
	}
	return out
}

// checkOverlaps rejects operations that affect overlapping line ranges.
func checkOverlaps(ops []normalizedOp) error {
	// Build affected ranges
	type rng struct{ start, end int }
	ranges := make([]rng, 0, len(ops))
	for _, op := range ops {
		s, e := op.startLine, op.endLine
		if e == 0 {
			e = s
		}
		if op.opType == OpInsertBefore || op.opType == OpInsertAfter {
			// Insertions don't "occupy" a line range, but they can't
			// conflict with a replace/delete of the same insertion point.
			e = s
		}
		if op.opType == OpPrepend {
			s = 0
			e = 0
		}
		if op.opType == OpAppend {
			s = 999999 // effectively no overlap
			e = s
		}
		ranges = append(ranges, rng{s, e})
	}

	for i := 0; i < len(ranges); i++ {
		for j := i + 1; j < len(ranges); j++ {
			if rangesOverlap(ranges[i], ranges[j]) {
				return fmt.Errorf("overlapping operations: edit at line %d overlaps with edit at line %d",
					ranges[i].start, ranges[j].start)
			}
		}
	}
	return nil
}

func rangesOverlap(a, b struct{ start, end int }) bool {
	if a.start == 0 || b.start == 0 {
		return false // prepend never overlaps
	}
	if a.start >= 999999 || b.start >= 999999 {
		return false // append never overlaps
	}
	return a.start <= b.end && b.start <= a.end
}

// applyOps applies operations to lines, returning the new lines and changed ranges.
func applyOps(lines []string, ops []normalizedOp) ([]string, []LineRange) {
	// Work on a copy
	result := make([]string, len(lines))
	copy(result, lines)

	var changedRanges []LineRange

	for _, op := range ops {
		switch op.opType {
		case OpReplaceLine:
			idx := op.startLine - 1
			result = replaceAt(result, idx, op.content)
			changedRanges = append(changedRanges, LineRange{Start: op.startLine, End: op.startLine + len(op.content) - 1})

		case OpReplaceRange:
			startIdx := op.startLine - 1
			endIdx := op.endLine // exclusive after splice
			result = spliceRange(result, startIdx, endIdx, op.content)
			newEnd := op.startLine + len(op.content) - 1
			changedRanges = append(changedRanges, LineRange{Start: op.startLine, End: newEnd})

		case OpInsertBefore:
			idx := op.startLine - 1
			result = insertAt(result, idx, op.content)
			changedRanges = append(changedRanges, LineRange{Start: op.startLine, End: op.startLine + len(op.content) - 1})

		case OpInsertAfter:
			idx := op.startLine - 1
			result = insertAt(result, idx, op.content)
			changedRanges = append(changedRanges, LineRange{Start: op.startLine + 1, End: op.startLine + len(op.content)})

		case OpDeleteLine:
			idx := op.startLine - 1
			result = spliceRange(result, idx, idx+1, nil)
			changedRanges = append(changedRanges, LineRange{Start: op.startLine, End: op.startLine})

		case OpDeleteRange:
			startIdx := op.startLine - 1
			endIdx := op.endLine
			result = spliceRange(result, startIdx, endIdx, nil)
			changedRanges = append(changedRanges, LineRange{Start: op.startLine, End: op.endLine})

		case OpPrepend:
			result = append(op.content, result...)
			changedRanges = append(changedRanges, LineRange{Start: 1, End: len(op.content)})

		case OpAppend:
			result = append(result, op.content...)
			changedRanges = append(changedRanges, LineRange{Start: len(result) - len(op.content) + 1, End: len(result)})
		}
	}

	return result, changedRanges
}

func replaceAt(lines []string, idx int, content []string) []string {
	if len(content) == 0 {
		return spliceRange(lines, idx, idx+1, nil)
	}
	lines[idx] = content[0]
	if len(content) > 1 {
		lines = insertAt(lines, idx+1, content[1:])
	}
	return lines
}

func insertAt(lines []string, idx int, content []string) []string {
	if idx < 0 {
		idx = 0
	}
	if idx > len(lines) {
		idx = len(lines)
	}
	result := make([]string, 0, len(lines)+len(content))
	result = append(result, lines[:idx]...)
	result = append(result, content...)
	result = append(result, lines[idx:]...)
	return result
}

func spliceRange(lines []string, start, end int, replacement []string) []string {
	result := make([]string, 0, len(lines)-(end-start)+len(replacement))
	result = append(result, lines[:start]...)
	result = append(result, replacement...)
	result = append(result, lines[end:]...)
	return result
}

func splitContent(content string) []string {
	if content == "" {
		return nil
	}
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.TrimSuffix(content, "\n")
	return strings.Split(content, "\n")
}

func joinLines(lines []string, newline NewlineStyle, hasFinalNL bool) string {
	sep := "\n"
	if newline == NewlineCRLF {
		sep = "\r\n"
	}
	result := strings.Join(lines, sep)
	if hasFinalNL {
		result += sep
	}
	return result
}

// atomicWrite writes data to a temp file in the same directory, then renames.
func atomicWrite(path string, data []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".lazygrok-mcp-tmp-*")
	if err != nil {
		return fmt.Errorf("create temp: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return fmt.Errorf("write temp: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return err
	}

	if err := os.Chmod(tmpPath, mode); err != nil {
		return fmt.Errorf("chmod: %w", err)
	}

	return os.Rename(tmpPath, path)
}

// generateUnifiedDiff produces a unified diff between old and new lines.
func generateUnifiedDiff(oldLines, newLines []string, context int) string {
	if context <= 0 {
		context = 3
	}

	var sb strings.Builder
	sb.WriteString("--- a\n")
	sb.WriteString("+++ b\n")

	// Simple line-by-line diff (not a full LCS, but sufficient for display)
	// For a proper diff, we'd compute LCS; here we use a simple approach
	// that shows the changes clearly.
	maxLen := len(oldLines)
	if len(newLines) > maxLen {
		maxLen = len(newLines)
	}

	// Find changed regions
	type changeRegion struct {
		start, oldEnd, newEnd int
	}
	var regions []changeRegion
	i, j := 0, 0
	for i < len(oldLines) || j < len(newLines) {
		if i < len(oldLines) && j < len(newLines) && oldLines[i] == newLines[j] {
			i++
			j++
			continue
		}
		// Found a difference
		oldStart := i
		newStart := j
		for i < len(oldLines) && j < len(newLines) && oldLines[i] != newLines[j] {
			i++
			j++
		}
		// Handle insertions/deletions
		if i == oldStart && j == newStart {
			if i < len(oldLines) {
				i++
			} else {
				j++
			}
		}
		regions = append(regions, changeRegion{start: oldStart, oldEnd: i, newEnd: j})
	}

	for _, r := range regions {
		ctxStart := r.start - context
		if ctxStart < 0 {
			ctxStart = 0
		}
		ctxOldEnd := r.oldEnd + context
		if ctxOldEnd > len(oldLines) {
			ctxOldEnd = len(oldLines)
		}
		ctxNewEnd := r.newEnd + context
		if ctxNewEnd > len(newLines) {
			ctxNewEnd = len(newLines)
		}

		sb.WriteString(fmt.Sprintf("@@ -%d,%d +%d,%d @@\n", ctxStart+1, ctxOldEnd-ctxStart, ctxStart+1, ctxNewEnd-ctxStart))

		for k := ctxStart; k < r.start; k++ {
			sb.WriteString(" " + oldLines[k] + "\n")
		}
		for k := r.start; k < r.oldEnd; k++ {
			if k < len(oldLines) {
				sb.WriteString("-" + oldLines[k] + "\n")
			}
		}
		for k := r.start; k < r.newEnd; k++ {
			if k < len(newLines) {
				sb.WriteString("+" + newLines[k] + "\n")
			}
		}
		for k := r.oldEnd; k < ctxOldEnd && k < len(oldLines); k++ {
			sb.WriteString(" " + oldLines[k] + "\n")
		}
	}

	return sb.String()
}

// generateNewAnchors returns anchors for lines around changed ranges.
func generateNewAnchors(lines []string, ranges []LineRange) []Line {
	var out []Line
	for _, r := range ranges {
		start := r.Start - 1
		if start < 0 {
			start = 0
		}
		end := r.End
		if end > len(lines) {
			end = len(lines)
		}
		for i := start; i < end; i++ {
			out = append(out, Line{
				Number:  i + 1,
				Hash:    ComputeLineHash(i+1, lines[i]),
				Content: lines[i],
			})
		}
	}
	return out
}
