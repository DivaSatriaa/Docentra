"""Checks for the streamed-text label filter. Run: python -m app.test_stream_filter"""

from app.rag.stream import MAX_HOLD, hide_labels


def run(chunks) -> str:
    return "".join(hide_labels(chunks))


assert run(["Halo [S1] dunia"]) == "Halo  dunia"

pieces = list(hide_labels(["Halo [S", "1]", " dunia"]))
assert "".join(pieces) == "Halo  dunia"
assert all("[S" not in p for p in pieces), pieces

assert run(["a [S1][S2, S3]."]) == "a ."
assert run(["tahun [2026] ini"]) == "tahun [2026] ini"
assert run(["[S2]"]) == ""
assert run(["lihat [abc] ya"]) == "lihat [abc] ya"
assert run(["teks [S1"]) == "teks [S1"
assert run(["a [Source 2] b [sumber 3] c"]) == "a  b  c"
assert run(["a [[S1] b"]) == "a [ b"

# Hold cap: flushed without waiting for "]".
text = "[" + "x" * 450
stream = hide_labels([text, "more"])
first = next(stream)
assert first.startswith("[xxx"), first
assert first + "".join(stream) == text + "more"
assert MAX_HOLD == 400

# A long but valid multi-source label is still hidden.
label = "[" + ", ".join(f"S{i}" for i in range(1, 40)) + "]"
assert 150 < len(label) < 400, len(label)
assert run(["a " + label + " b"]) == "a  b"
assert run(["a ", label[:100], label[100:], " b"]) == "a  b"

print("ok")
