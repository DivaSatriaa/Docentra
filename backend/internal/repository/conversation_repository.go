package repository

import (
	"context"
	"fmt"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ConversationRepository struct {
	db *pgxpool.Pool
}

func NewConversationRepository(db *pgxpool.Pool) *ConversationRepository {
	return &ConversationRepository{db: db}
}

func (r *ConversationRepository) Create(
	ctx context.Context,
	workspaceID string,
	title *string,
) (*model.Conversation, error) {
	query := `
		INSERT INTO conversations (
			workspace_id,
			title
		)
		VALUES ($1, $2)
		RETURNING
			id,
			workspace_id,
			title,
			created_at,
			updated_at
	`

	var conversation model.Conversation

	err := r.db.QueryRow(
		ctx,
		query,
		workspaceID,
		title,
	).Scan(
		&conversation.ID,
		&conversation.WorkspaceID,
		&conversation.Title,
		&conversation.CreatedAt,
		&conversation.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("create conversation: %w", err)
	}

	return &conversation, nil
}

func (r *ConversationRepository) GetByID(
	ctx context.Context,
	id string,
) (*model.Conversation, error) {
	query := `
		SELECT
			id,
			workspace_id,
			title,
			created_at,
			updated_at
		FROM conversations
		WHERE id = $1
	`

	var conversation model.Conversation

	err := r.db.QueryRow(
		ctx,
		query,
		id,
	).Scan(
		&conversation.ID,
		&conversation.WorkspaceID,
		&conversation.Title,
		&conversation.CreatedAt,
		&conversation.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("conversation not found")
		}

		return nil, fmt.Errorf("get conversation: %w", err)
	}

	return &conversation, nil
}

func (r *ConversationRepository) ListByWorkspace(
	ctx context.Context,
	workspaceID string,
) ([]model.Conversation, error) {
	query := `
		SELECT
			id,
			workspace_id,
			title,
			created_at,
			updated_at
		FROM conversations
		WHERE workspace_id = $1
		ORDER BY updated_at DESC
	`

	rows, err := r.db.Query(
		ctx,
		query,
		workspaceID,
	)
	if err != nil {
		return nil, fmt.Errorf("list conversations: %w", err)
	}
	defer rows.Close()

	var conversations []model.Conversation

	for rows.Next() {
		var conversation model.Conversation

		if err := rows.Scan(
			&conversation.ID,
			&conversation.WorkspaceID,
			&conversation.Title,
			&conversation.CreatedAt,
			&conversation.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan conversation: %w", err)
		}

		conversations = append(
			conversations,
			conversation,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate conversations: %w", err)
	}

	return conversations, nil
}
