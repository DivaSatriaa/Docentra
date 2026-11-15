"""Checks for provider stream parsing.

Run with:  python -m app.test_llm_stream

Uses canned lines only: no network.
"""

from unittest.mock import patch

from app.rag.llm import (
    _anthropic_deltas,
    _ollama_deltas,
    _openai_deltas,
    generate_stream,
)


def check(name, condition, detail=""):
    assert condition, f"FAIL {name}: {detail}"
    print(f"ok  {name}")


def raises(exc, fragment, fn):
    try:
        fn()
    except exc as e:
        return fragment in str(e)
    return False


ollama = ['{"response":"Ha"}', '{"response":"lo"}', '{"response":"","done":true}']
check("ollama deltas", list(_ollama_deltas(ollama)) == ["Ha", "lo"])

openai = [
    'data: {"choices":[{"delta":{"content":"Ha"}}]}',
    "",
    'data: {"choices":[{"delta":{}}]}',
    'data: {"choices":[{"delta":{"content":"lo"}}]}',
    "data: [DONE]",
    'data: {"choices":[{"delta":{"content":"late"}}]}',
]
check("openai deltas", list(_openai_deltas(openai)) == ["Ha", "lo"])

anthropic = [
    "event: message_start",
    'data: {"type":"message_start"}',
    "event: ping",
    'data: {"type":"ping"}',
    "event: content_block_delta",
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Ha"}}',
    "",
    "event: content_block_delta",
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}',
    "event: message_stop",
    'data: {"type":"message_stop"}',
]
check("anthropic deltas", list(_anthropic_deltas(anthropic)) == ["Ha", "lo"])

check(
    "ollama error",
    raises(RuntimeError, "boom", lambda: list(_ollama_deltas(['{"error":"boom"}']))),
)
check(
    "openai error",
    raises(
        RuntimeError,
        "boom",
        lambda: list(_openai_deltas(['data: {"error":{"message":"boom"}}'])),
    ),
)
check(
    "anthropic error",
    raises(
        RuntimeError,
        "boom",
        lambda: list(
            _anthropic_deltas(['data: {"type":"error","error":{"message":"boom"}}'])
        ),
    ),
)
check(
    "missing api key",
    raises(
        ValueError,
        "API key",
        lambda: list(generate_stream("hi", {"provider": "openai", "model": "m"})),
    ),
)


class FakeResponse:
    def __init__(self, lines, ok=True, status_code=200):
        self.lines = lines
        self.ok = ok
        self.status_code = status_code
        self.encoding = None
        self.closed = False
        self.text = "unauthorized"

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.closed = True
        return False

    def close(self):
        self.closed = True

    def json(self):
        return {"error": {"message": "bad key"}}

    def iter_lines(self, decode_unicode=False):
        yield from self.lines


# Complete streams yield every delta.
resp = FakeResponse(ollama)
with patch("app.rag.llm.requests.post", return_value=resp):
    check("http complete stream", list(generate_stream("hi")) == ["Ha", "lo"])
check("http complete stream closes", resp.closed)
check("http sets utf-8", resp.encoding == "utf-8")

resp = FakeResponse(openai[:5])
with patch("app.rag.llm.requests.post", return_value=resp):
    got = list(generate_stream("hi", {"provider": "custom", "model": "m", "base_url": "http://x"}))
check("http openai complete", got == ["Ha", "lo"], got)

# finish_reason counts as a terminal marker when [DONE] is missing.
finished = [
    'data: {"choices":[{"delta":{"content":"Ha"}}]}',
    'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}',
]
resp = FakeResponse(finished)
with patch("app.rag.llm.requests.post", return_value=resp):
    got = list(generate_stream("hi", {"provider": "custom", "model": "m", "base_url": "http://x"}))
check("openai finish_reason terminal", got == ["Ha", "lo"], got)

# 401 raises on the first next().
resp = FakeResponse([], ok=False, status_code=401)
with patch("app.rag.llm.requests.post", return_value=resp):
    gen = generate_stream("hi")
    check("401 raises", raises(RuntimeError, "401", lambda: next(gen)))
check("401 closes", resp.closed)

# Closing after the first delta closes the response.
resp = FakeResponse(ollama)
with patch("app.rag.llm.requests.post", return_value=resp):
    gen = generate_stream("hi")
    check("first delta", next(gen) == "Ha")
    check("open before close", not resp.closed)
    gen.close()
check("close closes response", resp.closed)

# A stream cut off before its terminal marker raises.
for name, lines, llm in [
    ("ollama", ollama[:2], None),
    ("openai", openai[:2], {"provider": "custom", "model": "m", "base_url": "http://x"}),
    ("anthropic", anthropic[:7], {"provider": "anthropic", "model": "m", "api_key": "k"}),
]:
    resp = FakeResponse(lines)
    with patch("app.rag.llm.requests.post", return_value=resp):
        check(
            f"truncated {name} raises",
            raises(RuntimeError, "stream ended unexpectedly", lambda: list(generate_stream("hi", llm))),
        )
    check(f"truncated {name} closes", resp.closed)

print("all llm stream checks passed")
