from uuid import UUID

from app.db import get_connection


def store_chunks(
    document_id: str,
    chunks: list[dict],
    embeddings,
) -> int:
    if len(chunks) != len(embeddings):
        raise ValueError("chunks and embeddings length must match")

    document_uuid = UUID(document_id)

    rows = []

    for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        rows.append(
            (
                document_uuid,
                index,
                chunk["text"],
                chunk["page"],
                embedding.tolist(),
                None,
            )
        )

    query = """
        INSERT INTO document_chunks (
            document_id,
            chunk_index,
            content,
            page_number,
            embedding,
            metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s)
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(query, rows)

        connection.commit()

    return len(rows)

def delete_chunks(document_id: str) -> None:
    query = """
        DELETE FROM document_chunks
        WHERE document_id = %s
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (UUID(document_id),),
            )

        connection.commit()
