package handler

import (
	"errors"
	"net/http"
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

func TestChatErrorStatus(t *testing.T) {
	cases := []struct {
		message string
		want    int
	}{
		{"conversation not found", http.StatusNotFound},
		{"collection not found", http.StatusNotFound},
		{"collection has no documents", http.StatusBadRequest},
		{"ai service unavailable", http.StatusInternalServerError},
	}

	for _, tc := range cases {
		if got := chatErrorStatus(errors.New(tc.message)); got != tc.want {
			t.Errorf("chatErrorStatus(%q) = %d, want %d", tc.message, got, tc.want)
		}
	}
}
