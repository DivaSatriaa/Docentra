package handler

import (
	"net/http"

	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/service"
	"github.com/gin-gonic/gin"
)

type CollectionHandler struct {
	service *service.CollectionService
}

func NewCollectionHandler(
	service *service.CollectionService,
) *CollectionHandler {
	return &CollectionHandler{
		service: service,
	}
}

// collectionErrorStatus maps a collection service error to an HTTP status.
func collectionErrorStatus(err error) int {
	if err.Error() == "collection not found" {
		return http.StatusNotFound
	}

	return http.StatusBadRequest
}

func collectionError(c *gin.Context, err error) {
	c.JSON(collectionErrorStatus(err), gin.H{
		"error": err.Error(),
	})
}

type createCollectionRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

func (h *CollectionHandler) Create(c *gin.Context) {
	var req createCollectionRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	collection, err := h.service.Create(
		c.Request.Context(),
		c.Param("id"),
		req.Name,
		req.Description,
	)
	if err != nil {
		collectionError(c, err)
		return
	}

	c.JSON(http.StatusCreated, collection)
}

func (h *CollectionHandler) List(c *gin.Context) {
	collections, err := h.service.List(
		c.Request.Context(),
		c.Param("id"),
	)
	if err != nil {
		collectionError(c, err)
		return
	}

	if collections == nil {
		collections = []model.Collection{}
	}

	c.JSON(http.StatusOK, collections)
}

func (h *CollectionHandler) Get(c *gin.Context) {
	detail, err := h.service.Get(
		c.Request.Context(),
		c.Param("collectionId"),
	)
	if err != nil {
		collectionError(c, err)
		return
	}

	c.JSON(http.StatusOK, detail)
}

// updateCollectionRequest uses pointers so an absent field stays unchanged.
type updateCollectionRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

func (h *CollectionHandler) Update(c *gin.Context) {
	var req updateCollectionRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	collection, err := h.service.Update(
		c.Request.Context(),
		c.Param("collectionId"),
		req.Name,
		req.Description,
	)
	if err != nil {
		collectionError(c, err)
		return
	}

	c.JSON(http.StatusOK, collection)
}

func (h *CollectionHandler) Delete(c *gin.Context) {
	err := h.service.Delete(
		c.Request.Context(),
		c.Param("collectionId"),
	)
	if err != nil {
		collectionError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

type addCollectionDocumentsRequest struct {
	DocumentIDs []string `json:"document_ids"`
}

func (h *CollectionHandler) AddDocuments(c *gin.Context) {
	var req addCollectionDocumentsRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	if len(req.DocumentIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "document_ids is required",
		})
		return
	}

	detail, err := h.service.AddDocuments(
		c.Request.Context(),
		c.Param("collectionId"),
		req.DocumentIDs,
	)
	if err != nil {
		collectionError(c, err)
		return
	}

	c.JSON(http.StatusOK, detail)
}

func (h *CollectionHandler) RemoveDocument(c *gin.Context) {
	err := h.service.RemoveDocument(
		c.Request.Context(),
		c.Param("collectionId"),
		c.Param("documentId"),
	)
	if err != nil {
		collectionError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}
