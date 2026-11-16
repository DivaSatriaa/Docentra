package client

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestChatRequestForwardsWebSearch(t *testing.T) {
	on, err := json.Marshal(ChatRequest{Question: "q", WebSearch: true})
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(string(on), `"web_search":true`) {
		t.Fatalf("web_search missing: %s", on)
	}

	off, _ := json.Marshal(ChatRequest{Question: "q"})
	if strings.Contains(string(off), "web_search") {
		t.Fatalf("web_search sent although off: %s", off)
	}
}

func TestWebCitationSurvivesRoundTrip(t *testing.T) {
	raw := `{"answer":"a [1][2]","citations":[` +
		`{"source":1,"kind":"document","document_id":"d1","document_name":"a.pdf","page":2,"chunk_id":"c1","snippet":"s"},` +
		`{"source":2,"kind":"web","url":"https://contoh.id/x","title":"Judul","snippet":"w","highlights":["w"]}],` +
		`"search_query":"q","scope":[],"web":{"used":true,"status":"ok","query":"kata kunci"}}`

	var done StreamDone
	if err := json.Unmarshal([]byte(raw), &done); err != nil {
		t.Fatal(err)
	}

	web := done.Citations[1]
	if web.Kind != "web" || web.URL != "https://contoh.id/x" || web.Title != "Judul" {
		t.Fatalf("web citation fields lost: %+v", web)
	}

	out, err := json.Marshal(done)
	if err != nil {
		t.Fatal(err)
	}

	for _, want := range []string{
		`"kind":"web"`,
		`"url":"https://contoh.id/x"`,
		`"title":"Judul"`,
		`"web":{"used":true,"status":"ok","query":"kata kunci"}`,
	} {
		if !strings.Contains(string(out), want) {
			t.Fatalf("%s missing after round trip: %s", want, out)
		}
	}

	stored, _ := json.Marshal(done.Citations)
	if !strings.Contains(string(stored), `"url":"https://contoh.id/x"`) {
		t.Fatalf("stored citations lost the url: %s", stored)
	}
}
