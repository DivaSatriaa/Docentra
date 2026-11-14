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
- Be complete and accurate. Keep the wording short, but never leave
  out relevant information.
- If the question asks for a list or "all" of something (for example
  "apa saja", "apa aja", "sebutkan", "list", "what are"), go through
  EVERY source and include EVERY matching item, not just the first few.
  Group the items when the documents group them (for example group vs.
  individual programs), and use a bulleted list.
- {language_rule}
- Cite the sources you used with their label, like [S1] or [S2][S5],
  right after the statement they support. Every bullet point needs its
  own citation. Cite only sources that actually support the statement.
- Numbers that appear inside the documents (row numbers, "No.", dates)
  are NOT source labels. Only cite labels written as [S<number>].

DOCUMENT CONTEXT:
{context}

USER QUESTION:
{question}

{language_rule}

ANSWER:
""".strip()

    return generate(prompt, llm)
