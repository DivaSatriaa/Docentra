package handler

import (
	"errors"
	"net/http"
	"testing"
)

func TestCollectionErrorStatus(t *testing.T) {
	cases := []struct {
		message string
		want    int
	}{
		{"collection not found", http.StatusNotFound},
		{"name is required", http.StatusBadRequest},
		{"document not found in this workspace", http.StatusBadRequest},
	}

	for _, tc := range cases {
		if got := collectionErrorStatus(errors.New(tc.message)); got != tc.want {
			t.Errorf("collectionErrorStatus(%q) = %d, want %d", tc.message, got, tc.want)
		}
	}
}
