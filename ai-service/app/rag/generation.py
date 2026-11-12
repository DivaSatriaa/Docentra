from app.rag.lang import language_instruction
from app.rag.llm import generate


def generate_answer(
    question: str,
    context: str,
    llm: dict | None = None,
) -> str:
    language_rule = language_instruction(question)

    prompt = f"""
You are Docentra, an AI assistant that answers questions
based only on the provided document context.

Rules:
- Use only the provided context.
- If the answer cannot be found in the context, say you
  don't have enough information from the provided documents.
- Do not invent facts.
- Be concise but useful.
- {language_rule}
- Cite the sources you used with their number, like [1] or [2][3],
  right after the statement they support. Cite only sources that
  actually support your answer.

DOCUMENT CONTEXT:
{context}

USER QUESTION:
{question}

{language_rule}

ANSWER:
""".strip()

    return generate(prompt, llm)
