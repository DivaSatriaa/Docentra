import re

from psycopg import errors as pg_errors

from app.db import get_connection
from app.rag.lang import STOPWORDS


# Reciprocal Rank Fusion constant (standard value).
RRF_K = 60

_TOKEN = re.compile(r"[a-z0-9]+")


def _scope_clauses(
    workspace_id: str | None,
    document_ids: list[str] | None,
    collection_id: str | None,
) -> tuple[str, list]:
    """WHERE fragments and their params, in matching order."""
    clauses = []
    params: list = []

    if workspace_id:
        clauses.append("d.workspace_id = %s")
        params.append(workspace_id)

    if document_ids:
        clauses.append("d.id = ANY(%s)")
        params.append(document_ids)

    if collection_id:
        clauses.append(
            """EXISTS (
                SELECT 1
                FROM collection_documents cd
                WHERE cd.document_id = d.id
                  AND cd.collection_id = %s
            )"""
        )
        params.append(collection_id)

    sql = "".join(f" AND {clause}" for clause in clauses)
    return sql, params


def _row_to_result(row) -> dict:
    return {
        "chunk_id": row[0],
        "document_id": row[1],
        "document_name": row[2],
        "page": row[3],
        "text": row[4],
        "similarity": float(row[5]),
    }


def search_chunks(
    query_embedding,
    *,
    workspace_id: str | None = None,
    document_ids: list[str] | None = None,
    collection_id: str | None = None,
    top_k: int = 5,
) -> list[dict]:
    """Vector-only search (cosine similarity)."""
    if top_k <= 0:
        raise ValueError("top_k must be greater than zero")

    scope_sql, scope_params = _scope_clauses(
        workspace_id,
        document_ids,
        collection_id,
    )

    query = f"""
        SELECT
            dc.id,
            dc.document_id,
            d.original_name AS document_name,
            dc.page_number,
            dc.content,
            1 - (dc.embedding <=> %s::vector) AS similarity
        FROM document_chunks dc
        JOIN documents d
            ON d.id = dc.document_id
        WHERE d.processing_status = 'ready'
        {scope_sql}
        ORDER BY dc.embedding <=> %s::vector
        LIMIT %s
    """

    params = [query_embedding, *scope_params, query_embedding, top_k]

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()

    return [_row_to_result(row) for row in rows]


def keyword_query(text: str) -> str:
    """Build a to_tsquery string: content words OR-ed, with prefix matching."""
    seen: list[str] = []

    for token in _TOKEN.findall(text.lower()):
        if token in STOPWORDS or len(token) < 2 or token in seen:
            continue
        seen.append(token)

    # Prefix match longer words so "magang" also finds "magangnya".
    return " | ".join(f"{t}:*" if len(t) >= 4 else t for t in seen)


def _keyword_search(
    cursor,
    query_embedding,
    tsquery: str,
    scope_sql: str,
    scope_params: list,
    limit: int,
) -> list[dict]:
    cursor.execute(
        f"""
        SELECT
            dc.id,
            dc.document_id,
            d.original_name,
            dc.page_number,
            dc.content,
            1 - (dc.embedding <=> %s::vector) AS similarity
        FROM document_chunks dc
        JOIN documents d
            ON d.id = dc.document_id
        WHERE d.processing_status = 'ready'
          AND dc.content_tsv @@ to_tsquery('simple', %s)
        {scope_sql}
        ORDER BY ts_rank_cd(dc.content_tsv, to_tsquery('simple', %s)) DESC
        LIMIT %s
        """,
        [query_embedding, tsquery, *scope_params, tsquery, limit],
    )

    return [_row_to_result(row) for row in cursor.fetchall()]


def hybrid_search_chunks(
    query_embedding,
    query_text: str,
    *,
    workspace_id: str | None = None,
    document_ids: list[str] | None = None,
    collection_id: str | None = None,
    top_k: int = 5,
    candidates: int = 30,
) -> list[dict]:
    """Vector + keyword search, merged with Reciprocal Rank Fusion.

    Each result has `similarity` (vector cosine, for every row), `keyword_rank`
    (1-based rank in the keyword results, or None) and the fused `score`.
    Falls back to vector-only if the full-text column isn't migrated yet.
    """
    vector_results = search_chunks(
        query_embedding,
        workspace_id=workspace_id,
        document_ids=document_ids,
        collection_id=collection_id,
        top_k=candidates,
    )

    keyword_results: list[dict] = []
    tsquery = keyword_query(query_text)

    if tsquery:
        scope_sql, scope_params = _scope_clauses(
            workspace_id,
            document_ids,
            collection_id,
        )

        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    keyword_results = _keyword_search(
                        cursor,
                        query_embedding,
                        tsquery,
                        scope_sql,
                        scope_params,
                        candidates,
                    )
        except pg_errors.UndefinedColumn:
            keyword_results = []  # run `go run ./cmd/migrate up`

    fused: dict = {}

    for rank, result in enumerate(vector_results, start=1):
        entry = fused.setdefault(
            result["chunk_id"],
            {**result, "keyword_rank": None, "score": 0.0},
        )
        entry["score"] += 1 / (RRF_K + rank)

    for rank, result in enumerate(keyword_results, start=1):
        entry = fused.setdefault(
            result["chunk_id"],
            {**result, "keyword_rank": None, "score": 0.0},
        )
        entry["keyword_rank"] = rank
        entry["score"] += 1 / (RRF_K + rank)

    ranked = sorted(fused.values(), key=lambda item: item["score"], reverse=True)
    return ranked[:top_k]
