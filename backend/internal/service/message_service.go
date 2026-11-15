package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/DivaSatriaa/Docentra/backend/internal/client"
	"github.com/DivaSatriaa/Docentra/backend/internal/model"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
)

type MessageService struct {
	repository             *repository.MessageRepository
	conversationRepository *repository.ConversationRepository
	aiClient               *client.AIClient
}

func NewMessageService(
	repository *repository.MessageRepository,
	conversationRepository *repository.ConversationRepository,
	aiClient *client.AIClient,
) *MessageService {
	return &MessageService{
		repository:             repository,
		conversationRepository: conversationRepository,
		aiClient:               aiClient,
	}
}

func (s *MessageService) CreateUserMessage(
	ctx context.Context,
	conversationID string,
	content string,
) (*model.Message, error) {
	conversationID = strings.TrimSpace(conversationID)
	content = strings.TrimSpace(content)

	if conversationID == "" {
		return nil, fmt.Errorf("conversation_id is required")
	}

	if content == "" {
		return nil, fmt.Errorf("content is required")
	}

	return s.repository.Create(
		ctx,
		conversationID,
		"user",
		content,
		nil,
	)
}

// prepareChat validates the input, loads the conversation and history, saves
// the user message and builds the request for the AI service.
func (s *MessageService) prepareChat(
	ctx context.Context,
	conversationID string,
	content string,
	llm *client.LLMConfig,
	documentIDs []string,
) (string, client.ChatRequest, *model.Message, error) {
	conversationID = strings.TrimSpace(conversationID)
	content = strings.TrimSpace(content)

	if conversationID == "" {
		return "", client.ChatRequest{}, nil, fmt.Errorf("conversation_id is required")
	}

	if content == "" {
		return "", client.ChatRequest{}, nil, fmt.Errorf("content is required")
	}

	conversation, err := s.conversationRepository.GetByID(
		ctx,
		conversationID,
	)
	if err != nil {
		return "", client.ChatRequest{}, nil, err
	}

	history, err := s.repository.ListByConversation(
		ctx,
		conversationID,
	)
	if err != nil {
		return "", client.ChatRequest{}, nil, err
	}

	userMessage, err := s.CreateUserMessage(
		ctx,
		conversationID,
		content,
	)
	if err != nil {
		return "", client.ChatRequest{}, nil, err
	}

	aiHistory := make(
		[]client.ChatHistoryMessage,
		0,
		len(history),
	)

	for _, message := range history {
		aiHistory = append(
			aiHistory,
			client.ChatHistoryMessage{
				Role:    message.Role,
				Content: message.Content,
			},
		)
	}

	aiRequest := client.ChatRequest{
		Question:    content,
		WorkspaceID: conversation.WorkspaceID,
		History:     aiHistory,
		TopK:        8,
		LLM:         llm,
		DocumentIDs: documentIDs,
	}

	return conversationID, aiRequest, userMessage, nil
}

// saveAssistantMessage stores an assistant answer with its citations.
func (s *MessageService) saveAssistantMessage(
	ctx context.Context,
	conversationID string,
	response *client.ChatResponse,
) (*model.Message, error) {
	var citations json.RawMessage
	if len(response.Citations) > 0 {
		var err error
		citations, err = json.Marshal(response.Citations)
		if err != nil {
			return nil, fmt.Errorf("encode citations: %w", err)
		}
	}

	return s.repository.Create(
		ctx,
		conversationID,
		"assistant",
		response.Answer,
		citations,
	)
}

func (s *MessageService) Chat(
	ctx context.Context,
	conversationID string,
	content string,
	llm *client.LLMConfig,
	documentIDs []string,
) (*client.ChatResponse, *model.Message, error) {
	conversationID, aiRequest, userMessage, err := s.prepareChat(
		ctx,
		conversationID,
		content,
		llm,
		documentIDs,
	)
	if err != nil {
		return nil, nil, err
	}

	aiResponse, err := s.aiClient.Chat(
		ctx,
		aiRequest,
	)
	if err != nil {
		return nil, userMessage, err
	}

	assistantMessage, err := s.saveAssistantMessage(
		ctx,
		conversationID,
		aiResponse,
	)
	if err != nil {
		return nil, userMessage, err
	}

	return aiResponse, assistantMessage, nil
}

func errorEvent(message string) client.StreamEvent {
	data, _ := json.Marshal(map[string]string{"message": message})
	return client.StreamEvent{Event: "error", Data: data}
}

