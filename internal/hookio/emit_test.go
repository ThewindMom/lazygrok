package hookio_test

import (
	"bytes"
	"encoding/json"
	"testing"

	"lazygrok/internal/hookio"
)

func TestEmitAllow(t *testing.T) {
	var buf bytes.Buffer
	hookio.EmitAllow(&buf)
	var out map[string]string
	if err := json.Unmarshal(buf.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out["decision"] != "allow" {
		t.Fatalf("got %v", out)
	}
}

func TestEmitDenyWritesReason(t *testing.T) {
	var buf bytes.Buffer
	code := hookio.EmitDeny(&buf, `say "hi"`)
	if code != 2 {
		t.Fatalf("exit %d", code)
	}
	if !bytes.Contains(buf.Bytes(), []byte(`deny`)) {
		t.Fatalf("%s", buf.Bytes())
	}
}