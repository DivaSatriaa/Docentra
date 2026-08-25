package repository

import (
	"context"
	"fmt"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkspaceRepository struct {
	db *pgxpool.Pool
}

func NewWorkspaceRepository(db *pgxpool.Pool) *WorkspaceRepository {
	return &WorkspaceRepository{db: db}
}

func (r *WorkspaceRepository) Create(
	ctx context.Context,
	ownerID string,
	name string,
	description *string,
) (*model.Workspace, error) {
	var workspace model.Workspace

	query := `
		INSERT INTO workspaces (
			owner_id,
			name,
			description
		)
		VALUES ($1, $2, $3)
		RETURNING
			id,
			owner_id,
			name,
			description,
			created_at,
			updated_at
	`

	err := r.db.QueryRow(
		ctx,
		query,
		ownerID,
		name,
		description,
	).Scan(
		&workspace.ID,
		&workspace.OwnerID,
		&workspace.Name,
		&workspace.Description,
		&workspace.CreatedAt,
		&workspace.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("create workspace: %w", err)
	}

	return &workspace, nil
}

func (r *WorkspaceRepository) ListByOwner(
	ctx context.Context,
	ownerID string,
) ([]model.Workspace, error) {
	query := `
		SELECT
			id,
			owner_id,
			name,
			description,
			created_at,
			updated_at
		FROM workspaces
		WHERE owner_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, ownerID)
	if err != nil {
		return nil, fmt.Errorf("list workspaces: %w", err)
	}
	defer rows.Close()

	var workspaces []model.Workspace

	for rows.Next() {
		var workspace model.Workspace

		if err := rows.Scan(
			&workspace.ID,
			&workspace.OwnerID,
			&workspace.Name,
			&workspace.Description,
			&workspace.CreatedAt,
			&workspace.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan workspace: %w", err)
		}

		workspaces = append(workspaces, workspace)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate workspaces: %w", err)
	}

	return workspaces, nil
}

func (r *WorkspaceRepository) GetByID(
	ctx context.Context,
	id string,
) (*model.Workspace, error) {
	query := `
		SELECT
			id,
			owner_id,
			name,
			description,
			created_at,
			updated_at
		FROM workspaces
		WHERE id = $1
	`

	var workspace model.Workspace

	err := r.db.QueryRow(ctx, query, id).Scan(
		&workspace.ID,
		&workspace.OwnerID,
		&workspace.Name,
		&workspace.Description,
		&workspace.CreatedAt,
		&workspace.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("workspace not found")
		}

		return nil, fmt.Errorf("get workspace: %w", err)
	}

	return &workspace, nil
}
