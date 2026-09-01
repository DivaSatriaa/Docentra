package handler

import (
	"net/http"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/service"
	"github.com/gin-gonic/gin"
)

type MessageHandler struct {
	service *service.MessageService
}

func NewMessageHandler(
	service *service.MessageService,
) *MessageHandler {
	return &MessageHandler{
		service: service,
	}
}

type createMessageRequest struct {
	Content string `json:"content"`
}

func (h *MessageHandler) Create(c *gin.Context) {
	conversationID := c.Param("id")

	var req createMessageRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	result, _, err := h.service.Chat(
		c.Request.Context(),
		conversationID,
		req.Content,
	)
	if err != nil {
		if err.Error() == "conversation not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "conversation not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *MessageHandler) List(c *gin.Context) {
	conversationID := c.Param("id")

	messages, err := h.service.ListByConversation(
		c.Request.Context(),
		conversationID,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if messages == nil {
		messages = []model.Message{}
	}

	c.JSON(http.StatusOK, messages)
}

func (h *MessageHandler) GetByID(c *gin.Context) {
	id := c.Param("messageId")

	message, err := h.service.GetByID(
		c.Request.Context(),
		id,
	)
	if err != nil {
		if err.Error() == "message not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "message not found",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, message)
}
