import os
import re
from contextlib import closing
from typing import Iterator

from app.rag.citations import (
    highlights_for,
    renumber,
    resolve_citations,
)
from app.rag.context import build_context
from app.rag.doc_match import list_documents, match_documents
from app.rag.embeddings import create_embeddings
from app.rag.lang import not_found_message
from app.rag.generation import generate_answer_stream
from app.rag.query_rewriter import rewrite_query
from app.rag.retriever import (
    document_chunks,
    hybrid_search_chunks,
    scope_text_length,
)
from app.rag.snippet import best_snippet
from app.rag.stream import hide_labels


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

def is_list_question(text: str) -> bool:
    return bool(_LIST_INTENT.search(text))


def _dominant_document(results: list[dict]) -> str | None:
    counts: dict[str, int] = {}
    for result in results:
        counts[result["document_id"]] = counts.get(result["document_id"], 0) + 1

    document_id, count = max(counts.items(), key=lambda item: item[1])
    return document_id if count / len(results) >= DOMINANT_SHARE else None


def chat_stream(
    question: str,
    *,
    workspace_id: str,
    history: list[dict] | None = None,
    document_ids: list[str] | None = None,
    collection_id: str | None = None,
    top_k: int = 5,
    llm: dict | None = None,
) -> Iterator[tuple[str, dict]]:
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
        yield "done", {
            "answer": not_found_message(question),
            "citations": [],
            "search_query": search_query,
            "scope": scope,
        }
        return

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

    # Stream the text with source labels hidden; the verified answer is
    # computed from the raw text once it is complete.
    raw: list[str] = []

    def raw_deltas():
        # closing(): if the consumer stops early, the provider connection is
        # closed right away instead of whenever the garbage collector runs.
        with closing(generate_answer_stream(question, context, llm)) as pieces:
            for piece in pieces:
                raw.append(piece)
                yield piece

    with closing(raw_deltas()) as source, closing(hide_labels(source)) as visible:
        for text in visible:
            yield "delta", {"text": text}

    answer = "".join(raw).strip()

    max_source = len(results)
    chunk_texts = [result["text"] for result in results]

    if any(phrase in answer.lower() for phrase in _CANNOT_ANSWER):
        cited, claims = [], {}
    else:
        # Don't take the model's source labels on trust: check each one
        # against the chunk it points at.
        resolved = resolve_citations(
            answer,
            chunk_texts,
            [result["similarity"] for result in results],
        )
        answer, cited, claims = resolved.answer, resolved.cited, resolved.claims

    mapping = {old: new for new, old in enumerate(cited, start=1)}
    answer = renumber(answer, mapping, max_source)

    citations = []
    for old in cited:
        result = results[old - 1]
        highlights = highlights_for(
            result["text"],
            claims.get(old, []),
            search_query,
            chunk_texts,
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

    yield "done", {
        "answer": answer,
        "citations": citations,
        "search_query": search_query,
        "scope": scope,
    }


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
    result: dict = {}

    for event, payload in chat_stream(
        question,
        workspace_id=workspace_id,
        history=history,
        document_ids=document_ids,
        collection_id=collection_id,
        top_k=top_k,
        llm=llm,
    ):
        if event == "done":
            result = payload

    return result
