package handler

import (
	"errors"
	"net/http"

	"github.com/DivaSatriaa/Docentra/backend/internal/client"
	"github.com/gin-gonic/gin"
)

type ModelHandler struct {
	aiClient *client.AIClient
}

func NewModelHandler(aiClient *client.AIClient) *ModelHandler {
	return &ModelHandler{aiClient: aiClient}
}

type listModelsRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"api_key"`
	BaseURL  string `json:"base_url"`
}

// List returns the models available for a provider ("ollama" for local).
// It is a POST so the API key never ends up in a URL or access log.
func (h *ModelHandler) List(c *gin.Context) {
	var req listModelsRequest

	if err := c.ShouldBindJSON(&req); err != nil || req.Provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "provider is required",
		})
		return
	}

	models, err := h.aiClient.ListModels(
		c.Request.Context(),
		req.Provider,
		req.APIKey,
		req.BaseURL,
	)
	if err != nil {
		status := http.StatusBadGateway

		var aiErr *client.ErrorWithStatus
		if errors.As(err, &aiErr) {
			message := aiErr.Message
			if message == "" {
				message = "could not list models"
			}

			if aiErr.Status == http.StatusBadRequest {
				status = http.StatusBadRequest
			}

			c.JSON(status, gin.H{"error": message})
			return
		}

		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	if models == nil {
		models = []string{}
	}

	c.JSON(http.StatusOK, gin.H{"models": models})
}
