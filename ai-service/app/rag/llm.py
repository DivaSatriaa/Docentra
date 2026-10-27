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

DEEPSEEK_URL = os.getenv(
    "DEEPSEEK_URL",
    "https://api.deepseek.com",
)

DEEPSEEK_API_KEY = os.getenv(
    "DEEPSEEK_API_KEY",
    "",
)

DEEPSEEK_MODEL = os.getenv(
    "DEEPSEEK_MODEL",
    "deepseek-chat",
)

DEEPSEEK_FALLBACK_MODELS = [
    "deepseek-chat",
    "deepseek-reasoner",
]

PROVIDER_OLLAMA = "ollama"
PROVIDER_DEEPSEEK = "deepseek"

PROVIDERS = (
    PROVIDER_OLLAMA,
    PROVIDER_DEEPSEEK,
)


def complete(
    prompt: str,
    *,
    provider: str | None = None,
    model: str | None = None,
) -> str:
    provider = provider or PROVIDER_OLLAMA

    if provider == PROVIDER_OLLAMA:
        return _complete_ollama(
            prompt,
            model or OLLAMA_MODEL,
        )

    if provider == PROVIDER_DEEPSEEK:
        return _complete_deepseek(
            prompt,
            model or DEEPSEEK_MODEL,
        )

    raise ValueError(f"unknown provider: {provider}")


def _complete_ollama(
    prompt: str,
    model: str,
) -> str:
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
        },
        timeout=300,
    )

    response.raise_for_status()

    data = response.json()

    return data["response"].strip()


def _complete_deepseek(
    prompt: str,
    model: str,
) -> str:
    if not DEEPSEEK_API_KEY:
        raise ValueError(
            "DEEPSEEK_API_KEY is not configured"
        )

    response = requests.post(
        f"{DEEPSEEK_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        },
        json={
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            "stream": False,
        },
        timeout=300,
    )

    response.raise_for_status()

    data = response.json()

    content = data["choices"][0]["message"]["content"]

    return (content or "").strip()


def list_ollama_models() -> list[str]:
    response = requests.get(
        f"{OLLAMA_URL}/api/tags",
        timeout=5,
    )

    response.raise_for_status()

    data = response.json()

    return sorted(
        model["name"]
        for model in data.get("models", [])
    )


def list_deepseek_models() -> list[str]:
    if not DEEPSEEK_API_KEY:
        return []

    try:
        response = requests.get(
            f"{DEEPSEEK_URL}/models",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            },
            timeout=5,
        )

        response.raise_for_status()

        data = response.json()

        models = sorted(
            model["id"]
            for model in data.get("data", [])
        )

        return models or DEEPSEEK_FALLBACK_MODELS

    except requests.RequestException:
        return DEEPSEEK_FALLBACK_MODELS


def list_providers() -> list[dict]:
    try:
        ollama_models = list_ollama_models()
        ollama_error = (
            None
            if ollama_models
            else "No local models installed"
        )

    except requests.RequestException:
        ollama_models = []
        ollama_error = "Ollama is not reachable"

    deepseek_models = list_deepseek_models()

    return [
        {
            "id": PROVIDER_OLLAMA,
            "label": "Local LLM",
            "available": bool(ollama_models),
            "error": ollama_error,
            "default_model": (
                OLLAMA_MODEL
                if OLLAMA_MODEL in ollama_models
                else next(iter(ollama_models), None)
            ),
            "models": ollama_models,
        },
        {
            "id": PROVIDER_DEEPSEEK,
            "label": "DeepSeek API",
            "available": bool(DEEPSEEK_API_KEY),
            "error": (
                None
                if DEEPSEEK_API_KEY
                else "DEEPSEEK_API_KEY is not configured"
            ),
            "default_model": (
                DEEPSEEK_MODEL
                if DEEPSEEK_API_KEY
                else None
            ),
            "models": deepseek_models,
        },
    ]
