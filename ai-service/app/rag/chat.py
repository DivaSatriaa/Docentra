from app.rag.context import build_context
from app.rag.embeddings import create_embeddings
from app.rag.generation import generate_answer
from app.rag.retriever import search_chunks


def chat(
    question: str,
    *,
    workspace_id: str,
    document_ids: list[str] | None = None,
    collection_id: str | None = None,
    top_k: int = 5,
) -> dict:
    question = question.strip()

    if not question:
        raise ValueError("question is required")

    if not workspace_id:
        raise ValueError("workspace_id is required")

    query_embedding = create_embeddings(
        [question],
    )[0]

    results = search_chunks(
        query_embedding,
        workspace_id=workspace_id,
        document_ids=document_ids,
        collection_id=collection_id,
        top_k=top_k,
    )

    if not results:
        return {
            "answer": (
                "I couldn't find enough information "
                "in the provided documents to answer "
                "that question."
            ),
            "citations": [],
        }

    context = build_context(results)

    answer = generate_answer(
        question,
        context,
    )

    citations = [
        {
            "document_id": result["document_id"],
            "document_name": result["document_name"],
            "page": result["page"],
            "chunk_id": result["chunk_id"],
            "snippet": result["text"][:500],
        }
        for result in results
    ]

    return {
        "answer": answer,
        "citations": citations,
    }