from app.rag.context import build_context
from app.rag.embeddings import create_embeddings
from app.rag.generation import generate_answer
from app.rag.retriever import search_chunks


question = "What is machine learning?"

query_embedding = create_embeddings([question])[0]

results = search_chunks(
    query_embedding,
    workspace_id="5400fe40-1e5a-4d63-9ffe-06fb12621540",
    top_k=5,
)

context = build_context(results)

answer = generate_answer(
    question,
    context,
)

print("\n=== ANSWER ===")
print(answer)

print("\n=== SOURCES ===")

for result in results:
    print(
        f"- {result['document_name']}, "
        f"page {result['page']}, "
        f"similarity={result['similarity']:.4f}"
    )
