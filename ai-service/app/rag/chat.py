import os
import re

from app.rag.citations import (
    cited_sources,
    claims_by_source,
    highlights_for,
    renumber,
)
from app.rag.context import build_context
from app.rag.doc_match import list_documents, match_documents
from app.rag.embeddings import create_embeddings
from app.rag.lang import not_found_message
from app.rag.generation import generate_answer
from app.rag.query_rewriter import rewrite_query
from app.rag.retriever import (
    document_chunks,
    hybrid_search_chunks,
    scope_text_length,
)
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

# Full-document mode: when the documents in play are this small (in
# characters), the model reads all of them instead of a handful of chunks.
# Search alone can't answer "list everything" questions, because the items
# are spread over the whole document. ~24k chars is roughly 7-8k tokens.
FULL_CONTEXT_CHARS = int(os.getenv("RAG_FULL_CONTEXT_CHARS", "24000"))

# Without an explicit scope, read a whole document when at least this share
# of the search hits come from it.
DOMINANT_SHARE = float(os.getenv("RAG_DOMINANT_SHARE", "0.6"))

# "List everything" questions get more chunks when the full document is
# too big to send.
LIST_TOP_K = int(os.getenv("RAG_LIST_TOP_K", "16"))

_LIST_INTENT = re.compile(
    r"\b(apa\s+(saja|aja|sajakah)|siapa\s+(saja|aja)|mana\s+(saja|aja)|"
    r"sebutkan|sebutin|daftar(kan)?|semua(nya)?|seluruh(nya)?|"
    r"berapa\s+(banyak|jumlah)|ada\s+berapa|list|all\s+the|what\s+are|"
    r"every|each|enumerate)\b",
    re.IGNORECASE,
)

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


def is_list_question(text: str) -> bool:
    return bool(_LIST_INTENT.search(text))


def _dominant_document(results: list[dict]) -> str | None:
    counts: dict[str, int] = {}
    for result in results:
        counts[result["document_id"]] = counts.get(result["document_id"], 0) + 1

    document_id, count = max(counts.items(), key=lambda item: item[1])
    return document_id if count / len(results) >= DOMINANT_SHARE else None


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

    wants_list = is_list_question(question) or is_list_question(search_query)
    if wants_list:
        top_k = max(top_k, LIST_TOP_K)

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
        document_ids = None

    if not results:
        return {
            "answer": not_found_message(question),
            "citations": [],
            "search_query": search_query,
            "scope": scope,
        }

    # Read whole documents when they are small enough: the scoped ones, or
    # the one document most hits came from.
    full_ids = document_ids or (
        [doc] if (doc := _dominant_document(results)) else None
    )
    if full_ids and not collection_id:
        if scope_text_length(full_ids) <= FULL_CONTEXT_CHARS:
            full = document_chunks(query_embedding, full_ids)
            if full:
                results = full

    context = build_context(results)

    answer = generate_answer(
        question,
        context,
        llm,
    )

    max_source = len(results)
    cited = cited_sources(answer, max_source)

    if any(phrase in answer.lower() for phrase in _CANNOT_ANSWER):
        cited = []
    elif not cited:
        by_relevance = sorted(
            range(1, max_source + 1),
            key=lambda n: results[n - 1]["similarity"],
            reverse=True,
        )
        cited = by_relevance[:FALLBACK_CITATIONS]

    claims = claims_by_source(answer, max_source)
    mapping = {old: new for new, old in enumerate(cited, start=1)}
    answer = renumber(answer, mapping, max_source)

    citations = []
    for old in cited:
        result = results[old - 1]
        highlights = highlights_for(
            result["text"],
            claims.get(old, []),
            search_query,
        )
        citations.append(
            {
                "source": mapping[old],
                "document_id": result["document_id"],
                "document_name": result["document_name"],
                "page": result["page"],
                "chunk_id": str(result["chunk_id"]),
                "snippet": (
                    " … ".join(highlights)
                    if highlights
                    else best_snippet(result["text"], search_query)
                ),
                "highlights": highlights,
                "similarity": round(result["similarity"], 3),
            }
        )

    return {
        "answer": answer,
        "citations": citations,
        "search_query": search_query,
        "scope": scope,
    }
