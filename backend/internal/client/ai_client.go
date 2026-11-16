package client

import (
	"bufio"
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
	// Also check the documents against the web.
	WebSearch bool `json:"web_search,omitempty"`
}

type Citation struct {
	Source     int     `json:"source,omitempty"`
	Similarity float64 `json:"similarity,omitempty"`
	// "document" or "web". Older stored citations have none: a document.
	Kind string `json:"kind,omitempty"`
	// Web sources only.
	URL   string `json:"url,omitempty"`
	Title string `json:"title,omitempty"`
	// Document sources only (empty for web sources).
	DocumentID   string `json:"document_id"`
	DocumentName string `json:"document_name"`
	Page         int    `json:"page"`
	ChunkID      string `json:"chunk_id"`
	Snippet      string `json:"snippet"`
	// Exact passages of the document the answer relied on, for highlighting.
	Highlights []string `json:"highlights,omitempty"`
}

type ChatResponse struct {
	Answer      string     `json:"answer"`
	Citations   []Citation `json:"citations"`
	SearchQuery string     `json:"search_query"`
	Scope       []string   `json:"scope"`
	// What happened with the web search, when one was requested.
	Web json.RawMessage `json:"web,omitempty"`
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

// StreamEvent is one server-sent event from the AI service.
type StreamEvent struct {
	Event string
	Data  json.RawMessage
}

// StreamDone is the payload of the final "done" event.
type StreamDone struct {
	ChatResponse
	MessageID string `json:"message_id,omitempty"`
}

// readSSE parses server-sent event frames from r and calls onEvent for each.
// Lines are read with bufio.Reader so arbitrarily large data lines are kept.
func readSSE(r io.Reader, onEvent func(StreamEvent) error) error {
	reader := bufio.NewReader(r)

	var (
		event   string
		data    []string
		hasData bool
	)

	dispatch := func() error {
		defer func() {
			event = ""
			data = nil
			hasData = false
		}()
		if !hasData {
			return nil
		}
		return onEvent(StreamEvent{
			Event: event,
			Data:  json.RawMessage(strings.Join(data, "\n")),
		})
	}

	for {
		line, readErr := reader.ReadString('\n')
		if readErr != nil && readErr != io.EOF {
			return readErr
		}

		if line != "" || readErr == nil {
			line = strings.TrimSuffix(line, "\n")
			line = strings.TrimSuffix(line, "\r")

			switch {
			case line == "":
				if err := dispatch(); err != nil {
					return err
				}
			case strings.HasPrefix(line, ":"):
				// comment / keepalive
			default:
				field, value, _ := strings.Cut(line, ":")
				value = strings.TrimPrefix(value, " ")
				switch field {
				case "event":
					event = value
				case "data":
					data = append(data, value)
					hasData = true
				}
			}
		}

		if readErr == io.EOF {
			return dispatch()
		}
	}
}

// ChatStream posts the question to the AI service and calls onEvent for every
// server-sent event. Cancelling ctx aborts the upstream request.
func (c *AIClient) ChatStream(
	ctx context.Context,
	request ChatRequest,
	onEvent func(StreamEvent) error,
) error {
	if request.TopK <= 0 {
		request.TopK = 5
	}

	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("marshal chat request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/internal/chat/stream",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("create chat stream request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call AI chat service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("AI chat service returned HTTP %d", resp.StatusCode)
	}

	return readSSE(resp.Body, onEvent)
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

type titleRequest struct {
	Question string     `json:"question"`
	Answer   string     `json:"answer"`
	LLM      *LLMConfig `json:"llm,omitempty"`
}

// GenerateTitle asks the AI service for a short chat title.
func (c *AIClient) GenerateTitle(
	ctx context.Context,
	question string,
	answer string,
	llm *LLMConfig,
) (string, error) {
	body, err := json.Marshal(titleRequest{
		Question: question,
		Answer:   answer,
		LLM:      llm,
	})
	if err != nil {
		return "", fmt.Errorf("marshal title request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/internal/title",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("create title request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call AI service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("AI title service returned HTTP %d", resp.StatusCode)
	}

	var result struct {
		Title string `json:"title"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode title response: %w", err)
	}

	return result.Title, nil
}
