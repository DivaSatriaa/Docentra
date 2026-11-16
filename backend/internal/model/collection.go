package model

import "time"

type Collection struct {
	ID            string    `json:"id"`
	WorkspaceID   string    `json:"workspace_id"`
	Name          string    `json:"name"`
	Description   *string   `json:"description,omitempty"`
	DocumentCount int       `json:"document_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// CollectionDetail is a collection together with its member documents.
type CollectionDetail struct {
	Collection
	Documents []Document `json:"documents"`
}
