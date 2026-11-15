"""Hide the model's [S1]-style source labels while its answer is streamed.

The labels are verified and renumbered once the answer is complete, so the
text shown meanwhile must not contain them. Only groups with an S / source /
sumber prefix are hidden: a bare "[2026]" is indistinguishable from document
content mid-stream and is kept.
"""

import re
from typing import Iterable, Iterator

from app.rag.citations import _BODY

# Characters buffered from an open "[" before giving up on it being a label.
MAX_HOLD = 400

_PREFIX = re.compile(r"^\s*(?:source|sumber|s)", re.IGNORECASE)


def _is_label(body: str) -> bool:
    return bool(_BODY.match(body)) and bool(_PREFIX.match(body))


def hide_labels(deltas: Iterable[str]) -> Iterator[str]:
    """Yield the deltas with every [S<n>]-style bracket group removed."""
    held = ""  # starts at an unmatched "["; empty when not inside one
    for delta in deltas:
        out: list[str] = []
        for ch in delta:
            if not held:
                if ch == "[":
                    held = ch
                else:
                    out.append(ch)
                continue

            if ch == "]":
                if not _is_label(held[1:]):
                    out.append(held + ch)
                held = ""
            elif ch == "[":
                # The earlier "[" never closed: it was plain text.
                out.append(held)
                held = ch
            else:
                held += ch
                if len(held) > MAX_HOLD:
                    out.append(held)
                    held = ""
        text = "".join(out)
        if text:
            yield text
    if held:
        yield held
