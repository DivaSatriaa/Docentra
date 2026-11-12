import os
import re

from app.rag.context import build_context
from app.rag.doc_match import list_documents, match_documents
from app.rag.embeddings import create_embeddings
from app.rag.lang import not_found_message
from app.rag.generation import generate_answer
from app.rag.query_rewriter import rewrite_query
from app.rag.retriever import hybrid_search_chunks
from app.rag.snippet import best_snippet


# Chunks below this cosine similarity are never used.
MIN_SIMILARITY = float(os.getenv("RAG_MIN_SIMILARITY", "0.25"))

# ...and chunks far weaker than the best match are dropped too.
RELATIVE_MARGIN = float(os.getenv("RAG_RELATIVE_MARGIN", "0.15"))

# Fetch more candidates than we keep, then filter.
CANDIDATE_MULTIPLIER = 2

# A chunk found by keyword match alone (weak vector similarity) is still kept
# if it is among the top keyword hits and at least this similar to the query.
KEYWORD_KEEP_RANK = int(os.getenv("RAG_KEYWORD_KEEP_RANK", "5"))
KEYWORD_MIN_SIMILARITY = float(os.getenv("RAG_KEYWORD_MIN_SIMILARITY", "0.18"))

# If the model itself says it can't answer, don't attach sources.
_CANNOT_ANSWER = (
    "don't have enough information",
    "do not have enough information",
    "couldn't find enough information",
    "not enough information",
    "tidak memiliki informasi yang cukup",
    "tidak menemukan informasi",
    "tidak ada informasi yang cukup",
    "informasi tidak cukup",
)

# When the model cites nothing, fall back to this many top sources.
FALLBACK_CITATIONS = 2

_CITATION_GROUP = re.compile(r"\[([^\]]{1,40})\]")
_CITATION_BODY = re.compile(
    r"^(?:source\s*)?\d+(?:\s*[,;]\s*(?:source\s*)?\d+)*$",
    re.IGNORECASE,
)


def extract_cited_sources(answer: str, max_source: int) -> list[int]:
    """Source numbers the answer cites, like [1] or [Source 2, 3], in order."""
    cited: list[int] = []

    for group in _CITATION_GROUP.findall(answer):
        if not _CITATION_BODY.match(group.strip()):
            continue

        for number in re.findall(r"\d+", group):
            value = int(number)
            if 1 <= value <= max_source and value not in cited:
                cited.append(value)

    return cited


def chat(
    question: str,
    *,
    workspace_id: str,
    history: list[dict] | None = None,
    document_ids: list[str] | None = None,
    collection_id: str | None = None,
    top_k: int = 5,
    llm: dict | None = None,
) -> dict:
    question = question.strip()

    if not question:
        raise ValueError("question is required")

    if not workspace_id:
        raise ValueError("workspace_id is required")

    history = history or []

    # If the user named a file in the question, search only that file.
    scope: list[str] = []

    if not document_ids:
        matched = match_documents(
            question,
            list_documents(workspace_id),
        )

        if matched:
            document_ids = [document_id for document_id, _ in matched]
            scope = [name for _, name in matched]

    # Rewrite follow-up questions into standalone search queries.
    search_query = rewrite_query(
        question,
        history,
        llm,
    )

    query_embedding = create_embeddings(
        [search_query],
    )[0]

    def retrieve(ids: list[str] | None) -> list[dict]:
        candidates = hybrid_search_chunks(
            query_embedding,
            search_query,
            workspace_id=workspace_id,
            document_ids=ids,
            collection_id=collection_id,
            top_k=top_k * CANDIDATE_MULTIPLIER,
        )

        if not candidates:
            return []

        best = max(result["similarity"] for result in candidates)
        floor = max(MIN_SIMILARITY, best - RELATIVE_MARGIN)

        def keep(result: dict) -> bool:
            if result["similarity"] >= floor:
                return True

            rank = result["keyword_rank"]
            return (
                rank is not None
                and rank <= KEYWORD_KEEP_RANK
                and result["similarity"] >= KEYWORD_MIN_SIMILARITY
            )

        # Candidates are already ordered by fused (vector + keyword) score.
        return [result for result in candidates if keep(result)][:top_k]

    results = retrieve(document_ids)

    # A filename we guessed from the question found nothing relevant:
    # fall back to searching everything rather than giving up.
    if not results and scope:
        results = retrieve(None)
        scope = []

    if not results:
        return {
            "answer": not_found_message(question),
            "citations": [],
            "search_query": search_query,
            "scope": scope,
        }

    context = build_context(results)

    answer = generate_answer(
        question,
        context,
        llm,
    )

    cited = extract_cited_sources(answer, len(results))

    if any(phrase in answer.lower() for phrase in _CANNOT_ANSWER):
        cited = []
    elif not cited:
        cited = list(range(1, min(FALLBACK_CITATIONS, len(results)) + 1))

    citations = [
        {
            "source": number,
            "document_id": results[number - 1]["document_id"],
            "document_name": results[number - 1]["document_name"],
            "page": results[number - 1]["page"],
            "chunk_id": results[number - 1]["chunk_id"],
            "snippet": best_snippet(
                results[number - 1]["text"],
                search_query,
            ),
            "similarity": round(results[number - 1]["similarity"], 3),
        }
        for number in cited
    ]

    return {
        "answer": answer,
        "citations": citations,
        "search_query": search_query,
        "scope": scope,
    }
