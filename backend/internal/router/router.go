package router

import (
	"context"
	"net/http"
	"time"

	"github.com/DivaSatriaa/Docentra/backend/internal/client"
	"github.com/DivaSatriaa/Docentra/backend/internal/handler"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
	"github.com/DivaSatriaa/Docentra/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Setup(
	db *pgxpool.Pool,
	aiClient *client.AIClient,
) *gin.Engine {
	r := gin.Default()

	// =========================
	// Dependencies
	// =========================

	workspaceRepository := repository.NewWorkspaceRepository(db)
	workspaceService := service.NewWorkspaceService(
		workspaceRepository,
	)
	workspaceHandler := handler.NewWorkspaceHandler(
		workspaceService,
	)

	documentRepository := repository.NewDocumentRepository(db)
	documentService := service.NewDocumentService(
		documentRepository,
		aiClient,
	)
	documentHandler := handler.NewDocumentHandler(
		documentService,
	)

	conversationRepository := repository.NewConversationRepository(db)
	conversationService := service.NewConversationService(
		conversationRepository,
	)
	conversationHandler := handler.NewConversationHandler(
		conversationService,
	)

	messageRepository := repository.NewMessageRepository(db)
	messageService := service.NewMessageService(
		messageRepository,
	)
	messageHandler := handler.NewMessageHandler(
		messageService,
	)

	// =========================
	// Health
	// =========================

	r.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(
			c.Request.Context(),
			2*time.Second,
		)
		defer cancel()

		if err := db.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":   "error",
				"service":  "docentra-api",
				"database": "unhealthy",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"service":  "docentra-api",
			"database": "ok",
		})
	})

	// =========================
	// API v1
	// =========================

	api := r.Group("/api/v1")

	// =========================
	// Workspaces
	// =========================

	workspaces := api.Group("/workspaces")
	{
		workspaces.POST(
			"",
			workspaceHandler.Create,
		)

		workspaces.GET(
			"",
			workspaceHandler.List,
		)

		workspaces.GET(
			"/:id",
			workspaceHandler.GetByID,
		)

		// =====================
		// Documents
		// =====================

		workspaces.POST(
			"/:id/documents",
			documentHandler.Create,
		)

		workspaces.GET(
			"/:id/documents",
			documentHandler.List,
		)

		// =====================
		// Conversations
		// =====================

		workspaces.POST(
			"/:id/conversations",
			conversationHandler.Create,
		)

		workspaces.GET(
			"/:id/conversations",
			conversationHandler.List,
		)
	}

	// =========================
	// Conversations
	// =========================

	conversations := api.Group("/conversations")
	{
		conversations.GET(
			"/:id",
			conversationHandler.GetByID,
		)

		// =====================
		// Messages
		// =====================

		conversations.POST(
			"/:id/messages",
			messageHandler.Create,
		)

		conversations.GET(
			"/:id/messages",
			messageHandler.List,
		)

		conversations.GET(
			"/:id/messages/:messageId",
			messageHandler.GetByID,
		)
	}

	return r
}
