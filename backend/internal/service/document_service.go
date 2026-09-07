package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/DivaSatriaa/Docentra/backend/internal/client"
	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
)

type DocumentService struct {
	repository *repository.DocumentRepository
	aiClient   *client.AIClient
}

func NewDocumentService(
	repository *repository.DocumentRepository,
	aiClient *client.AIClient,
) *DocumentService {
	return &DocumentService{
		repository: repository,
		aiClient:   aiClient,
	}
}

func (s *DocumentService) Create(
	ctx context.Context,
	workspaceID string,
	name string,
	originalName string,
	mimeType string,
	fileSize int64,
	storagePath string,
) (*model.Document, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	name = strings.TrimSpace(name)
	originalName = strings.TrimSpace(originalName)
	mimeType = strings.TrimSpace(mimeType)
	storagePath = strings.TrimSpace(storagePath)

	if workspaceID == "" {
		return nil, fmt.Errorf("workspace_id is required")
	}

	if originalName == "" {
		return nil, fmt.Errorf("original_name is required")
	}

	if name == "" {
		name = originalName
	}

	if fileSize <= 0 {
		return nil, fmt.Errorf("file must not be empty")
	}

	if storagePath == "" {
		return nil, fmt.Errorf("storage_path is required")
	}

	extension := filepath.Ext(originalName)
	extension = strings.TrimPrefix(strings.ToLower(extension), ".")

	var extensionPtr *string
	if extension != "" {
		extensionPtr = &extension
	}

	document := &model.Document{
		WorkspaceID:      workspaceID,
		Name:             name,
		OriginalName:     originalName,
		MimeType:         mimeType,
		Extension:        extensionPtr,
		FileSize:         fileSize,
		StoragePath:      storagePath,
		ProcessingStatus: "pending",
	}

	created, err := s.repository.Create(ctx, document)
	if err != nil {
		return nil, err
	}

	go func(documentID string) {
		processingCtx, cancel := context.WithTimeout(
			context.Background(),
			15*time.Minute,
		)
		defer cancel()

		if err := s.aiClient.ProcessDocument(
			processingCtx,
			documentID,
		); err != nil {
			fmt.Printf(
				"document processing failed for %s: %v\n",
				documentID,
				err,
			)
		}
	}(created.ID)

	return created, nil
}

func (s *DocumentService) ListByWorkspace(
	ctx context.Context,
	workspaceID string,
) ([]model.Document, error) {
	workspaceID = strings.TrimSpace(workspaceID)

	if workspaceID == "" {
		return nil, fmt.Errorf("workspace_id is required")
	}

	return s.repository.ListByWorkspace(ctx, workspaceID)
}

func (s *DocumentService) GetByID(
	ctx context.Context,
	id string,
) (*model.Document, error) {
	id = strings.TrimSpace(id)

	if id == "" {
		return nil, fmt.Errorf("document id is required")
	}

	return s.repository.GetByID(ctx, id)
}

func (s *DocumentService) Rename(
	ctx context.Context,
	id string,
	name string,
) (*model.Document, error) {
	id = strings.TrimSpace(id)
	name = strings.TrimSpace(name)

	if id == "" {
		return nil, fmt.Errorf("document id is required")
	}

	if name == "" {
		return nil, fmt.Errorf("document name is required")
	}

	return s.repository.UpdateName(
		ctx,
		id,
		name,
	)
}

func (s *DocumentService) Delete(
	ctx context.Context,
	id string,
) error {
	id = strings.TrimSpace(id)

	if id == "" {
		return fmt.Errorf("document id is required")
	}

	document, err := s.repository.GetByID(
		ctx,
		id,
	)
	if err != nil {
		return err
	}

	if document.StoragePath != "" {
		if err := os.Remove(document.StoragePath); err != nil {
			if !os.IsNotExist(err) {
				return fmt.Errorf(
					"delete document file: %w",
					err,
				)
			}
		}
	}

	_, err = s.repository.Delete(
		ctx,
		id,
	)
	if err != nil {
		return err
	}

	return nil
}