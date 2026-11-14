package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MessageRepository struct {
	db *pgxpool.Pool
}

func NewMessageRepository(db *pgxpool.Pool) *MessageRepository {
	return &MessageRepository{
		db: db,
	}
}

func (r *MessageRepository) Create(
	ctx context.Context,
	conversationID string,
	role string,
	content string,
	citations json.RawMessage,
) (*model.Message, error) {
	query := `
		INSERT INTO messages (
			conversation_id,
			role,
			content,
			citations
		)
		VALUES ($1, $2, $3, $4)
		RETURNING
			id,
			conversation_id,
			role,
			content,
			citations,
			created_at
	`

	// A nil RawMessage must be stored as SQL NULL, not the JSON text "null".
	var citationsParam any
	if len(citations) > 0 {
		citationsParam = string(citations)
	}

	var message model.Message

	err := r.db.QueryRow(
		ctx,
		query,
		conversationID,
		role,
		content,
		citationsParam,
	).Scan(
		&message.ID,
		&message.ConversationID,
		&message.Role,
		&message.Content,
		&message.Citations,
		&message.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("create message: %w", err)
	}

	return &message, nil
}

func (r *MessageRepository) ListByConversation(
	ctx context.Context,
	conversationID string,
) ([]model.Message, error) {
	query := `
		SELECT
			id,
			conversation_id,
			role,
			content,
			citations,
			created_at
		FROM messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(
		ctx,
		query,
		conversationID,
	)
	if err != nil {
		return nil, fmt.Errorf("list messages: %w", err)
	}
	defer rows.Close()

	var messages []model.Message

	for rows.Next() {
		var message model.Message

		if err := rows.Scan(
			&message.ID,
			&message.ConversationID,
			&message.Role,
			&message.Content,
			&message.Citations,
			&message.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}

		messages = append(
			messages,
			message,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate messages: %w", err)
	}

	return messages, nil
}

func (r *MessageRepository) GetByID(
	ctx context.Context,
	id string,
) (*model.Message, error) {
	query := `
		SELECT
			id,
			conversation_id,
			role,
			content,
			citations,
			created_at
		FROM messages
		WHERE id = $1
	`

	var message model.Message

	err := r.db.QueryRow(
		ctx,
		query,
		id,
	).Scan(
		&message.ID,
		&message.ConversationID,
		&message.Role,
		&message.Content,
		&message.Citations,
		&message.CreatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("message not found")
		}

		return nil, fmt.Errorf("get message: %w", err)
	}

	return &message, nil
}
