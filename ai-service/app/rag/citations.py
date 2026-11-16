"""Turn the model's [S1]-style markers into numbered, highlightable citations.

The model sees sources labelled [S1]..[Sn]. After it answers we:
1. check every label against the text of the chunk it points at, because
   models (small ones especially) often attach the wrong label to a right
   answer: unsupported labels are dropped, and a sentence whose labels are all
   wrong is moved to the chunk that does contain it,
2. renumber the surviving sources 1..k and rewrite the markers as [1][2],
3. for every cited source, pick the exact passage of that chunk that supports
   the sentences citing it, so the viewer can highlight it in the document.

The check is lexical (shared names, numbers and words), so it is skipped when
nothing in the chunks matches the wording: then the model's labels stand.
"""

import math
import re
from dataclasses import dataclass, field

from app.rag.lang import STOPWORDS

# A bracket group that may hold citations: [S1], [S1, S3], [Source 2], [1].
# Long enough for a model that lists every source in one group.
_GROUP = re.compile(r"\[([^\[\]]{1,400})\]")
_BODY = re.compile(
    r"^\s*(?:(?:source|sumber|s)\s*)?\d+"
    r"(?:\s*(?:,|;|&|dan|and)\s*(?:(?:source|sumber|s)\s*)?\d+)*\s*$",
    re.IGNORECASE,
)
_NUMBER = re.compile(r"\d+")

# Pieces of a chunk that can be highlighted on their own.
# Sentence ends, table cell bars, line breaks, and checkbox / bullet glyphs.
_SEGMENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\s+\|\s+|\n+|\s*[☐☑☒✓✔•▪■□●○]\s*")
# Pieces of the answer that make one claim.
_CLAIM_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
_WORD = re.compile(r"\w+", re.UNICODE)

