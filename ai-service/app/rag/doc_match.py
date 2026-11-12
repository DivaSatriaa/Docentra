"""Detect which uploaded documents a question explicitly refers to.

Precision matters more than recall here: a wrong match would restrict the
search to the wrong file, while a miss just falls back to searching everything.
"""

import re

from app.db import get_connection


_TOKEN = re.compile(r"[a-z0-9]+")
_FILENAME = re.compile(
    r"[\w.\-() ]*?[\w\-()]+\.(?:pdf|docx?|txt|md|csv|xlsx|pptx)\b",
    re.IGNORECASE,
)
_FILE_WORDS = {"file", "files", "dokumen", "document", "documents", "pdf", "berkas"}


def _tokens(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def _distinctive(token: str) -> bool:
    return len(token) >= 3 and not token.isdigit()


def list_documents(workspace_id: str) -> list[tuple[str, str]]:
    query = """
        SELECT id, original_name
        FROM documents
        WHERE workspace_id = %s AND processing_status = 'ready'
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (workspace_id,))
            return [(str(row[0]), row[1]) for row in cursor.fetchall()]


def match_documents(
    question: str,
    documents: list[tuple[str, str]],
) -> list[tuple[str, str]]:
    """Return the (id, name) of documents the question names, or []."""
    question_lower = question.lower()
    question_tokens = _tokens(question)
    question_text = " ".join(question_tokens)
    mentions_file = bool(_FILE_WORDS & set(question_tokens)) or bool(
        re.search(r"\.(?:pdf|docx?|txt|md|csv|xlsx|pptx)\b", question_lower)
    )

    matched = []

    for document_id, name in documents:
        name_lower = name.lower()
        stem = name_lower.rsplit(".", 1)[0]
        stem_tokens = _tokens(stem)
        stem_text = " ".join(stem_tokens)

        # 1. Exact filename or full name (without extension) is written out.
        multi_word = sum(_distinctive(t) for t in stem_tokens) >= 2
        if name_lower in question_lower or (
            stem_text
            and (multi_word or mentions_file)
            and f" {stem_text} " in f" {question_text} "
        ):
            matched.append((document_id, name))
            continue

        # 2. Two or more consecutive words of the filename appear in order.
        found = False
        for size in range(len(stem_tokens), 1, -1):
            for start in range(0, len(stem_tokens) - size + 1):
                window = stem_tokens[start : start + size]
                if not all(_distinctive(t) for t in window):
                    continue
                if f" {' '.join(window)} " in f" {question_text} ":
                    found = True
                    break
            if found:
                break

        # 3. One-word filename: only when the user clearly talks about a file.
        if not found and mentions_file:
            distinctive = [t for t in stem_tokens if _distinctive(t)]
            if len(distinctive) == 1 and len(distinctive[0]) >= 4:
                found = distinctive[0] in question_tokens

        if found:
            matched.append((document_id, name))

    return matched
