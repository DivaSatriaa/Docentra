from app.rag.llm import complete


def generate_answer(
    question: str,
    context: str,
    *,
    provider: str | None = None,
    model: str | None = None,
) -> str:
    prompt = f"""
You are Docentra, an AI assistant that answers questions
based only on the provided document context.

Rules:
- Use only the provided context.
- If the answer cannot be found in the context, say you
  don't have enough information from the provided documents.
- Do not invent facts.
- Be concise but useful.

DOCUMENT CONTEXT:
{context}

USER QUESTION:
{question}

ANSWER:
""".strip()

    return complete(
        prompt,
        provider=provider,
        model=model,
    )