# A sentence saying the information is missing ("the documents don't cover
# this") is not a claim a source can back, so it never gets one. Without this,
# the label the model puts after it points at whichever chunk was closest.
_NO_INFO = re.compile(
    r"""
    \btidak\s+(?:memiliki|menemukan|ada|terdapat|tersedia)\s+(?:cukup\s+)?(?:informasi|data)
    | \b(?:dokumen|konteks|sumber|teks)\b.{0,60}?\btidak\s+(?:membahas|memuat|menyebut(?:kan)?|mencantumkan|mengandung|berisi|menjelaskan|menjawab)
    | \b(?:documents?|context|sources?|excerpts?)\b.{0,60}?\b(?:do(?:es)?\s+not|don't|doesn't|did\s+not)\s+(?:contain|mention|cover|discuss|include|address|say|provide)
    | \b(?:no|not\s+enough|insufficient)\s+(?:relevant\s+)?information\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

MIN_SEGMENT_CHARS = 12
MAX_HIGHLIGHTS = 3

# A cited source is kept when it backs the sentence at least this well,
# relative to the best chunk in the context.
SUPPORT_RATIO = 0.5
# Share of a sentence's (weighted) terms a chunk must contain before we trust
# it enough to move a citation there, or to add one the model left out.
MIN_COVERAGE = 0.5
# When the model cites nothing, attach at most this many sources.
MAX_ATTRIBUTED = 2

# A matching passage is narrowed to the words that matter when it is not a
# proper sentence (headers, title pages, table cells and checklists come out of
# extraction as one run with no full stop), or when it is simply very long.
NARROW_RUN_OVER_CHARS = 60
NARROW_SENTENCE_OVER_CHARS = 320
MAX_NARROW_CHARS = 160
MIN_NARROW_CHARS = 24
# Words the question itself used ("Kreasi Fest", "penulis") say what the
# topic is, not where the answer is, so they count for less when narrowing.
QUERY_TERM_WEIGHT = 0.3


def _numbers(group_body: str) -> list[int] | None:
    if not _BODY.match(group_body):
        return None
    return [int(n) for n in _NUMBER.findall(group_body)]


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


def _terms(text: str) -> list[str]:
    """Words that can tie a sentence to a passage: content words and numbers."""
    terms: list[str] = []
    for word in _WORD.findall(text.lower()):
        if word.isdigit() or (len(word) > 2 and word not in STOPWORDS):
            if word not in terms:
                terms.append(word)
    return terms


def _same(term: str, token: str) -> bool:
    """Loose word match: "desember" ~ "des", "penulisnya" ~ "penulis"."""
    if term == token:
        return True
    if term.isdigit() or token.isdigit():
        return False
    short, long = sorted((term, token), key=len)
    return len(short) >= 3 and long.startswith(short)


def _tokens(text: str) -> set[str]:
    return set(_WORD.findall(text.lower()))


def _has(term: str, tokens: set[str]) -> bool:
    return term in tokens or any(_same(term, token) for token in tokens)


def _weights(terms: list[str], chunk_tokens: list[set[str]]) -> dict[str, float]:
    """Rarer across the context = more telling. Unseen terms weigh the most."""
    total = len(chunk_tokens)
    weights = {}
    for term in terms:
        seen = sum(_has(term, tokens) for tokens in chunk_tokens)
        weights[term] = math.log(1 + total / seen) if seen else math.log(2 + total)
    return weights


def _support(terms: list[str], weights: dict[str, float], tokens: set[str]) -> float:
    return sum(weights[t] for t in terms if _has(t, tokens))


def _segments(text: str) -> list[str]:
    pieces = (" ".join(p.split()) for p in _SEGMENT_SPLIT.split(text))
    return [p for p in pieces if len(p) >= MIN_SEGMENT_CHARS]


@dataclass
class Resolved:
    """The answer with verified [S<n>] markers, and what backs each source."""

    answer: str
    cited: list[int] = field(default_factory=list)
    claims: dict[int, list[str]] = field(default_factory=dict)


def _strip_markers(piece: str) -> str:
    return _GROUP.sub(
        lambda m: " " if _numbers(m.group(1)) is not None else m.group(0), piece
    ).strip(" -*•\t")


def _labels(numbers: list[int]) -> str:
    return "".join(f"[S{n}]" for n in numbers)


def _set_markers(piece: str, numbers: list[int], max_source: int) -> str:
    """Replace the piece's citation groups with exactly these sources."""
    done = False

    def replace(match: re.Match) -> str:
        nonlocal done
        found = _numbers(match.group(1))
        if found is None or not any(1 <= n <= max_source for n in found):
            return match.group(0)
        if done:
            return ""
        done = True
        return _labels(numbers)

    rewritten = _GROUP.sub(replace, piece)
    if not done and numbers:
        # No marker to reuse: put it at the end, before closing punctuation.
        body = rewritten.rstrip()
        tail = re.search(r"[.!?:;]*$", body).group(0)
        stem = body[: len(body) - len(tail)].rstrip()
        rewritten = f"{stem} {_labels(numbers)}{tail}"
    return rewritten


def resolve_citations(
    answer: str,
    chunk_texts: list[str],
    similarities: list[float] | None = None,
    strict: set[int] | None = None,
) -> Resolved:
    """Check the answer's source labels against the chunks and fix them up.

    `similarities` is accepted for callers but no longer used: a source is
    never attached just because it was the closest chunk, only when the
    sentence's own words back it.

    `strict` holds the source numbers that are web pages. Their labels are
    only kept when the page text supports the sentence: never on trust, and
    never by moving a label between a document and a web page.
    """
    strict = strict or set()
    max_source = len(chunk_texts)
    chunk_tokens = [_tokens(text) for text in chunk_texts]

    # Split into sentences, keeping the separators so we can rebuild the text.
    parts = re.split(f"({_CLAIM_SPLIT.pattern})", answer)
    pieces = parts[0::2]

    def cited_in(piece: str) -> list[int]:
        numbers: list[int] = []
        for match in _GROUP.finditer(piece):
            for n in _numbers(match.group(1)) or []:
                if 1 <= n <= max_source and n not in numbers:
                    numbers.append(n)
        return numbers

    texts = [_strip_markers(piece) for piece in pieces]
    numbers = [cited_in(piece) for piece in pieces]
    has_markers = any(numbers)

    # A label standing alone after the full stop ("... 2026 [S6]. [S4]")
    # belongs to the sentence before it.
    last_claim = None
    for i, text in enumerate(texts):
        if text:
            last_claim = i
        elif numbers[i] and last_claim is not None:
            numbers[last_claim] += [n for n in numbers[i] if n not in numbers[last_claim]]
            numbers[i] = []
            pieces[i] = _set_markers(pieces[i], [], max_source)

    # Sentences that only say something is missing carry no source at all.
    absent = [bool(text) and bool(_NO_INFO.search(text)) for text in texts]
    for i, is_absent in enumerate(absent):
        if is_absent and numbers[i]:
            numbers[i] = []
            pieces[i] = _set_markers(pieces[i], [], max_source)

    resolved = Resolved(answer=answer)

    def keep(n: int, text: str) -> None:
        if n not in resolved.cited:
            resolved.cited.append(n)
        resolved.claims.setdefault(n, []).append(text)

    for i, text in enumerate(texts):
        if not text or absent[i] or (has_markers and not numbers[i]):
            continue

        terms = _terms(text)
        if not terms:
            for n in numbers[i]:
                keep(n, text)
            continue

        weights = _weights(terms, chunk_tokens)
        scores = [_support(terms, weights, tokens) for tokens in chunk_tokens]
        best = max(range(max_source), key=lambda j: scores[j])
        coverage = scores[best] / sum(weights.values())
        confident = scores[best] > 0 and coverage >= MIN_COVERAGE

        if numbers[i]:
            supported = [
                n
                for n in numbers[i]
                if scores[n - 1] > 0 and scores[n - 1] >= SUPPORT_RATIO * scores[best]
            ]
            trusted = [n for n in numbers[i] if n not in strict]
            if supported:
                chosen = supported
            elif not trusted:
                # Only web labels, and the pages don't say this.
                chosen = []
            elif confident and best + 1 not in strict:
                # Every label is wrong, and another chunk plainly says this.
                chosen = [best + 1]
            else:
                # Can't verify either way (paraphrase, other language).
                chosen = trusted
        elif (
            confident
            and best + 1 not in strict
            and len(resolved.cited) < MAX_ATTRIBUTED
        ):
            # The model cited nothing at all: attribute by content.
            chosen = [best + 1]
        else:
            continue

        if chosen != cited_in(pieces[i]):
            pieces[i] = _set_markers(pieces[i], chosen, max_source)
        for n in chosen:
            keep(n, text)

    parts[0::2] = pieces
    rewritten = "".join(parts)
    # Tidy what removed markers leave behind.
    rewritten = re.sub(r"[ \t]+([.,;:!?])", r"\1", rewritten)
    resolved.answer = re.sub(r"[ \t]+$", "", rewritten, flags=re.MULTILINE).rstrip()
    return resolved


def _narrow(segment: str, weights: dict[str, float]) -> str:
    """The stretch of a long segment where the telling terms are densest."""
    words = [(m.start(), m.end(), m.group().lower()) for m in _WORD.finditer(segment)]
    # For each word, the terms it satisfies.
    hits = [{t for t in weights if _same(t, word)} for _, _, word in words]
    anchors = [i for i, found in enumerate(hits) if found]
    if not anchors:
        return segment

    best, best_score = (words[anchors[0]][0], words[anchors[0]][1]), 0.0
    for first in anchors:
        start = words[first][0]
        seen: set[str] = set()
        for last in range(first, len(words)):
            end = words[last][1]
            if end - start > MAX_NARROW_CHARS:
                break
            if not hits[last]:
                continue
            seen |= hits[last]
            # Reward covered terms, charge for every character spent on them.
            score = sum(weights[t] for t in seen) / (end - start + 60)
            if score > best_score:
                best, best_score = (start, end), score

    start, end = best
    # Too short to find reliably in the rendered page: take in a few
    # neighbouring words, the ones before first.
    first = next(i for i, w in enumerate(words) if w[0] == start)
    last = next(i for i, w in enumerate(words) if w[1] == end)
    while end - start < MIN_NARROW_CHARS and (first > 0 or last < len(words) - 1):
        if first > 0:
            first -= 1
            start = words[first][0]
        else:
            last += 1
            end = words[last][1]

    # Finish the words at both ends ("Rinandi*1," rather than "Rinandi").
    while start > 0 and not segment[start - 1].isspace():
        start -= 1
    while end < len(segment) and not segment[end].isspace():
        end += 1

    passage = segment[start:end]
    return passage if len(passage) >= MIN_SEGMENT_CHARS else segment


def highlights_for(
    chunk_text: str,
    claims: list[str],
    query: str,
    context_chunks: list[str] | None = None,
) -> list[str]:
    """Exact passages of the chunk that best support the claims."""
    segments = _segments(chunk_text)
    if not segments:
        return []

    segment_tokens = [_tokens(s) for s in segments]
    # Weigh terms by how rare they are across everything the model read.
    context_tokens = [_tokens(c) for c in context_chunks or [chunk_text]]
    query_tokens = _tokens(query)
    picked: dict[int, str] = {}

    def pick(text: str) -> None:
        terms = _terms(text)
        if not terms:
            return
        weights = _weights(terms, context_tokens)

        def score(i: int) -> float:
            # One shared word (often just a number) is a coincidence.
            shared = sum(_has(t, segment_tokens[i]) for t in terms)
            if shared < min(2, len(terms)):
                return 0.0
            # Prefer segments that cover the claim, not just long ones.
            matched = _support(terms, weights, segment_tokens[i])
            return matched / (1 + len(segment_tokens[i]) ** 0.5)

        best = max(range(len(segments)), key=score)
        if score(best) <= 0 or best in picked:
            return

        passage = segments[best]
        is_sentence = passage.rstrip(")\"'”’").endswith((".", "!", "?"))
        limit = NARROW_SENTENCE_OVER_CHARS if is_sentence else NARROW_RUN_OVER_CHARS
        if len(passage) > limit:
            passage = _narrow(
                passage,
                {
                    t: w * (QUERY_TERM_WEIGHT if _has(t, query_tokens) else 1)
                    for t, w in weights.items()
                },
            )
        picked[best] = passage

    for claim in claims:
        if len(picked) < MAX_HIGHLIGHTS:
            pick(claim)

    if not picked:
        # No claim to go on, or nothing overlapped: fall back to the query.
        pick(query)

    # Keep reading order so the viewer scrolls to the first one.
    return [picked[i] for i in sorted(picked)]
