package model

import (
	"encoding/json"
	"time"
)

type Message struct {
	ID             string `json:"id"`
	ConversationID string `json:"conversation_id"`
	Role           string `json:"role"`
	Content        string `json:"content"`
	// Sources an assistant answer cited (JSON array), null otherwise.
	Citations json.RawMessage `json:"citations,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}
