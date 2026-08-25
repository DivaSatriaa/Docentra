package repository

import (
	"context"
	"fmt"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DocumentRepository struct {
	db *pgxpool.Pool
}

func NewDocumentRepository(db *pgxpool.Pool) *DocumentRepository {
	return &DocumentRepository{db: db}
}

func (r *DocumentRepository) Create(
	ctx context.Context,
	document *model.Document,
) (*model.Document, error) {
	query := `
		INSERT INTO documents (
			workspace_id,
			name,
			original_name,
			mime_type,
			extension,
			file_size,
			storage_path,
			processing_status,
			page_count
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9
		)
		RETURNING
			id,
			workspace_id,
			name,
			original_name,
			mime_type,
			extension,
			file_size,
			storage_path,
			processing_status,
			page_count,
			created_at,
			updated_at
	`

	var created model.Document

	err := r.db.QueryRow(
		ctx,
		query,
		document.WorkspaceID,
		document.Name,
		document.OriginalName,
		document.MimeType,
		document.Extension,
		document.FileSize,
		document.StoragePath,
		document.ProcessingStatus,
		document.PageCount,
	).Scan(
		&created.ID,
		&created.WorkspaceID,
		&created.Name,
		&created.OriginalName,
		&created.MimeType,
		&created.Extension,
		&created.FileSize,
		&created.StoragePath,
		&created.ProcessingStatus,
		&created.PageCount,
		&created.CreatedAt,
		&created.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("create document: %w", err)
	}

	return &created, nil
}

func (r *DocumentRepository) ListByWorkspace(
	ctx context.Context,
	workspaceID string,
) ([]model.Document, error) {
	query := `
		SELECT
			id,
			workspace_id,
			name,
			original_name,
			mime_type,
			extension,
			file_size,
			storage_path,
			processing_status,
			page_count,
			created_at,
			updated_at
		FROM documents
		WHERE workspace_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("list documents: %w", err)
	}
	defer rows.Close()

	var documents []model.Document

	for rows.Next() {
		var document model.Document

		if err := rows.Scan(
			&document.ID,
			&document.WorkspaceID,
			&document.Name,
			&document.OriginalName,
			&document.MimeType,
			&document.Extension,
			&document.FileSize,
			&document.StoragePath,
			&document.ProcessingStatus,
			&document.PageCount,
			&document.CreatedAt,
			&document.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan document: %w", err)
		}

		documents = append(documents, document)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate documents: %w", err)
	}

	return documents, nil
}

func (r *DocumentRepository) GetByID(
	ctx context.Context,
	id string,
) (*model.Document, error) {
	query := `
		SELECT
			id,
			workspace_id,
			name,
			original_name,
			mime_type,
			extension,
			file_size,
			storage_path,
			processing_status,
			page_count,
			created_at,
			updated_at
		FROM documents
		WHERE id = $1
	`

	var document model.Document

	err := r.db.QueryRow(ctx, query, id).Scan(
		&document.ID,
		&document.WorkspaceID,
		&document.Name,
		&document.OriginalName,
		&document.MimeType,
		&document.Extension,
		&document.FileSize,
		&document.StoragePath,
		&document.ProcessingStatus,
		&document.PageCount,
		&document.CreatedAt,
		&document.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("document not found")
		}

		return nil, fmt.Errorf("get document: %w", err)
	}

	return &document, nil
}
