package handler

import (
	"net/http"

	"github.com/DivaSatriaa/Docentra/backend/internal/client"
	"github.com/gin-gonic/gin"
)

type LLMHandler struct {
	aiClient *client.AIClient
}

func NewLLMHandler(
	aiClient *client.AIClient,
) *LLMHandler {
	return &LLMHandler{
		aiClient: aiClient,
	}
}

func (h *LLMHandler) ListProviders(c *gin.Context) {
	result, err := h.aiClient.ListProviders(
		c.Request.Context(),
	)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}
