package router

import (
	"context"
	"net/http"
	"time"

	"github.com/DivaSatriaa/Docentra/backend/internal/handler"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
	"github.com/DivaSatriaa/Docentra/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Setup(db *pgxpool.Pool) *gin.Engine {
	r := gin.Default()

	workspaceRepository := repository.NewWorkspaceRepository(db)
	workspaceService := service.NewWorkspaceService(workspaceRepository)
	workspaceHandler := handler.NewWorkspaceHandler(workspaceService)

	r.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
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

	api := r.Group("/api/v1")
	{
		workspaces := api.Group("/workspaces")
		{
			workspaces.POST("", workspaceHandler.Create)
			workspaces.GET("", workspaceHandler.List)
			workspaces.GET("/:id", workspaceHandler.GetByID)
		}
	}

	return r
}
