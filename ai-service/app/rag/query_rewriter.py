import os

import requests
from dotenv import load_dotenv


load_dotenv()


OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://localhost:11434",
)

OLLAMA_MODEL = os.getenv(
    "OLLAMA_MODEL",
    "qwen3:4b-instruct",
)


def rewrite_query(
    question: str,
    history: list[dict],
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

    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
        },
        timeout=300,
    )

    response.raise_for_status()

    data = response.json()

    rewritten = data["response"].strip()

    return rewritten or question
