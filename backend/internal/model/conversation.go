package model

import "time"

type Conversation struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Title       *string   `json:"title,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
