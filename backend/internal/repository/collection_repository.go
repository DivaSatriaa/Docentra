package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CollectionRepository struct {
	db *pgxpool.Pool
}

func NewCollectionRepository(db *pgxpool.Pool) *CollectionRepository {
	return &CollectionRepository{db: db}
}

// collectionColumns selects a collection with a live count of its documents.
// It expects the collections table to be aliased as c.
const collectionColumns = `
	c.id,
	c.workspace_id,
	c.name,
	c.description,
	(
		SELECT COUNT(*)
		FROM collection_documents cd
		WHERE cd.collection_id = c.id
	),
	c.created_at,
	c.updated_at
`

func scanCollection(row pgx.Row) (*model.Collection, error) {
	var collection model.Collection

	err := row.Scan(
		&collection.ID,
		&collection.WorkspaceID,
		&collection.Name,
		&collection.Description,
		&collection.DocumentCount,
		&collection.CreatedAt,
		&collection.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &collection, nil
}

// isCollectionMissing reports whether err means the collection does not
// exist: no row, or an id that is not a UUID at all.
func isCollectionMissing(err error) bool {
	if errors.Is(err, pgx.ErrNoRows) {
		return true
	}

	var pgErr *pgconn.PgError

	return errors.As(err, &pgErr) && pgErr.Code == "22P02"
}

func (r *CollectionRepository) Create(
	ctx context.Context,
	workspaceID string,
	name string,
	description *string,
) (*model.Collection, error) {
	query := `
		INSERT INTO collections AS c (
			workspace_id,
			name,
			description
		)
		VALUES ($1, $2, $3)
		RETURNING ` + collectionColumns

	collection, err := scanCollection(
		r.db.QueryRow(ctx, query, workspaceID, name, description),
	)
	if err != nil {
		return nil, fmt.Errorf("create collection: %w", err)
	}

	return collection, nil
}

func (r *CollectionRepository) ListByWorkspace(
	ctx context.Context,
	workspaceID string,
) ([]model.Collection, error) {
	query := `
		SELECT ` + collectionColumns + `
		FROM collections c
		WHERE c.workspace_id = $1
		ORDER BY c.updated_at DESC
	`

	rows, err := r.db.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("list collections: %w", err)
	}
	defer rows.Close()

	var collections []model.Collection

	for rows.Next() {
		collection, err := scanCollection(rows)
		if err != nil {
			return nil, fmt.Errorf("scan collection: %w", err)
		}

		collections = append(collections, *collection)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate collections: %w", err)
	}

	return collections, nil
}

func (r *CollectionRepository) GetByID(
	ctx context.Context,
	id string,
) (*model.Collection, error) {
	query := `
		SELECT ` + collectionColumns + `
		FROM collections c
		WHERE c.id = $1
	`

	collection, err := scanCollection(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if isCollectionMissing(err) {
			return nil, fmt.Errorf("collection not found")
		}

		return nil, fmt.Errorf("get collection: %w", err)
	}

	return collection, nil
}

func (r *CollectionRepository) Update(
	ctx context.Context,
	id string,
	name string,
	description *string,
) (*model.Collection, error) {
	query := `
		UPDATE collections AS c
		SET
			name = $1,
			description = $2,
			updated_at = NOW()
		WHERE c.id = $3
		RETURNING ` + collectionColumns

	collection, err := scanCollection(
		r.db.QueryRow(ctx, query, name, description, id),
	)
	if err != nil {
		if isCollectionMissing(err) {
			return nil, fmt.Errorf("collection not found")
		}

		return nil, fmt.Errorf("update collection: %w", err)
	}

	return collection, nil
}

// Delete removes the collection and its memberships. Documents are kept.
func (r *CollectionRepository) Delete(
	ctx context.Context,
	id string,
) error {
	tag, err := r.db.Exec(
		ctx,
		`DELETE FROM collections WHERE id = $1`,
		id,
	)
	if err != nil {
		if isCollectionMissing(err) {
			return fmt.Errorf("collection not found")
		}

		return fmt.Errorf("delete collection: %w", err)
	}

	if tag.RowsAffected() == 0 {
		return fmt.Errorf("collection not found")
	}

	return nil
}

