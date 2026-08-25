package handler

import (
	"net/http"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/service"
	"github.com/gin-gonic/gin"
)

type WorkspaceHandler struct {
	service *service.WorkspaceService
}

func NewWorkspaceHandler(service *service.WorkspaceService) *WorkspaceHandler {
	return &WorkspaceHandler{
		service: service,
	}
}

type createWorkspaceRequest struct {
	OwnerID     string  `json:"owner_id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

func (h *WorkspaceHandler) Create(c *gin.Context) {
	var req createWorkspaceRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	workspace, err := h.service.Create(
		c.Request.Context(),
		req.OwnerID,
		req.Name,
		req.Description,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, workspace)
}

func (h *WorkspaceHandler) List(c *gin.Context) {
	ownerID := c.Query("owner_id")

	workspaces, err := h.service.List(
		c.Request.Context(),
		ownerID,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if workspaces == nil {
		workspaces = []model.Workspace{}
	}

	c.JSON(http.StatusOK, workspaces)
}

func (h *WorkspaceHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	workspace, err := h.service.GetByID(
		c.Request.Context(),
		id,
	)
	if err != nil {
		if err.Error() == "workspace not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "workspace not found",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, workspace)
}
