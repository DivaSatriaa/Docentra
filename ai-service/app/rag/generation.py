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


def generate_answer(
    question: str,
    context: str,
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

    return data["response"].strip()
