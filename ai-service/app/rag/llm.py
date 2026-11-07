import os

import requests
from dotenv import load_dotenv

from app.settings_store import get_setting, set_setting


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

DEEPSEEK_API_KEY_SETTING = "deepseek_api_key"

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
    api_key = get_deepseek_api_key()

    if not api_key:
        raise ValueError(
            "DeepSeek API key is not configured"
        )

    response = requests.post(
        f"{DEEPSEEK_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
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


def get_deepseek_api_key() -> str:
    # A key saved from the Settings page wins over .env.
    return (
        get_setting(DEEPSEEK_API_KEY_SETTING)
        or os.getenv("DEEPSEEK_API_KEY", "")
    )


def get_deepseek_key_status() -> dict:
    saved_key = get_setting(DEEPSEEK_API_KEY_SETTING)
    api_key = get_deepseek_api_key()

    if saved_key:
        source = "settings"
    elif api_key:
        source = "env"
    else:
        source = None

    return {
        "configured": bool(api_key),
        "source": source,
        "masked_key": _mask_key(api_key) if api_key else None,
    }


def save_deepseek_api_key(api_key: str) -> dict:
    api_key = api_key.strip()

    if not api_key:
        raise ValueError("api_key is required")

    # Reject keys DeepSeek says are wrong; if DeepSeek
    # can't be reached, save the key anyway.
    try:
        response = requests.get(
            f"{DEEPSEEK_URL}/models",
            headers={
                "Authorization": f"Bearer {api_key}",
            },
            timeout=10,
        )

        if response.status_code in (401, 403):
            raise ValueError(
                "DeepSeek rejected this API key"
            )

        verified = response.ok

    except requests.RequestException:
        verified = False

    set_setting(DEEPSEEK_API_KEY_SETTING, api_key)

    return {
        **get_deepseek_key_status(),
        "verified": verified,
    }


def remove_deepseek_api_key() -> dict:
    set_setting(DEEPSEEK_API_KEY_SETTING, None)

    return get_deepseek_key_status()


def _mask_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "•" * len(api_key)

    return f"{api_key[:3]}…{api_key[-4:]}"


def list_deepseek_models() -> list[str]:
    api_key = get_deepseek_api_key()

    if not api_key:
        return []

    try:
        response = requests.get(
            f"{DEEPSEEK_URL}/models",
            headers={
                "Authorization": f"Bearer {api_key}",
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
    deepseek_configured = bool(get_deepseek_api_key())

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
            "available": deepseek_configured,
            "error": (
                None
                if deepseek_configured
                else "Add your DeepSeek API key in Settings"
            ),
            "default_model": (
                DEEPSEEK_MODEL
                if deepseek_configured
                else None
            ),
            "models": deepseek_models,
        },
    ]
