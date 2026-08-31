package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
)

type MessageService struct {
	repository *repository.MessageRepository
}

func NewMessageService(
	repository *repository.MessageRepository,
) *MessageService {
	return &MessageService{
		repository: repository,
	}
}

func (s *MessageService) Create(
	ctx context.Context,
	conversationID string,
	role string,
	content string,
) (*model.Message, error) {
	conversationID = strings.TrimSpace(conversationID)
	role = strings.TrimSpace(strings.ToLower(role))
	content = strings.TrimSpace(content)

	if conversationID == "" {
		return nil, fmt.Errorf("conversation_id is required")
	}

	if content == "" {
		return nil, fmt.Errorf("content is required")
	}

	switch role {
	case "user", "assistant", "system":
	default:
		return nil, fmt.Errorf("invalid message role")
	}

	return s.repository.Create(
		ctx,
		conversationID,
		role,
		content,
	)
}

func (s *MessageService) ListByConversation(
	ctx context.Context,
	conversationID string,
) ([]model.Message, error) {
	conversationID = strings.TrimSpace(conversationID)

	if conversationID == "" {
		return nil, fmt.Errorf("conversation_id is required")
	}

	return s.repository.ListByConversation(
		ctx,
		conversationID,
	)
}

func (s *MessageService) GetByID(
	ctx context.Context,
	id string,
) (*model.Message, error) {
	id = strings.TrimSpace(id)

	if id == "" {
		return nil, fmt.Errorf("message id is required")
	}

	return s.repository.GetByID(ctx, id)
}
