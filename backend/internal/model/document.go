package model

import "time"

type Document struct {
	ID               string    `json:"id"`
	WorkspaceID      string    `json:"workspace_id"`
	Name             string    `json:"name"`
	OriginalName     string    `json:"original_name"`
	MimeType         string    `json:"mime_type"`
	Extension        *string   `json:"extension,omitempty"`
	FileSize         int64     `json:"file_size"`
	StoragePath      string    `json:"storage_path"`
	ProcessingStatus string    `json:"processing_status"`
	PageCount        *int      `json:"page_count,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
