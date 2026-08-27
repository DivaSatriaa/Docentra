from app.db import get_connection


def search_chunks(
    query_embedding,
    *,
    workspace_id: str | None = None,
    document_ids: list[str] | None = None,
    collection_id: str | None = None,
    top_k: int = 5,
) -> list[dict]:
    if top_k <= 0:
        raise ValueError("top_k must be greater than zero")

    filters = []
    params = []

    query = """
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
    """

    params.append(query_embedding)

    if workspace_id:
        filters.append("d.workspace_id = %s")
        params.append(workspace_id)

    if document_ids:
        filters.append("d.id = ANY(%s)")
        params.append(document_ids)

    if collection_id:
        query += """
            AND EXISTS (
                SELECT 1
                FROM collection_documents cd
                WHERE cd.document_id = d.id
                  AND cd.collection_id = %s
            )
        """
        params.append(collection_id)

    if filters:
        query += " AND " + " AND ".join(filters)

    query += """
        ORDER BY dc.embedding <=> %s::vector
        LIMIT %s
    """

    # ORDER BY needs the query embedding again.
    params.append(query_embedding)
    params.append(top_k)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()

    return [
        {
            "chunk_id": row[0],
            "document_id": row[1],
            "document_name": row[2],
            "page": row[3],
            "text": row[4],
            "similarity": float(row[5]),
        }
        for row in rows
    ]
