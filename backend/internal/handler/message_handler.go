package handler

import (
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/DivaSatriaa/Docentra/backend/internal/client"
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
	Content string            `json:"content"`
	Model   *client.LLMConfig `json:"model,omitempty"`

	// Optional: restrict the search to these documents.
	DocumentIDs []string `json:"document_ids,omitempty"`

	// Optional: restrict the search to this collection's documents, plus
	// any document_ids.
	CollectionID string `json:"collection_id,omitempty"`

	// Optional: also check the documents against the web.
	WebSearch bool `json:"web_search,omitempty"`
}

// chatErrorStatus maps an error returned before an answer started to an HTTP
// status.
func chatErrorStatus(err error) int {
	switch err.Error() {
	case "conversation not found", "collection not found":
		return http.StatusNotFound
	case "collection has no documents":
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
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
		req.Model,
		req.DocumentIDs,
		req.CollectionID,
		req.WebSearch,
	)
	if err != nil {
		c.JSON(chatErrorStatus(err), gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// writeSSE writes one server-sent event frame and flushes it. data must be
// single-line JSON.
func writeSSE(w io.Writer, flusher http.Flusher, event string, data []byte) error {
	if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data); err != nil {
		return err
	}

	if flusher != nil {
		flusher.Flush()
	}

	return nil
}

// CreateStream answers a message as a server-sent event stream.
func (h *MessageHandler) CreateStream(c *gin.Context) {
	var req createMessageRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	started := false

	emit := func(event client.StreamEvent) error {
		if !started {
			started = true
			header := c.Writer.Header()
			header.Set("Content-Type", "text/event-stream")
			header.Set("Cache-Control", "no-cache")
			header.Set("Connection", "keep-alive")
			header.Set("X-Accel-Buffering", "no")
			c.Status(http.StatusOK)
		}

		return writeSSE(c.Writer, c.Writer, event.Event, event.Data)
	}

	err := h.service.ChatStream(
		c.Request.Context(),
		c.Param("id"),
		req.Content,
		req.Model,
		req.DocumentIDs,
		req.CollectionID,
		req.WebSearch,
		emit,
	)
	if err == nil {
		return
	}

	if started {
		log.Printf("chat stream failed after start (conversation %s): %v", c.Param("id"), err)
		return
	}

	c.JSON(chatErrorStatus(err), gin.H{
		"error": err.Error(),
	})
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

type generateTitleRequest struct {
	Model *client.LLMConfig `json:"model,omitempty"`
}

// GenerateTitle names the conversation from its first exchange.
func (h *MessageHandler) GenerateTitle(c *gin.Context) {
	var req generateTitleRequest

	// The body is optional.
	_ = c.ShouldBindJSON(&req)

	conversation, err := h.service.GenerateTitle(
		c.Request.Context(),
		c.Param("id"),
		req.Model,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, conversation)
}
