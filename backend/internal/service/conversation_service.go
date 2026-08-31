package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
)

type ConversationService struct {
	repository *repository.ConversationRepository
}

func NewConversationService(
	repository *repository.ConversationRepository,
) *ConversationService {
	return &ConversationService{
		repository: repository,
	}
}

func (s *ConversationService) Create(
	ctx context.Context,
	workspaceID string,
	title *string,
) (*model.Conversation, error) {
	workspaceID = strings.TrimSpace(workspaceID)

	if workspaceID == "" {
		return nil, fmt.Errorf("workspace_id is required")
	}

	if title != nil {
		value := strings.TrimSpace(*title)

		if value == "" {
			title = nil
		} else {
			title = &value
		}
	}

	return s.repository.Create(
		ctx,
		workspaceID,
		title,
	)
}

func (s *ConversationService) GetByID(
	ctx context.Context,
	id string,
) (*model.Conversation, error) {
	id = strings.TrimSpace(id)

	if id == "" {
		return nil, fmt.Errorf("conversation id is required")
	}

	return s.repository.GetByID(ctx, id)
}

func (s *ConversationService) ListByWorkspace(
	ctx context.Context,
	workspaceID string,
) ([]model.Conversation, error) {
	workspaceID = strings.TrimSpace(workspaceID)

	if workspaceID == "" {
		return nil, fmt.Errorf("workspace_id is required")
	}

	return s.repository.ListByWorkspace(
		ctx,
		workspaceID,
	)
}