// ListDocuments returns the member documents, newest membership first.
func (r *CollectionRepository) ListDocuments(
	ctx context.Context,
	id string,
) ([]model.Document, error) {
	query := `
		SELECT
			d.id,
			d.workspace_id,
			d.name,
			d.original_name,
			d.mime_type,
			d.extension,
			d.file_size,
			d.storage_path,
			d.processing_status,
			d.processing_error,
			d.page_count,
			d.created_at,
			d.updated_at
		FROM collection_documents cd
		JOIN documents d ON d.id = cd.document_id
		WHERE cd.collection_id = $1
		ORDER BY cd.created_at DESC, d.name
	`

	rows, err := r.db.Query(ctx, query, id)
	if err != nil {
		return nil, fmt.Errorf("list collection documents: %w", err)
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
			&document.ProcessingError,
			&document.PageCount,
			&document.CreatedAt,
			&document.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan collection document: %w", err)
		}

		documents = append(documents, document)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate collection documents: %w", err)
	}

	return documents, nil
}

// DocumentIDs returns the ids of the member documents.
func (r *CollectionRepository) DocumentIDs(
	ctx context.Context,
	id string,
) ([]string, error) {
	rows, err := r.db.Query(
		ctx,
		`SELECT document_id::text
		 FROM collection_documents
		 WHERE collection_id = $1
		 ORDER BY created_at, document_id`,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("list collection document ids: %w", err)
	}
	defer rows.Close()

	var ids []string

	for rows.Next() {
		var documentID string

		if err := rows.Scan(&documentID); err != nil {
			return nil, fmt.Errorf("scan collection document id: %w", err)
		}

		ids = append(ids, documentID)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate collection document ids: %w", err)
	}

	return ids, nil
}

// AddDocuments adds documents to the collection in one transaction. Every id
// must be a document of workspaceID, otherwise nothing is inserted. Documents
// that are already members are ignored.
func (r *CollectionRepository) AddDocuments(
	ctx context.Context,
	id string,
	workspaceID string,
	documentIDs []string,
) error {
	unique := make([]string, 0, len(documentIDs))
	seen := make(map[string]bool, len(documentIDs))

	for _, documentID := range documentIDs {
		if !seen[documentID] {
			seen[documentID] = true
			unique = append(unique, documentID)
		}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("add collection documents: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Ids are compared as text so a malformed id is simply "not found".
	var found int

	err = tx.QueryRow(
		ctx,
		`SELECT COUNT(*)
		 FROM documents
		 WHERE workspace_id = $1
		   AND id::text = ANY($2::text[])`,
		workspaceID,
		unique,
	).Scan(&found)
	if err != nil {
		return fmt.Errorf("check collection documents: %w", err)
	}

	if found != len(unique) {
		return fmt.Errorf("document not found in this workspace")
	}

	_, err = tx.Exec(
		ctx,
		`INSERT INTO collection_documents (collection_id, document_id)
		 SELECT $1, d.id
		 FROM documents d
		 WHERE d.workspace_id = $2
		   AND d.id::text = ANY($3::text[])
		 ON CONFLICT DO NOTHING`,
		id,
		workspaceID,
		unique,
	)
	if err != nil {
		return fmt.Errorf("add collection documents: %w", err)
	}

	tag, err := tx.Exec(
		ctx,
		`UPDATE collections SET updated_at = NOW() WHERE id = $1`,
		id,
	)
	if err != nil {
		return fmt.Errorf("touch collection: %w", err)
	}

	if tag.RowsAffected() == 0 {
		return fmt.Errorf("collection not found")
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("add collection documents: %w", err)
	}

	return nil
}

// RemoveDocument takes one document out of the collection. Removing a
// document that is not a member is not an error.
func (r *CollectionRepository) RemoveDocument(
	ctx context.Context,
	id string,
	documentID string,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("remove collection document: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(
		ctx,
		`DELETE FROM collection_documents
		 WHERE collection_id = $1
		   AND document_id::text = $2`,
		id,
		documentID,
	)
	if err != nil {
		return fmt.Errorf("remove collection document: %w", err)
	}

	if tag.RowsAffected() > 0 {
		_, err = tx.Exec(
			ctx,
			`UPDATE collections SET updated_at = NOW() WHERE id = $1`,
			id,
		)
		if err != nil {
			return fmt.Errorf("touch collection: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("remove collection document: %w", err)
	}

	return nil
}
