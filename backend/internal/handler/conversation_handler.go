package handler

import (
	"net/http"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/service"
	"github.com/gin-gonic/gin"
)

type ConversationHandler struct {
	service *service.ConversationService
}

func NewConversationHandler(
	service *service.ConversationService,
) *ConversationHandler {
	return &ConversationHandler{
		service: service,
	}
}

type createConversationRequest struct {
	Title *string `json:"title"`
}

func (h *ConversationHandler) Create(c *gin.Context) {
	workspaceID := c.Param("id")

	var req createConversationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	conversation, err := h.service.Create(
		c.Request.Context(),
		workspaceID,
		req.Title,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, conversation)
}

func (h *ConversationHandler) List(c *gin.Context) {
	workspaceID := c.Param("id")

	conversations, err := h.service.ListByWorkspace(
		c.Request.Context(),
		workspaceID,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if conversations == nil {
		conversations = []model.Conversation{}
	}

	c.JSON(http.StatusOK, conversations)
}

func (h *ConversationHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	conversation, err := h.service.GetByID(
		c.Request.Context(),
		id,
	)
	if err != nil {
		if err.Error() == "conversation not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "conversation not found",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, conversation)
}
