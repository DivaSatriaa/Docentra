"""Provider-agnostic LLM calls.

`llm` is an optional dict sent from the frontend:
    {"provider": "ollama" | "openai" | "anthropic" | "gemini",
     "model": "<model id>", "api_key": "<key, not needed for ollama>"}
When omitted, the local Ollama model from the environment is used.
"""

import os

import requests
from dotenv import load_dotenv


load_dotenv()


OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b-instruct")

OPENAI_BASE = "https://api.openai.com/v1"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai"
ANTHROPIC_BASE = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01"

API_PROVIDERS = ("openai", "anthropic", "gemini")

# "custom" = any OpenAI-compatible endpoint (DeepSeek, Groq, OpenRouter,
# LM Studio, ...), configured by the user with their own base URL.
CUSTOM_PROVIDER = "custom"


def _custom_base(llm: dict) -> str:
    base = (llm.get("base_url") or "").strip().rstrip("/")

    if not base.startswith(("http://", "https://")):
        raise ValueError("base URL must start with http:// or https://")

    return base


def _raise_for_status(response: requests.Response) -> None:
    if response.ok:
        return

    # Surface the provider's message, never the request (which holds the key).
    try:
        detail = response.json()
        detail = detail.get("error", detail)
        if isinstance(detail, dict):
            detail = detail.get("message", detail)
    except ValueError:
        detail = response.text[:300]

    raise RuntimeError(f"LLM provider error {response.status_code}: {detail}")


def generate(prompt: str, llm: dict | None = None) -> str:
    llm = llm or {}
    provider = (llm.get("provider") or "ollama").lower()
    model = (llm.get("model") or "").strip()
    api_key = (llm.get("api_key") or "").strip()

    if provider == "ollama":
        return _ollama(prompt, model or OLLAMA_MODEL)

    if provider == CUSTOM_PROVIDER:
        if not model:
            raise ValueError("model is required")
        return _openai_compatible(prompt, model, api_key, _custom_base(llm))

    if provider not in API_PROVIDERS:
        raise ValueError(f"unknown provider: {provider}")

    if not api_key:
        raise ValueError(f"API key for {provider} is required")

    if not model:
        raise ValueError("model is required")

    if provider == "anthropic":
        return _anthropic(prompt, model, api_key)

    base = OPENAI_BASE if provider == "openai" else GEMINI_BASE
    return _openai_compatible(prompt, model, api_key, base)


def _ollama(prompt: str, model: str) -> str:
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=300,
    )
    _raise_for_status(response)
    return response.json()["response"].strip()


def _openai_compatible(prompt: str, model: str, api_key: str, base: str) -> str:
    response = requests.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
        json={"model": model, "messages": [{"role": "user", "content": prompt}]},
        timeout=120,
    )
    _raise_for_status(response)
    return response.json()["choices"][0]["message"]["content"].strip()


def _anthropic(prompt: str, model: str, api_key: str) -> str:
    response = requests.post(
        f"{ANTHROPIC_BASE}/messages",
        headers={"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION},
        json={
            "model": model,
            "max_tokens": 2048,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    _raise_for_status(response)
    blocks = response.json()["content"]
    return "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()


def list_models(provider: str, api_key: str = "", base_url: str = "") -> list[str]:
    provider = (provider or "").lower()
    api_key = (api_key or "").strip()

    if provider == CUSTOM_PROVIDER:
        response = requests.get(
            f"{_custom_base({'base_url': base_url})}/models",
            headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
            timeout=15,
        )
        _raise_for_status(response)
        return sorted(m["id"] for m in response.json().get("data", []))

    if provider == "ollama":
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        _raise_for_status(response)
        return sorted(m["name"] for m in response.json().get("models", []))

    if provider not in API_PROVIDERS:
        raise ValueError(f"unknown provider: {provider}")

    if not api_key:
        raise ValueError(f"API key for {provider} is required")

    if provider == "anthropic":
        response = requests.get(
            f"{ANTHROPIC_BASE}/models",
            headers={"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION},
            params={"limit": 100},
            timeout=15,
        )
        _raise_for_status(response)
        return [m["id"] for m in response.json().get("data", [])]

    base = OPENAI_BASE if provider == "openai" else GEMINI_BASE
    response = requests.get(
        f"{base}/models",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    _raise_for_status(response)
    ids = [m["id"].removeprefix("models/") for m in response.json().get("data", [])]

    if provider == "openai":
        # Hide embeddings/audio/image/etc; keep chat-capable families.
        ids = [i for i in ids if i.startswith(("gpt-", "o1", "o3", "o4", "chatgpt-"))
               and not any(x in i for x in ("audio", "realtime", "transcribe", "tts", "image", "search"))]
    else:
        ids = [i for i in ids if i.startswith("gemini")]

    return sorted(ids)


def generate_title(question: str, answer: str, llm: dict | None = None) -> str:
    """A short chat title (max ~6 words) in the language of the question."""
    from app.rag.lang import detect_language

    language = detect_language(question)
    language_rule = (
        f"Write the title in {language}."
        if language
        else "Use the same language as the user's question."
    )

    prompt = f"""
Write a short title (3 to 6 words) for a chat that starts like this.
{language_rule} No quotes, no trailing punctuation, no explanation.
Reply with the title only.

User question:
{question[:500]}

Assistant answer:
{answer[:500]}

Title:
""".strip()

    lines = generate(prompt, llm).strip().splitlines()
    title = lines[0] if lines else ""
    title = title.strip().strip("\"'`*#").strip().rstrip(".!?:;,")

    if len(title) > 60:
        title = title[:60].rsplit(" ", 1)[0]

    return title
