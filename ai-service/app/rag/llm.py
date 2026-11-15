"""Provider-agnostic LLM calls.

`llm` is an optional dict sent from the frontend:
    {"provider": "ollama" | "openai" | "anthropic" | "gemini",
     "model": "<model id>", "api_key": "<key, not needed for ollama>"}
When omitted, the local Ollama model from the environment is used.
"""

import json
import os

import requests
from dotenv import load_dotenv


load_dotenv()


OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b-instruct")
# Largest context window we ask Ollama for. The window is sized per request
# (see _ollama_num_ctx): a bigger window costs memory and can push the model
# partly onto the CPU, so short prompts keep a small one.
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "16384"))
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "900"))
# Room left for the answer on top of the prompt.
_ANSWER_TOKENS = 1536

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


def _resolve(llm: dict | None) -> tuple[str, str, str, str]:
    """Validate `llm` and return (kind, model, api_key, base).

    kind is "ollama", "anthropic" or "openai" (any OpenAI-compatible API).
    """
    llm = llm or {}
    provider = (llm.get("provider") or "ollama").lower()
    model = (llm.get("model") or "").strip()
    api_key = (llm.get("api_key") or "").strip()

    if provider == "ollama":
        return "ollama", model or OLLAMA_MODEL, "", OLLAMA_URL

    if provider == CUSTOM_PROVIDER:
        if not model:
            raise ValueError("model is required")
        return "openai", model, api_key, _custom_base(llm)

    if provider not in API_PROVIDERS:
        raise ValueError(f"unknown provider: {provider}")

    if not api_key:
        raise ValueError(f"API key for {provider} is required")

    if not model:
        raise ValueError("model is required")

    if provider == "anthropic":
        return "anthropic", model, api_key, ANTHROPIC_BASE

    base = OPENAI_BASE if provider == "openai" else GEMINI_BASE
    return "openai", model, api_key, base


def generate(prompt: str, llm: dict | None = None) -> str:
    kind, model, api_key, base = _resolve(llm)

    if kind == "ollama":
        return _ollama(prompt, model)

    if kind == "anthropic":
        return _anthropic(prompt, model, api_key)

    return _openai_compatible(prompt, model, api_key, base)


def _sse_data(line: str) -> str | None:
    """The payload of an SSE `data:` line, or None for any other line."""
    if not line.startswith("data:"):
        return None
    return line[5:].strip()


def _error_message(error) -> str:
    if isinstance(error, dict):
        error = error.get("message", error)
    return str(error)


def _ollama_deltas(lines):
    for line in lines:
        if not line or not line.strip():
            continue

        event = json.loads(line)

        if event.get("error"):
            raise RuntimeError(f"LLM provider error: {_error_message(event['error'])}")

        text = event.get("response")
        if text:
            yield text

        if event.get("done"):
            return True


def _openai_deltas(lines):
    for line in lines:
        data = _sse_data(line)
        if not data:
            continue

        if data == "[DONE]":
            return True

        event = json.loads(data)

        if event.get("error"):
            raise RuntimeError(f"LLM provider error: {_error_message(event['error'])}")

        finished = False
        for choice in event.get("choices") or []:
            text = (choice.get("delta") or {}).get("content")
            if text:
                yield text
            if choice.get("finish_reason"):
                finished = True

        # Some servers end after the final finish_reason without [DONE].
        if finished:
            return True


def _anthropic_deltas(lines):
    for line in lines:
        data = _sse_data(line)
        if not data:
            continue

        event = json.loads(data)
        kind = event.get("type")

        if kind == "error":
            raise RuntimeError(f"LLM provider error: {_error_message(event.get('error'))}")

        if kind == "content_block_delta":
            delta = event.get("delta") or {}
            if delta.get("type") == "text_delta" and delta.get("text"):
                yield delta["text"]
        elif kind == "message_stop":
            return True


def generate_stream(prompt: str, llm: dict | None = None):
    """Yield the answer as text deltas. Validation errors raise on first use."""
    kind, model, api_key, base = _resolve(llm)

    if kind == "ollama":
        request = {
            "url": f"{base}/api/generate",
            "json": {
                "model": model,
                "prompt": prompt,
                "stream": True,
                "options": {"num_ctx": _ollama_num_ctx(prompt)},
            },
            "timeout": OLLAMA_TIMEOUT,
        }
        parse = _ollama_deltas
    elif kind == "anthropic":
        request = {
            "url": f"{base}/messages",
            "headers": {"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION},
            "json": {
                "model": model,
                "max_tokens": 2048,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
            },
            "timeout": 120,
        }
        parse = _anthropic_deltas
    else:
        request = {
            "url": f"{base}/chat/completions",
            "headers": {"Authorization": f"Bearer {api_key}"} if api_key else {},
            "json": {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
            },
            "timeout": 120,
        }
        parse = _openai_deltas

    # The with-block closes the connection when the consumer stops early.
    with requests.post(stream=True, **request) as response:
        _raise_for_status(response)
        # Streams are UTF-8; without this requests may default to latin-1/bytes.
        response.encoding = "utf-8"
        # Parsers return True once they see the provider's terminal marker.
        complete = yield from parse(response.iter_lines(decode_unicode=True))

    # A dropped connection must never look like a finished answer.
    if not complete:
        raise RuntimeError("stream ended unexpectedly")


def _ollama_num_ctx(prompt: str) -> int:
    """Smallest window (4k, 8k, 16k, ...) that fits the prompt and an answer.

    Ollama's default window is small and silently drops the start of longer
    prompts, which loses most of the document context. Fixed sizes (instead
    of the exact count) avoid reloading the model on every request.
    """
    # Rough token estimate: ~3 characters per token for Indonesian/English.
    needed = len(prompt) // 3 + _ANSWER_TOKENS
    size = 4096
    while size < needed and size < OLLAMA_NUM_CTX:
        size *= 2
    return min(size, OLLAMA_NUM_CTX)


def _ollama(prompt: str, model: str) -> str:
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"num_ctx": _ollama_num_ctx(prompt)},
        },
        timeout=OLLAMA_TIMEOUT,
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
