from app.rag.llm import complete


def rewrite_query(
    question: str,
    history: list[dict],
    *,
    provider: str | None = None,
    model: str | None = None,
) -> str:
    question = question.strip()

    if not question:
        raise ValueError("question is required")

    if not history:
        return question

    history_text = "\n".join(
        f"{message['role']}: {message['content']}"
        for message in history[-6:]
    )

    prompt = f"""
Rewrite the user's latest question into a standalone search query.

Rules:
- Preserve the original meaning.
- Resolve references such as "it", "they", "this", or "that"
  using the conversation history.
- Do not answer the question.
- Return only the rewritten query.
- Do not add explanations.

Conversation history:
{history_text}

Latest user question:
{question}

Standalone search query:
""".strip()

    rewritten = complete(
        prompt,
        provider=provider,
        model=model,
    )

    return rewritten or question
