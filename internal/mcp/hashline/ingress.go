package hashline

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

const (
	MaxMessageBytes = 1 << 20
	maxHeaderBytes  = 16 << 10
)

var ErrMessageTooLarge = errors.New("MCP message exceeds size limit")

func (s *Server) readMessage() ([]byte, error) {
	firstLine, err := readBoundedLine(s.in, MaxMessageBytes)
	if err != nil {
		return nil, err
	}
	trimmed := strings.TrimSpace(string(firstLine))
	if !strings.HasPrefix(strings.ToLower(trimmed), "content-length:") {
		return []byte(trimmed), nil
	}

	lengthText := strings.TrimSpace(strings.TrimPrefix(strings.ToLower(trimmed), "content-length:"))
	contentLength, err := strconv.ParseInt(lengthText, 10, 64)
	if err != nil || contentLength < 0 {
		return nil, errors.New("invalid MCP Content-Length header")
	}
	if contentLength > MaxMessageBytes {
		return nil, fmt.Errorf("%w: %d bytes", ErrMessageTooLarge, contentLength)
	}
	headerBytes := len(firstLine)
	for {
		line, readErr := readBoundedLine(s.in, maxHeaderBytes)
		if readErr != nil {
			return nil, readErr
		}
		headerBytes += len(line)
		if headerBytes > maxHeaderBytes {
			return nil, errors.New("MCP headers exceed size limit")
		}
		if len(strings.TrimSpace(string(line))) == 0 {
			break
		}
	}
	body := make([]byte, int(contentLength))
	if _, err := io.ReadFull(s.in, body); err != nil {
		return nil, fmt.Errorf("read MCP frame: %w", err)
	}
	return body, nil
}

func readBoundedLine(reader *bufio.Reader, maxBytes int) ([]byte, error) {
	line := make([]byte, 0, min(maxBytes, 4096))
	for {
		fragment, more, err := reader.ReadLine()
		if err != nil {
			if err == io.EOF && len(fragment) == 0 && len(line) == 0 {
				return nil, io.EOF
			}
			if err != io.EOF {
				return nil, err
			}
		}
		if len(line)+len(fragment) > maxBytes {
			return nil, ErrMessageTooLarge
		}
		line = append(line, fragment...)
		if !more {
			return line, nil
		}
	}
}
