from app.rag.query_rewriter import rewrite_query


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

question = "What are its types?"

rewritten = rewrite_query(
    question,
    history,
)

print("Original :", question)
print("Rewritten:", rewritten)
