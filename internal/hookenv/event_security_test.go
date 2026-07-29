package hookenv

import (
	"errors"
	"fmt"
	"strings"
	"testing"
)

func TestReadEvent_rejectsHostileSessionID(t *testing.T) {
	t.Parallel()

	for _, sessionID := range []string{
		"../../../escaped",
		`..\..\escaped`,
		".",
		"..",
		"contains.dot",
		"contains/slash",
		`contains\backslash`,
		strings.Repeat("a", 129),
	} {
		t.Run(fmt.Sprintf("%q", sessionID), func(t *testing.T) {
			// Given: a hostile session identifier at the hook envelope boundary.
			input := fmt.Sprintf(`{"sessionId":%q,"hookEventName":"SessionEnd"}`, sessionID)

			// When: the event is decoded.
			_, err := ReadEvent(strings.NewReader(input))

			// Then: the envelope is rejected before any state path can be built.
			if err == nil {
				t.Fatalf("ReadEvent accepted hostile session ID %q", sessionID)
			}
		})
	}
}

func TestReadEvent_acceptsOpaqueSessionID(t *testing.T) {
	t.Parallel()

	// Given: a normal bounded opaque session identifier.
	const input = `{"sessionId":"019fac61-3890-7d70-80e4-6ec0232a644b"}`

	// When: the event is decoded.
	ev, err := ReadEvent(strings.NewReader(input))

	// Then: the identifier is preserved exactly, without normalization.
	if err != nil {
		t.Fatalf("ReadEvent: %v", err)
	}
	if ev.SessionID != "019fac61-3890-7d70-80e4-6ec0232a644b" {
		t.Fatalf("SessionID = %q", ev.SessionID)
	}
}

func TestReadEvent_rejectsOversizedEnvelope(t *testing.T) {
	t.Parallel()

	// Given: a native hook envelope larger than the boundary limit.
	input := `{"prompt":"` + strings.Repeat("x", int(MaxEventBytes)) + `"}`

	// When: the hook envelope is decoded.
	_, err := ReadEvent(strings.NewReader(input))

	// Then: the ingress boundary reports a size error.
	if !errors.Is(err, ErrEventTooLarge) {
		t.Fatalf("error = %v, want ErrEventTooLarge", err)
	}
}
