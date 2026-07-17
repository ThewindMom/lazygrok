// Package hashline implements line-anchored file reading and editing.
//
// Anchors are stable identifiers of the form "N#XX" where N is the 1-based
// line number and XX is a 2-character content-derived hash. The hash is
// computed from the line's normalized content (trailing whitespace stripped,
// CR removed) using xxhash32, then mapped to a 2-character encoding from the
// dictionary "ZPMQVRWSNKTXJBYH".
//
// This implementation is compatible with the existing lazygrok anchor format.
// Edit semantics are independently implemented and do not derive from any
// SUL-covered source.
package hashline

import (
	"fmt"
	"strings"
	"unicode"
)

// dict is the character set used for 2-char anchor encoding.
const dict = "ZPMQVRWSNKTXJBYH"

var encMap [256]string

func init() {
	for i := 0; i < 256; i++ {
		encMap[i] = string([]byte{dict[i>>4], dict[i&0x0F]})
	}
}

const (
	prime32_1 = 0x9E3779B1
	prime32_2 = 0x85EBCA77
	prime32_3 = 0xC2B2AE3D
	prime32_4 = 0x27D4EB2F
	prime32_5 = 0x165667B1
)

func rotl32(v uint32, bits uint) uint32 {
	return (v << bits) | (v >> (32 - bits))
}

func imul(a, b uint32) uint32 {
	return uint32(uint64(a) * uint64(b))
}

func readUint32LE(data []byte, offset int) uint32 {
	var b0, b1, b2, b3 byte
	if offset < len(data) {
		b0 = data[offset]
	}
	if offset+1 < len(data) {
		b1 = data[offset+1]
	}
	if offset+2 < len(data) {
		b2 = data[offset+2]
	}
	if offset+3 < len(data) {
		b3 = data[offset+3]
	}
	return uint32(b0) | uint32(b1)<<8 | uint32(b2)<<16 | uint32(b3)<<24
}

func round32(acc, val uint32) uint32 {
	added := acc + imul(val, prime32_2)
	return imul(rotl32(added, 13), prime32_1)
}

func xxhash32(data []byte, seed uint32) uint32 {
	offset := 0
	length := len(data)

	var h uint32
	if length >= 16 {
		limit := length - 16
		v1 := seed + prime32_1 + prime32_2
		v2 := seed + prime32_2
		v3 := seed
		v4 := seed - prime32_1

		for offset <= limit {
			v1 = round32(v1, readUint32LE(data, offset))
			offset += 4
			v2 = round32(v2, readUint32LE(data, offset))
			offset += 4
			v3 = round32(v3, readUint32LE(data, offset))
			offset += 4
			v4 = round32(v4, readUint32LE(data, offset))
			offset += 4
		}

		h = rotl32(v1, 1) + rotl32(v2, 7)
		h = h + rotl32(v3, 12)
		h = h + rotl32(v4, 18)
	} else {
		h = seed + prime32_5
	}

	h = h + uint32(length)

	for offset+4 <= length {
		h = h + imul(readUint32LE(data, offset), prime32_3)
		h = imul(rotl32(h, 17), prime32_4)
		offset += 4
	}

	for offset < length {
		h = h + imul(uint32(data[offset]), prime32_5)
		h = imul(rotl32(h, 11), prime32_1)
		offset++
	}

	h = h ^ (h >> 15)
	h = imul(h, prime32_2)
	h = h ^ (h >> 13)
	h = imul(h, prime32_3)
	return h ^ (h >> 16)
}

func hasSignificantChar(text string) bool {
	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			return true
		}
	}
	return false
}

func computeNormalizedLineHash(lineNumber int, normalizedContent string) string {
	seed := uint32(0)
	if !hasSignificantChar(normalizedContent) {
		seed = uint32(lineNumber)
	}
	digest := xxhash32([]byte(normalizedContent), seed)
	return encMap[digest%256]
}

// ComputeLineHash returns the two-char hash tag for a line.
// The content is normalized by stripping trailing whitespace and CR.
func ComputeLineHash(lineNumber int, content string) string {
	normalized := strings.TrimRight(strings.ReplaceAll(content, "\r", ""), " \t\n\r")
	return computeNormalizedLineHash(lineNumber, normalized)
}

// FormatHashLine returns "N#XX|content" for display.
func FormatHashLine(lineNumber int, content string) string {
	return fmt.Sprintf("%d#%s|%s", lineNumber, ComputeLineHash(lineNumber, content), content)
}

// Anchor represents a parsed line anchor "N#XX".
type Anchor struct {
	Line int    // 1-based line number
	Hash string // 2-char hash
}

// String returns the anchor in "N#XX" form.
func (a Anchor) String() string {
	return fmt.Sprintf("%d#%s", a.Line, a.Hash)
}

// ParseAnchor parses a "N#XX" string into an Anchor.
func ParseAnchor(s string) (Anchor, error) {
	s = strings.TrimSpace(s)
	idx := strings.IndexByte(s, '#')
	if idx <= 0 || idx >= len(s)-1 {
		return Anchor{}, fmt.Errorf("invalid anchor %q: expected N#XX", s)
	}
	lineStr := s[:idx]
	hash := s[idx+1:]
	line := 0
	for _, c := range lineStr {
		if c < '0' || c > '9' {
			return Anchor{}, fmt.Errorf("invalid anchor %q: line number not numeric", s)
		}
		line = line*10 + int(c-'0')
	}
	if line < 1 {
		return Anchor{}, fmt.Errorf("invalid anchor %q: line must be >= 1", s)
	}
	if len(hash) != 2 {
		return Anchor{}, fmt.Errorf("invalid anchor %q: hash must be 2 chars", s)
	}
	for _, c := range hash {
		if !strings.ContainsRune(dict, c) {
			return Anchor{}, fmt.Errorf("invalid anchor %q: hash chars not in dictionary", s)
		}
	}
	return Anchor{Line: line, Hash: hash}, nil
}

// ValidateAnchor checks whether an anchor matches the given line content.
// Returns true if the hash matches.
func ValidateAnchor(lineNumber int, content, expectedHash string) bool {
	return ComputeLineHash(lineNumber, content) == expectedHash
}

// IsHashChar reports whether c is a valid hash dictionary character.
func IsHashChar(c byte) bool {
	return strings.IndexByte(dict, c) >= 0
}
