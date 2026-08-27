package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type AIClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewAIClient(baseURL string) *AIClient {
	return &AIClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 10 * time.Minute,
		},
	}
}

type ProcessDocumentRequest struct {
	DocumentID string `json:"document_id"`
}

func (c *AIClient) ProcessDocument(
	ctx context.Context,
	documentID string,
) error {
	payload := ProcessDocumentRequest{
		DocumentID: documentID,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal process document request: %w", err)
	}

	url := c.baseURL + "/internal/process-document"

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		url,
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("create AI request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call AI service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf(
			"AI service returned HTTP %d",
			resp.StatusCode,
		)
	}

	return nil
}