// ChatStream is the streaming variant of Chat. Preparation errors are
// returned without calling emit. The assistant message is saved only when
// the AI service sends its final "done" event.
func (s *MessageService) ChatStream(
	ctx context.Context,
	conversationID string,
	content string,
	llm *client.LLMConfig,
	documentIDs []string,
	emit func(client.StreamEvent) error,
) error {
	conversationID, aiRequest, _, err := s.prepareChat(
		ctx,
		conversationID,
		content,
		llm,
		documentIDs,
	)
	if err != nil {
		return err
	}

	finished := false
	emitted := false

	err = s.aiClient.ChatStream(
		ctx,
		aiRequest,
		func(event client.StreamEvent) error {
			emitted = true

			switch event.Event {
			case "done":
				finished = true

				var done client.StreamDone
				if err := json.Unmarshal(event.Data, &done); err != nil {
					return emit(errorEvent("invalid response from AI service"))
				}

				message, err := s.saveAssistantMessage(
					ctx,
					conversationID,
					&done.ChatResponse,
				)
				if err != nil {
					log.Printf("chat stream: save assistant message failed (conversation %s): %v", conversationID, err)
					return emit(errorEvent(err.Error()))
				}

				done.MessageID = message.ID

				data, err := json.Marshal(done)
				if err != nil {
					return emit(errorEvent(err.Error()))
				}

				return emit(client.StreamEvent{Event: "done", Data: data})

			case "error":
				finished = true

				var failure struct {
					Message string `json:"message"`
				}
				_ = json.Unmarshal(event.Data, &failure)
				log.Printf("chat stream: AI service error (conversation %s): %s", conversationID, failure.Message)

				return emit(event)

			default:
				return emit(event)
			}
		},
	)
	if err != nil {
		// The connection broke after the AI service had already started
		// answering: tell the client instead of silently cutting the stream.
		if ctx.Err() == nil && emitted && !finished {
			log.Printf("chat stream: stream ended unexpectedly (conversation %s): %v", conversationID, err)
			return emit(errorEvent("stream ended unexpectedly"))
		}

		return err
	}

	if ctxErr := ctx.Err(); ctxErr != nil {
		return ctxErr
	}

	if !finished {
		log.Printf("chat stream: stream ended unexpectedly without a final event (conversation %s)", conversationID)
		return emit(errorEvent("stream ended unexpectedly"))
	}

	return nil
}

func (s *MessageService) ListByConversation(
	ctx context.Context,
	conversationID string,
) ([]model.Message, error) {
	conversationID = strings.TrimSpace(conversationID)

	if conversationID == "" {
		return nil, fmt.Errorf("conversation_id is required")
	}

	return s.repository.ListByConversation(
		ctx,
		conversationID,
	)
}

func (s *MessageService) GetByID(
	ctx context.Context,
	id string,
) (*model.Message, error) {
	id = strings.TrimSpace(id)

	if id == "" {
		return nil, fmt.Errorf("message id is required")
	}

	return s.repository.GetByID(ctx, id)
}

const defaultChatTitle = "New Chat"

// GenerateTitle names a conversation after its first exchange. It only
// renames chats that still have the default title, so it is safe to call
// more than once. If the AI service fails, it falls back to the question.
func (s *MessageService) GenerateTitle(
	ctx context.Context,
	conversationID string,
	llm *client.LLMConfig,
) (*model.Conversation, error) {
	conversationID = strings.TrimSpace(conversationID)

	conversation, err := s.conversationRepository.GetByID(
		ctx,
		conversationID,
	)
	if err != nil {
		return nil, err
	}

	if conversation.Title != nil {
		current := strings.TrimSpace(*conversation.Title)
		if current != "" && current != defaultChatTitle {
			return conversation, nil
		}
	}

	messages, err := s.repository.ListByConversation(
		ctx,
		conversationID,
	)
	if err != nil {
		return nil, err
	}

	var question, answer string

	for _, message := range messages {
		if question == "" && message.Role == "user" {
			question = message.Content
		}

		if answer == "" && message.Role == "assistant" {
			answer = message.Content
		}
	}

	if question == "" {
		return conversation, nil
	}

	title, err := s.aiClient.GenerateTitle(ctx, question, answer, llm)
	if err != nil || strings.TrimSpace(title) == "" {
		title = fallbackTitle(question)
	}

	return s.conversationRepository.UpdateTitle(
		ctx,
		conversationID,
		strings.TrimSpace(title),
	)
}

func fallbackTitle(question string) string {
	title := strings.Join(strings.Fields(question), " ")
	runes := []rune(title)

	if len(runes) > 40 {
		title = strings.TrimSpace(string(runes[:40])) + "..."
	}

	return title
}
