from app.rag.chat import chat


history = [
    {
        "role": "user",
        "content": "What is machine learning?",
    },
    {
        "role": "assistant",
        "content": (
            "Machine learning is a type of artificial "
            "intelligence where algorithms learn from data."
        ),
    },
]


result = chat(
    "What are its types?",
    workspace_id="5400fe40-1e5a-4d63-9ffe-06fb12621540",
    history=history,
    top_k=5,
)


print("\n=== SEARCH QUERY ===")
print(result["search_query"])

print("\n=== ANSWER ===")
print(result["answer"])

print("\n=== SOURCES ===")

for citation in result["citations"]:
    print(
        f"- {citation['document_name']}, "
        f"page {citation['page']}"
    )
