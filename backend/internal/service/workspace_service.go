package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
)

type WorkspaceService struct {
	repository *repository.WorkspaceRepository
}

func NewWorkspaceService(repository *repository.WorkspaceRepository) *WorkspaceService {
	return &WorkspaceService{
		repository: repository,
	}
}

func (s *WorkspaceService) Create(
	ctx context.Context,
	ownerID string,
	name string,
	description *string,
) (*model.Workspace, error) {
	ownerID = strings.TrimSpace(ownerID)
	name = strings.TrimSpace(name)

	if ownerID == "" {
		return nil, fmt.Errorf("owner_id is required")
	}

	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	return s.repository.Create(ctx, ownerID, name, description)
}

func (s *WorkspaceService) List(
	ctx context.Context,
	ownerID string,
) ([]model.Workspace, error) {
	ownerID = strings.TrimSpace(ownerID)

	if ownerID == "" {
		return nil, fmt.Errorf("owner_id is required")
	}

	return s.repository.ListByOwner(ctx, ownerID)
}

func (s *WorkspaceService) GetByID(
	ctx context.Context,
	id string,
) (*model.Workspace, error) {
	id = strings.TrimSpace(id)

	if id == "" {
		return nil, fmt.Errorf("workspace id is required")
	}

	return s.repository.GetByID(ctx, id)
}
