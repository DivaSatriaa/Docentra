package handler

import (
	"net/http/httptest"
	"testing"
)

func TestWriteSSE(t *testing.T) {
	rec := httptest.NewRecorder()

	if err := writeSSE(rec, rec, "delta", []byte(`{"text":"hi"}`)); err != nil {
		t.Fatalf("writeSSE: %v", err)
	}

	want := "event: delta\ndata: {\"text\":\"hi\"}\n\n"
	if got := rec.Body.String(); got != want {
		t.Fatalf("frame = %q, want %q", got, want)
	}

	if !rec.Flushed {
		t.Fatal("frame was not flushed")
	}
}
