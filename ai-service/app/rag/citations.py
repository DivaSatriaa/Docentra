"""Turn the model's [S1]-style markers into numbered, highlightable citations.

The model sees sources labelled [S1]..[Sn]. After it answers we:
1. find which sources it actually cited, in order of first use,
2. renumber them 1..k and rewrite the markers as [1][2] for the UI,
3. for every cited source, pick the exact passages of that chunk that support
   the sentences citing it, so the viewer can highlight them in the document.
"""

import re

from app.rag.lang import STOPWORDS

# A bracket group that may hold citations: [S1], [S1, S3], [Source 2], [1].
_GROUP = re.compile(r"\[([^\[\]]{1,60})\]")
_BODY = re.compile(
    r"^\s*(?:(?:source|sumber|s)\s*)?\d+"
    r"(?:\s*(?:,|;|&|dan|and)\s*(?:(?:source|sumber|s)\s*)?\d+)*\s*$",
    re.IGNORECASE,
)
_NUMBER = re.compile(r"\d+")

# Pieces of a chunk that can be highlighted on their own.
_SEGMENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\s+\|\s+|\n+")
# Pieces of the answer that make one claim.
_CLAIM_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
_WORD = re.compile(r"\w+", re.UNICODE)

MIN_SEGMENT_CHARS = 12
MAX_HIGHLIGHTS = 3


def _numbers(group_body: str) -> list[int] | None:
    if not _BODY.match(group_body):
        return None
    return [int(n) for n in _NUMBER.findall(group_body)]


def cited_sources(answer: str, max_source: int) -> list[int]:
    """Source numbers the answer cites, in order of first use."""
    cited: list[int] = []

    for match in _GROUP.finditer(answer):
        for number in _numbers(match.group(1)) or []:
            if 1 <= number <= max_source and number not in cited:
                cited.append(number)

    return cited


def renumber(answer: str, mapping: dict[int, int], max_source: int) -> str:
    """Rewrite citation groups with the new numbers as [1][2].

    Groups that look like citations but point at no kept source are removed,
    so stray markers never show up in the answer.
    """

    def replace(match: re.Match) -> str:
        numbers = _numbers(match.group(1))
        if numbers is None:
            return match.group(0)

        # A bare number with no "S" that isn't a valid source is probably
        # document content like "[2026]": leave it alone.
        body = match.group(1).lower()
        has_label = "s" in body
        valid = [n for n in numbers if 1 <= n <= max_source]
        if not valid and not has_label:
            return match.group(0)

        new = []
        for n in valid:
            if n in mapping and mapping[n] not in new:
                new.append(mapping[n])

        return "".join(f"[{n}]" for n in new)

    rewritten = _GROUP.sub(replace, answer)
    # Tidy spaces left before punctuation by removed markers.
    return re.sub(r"[ \t]+([.,;:!?])", r"\1", rewritten)


def _content_words(text: str) -> set[str]:
    return {
        word
        for word in _WORD.findall(text.lower())
        if len(word) > 2 and word not in STOPWORDS
    }


def _segments(text: str) -> list[str]:
    pieces = (" ".join(p.split()) for p in _SEGMENT_SPLIT.split(text))
    return [p for p in pieces if len(p) >= MIN_SEGMENT_CHARS]


def claims_by_source(answer: str, max_source: int) -> dict[int, list[str]]:
    """For each source number, the answer sentences (markers removed) citing it."""
    claims: dict[int, list[str]] = {}

    for piece in _CLAIM_SPLIT.split(answer):
        numbers: list[int] = []
        for match in _GROUP.finditer(piece):
            for n in _numbers(match.group(1)) or []:
                if 1 <= n <= max_source and n not in numbers:
                    numbers.append(n)

        if not numbers:
            continue

        text = _GROUP.sub(" ", piece).strip(" -*•\t")
        if not text:
            continue

        for n in numbers:
            claims.setdefault(n, []).append(text)

    return claims


def highlights_for(chunk_text: str, claims: list[str], query: str) -> list[str]:
    """Exact passages of the chunk that best support the claims."""
    segments = _segments(chunk_text)
    if not segments:
        return []

    segment_words = [_content_words(s) for s in segments]
    picked: list[int] = []

    for claim in claims or [query]:
        words = _content_words(claim)
        if not words:
            continue

        def score(i: int) -> float:
            overlap = len(words & segment_words[i])
            # Prefer segments that cover the claim, not just long ones.
            return overlap / (1 + len(segment_words[i]) ** 0.5)

        best = max(range(len(segments)), key=score)
        if score(best) > 0 and best not in picked:
            picked.append(best)

    if not picked:
        # Nothing overlapped: fall back to the query.
        words = _content_words(query)
        ranked = sorted(
            range(len(segments)),
            key=lambda i: len(words & segment_words[i]),
            reverse=True,
        )
        if ranked and words & segment_words[ranked[0]]:
            picked.append(ranked[0])

    picked = picked[:MAX_HIGHLIGHTS]
    # Keep reading order so the viewer scrolls to the first one.
    return [segments[i] for i in sorted(picked)]
