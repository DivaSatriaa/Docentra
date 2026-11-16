package service

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
)

const maxCollectionNameLength = 150

type CollectionService struct {
	repository *repository.CollectionRepository
}

func NewCollectionService(
	repository *repository.CollectionRepository,
) *CollectionService {
	return &CollectionService{
		repository: repository,
	}
}

// normalizeCollectionInput trims the name and description and applies the
// naming rules. A blank description becomes nil.
func normalizeCollectionInput(
	name string,
	description *string,
) (string, *string, error) {
	name = strings.TrimSpace(name)

	if name == "" {
		return "", nil, fmt.Errorf("name is required")
	}

	if utf8.RuneCountInString(name) > maxCollectionNameLength {
		return "", nil, fmt.Errorf(
			"name must be at most %d characters",
			maxCollectionNameLength,
		)
	}

	if description != nil {
		value := strings.TrimSpace(*description)

		if value == "" {
			description = nil
		} else {
			description = &value
		}
	}

	return name, description, nil
}

func (s *CollectionService) Create(
	ctx context.Context,
	workspaceID string,
	name string,
	description *string,
) (*model.Collection, error) {
	workspaceID = strings.TrimSpace(workspaceID)

	if workspaceID == "" {
		return nil, fmt.Errorf("workspace_id is required")
	}

	name, description, err := normalizeCollectionInput(name, description)
	if err != nil {
		return nil, err
	}

	return s.repository.Create(ctx, workspaceID, name, description)
}

func (s *CollectionService) List(
	ctx context.Context,
	workspaceID string,
) ([]model.Collection, error) {
	workspaceID = strings.TrimSpace(workspaceID)

	if workspaceID == "" {
		return nil, fmt.Errorf("workspace_id is required")
	}

	return s.repository.ListByWorkspace(ctx, workspaceID)
}

func (s *CollectionService) Get(
	ctx context.Context,
	id string,
) (*model.CollectionDetail, error) {
	collection, err := s.repository.GetByID(ctx, strings.TrimSpace(id))
	if err != nil {
		return nil, err
	}

	documents, err := s.repository.ListDocuments(ctx, collection.ID)
	if err != nil {
		return nil, err
	}

	if documents == nil {
		documents = []model.Document{}
	}

	collection.DocumentCount = len(documents)

	return &model.CollectionDetail{
		Collection: *collection,
		Documents:  documents,
	}, nil
}

// Update changes the name and/or the description. A nil field is left as it
// is; an empty description clears it.
func (s *CollectionService) Update(
	ctx context.Context,
	id string,
	name *string,
	description *string,
) (*model.Collection, error) {
	current, err := s.repository.GetByID(ctx, strings.TrimSpace(id))
	if err != nil {
		return nil, err
	}

	newName := current.Name
	if name != nil {
		newName = *name
	}

	newDescription := current.Description
	if description != nil {
		newDescription = description
	}

	newName, newDescription, err = normalizeCollectionInput(
		newName,
		newDescription,
	)
	if err != nil {
		return nil, err
	}

	return s.repository.Update(ctx, current.ID, newName, newDescription)
}

func (s *CollectionService) Delete(
	ctx context.Context,
	id string,
) error {
	return s.repository.Delete(ctx, strings.TrimSpace(id))
}

func (s *CollectionService) AddDocuments(
	ctx context.Context,
	id string,
	documentIDs []string,
) (*model.CollectionDetail, error) {
	collection, err := s.repository.GetByID(ctx, strings.TrimSpace(id))
	if err != nil {
		return nil, err
	}

	err = s.repository.AddDocuments(
		ctx,
		collection.ID,
		collection.WorkspaceID,
		documentIDs,
	)
	if err != nil {
		return nil, err
	}

	return s.Get(ctx, collection.ID)
}

func (s *CollectionService) RemoveDocument(
	ctx context.Context,
	id string,
	documentID string,
) error {
	collection, err := s.repository.GetByID(ctx, strings.TrimSpace(id))
	if err != nil {
		return err
	}

	return s.repository.RemoveDocument(
		ctx,
		collection.ID,
		strings.TrimSpace(documentID),
	)
}
