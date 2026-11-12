package service

import (
	"context"
	"fmt"
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
	)
}

func (s *MessageService) Chat(
	ctx context.Context,
	conversationID string,
	content string,
	llm *client.LLMConfig,
	documentIDs []string,
) (*client.ChatResponse, *model.Message, error) {
	conversationID = strings.TrimSpace(conversationID)
	content = strings.TrimSpace(content)

	if conversationID == "" {
		return nil, nil, fmt.Errorf("conversation_id is required")
	}

	if content == "" {
		return nil, nil, fmt.Errorf("content is required")
	}

	conversation, err := s.conversationRepository.GetByID(
		ctx,
		conversationID,
	)
	if err != nil {
		return nil, nil, err
	}

	history, err := s.repository.ListByConversation(
		ctx,
		conversationID,
	)
	if err != nil {
		return nil, nil, err
	}

	userMessage, err := s.CreateUserMessage(
		ctx,
		conversationID,
		content,
	)
	if err != nil {
		return nil, nil, err
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
		TopK:        5,
		LLM:         llm,
		DocumentIDs: documentIDs,
	}

	aiResponse, err := s.aiClient.Chat(
		ctx,
		aiRequest,
	)
	if err != nil {
		return nil, userMessage, err
	}

	assistantMessage, err := s.repository.Create(
		ctx,
		conversationID,
		"assistant",
		aiResponse.Answer,
	)
	if err != nil {
		return nil, userMessage, err
	}

	return aiResponse, assistantMessage, nil
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
