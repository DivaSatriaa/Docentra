package client

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/iotest"
)

const sampleStream = "event: delta\ndata: {\"text\":\"Ha\"}\n\nevent: done\ndata: {\"answer\":\"x\"}\n\n"

func collect(t *testing.T, r io.Reader) ([]StreamEvent, error) {
	t.Helper()
	var got []StreamEvent
	err := readSSE(r, func(e StreamEvent) error {
		got = append(got, e)
		return nil
	})
	return got, err
}

func assertSample(t *testing.T, got []StreamEvent) {
	t.Helper()
	if len(got) != 2 {
		t.Fatalf("want 2 events, got %d: %+v", len(got), got)
	}
	if got[0].Event != "delta" || string(got[0].Data) != `{"text":"Ha"}` {
		t.Errorf("event 0 = %q %s", got[0].Event, got[0].Data)
	}
	if got[1].Event != "done" || string(got[1].Data) != `{"answer":"x"}` {
		t.Errorf("event 1 = %q %s", got[1].Event, got[1].Data)
	}
}

func TestReadSSEParsesFrames(t *testing.T) {
	got, err := collect(t, strings.NewReader(sampleStream))
	if err != nil {
		t.Fatal(err)
	}
	assertSample(t, got)
}

func TestReadSSEOneByteReader(t *testing.T) {
	got, err := collect(t, iotest.OneByteReader(strings.NewReader(sampleStream)))
	if err != nil {
		t.Fatal(err)
	}
	assertSample(t, got)
}

func TestReadSSEIgnoresComments(t *testing.T) {
	in := ": keepalive\n\nevent: delta\n: another\ndata: {\"text\":\"Ha\"}\n\nevent: done\ndata: {\"answer\":\"x\"}\n\n"
	got, err := collect(t, strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	assertSample(t, got)
}

func TestReadSSEHandlerErrorStops(t *testing.T) {
	boom := errors.New("boom")
	calls := 0
	err := readSSE(strings.NewReader(sampleStream), func(StreamEvent) error {
		calls++
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatalf("want boom, got %v", err)
	}
	if calls != 1 {
		t.Fatalf("want 1 call, got %d", calls)
	}
}

func TestReadSSEFinalFrameWithoutBlankLine(t *testing.T) {
	got, err := collect(t, strings.NewReader("event: delta\ndata: {\"text\":\"Ha\"}\n\nevent: done\ndata: {\"answer\":\"x\"}"))
	if err != nil {
		t.Fatal(err)
	}
	assertSample(t, got)
}

func TestReadSSECRLFAndMultilineData(t *testing.T) {
	got, err := collect(t, strings.NewReader("event:x\r\ndata: a\r\ndata:b\r\n\r\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Event != "x" || string(got[0].Data) != "a\nb" {
		t.Fatalf("got %+v", got)
	}
}

func TestReadSSELargeData(t *testing.T) {
	payload := `{"answer":"` + strings.Repeat("a", 300*1024) + `"}`
	in := "event: done\ndata: " + payload + "\n\n"
	got, err := collect(t, strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || string(got[0].Data) != payload {
		t.Fatalf("large payload truncated or missing: %d events", len(got))
	}
}

func TestChatStream(t *testing.T) {
	var path, accept string
	var body map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		accept = r.Header.Get("Accept")
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "event: delta\ndata: {\"text\":\"A\"}\n\n")
		io.WriteString(w, "event: delta\ndata: {\"text\":\"B\"}\n\n")
		io.WriteString(w, "event: done\ndata: {\"answer\":\"AB\"}\n\n")
	}))
	defer srv.Close()

	var got []StreamEvent
	err := NewAIClient(srv.URL).ChatStream(context.Background(), ChatRequest{Question: "hi"}, func(e StreamEvent) error {
		got = append(got, e)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if path != "/internal/chat/stream" {
		t.Errorf("path = %q", path)
	}
	if accept != "text/event-stream" {
		t.Errorf("accept = %q", accept)
	}
	if body["question"] != "hi" || body["top_k"] != float64(5) {
		t.Errorf("body = %v", body)
	}
	want := []StreamEvent{
		{"delta", json.RawMessage(`{"text":"A"}`)},
		{"delta", json.RawMessage(`{"text":"B"}`)},
		{"done", json.RawMessage(`{"answer":"AB"}`)},
	}
	if len(got) != len(want) {
		t.Fatalf("got %+v", got)
	}
	for i := range want {
		if got[i].Event != want[i].Event || string(got[i].Data) != string(want[i].Data) {
			t.Errorf("event %d = %q %s", i, got[i].Event, got[i].Data)
		}
	}
}

func TestChatStreamHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	called := false
	err := NewAIClient(srv.URL).ChatStream(context.Background(), ChatRequest{Question: "hi"}, func(StreamEvent) error {
		called = true
		return nil
	})
	if err == nil || !strings.Contains(err.Error(), "500") {
		t.Fatalf("want error with 500, got %v", err)
	}
	if called {
		t.Error("callback must not be called")
	}
}

func TestChatStreamCallbackError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		io.WriteString(w, "event: delta\ndata: {\"text\":\"A\"}\n\n")
		io.WriteString(w, "event: delta\ndata: {\"text\":\"B\"}\n\n")
	}))
	defer srv.Close()

	boom := errors.New("boom")
	calls := 0
	err := NewAIClient(srv.URL).ChatStream(context.Background(), ChatRequest{Question: "hi"}, func(StreamEvent) error {
		calls++
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatalf("want boom, got %v", err)
	}
	if calls != 1 {
		t.Errorf("calls = %d", calls)
	}
}
