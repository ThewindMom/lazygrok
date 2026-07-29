package hashline

import (
	"bufio"
	"bytes"
	"errors"
	"strconv"
	"strings"
	"testing"
)

func TestRun_rejectsOversizedLineBeforeUnboundedRead(t *testing.T) {
	t.Parallel()

	// Given: a newline-delimited MCP message over the ingress limit.
	server := NewServer(t.TempDir())
	server.in = bufio.NewReaderSize(
		strings.NewReader(strings.Repeat("x", MaxMessageBytes+1)+"\n"),
		64,
	)
	server.out = &bytes.Buffer{}

	// When: the server reads the message.
	err := server.Run()

	// Then: the bounded reader rejects it.
	if !errors.Is(err, ErrMessageTooLarge) {
		t.Fatalf("error = %v, want ErrMessageTooLarge", err)
	}
}

func TestRun_rejectsOversizedFramedMessageBeforeBodyAllocation(t *testing.T) {
	t.Parallel()

	// Given: an MCP Content-Length frame declaring an oversized body.
	header := "Content-Length: " + strconv.Itoa(MaxMessageBytes+1) + "\r\n\r\n"
	server := NewServer(t.TempDir())
	server.in = bufio.NewReaderSize(strings.NewReader(header), 64)
	server.out = &bytes.Buffer{}

	// When: the frame header is parsed.
	err := server.Run()

	// Then: the body is rejected without being allocated or read.
	if !errors.Is(err, ErrMessageTooLarge) {
		t.Fatalf("error = %v, want ErrMessageTooLarge", err)
	}
}

func TestRun_acceptsBoundedContentLengthFrame(t *testing.T) {
	t.Parallel()

	// Given: a valid initialized request using framed MCP transport.
	body := `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`
	frame := "Content-Length: " + strconv.Itoa(len(body)) + "\r\n\r\n" + body
	output := &bytes.Buffer{}
	server := NewServer(t.TempDir())
	server.in = bufio.NewReader(strings.NewReader(frame))
	server.out = output

	// When: the server processes the frame.
	err := server.Run()

	// Then: it emits a normal initialize response.
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if !strings.Contains(output.String(), `"protocolVersion"`) {
		t.Fatalf("response = %q", output.String())
	}
}
