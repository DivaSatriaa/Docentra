package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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

type ChatRequest struct {
	Question     string               `json:"question"`
	WorkspaceID  string               `json:"workspace_id"`
	History      []ChatHistoryMessage `json:"history"`
	DocumentIDs  []string             `json:"document_ids,omitempty"`
	CollectionID string               `json:"collection_id,omitempty"`
	TopK         int                  `json:"top_k"`
	Provider     string               `json:"provider,omitempty"`
	Model        string               `json:"model,omitempty"`
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

type LLMProvider struct {
	ID           string   `json:"id"`
	Label        string   `json:"label"`
	Available    bool     `json:"available"`
	Error        *string  `json:"error"`
	DefaultModel *string  `json:"default_model"`
	Models       []string `json:"models"`
}

type ListProvidersResponse struct {
	Providers []LLMProvider `json:"providers"`
}

func (c *AIClient) ListProviders(
	ctx context.Context,
) (*ListProvidersResponse, error) {
	url := c.baseURL + "/internal/llm/providers"

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		url,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"create list providers request: %w",
			err,
		)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(
			"call AI providers service: %w",
			err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf(
			"AI providers service returned HTTP %d",
			resp.StatusCode,
		)
	}

	var result ListProvidersResponse

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf(
			"decode AI providers response: %w",
			err,
		)
	}

	return &result, nil
}

// AIServiceError carries the status and detail returned by the
// AI service so handlers can show the user what went wrong.
type AIServiceError struct {
	StatusCode int
	Detail     string
}

func (e *AIServiceError) Error() string {
	if e.Detail != "" {
		return e.Detail
	}

	return fmt.Sprintf(
		"AI service returned HTTP %d",
		e.StatusCode,
	)
}

type DeepSeekKeyStatus struct {
	Configured bool    `json:"configured"`
	Source     *string `json:"source"`
	MaskedKey  *string `json:"masked_key"`
	Verified   *bool   `json:"verified,omitempty"`
}

type LLMSettings struct {
	DeepSeek DeepSeekKeyStatus `json:"deepseek"`
}

type saveAPIKeyRequest struct {
	APIKey string `json:"api_key"`
}

func (c *AIClient) GetLLMSettings(
	ctx context.Context,
) (*LLMSettings, error) {
	var result LLMSettings

	err := c.doSettingsRequest(
		ctx,
		http.MethodGet,
		"/internal/settings/llm",
		nil,
		&result,
	)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func (c *AIClient) SaveDeepSeekAPIKey(
	ctx context.Context,
	apiKey string,
) (*LLMSettings, error) {
	var result LLMSettings

	err := c.doSettingsRequest(
		ctx,
		http.MethodPut,
		"/internal/settings/llm/deepseek-api-key",
		saveAPIKeyRequest{APIKey: apiKey},
		&result,
	)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func (c *AIClient) RemoveDeepSeekAPIKey(
	ctx context.Context,
) (*LLMSettings, error) {
	var result LLMSettings

	err := c.doSettingsRequest(
		ctx,
		http.MethodDelete,
		"/internal/settings/llm/deepseek-api-key",
		nil,
		&result,
	)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func (c *AIClient) doSettingsRequest(
	ctx context.Context,
	method string,
	path string,
	payload any,
	result any,
) error {
	var body io.Reader

	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf(
				"marshal settings request: %w",
				err,
			)
		}

		body = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		method,
		c.baseURL+path,
		body,
	)
	if err != nil {
		return fmt.Errorf(
			"create settings request: %w",
			err,
		)
	}

	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf(
			"call AI settings service: %w",
			err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errorBody struct {
			Detail string `json:"detail"`
		}

		_ = json.NewDecoder(resp.Body).Decode(&errorBody)

		return &AIServiceError{
			StatusCode: resp.StatusCode,
			Detail:     errorBody.Detail,
		}
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf(
			"decode AI settings response: %w",
			err,
		)
	}

	return nil
}
