import os
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv

from app.db import get_connection
from app.rag.chunker import chunk_text
from app.rag.embeddings import create_embeddings
from app.rag.vector_store import (
    delete_chunks,
    store_chunks,
)
from app.services.loaders import load_document


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
    *,
    error: str | None = None,
    page_count: int | None = None,
) -> None:
    """Set the status; `error` is stored (and cleared on any non-failed status)."""
    query = """
        UPDATE documents
        SET
            processing_status = %s,
            processing_error = %s,
            page_count = COALESCE(%s, page_count),
            updated_at = NOW()
        WHERE id = %s
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (status, error, page_count, UUID(document_id)),
            )

        connection.commit()


def _friendly_error(error: Exception) -> str:
    """A short reason the user can act on."""
    message = str(error).strip() or error.__class__.__name__

    if isinstance(error, (ValueError, FileNotFoundError)):
        return message[:500]

    return f"Could not read this file ({error.__class__.__name__}: {message})"[:500]


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
            # <repo>/backend, so it works on any machine.
            str(Path(__file__).resolve().parents[3] / "backend"),
        )

        file_path = os.path.join(
            storage_root,
            document["storage_path"],
        )

        pages = load_document(file_path)

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
                "No readable text was found in this file. "
                "If it is a scanned document, it needs OCR first."
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
            page_count=len(pages),
        )

        return {
            "document_id": document_id,
            "pages": len(pages),
            "chunks": stored_chunks,
            "status": "ready",
        }

    except Exception as error:
        update_processing_status(
            document_id,
            "failed",
            error=_friendly_error(error),
        )
        raise