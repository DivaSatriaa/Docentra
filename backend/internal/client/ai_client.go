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
			Timeout: 15 * time.Minute,
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
		return fmt.Errorf(
			"marshal process document request: %w",
			err,
		)
	}

	url := c.baseURL + "/internal/process-document"

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		url,
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf(
			"create AI request: %w",
			err,
		)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf(
			"call AI service: %w",
			err,
		)
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

type ChatHistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type LLMConfig struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	APIKey   string `json:"api_key,omitempty"`
	BaseURL  string `json:"base_url,omitempty"`
}

type ChatRequest struct {
	Question     string               `json:"question"`
	WorkspaceID  string               `json:"workspace_id"`
	History      []ChatHistoryMessage `json:"history"`
	DocumentIDs  []string             `json:"document_ids,omitempty"`
	CollectionID string               `json:"collection_id,omitempty"`
	TopK         int                  `json:"top_k"`
	LLM          *LLMConfig           `json:"llm,omitempty"`
}

type Citation struct {
	DocumentID   string `json:"document_id"`
	DocumentName string `json:"document_name"`
	Page         int    `json:"page"`
	ChunkID      string `json:"chunk_id"`
	Snippet      string `json:"snippet"`
}

type ChatResponse struct {
	Answer      string     `json:"answer"`
	Citations   []Citation `json:"citations"`
	SearchQuery string     `json:"search_query"`
}

func (c *AIClient) Chat(
	ctx context.Context,
	request ChatRequest,
) (*ChatResponse, error) {
	if request.TopK <= 0 {
		request.TopK = 5
	}

	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf(
			"marshal chat request: %w",
			err,
		)
	}

	url := c.baseURL + "/internal/chat"

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		url,
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf(
			"create chat request: %w",
			err,
		)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(
			"call AI chat service: %w",
			err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf(
			"AI chat service returned HTTP %d",
			resp.StatusCode,
		)
	}

	var result ChatResponse

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf(
			"decode AI chat response: %w",
			err,
		)
	}

	return &result, nil
}

type listModelsRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"api_key,omitempty"`
	BaseURL  string `json:"base_url,omitempty"`
}

type listModelsResponse struct {
	Models []string `json:"models"`
}

// ErrorWithStatus carries the AI service's HTTP status and message.
type ErrorWithStatus struct {
	Status  int
	Message string
}

func (e *ErrorWithStatus) Error() string { return e.Message }

func (c *AIClient) ListModels(
	ctx context.Context,
	provider string,
	apiKey string,
	baseURL string,
) ([]string, error) {
	body, err := json.Marshal(listModelsRequest{
		Provider: provider,
		APIKey:   apiKey,
		BaseURL:  baseURL,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal list models request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/internal/models",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("create list models request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call AI service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var failure struct {
			Detail string `json:"detail"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&failure)

		return nil, &ErrorWithStatus{
			Status:  resp.StatusCode,
			Message: failure.Detail,
		}
	}

	var result listModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode list models response: %w", err)
	}

	return result.Models, nil
}
