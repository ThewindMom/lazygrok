package hashline_test

import (
	"testing"

	"lazygrok/internal/hashline"
)

func TestComputeLineHashGoldenHello(t *testing.T) {
	got := hashline.ComputeLineHash(1, "  hello  ")
	if got != "ST" {
		t.Fatalf("got %q want ST", got)
	}
}

func TestComputeLineHashTrimEnd(t *testing.T) {
	a := hashline.ComputeLineHash(1, "function hello() {")
	b := hashline.ComputeLineHash(1, "function hello() {  ")
	if a != b {
		t.Fatalf("%s vs %s", a, b)
	}
}