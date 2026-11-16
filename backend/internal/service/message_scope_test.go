package service

import (
	"reflect"
	"testing"
)

func TestResolveScopeWithoutCollectionKeepsDocumentIDs(t *testing.T) {
	got, err := resolveScope("", nil, []string{"a"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !reflect.DeepEqual(got, []string{"a"}) {
		t.Fatalf("scope = %v, want [a]", got)
	}
}

func TestResolveScopeWithoutCollectionOrDocumentsIsUnscoped(t *testing.T) {
	got, err := resolveScope("", nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != nil {
		t.Fatalf("scope = %v, want nil", got)
	}
}

func TestResolveScopeUnionsMembersAndTickedWithoutDuplicates(t *testing.T) {
	got, err := resolveScope("c", []string{"a", "b"}, []string{"b", "x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if want := []string{"a", "b", "x"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("scope = %v, want %v", got, want)
	}
}

func TestResolveScopeEmptyCollectionWithTickedDocument(t *testing.T) {
	got, err := resolveScope("c", nil, []string{"x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if want := []string{"x"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("scope = %v, want %v", got, want)
	}
}

func TestResolveScopeEmptyCollectionIsRejected(t *testing.T) {
	_, err := resolveScope("c", nil, nil)
	if err == nil || err.Error() != "collection has no documents" {
		t.Fatalf("err = %v, want %q", err, "collection has no documents")
	}
}
