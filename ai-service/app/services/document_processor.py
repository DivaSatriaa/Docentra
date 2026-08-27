import os
from uuid import UUID

from dotenv import load_dotenv

from app.db import get_connection
from app.rag.chunker import chunk_text
from app.rag.embeddings import create_embeddings
from app.rag.vector_store import (
    delete_chunks,
    store_chunks,
)
from app.services.pdf_loader import load_pdf


load_dotenv()


def get_document(document_id: str) -> dict:
    document_uuid = UUID(document_id)

    query = """
        SELECT
            id,
            storage_path,
            processing_status
        FROM documents
        WHERE id = %s
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_uuid,))
            row = cursor.fetchone()

    if row is None:
        raise ValueError("document not found")

    return {
        "id": str(row[0]),
        "storage_path": row[1],
        "processing_status": row[2],
    }


def update_processing_status(
    document_id: str,
    status: str,
) -> None:
    query = """
        UPDATE documents
        SET
            processing_status = %s,
            updated_at = NOW()
        WHERE id = %s
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (status, UUID(document_id)),
            )

        connection.commit()


def process_document(document_id: str) -> dict:
    document = get_document(document_id)

    update_processing_status(
        document_id,
        "processing",
    )

    delete_chunks(document_id)

    try:
        storage_root = os.getenv(
            "DOCUMENT_STORAGE_ROOT",
            "/home/divas/Docentra/backend",
        )

        file_path = os.path.join(
            storage_root,
            document["storage_path"],
        )

        pages = load_pdf(file_path)

        all_chunks: list[dict] = []

        for page in pages:
            chunks = chunk_text(page["text"])

            for chunk in chunks:
                all_chunks.append(
                    {
                        "page": page["page"],
                        "text": chunk,
                    }
                )

        if not all_chunks:
            raise ValueError(
                "document contains no extractable text"
            )

        texts = [
            chunk["text"]
            for chunk in all_chunks
        ]

        embeddings = create_embeddings(texts)

        stored_chunks = store_chunks(
            document_id,
            all_chunks,
            embeddings,
        )

        update_processing_status(
            document_id,
            "ready",
        )

        return {
            "document_id": document_id,
            "pages": len(pages),
            "chunks": stored_chunks,
            "status": "ready",
        }

    except Exception:
        update_processing_status(
            document_id,
            "failed",
        )
        raise