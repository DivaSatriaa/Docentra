package handler

import (
	"errors"
	"net/http"
	"strings"

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

type saveAPIKeyRequest struct {
	APIKey string `json:"api_key"`
}

func (h *LLMHandler) GetSettings(c *gin.Context) {
	result, err := h.aiClient.GetLLMSettings(
		c.Request.Context(),
	)
	if err != nil {
		respondAIError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *LLMHandler) SaveDeepSeekAPIKey(c *gin.Context) {
	var req saveAPIKeyRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	apiKey := strings.TrimSpace(req.APIKey)

	if apiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "api_key is required",
		})
		return
	}

	result, err := h.aiClient.SaveDeepSeekAPIKey(
		c.Request.Context(),
		apiKey,
	)
	if err != nil {
		respondAIError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *LLMHandler) RemoveDeepSeekAPIKey(c *gin.Context) {
	result, err := h.aiClient.RemoveDeepSeekAPIKey(
		c.Request.Context(),
	)
	if err != nil {
		respondAIError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

func respondAIError(c *gin.Context, err error) {
	var aiErr *client.AIServiceError

	if errors.As(err, &aiErr) &&
		aiErr.StatusCode >= 400 &&
		aiErr.StatusCode < 500 {
		c.JSON(aiErr.StatusCode, gin.H{
			"error": aiErr.Error(),
		})
		return
	}

	c.JSON(http.StatusBadGateway, gin.H{
		"error": err.Error(),
	})
}
