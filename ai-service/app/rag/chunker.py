import re

# Sentence end: punctuation followed by whitespace, or a line break.
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+|\n+")


def _split_long(piece: str, limit: int) -> list[str]:
    """Split text with no usable sentence breaks at word boundaries."""
    parts: list[str] = []

    while len(piece) > limit:
        cut = piece.rfind(" ", 0, limit)
        if cut <= 0:
            cut = limit
        parts.append(piece[:cut].strip())
        piece = piece[cut:].strip()

    if piece:
        parts.append(piece)

    return parts


def _sentences(text: str, limit: int) -> list[str]:
    sentences: list[str] = []

    for raw in _SENTENCE_END.split(text):
        sentence = " ".join(raw.split())
        if not sentence:
            continue
        if len(sentence) > limit:
            sentences.extend(_split_long(sentence, limit))
        else:
            sentences.append(sentence)

    return sentences


def chunk_text(
    text: str,
    chunk_size: int = 800,
    chunk_overlap: int = 120,
) -> list[str]:
    """Split text into chunks of up to `chunk_size` characters.

    Chunks end on sentence boundaries (never mid-word), and each chunk starts
    with the last sentence(s) of the previous one, up to `chunk_overlap`
    characters, so context isn't lost at the seams.
    """
    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size")

    sentences = _sentences(text, chunk_size)

    if not sentences:
        return []

    chunks: list[str] = []
    current: list[str] = []
    length = 0

    for sentence in sentences:
        added = len(sentence) + (1 if current else 0)

        if current and length + added > chunk_size:
            chunks.append(" ".join(current))

            # Carry trailing sentences over as overlap.
            carried: list[str] = []
            carried_length = 0

            for previous in reversed(current):
                extra = len(previous) + (1 if carried else 0)
                if carried_length + extra > chunk_overlap:
                    break
                carried.insert(0, previous)
                carried_length += extra

            # Never let the overlap crowd out the next sentence.
            if carried_length + len(sentence) + 1 > chunk_size:
                carried, carried_length = [], 0

            current, length = carried, carried_length
            added = len(sentence) + (1 if current else 0)

        current.append(sentence)
        length += added

    if current:
        chunks.append(" ".join(current))

    return chunks
