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


seen = {}


def fake_stream(question, context, llm=None, web=False):
    seen.update(context=context, web=web)
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

# --- Web search
WEB = [
    {
        "kind": "web",
        "url": "https://contoh.id/lomba",
        "title": "Lomba Esai - Situs Resmi",
        "text": "Biaya pendaftaran lomba esai di situs resmi adalah Rp50.000 per orang.",
        "similarity": 0.7,
    }
]
web_state = {"calls": 0, "passages": WEB, "status": {"used": True, "status": "ok", "query": "biaya lomba esai"}, "fail": False}


def fake_gather(question, search_query, results, llm=None):
    web_state["calls"] += 1
    if web_state["fail"]:
        raise RuntimeError("boom")
    return list(web_state["passages"]), dict(web_state["status"])


chat_mod.gather_web = fake_gather

# Off: the web is never touched.
state.update(found=True, model=["Biaya ", "Rp45.000 ", "[S1]."])
done = list(chat_mod.chat_stream("Berapa biaya pendaftaran?", **ARGS))[-1][1]
check("web off: provider not called", web_state["calls"] == 0)
check("web off: no web key, prompt in document mode", "web" not in done and seen["web"] is False, done.keys())

# On: document and web sources in one answer.
state.update(model=["Menurut dokumen biaya pendaftaran Rp45.000 per orang [S1]. ", "Situs resmi menyebut biaya pendaftaran lomba esai Rp50.000 per orang [S2]."])
events = list(chat_mod.chat_stream("Berapa biaya pendaftaran?", web_search=True, **ARGS))
done = events[-1][1]
check("web on: provider called once", web_state["calls"] == 1)
# Only the first chunk passes the similarity filter, so the web page is S2.
check("web on: web passage numbered after the chunks", "[S2]" in seen["context"] and "https://contoh.id/lomba" in seen["context"] and "Web page" in seen["context"], seen["context"])
check("web on: prompt in web mode", seen["web"] is True)
check("web on: answer renumbered", "[1]" in done["answer"] and "[2]" in done["answer"] and "[S" not in done["answer"], done["answer"])
kinds = [c["kind"] for c in done["citations"]]
check("web on: one citation of each kind", kinds == ["document", "web"], done["citations"])
w = done["citations"][1]
check("web citation fields", w["source"] == 2 and w["url"] == "https://contoh.id/lomba" and w["title"] == "Lomba Esai - Situs Resmi" and w["snippet"] and "document_id" not in w, w)
check("web on: status reported", done["web"] == {"used": True, "status": "ok", "query": "biaya lomba esai"}, done["web"])
check("web on: JSON-encodable", json.dumps(jsonable_encoder(done)))

# A web label the page does not support is dropped.
state.update(model=["Jam operasional kantor adalah pukul 08.00 sampai 16.00 [S2]."])
done = list(chat_mod.chat_stream("Jam berapa kantor buka?", web_search=True, **ARGS))[-1][1]
check("web on: unsupported web citation dropped", all(c["kind"] == "document" for c in done["citations"]), done["citations"])

# The web part fails: the documents still answer.
web_state["fail"] = True
state.update(model=["Biaya ", "Rp45.000 ", "[S1]."])
done = list(chat_mod.chat_stream("Berapa biaya pendaftaran?", web_search=True, **ARGS))[-1][1]
check("web down: answered from documents", "[1]" in done["answer"] and len(done["citations"]) == 1, done)
check("web down: reported unavailable", done["web"]["status"] == "unavailable" and done["web"]["used"] is False and seen["web"] is False, done["web"])
web_state["fail"] = False

# Documents have nothing, the web does.
state.update(found=False, model=["Situs resmi menyebut biaya pendaftaran lomba esai Rp50.000 per orang [S1]."])
done = list(chat_mod.chat_stream("Berapa biaya pendaftaran?", web_search=True, **ARGS))[-1][1]
check("web only: answered from the web", [c["kind"] for c in done["citations"]] == ["web"] and "[1]" in done["answer"], done)

# Neither has anything.
web_state.update(passages=[], status={"used": False, "status": "no_results", "query": "q"})
events = list(chat_mod.chat_stream("Berapa biaya pendaftaran?", web_search=True, **ARGS))
check("nothing anywhere: not found, web status kept", [n for n, _ in events] == ["done"] and events[0][1]["citations"] == [] and events[0][1]["web"]["status"] == "no_results", events)

print("all chat stream checks passed")
