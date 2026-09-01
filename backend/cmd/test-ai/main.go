package main

import (
	"context"
	"fmt"
	"log"

	"github.com/DivaSatriaa/Docentra/backend/internal/client"
)

func main() {
	aiClient := client.NewAIClient(
		"http://localhost:8000",
	)

	ctx := context.Background()

	result, err := aiClient.Chat(
		ctx,
		client.ChatRequest{
			Question: "What is machine learning?",
			WorkspaceID: "5400fe40-1e5a-4d63-9ffe-06fb12621540",
			History: []client.ChatHistoryMessage{
				{
					Role:    "user",
					Content: "What is machine learning?",
				},
			},
			TopK: 5,
		},
	)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("=== ANSWER ===")
	fmt.Println(result.Answer)

	fmt.Println("\n=== SEARCH QUERY ===")
	fmt.Println(result.SearchQuery)

	fmt.Println("\n=== SOURCES ===")

	for _, citation := range result.Citations {
		fmt.Printf(
			"- %s, page %d\n",
			citation.DocumentName,
			citation.Page,
		)
	}
}
