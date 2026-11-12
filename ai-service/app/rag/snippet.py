import re

from app.rag.lang import STOPWORDS

_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_WORD = re.compile(r"\w+", re.UNICODE)


def best_snippet(text: str, query: str, max_chars: int = 320) -> str:
    """Pick the part of a chunk that best matches the query."""
    text = " ".join(text.split())

    if len(text) <= max_chars:
        return text

    query_words = {w for w in _WORD.findall(query.lower()) if len(w) > 2}
    sentences = [s for s in _SENTENCE.split(text) if s]

    if not query_words:
        return text[:max_chars].rstrip() + "..."

    if len(sentences) < 2:
        return _window_around_match(text, query_words, max_chars)

    def score(sentence: str) -> int:
        return len(query_words & set(_WORD.findall(sentence.lower())))

    best = max(range(len(sentences)), key=lambda i: score(sentences[i]))

    # One long run-on "sentence" (tables, lists): center on the match instead.
    if len(sentences[best]) > max_chars:
        return _window_around_match(sentences[best], query_words, max_chars)

    # Grow around the best sentence while it still fits.
    start = end = best
    snippet = sentences[best]

    while True:
        grew = False
        if start > 0 and len(snippet) + len(sentences[start - 1]) + 1 <= max_chars:
            start -= 1
            snippet = sentences[start] + " " + snippet
            grew = True
        if end < len(sentences) - 1 and len(snippet) + len(sentences[end + 1]) + 1 <= max_chars:
            end += 1
            snippet = snippet + " " + sentences[end]
            grew = True
        if not grew:
            break

    if len(snippet) > max_chars:
        snippet = snippet[:max_chars].rstrip() + "..."

    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(sentences) - 1 and not snippet.endswith("...") else ""
    return prefix + snippet + suffix


def _window_around_match(text: str, query_words: set[str], max_chars: int) -> str:
    """A max_chars window of text, positioned around the first query-word hit."""
    keywords = {w for w in query_words if w not in STOPWORDS} or query_words

    first = None
    for match in _WORD.finditer(text.lower()):
        if match.group() in keywords:
            first = match.start()
            break

    if first is None:
        return text[:max_chars].rstrip() + "..."

    start = max(0, first - max_chars // 3)
    end = min(len(text), start + max_chars)
    start = max(0, end - max_chars)

    # Snap to word boundaries so we don't cut words in half.
    if start > 0:
        start = text.find(" ", start) + 1 or start
    if end < len(text):
        end = text.rfind(" ", start, end) if text.rfind(" ", start, end) > start else end

    snippet = text[start:end].strip()
    return ("..." if start > 0 else "") + snippet + ("..." if end < len(text) else "")
