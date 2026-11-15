"""Checks for streamed chat.

Run with:  python -m app.test_chat_stream

Fakes retrieval and the model: no network, no DB.
"""

import json
import uuid

from fastapi.encoders import jsonable_encoder

import app.rag.chat as chat_mod


def check(name, condition, detail=""):
    assert condition, f"FAIL {name}: {detail}"
    print(f"ok  {name}")


CHUNKS = [
    {
        "document_id": uuid.UUID(int=1),
        "document_name": "tarif.pdf",
        "page": 2,
        "chunk_id": "c1",
        "text": "Biaya pendaftaran adalah Rp45.000 per orang.",
        "similarity": 0.9,
        "keyword_rank": 1,
    },
    {
        "document_id": uuid.UUID(int=1),
        "document_name": "tarif.pdf",
        "page": 3,
        "chunk_id": "c2",
        "text": "Jam operasional kantor adalah pukul 08.00 sampai 16.00.",
        "similarity": 0.5,
        "keyword_rank": None,
    },
]

state = {"found": True, "model": ["Biaya ", "Rp45.000 ", "[S", "1]."]}


def fake_stream(question, context, llm=None):
    yield from state["model"]


chat_mod.match_documents = lambda question, docs: []
chat_mod.list_documents = lambda workspace_id: []
chat_mod.rewrite_query = lambda question, history, llm=None: question
chat_mod.create_embeddings = lambda texts: [[0.0] for _ in texts]
chat_mod.hybrid_search_chunks = lambda *a, **k: list(CHUNKS) if state["found"] else []
chat_mod.scope_text_length = lambda ids: 10**9  # never full-document mode
chat_mod.document_chunks = lambda *a, **k: []
chat_mod.generate_answer_stream = fake_stream

ARGS = dict(workspace_id="w1")

# Normal answer.
state.update(found=True, model=["Biaya ", "Rp45.000 ", "[S", "1]."])
events = list(chat_mod.chat_stream("Berapa biaya pendaftaran?", **ARGS))
names = [name for name, _ in events]
check("deltas then one done", names[-1] == "done" and set(names[:-1]) == {"delta"} and names.count("done") == 1, names)
streamed = "".join(p["text"] for n, p in events if n == "delta")
check("streamed text has no label", "[S" not in streamed and streamed.startswith("Biaya Rp45.000"), streamed)
done = events[-1][1]
check("done keys", set(done) == {"answer", "citations", "search_query", "scope"}, done.keys())
check("done answer from raw text", "[1]" in done["answer"] and "[S" not in done["answer"], done["answer"])
check("one citation", len(done["citations"]) == 1, done["citations"])
c = done["citations"][0]
check("citation fields", c["document_id"] == uuid.UUID(int=1) and c["page"] == 2 and c["snippet"], c)

check("done is JSON-encodable (UUIDs)", json.dumps(jsonable_encoder(done)))

# chat() returns the done payload.
check("chat equals done", chat_mod.chat("Berapa biaya pendaftaran?", **ARGS) == done)

# Nothing found.
state["found"] = False
events = list(chat_mod.chat_stream("Berapa biaya pendaftaran?", **ARGS))
check("nothing found: single done", [n for n, _ in events] == ["done"], events)
check("nothing found: no citations", events[0][1]["citations"] == [])
check("nothing found: message", events[0][1]["answer"] == chat_mod.not_found_message("Berapa biaya pendaftaran?"))

# Model says it cannot answer.
state.update(found=True, model=["I don't have enough ", "information to answer."])
events = list(chat_mod.chat_stream("Siapa presidennya?", **ARGS))
done = events[-1][1]
check("cannot answer: no citations", done["citations"] == [])
check("cannot answer: text kept", done["answer"] == "I don't have enough information to answer.", done["answer"])

# Empty question.
try:
    next(chat_mod.chat_stream("   ", **ARGS))
    check("empty question raises", False)
except ValueError:
    check("empty question raises", True)

print("all chat stream checks passed")
