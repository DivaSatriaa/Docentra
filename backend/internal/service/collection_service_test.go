package service

import (
	"strings"
	"testing"
)

func TestNormalizeCollectionInputTrimsName(t *testing.T) {
	name, description, err := normalizeCollectionInput("  KKN  ", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if name != "KKN" {
		t.Fatalf("name = %q, want %q", name, "KKN")
	}

	if description != nil {
		t.Fatalf("description = %q, want nil", *description)
	}
}

func TestNormalizeCollectionInputRejectsBlankName(t *testing.T) {
	_, _, err := normalizeCollectionInput("   ", nil)
	if err == nil || err.Error() != "name is required" {
		t.Fatalf("err = %v, want %q", err, "name is required")
	}
}

func TestNormalizeCollectionInputCountsRunes(t *testing.T) {
	if _, _, err := normalizeCollectionInput(strings.Repeat("é", 150), nil); err != nil {
		t.Fatalf("150 runes: unexpected error: %v", err)
	}

	_, _, err := normalizeCollectionInput(strings.Repeat("é", 151), nil)
	if err == nil || err.Error() != "name must be at most 150 characters" {
		t.Fatalf("151 runes: err = %v, want %q", err, "name must be at most 150 characters")
	}
}

func TestNormalizeCollectionInputTrimsDescription(t *testing.T) {
	value := "  notes "

	_, description, err := normalizeCollectionInput("KKN", &value)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if description == nil || *description != "notes" {
		t.Fatalf("description = %v, want %q", description, "notes")
	}
}

func TestNormalizeCollectionInputBlankDescriptionIsNil(t *testing.T) {
	value := "   "

	_, description, err := normalizeCollectionInput("KKN", &value)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if description != nil {
		t.Fatalf("description = %q, want nil", *description)
	}
}
