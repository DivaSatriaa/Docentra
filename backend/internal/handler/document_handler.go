package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DocumentHandler struct {
	service *service.DocumentService
}

func NewDocumentHandler(service *service.DocumentService) *DocumentHandler {
	return &DocumentHandler{
		service: service,
	}
}

func (h *DocumentHandler) Create(c *gin.Context) {
	workspaceID := strings.TrimSpace(c.PostForm("workspace_id"))

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "workspace_id is required",
		})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "file is required",
		})
		return
	}

	if fileHeader.Size <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "file must not be empty",
		})
		return
	}

	allowedExtensions := map[string]bool{
		".pdf":  true,
		".doc":  true,
		".docx": true,
		".txt":  true,
		".md":   true,
		".csv":  true,
		".xlsx": true,
		".pptx": true,
	}

	extension := strings.ToLower(filepath.Ext(fileHeader.Filename))

	if !allowedExtensions[extension] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unsupported file type",
		})
		return
	}

	storageDir := filepath.Join(
		"storage",
		"documents",
		workspaceID,
	)

	if err := os.MkdirAll(storageDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create storage directory",
		})
		return
	}

	storedName := uuid.NewString() + extension
	storagePath := filepath.Join(storageDir, storedName)

	if err := c.SaveUploadedFile(fileHeader, storagePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to save file",
		})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")

	if mimeType == "" {
		mimeType = mimeTypeFromExtension(extension)
	}

	document, err := h.service.Create(
		c.Request.Context(),
		workspaceID,
		fileHeader.Filename,
		fileHeader.Filename,
		mimeType,
		fileHeader.Size,
		storagePath,
	)

	if err != nil {
		_ = os.Remove(storagePath)

		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, document)
}

func mimeTypeFromExtension(extension string) string {
	switch extension {
	case ".pdf":
		return "application/pdf"
	case ".txt":
		return "text/plain"
	case ".md":
		return "text/markdown"
	case ".csv":
		return "text/csv"
	case ".doc":
		return "application/msword"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	default:
		return "application/octet-stream"
	}
}

func (h *DocumentHandler) List(c *gin.Context) {
	workspaceID := c.Param("id")

	documents, err := h.service.ListByWorkspace(
		c.Request.Context(),
		workspaceID,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if documents == nil {
		documents = []model.Document{}
	}

	c.JSON(http.StatusOK, documents)
}
