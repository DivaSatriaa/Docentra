"""Checks for web search support.

Run with:  python -m app.test_web

Search, page fetching, DNS, embeddings and the model are faked: no network.
"""

import app.rag.web as web


def check(name, condition, detail=""):
    assert condition, f"FAIL {name}: {detail}"
    print(f"ok  {name}")


# --- URLs in text
check(
    "extract_urls",
    web.extract_urls("Bandingkan dengan https://contoh.id/artikel-1, lalu (http://a.b/c).")
    == ["https://contoh.id/artikel-1", "http://a.b/c"],
    web.extract_urls("Bandingkan dengan https://contoh.id/artikel-1, lalu (http://a.b/c)."),
)
check("extract_urls: none", web.extract_urls("tidak ada tautan") == [])

# --- Address safety
ADDRESSES = {
    "contoh.id": ["93.184.216.34"],
    "intranet.contoh.id": ["10.0.0.5"],
    "mixed.contoh.id": ["93.184.216.34", "127.0.0.1"],
    "localhost": ["127.0.0.1"],
}
web.resolve_host = lambda host: ADDRESSES.get(host, [])

check("public url allowed", web.is_public_url("https://contoh.id/a"))
check("localhost rejected", not web.is_public_url("http://localhost:8000/internal"))
check("loopback ip rejected", not web.is_public_url("http://127.0.0.1/"))
check("private ip rejected", not web.is_public_url("http://192.168.1.1/"))
check("metadata ip rejected", not web.is_public_url("http://169.254.169.254/latest"))
check("private dns rejected", not web.is_public_url("https://intranet.contoh.id/"))
check("any private address rejects the host", not web.is_public_url("https://mixed.contoh.id/"))
check("other schemes rejected", not web.is_public_url("file:///etc/passwd") and not web.is_public_url("ftp://contoh.id/x"))
check("unresolvable rejected", not web.is_public_url("https://tidak-ada.contoh/"))
check("credentials in url rejected", not web.is_public_url("https://user:pw@contoh.id/"))

# --- Text extraction
HTML = """<html><head><title> Lomba Esai </title><style>p{color:red}</style></head>
<body><nav>Beranda | Kontak</nav><script>alert(1)</script>
<article><h1>Lomba Esai</h1><p>Biaya pendaftaran Rp50.000 per orang.</p>
<p>Pendaftaran ditutup 2 Desember 2026.</p></article><footer>Hak cipta</footer></body></html>"""
title, text = web.extract_text(HTML)
check("title", title == "Lomba Esai", title)
check("body text kept", "Biaya pendaftaran Rp50.000" in text and "2 Desember 2026" in text, text)
check("chrome and scripts dropped", "alert" not in text and "Beranda" not in text and "Hak cipta" not in text and "color:red" not in text, text)

# --- Passages
long_text = "\n".join(f"Kalimat nomor {i} tentang lomba esai nasional." for i in range(60))
passages = web.split_passages(long_text)
check("passages are bounded", len(passages) > 1 and all(len(p) <= web.PASSAGE_CHARS + 200 for p in passages), [len(p) for p in passages])
check("short fragments dropped", web.split_passages("ok") == [])

# --- Closest URL (the user may have made a typo)
candidates = ["https://lain.com/x", "https://kreasifest.id/lomba-esai", "https://contoh.id/tentang"]
check("closest: same host", web.closest_url("https://contoh.id/artikel-salah", candidates) == "https://contoh.id/tentang")
check("closest: typo in host", web.closest_url("https://kreasifes.id/lomba-esai", candidates) == "https://kreasifest.id/lomba-esai")
check("closest: nothing similar", web.closest_url("https://samasekali-beda.org/", candidates) is None)

# --- Web query stays a short keyword query
check("query clamp", len(web.clamp_query("satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas duabelas tigabelas empatbelas").split()) == web.MAX_QUERY_WORDS)
check("query clamp strips quotes and lines", web.clamp_query('"lomba esai kreasi fest"\nPenjelasan: ...') == "lomba esai kreasi fest")

web.generate = lambda prompt, llm=None: "kreasi fest 3.0 lomba esai biaya pendaftaran " + "kata " * 30
query = web.build_query("Apakah artikel ini akurat? https://contoh.id/a", "apakah artikel ini akurat", ["Kreasi Fest 3.0 biaya Rp45.000"], None)
check("build_query: clamped", len(query.split()) <= web.MAX_QUERY_WORDS and query.startswith("kreasi fest"), query)


def broken(prompt, llm=None):
    raise RuntimeError("model down")


web.generate = broken
check("build_query: falls back to the search query", web.build_query("q", "biaya lomba esai", ["x"], None) == "biaya lomba esai")
web.generate = lambda prompt, llm=None: "kreasi fest lomba esai"

# --- gather()
PAGES = {
    "https://contoh.id/asli": ("Artikel asli", "Biaya pendaftaran lomba esai adalah Rp50.000 per orang. " * 3),
    "https://hasil.com/1": ("Hasil satu", "Lomba esai nasional Kreasi Fest dibuka untuk umum sampai Desember. " * 3),
    "https://hasil.com/2": ("Hasil dua", "Pengumuman pemenang lomba esai dilakukan tanggal 13 Desember. " * 3),
}
calls = {"search": [], "fetch": []}


def fake_fetch(url):
    calls["fetch"].append(url)
    if url in PAGES:
        title, text = PAGES[url]
        return {"url": url, "title": title, "text": text}
    return None


def fake_search(query, max_results):
    calls["search"].append(query)
    return [
        {"title": "Hasil satu", "url": "https://hasil.com/1", "snippet": "cuplikan satu tentang lomba esai nasional"},
        {"title": "Hasil dua", "url": "https://hasil.com/2", "snippet": "cuplikan dua tentang pengumuman pemenang"},
        {"title": "Tak terbaca", "url": "https://hasil.com/rusak", "snippet": "cuplikan dari halaman yang tidak bisa dibuka sama sekali"},
    ]


web.fetch_page = fake_fetch
real_search = web.search
web.search = fake_search
web.create_embeddings = lambda texts: [[1.0, 0.0] for _ in texts]

DOCS = [{"text": "Artikel ini dikutip dari https://contoh.id/asli dan membahas biaya Rp45.000."}]

# Plain search.
passages, status = web.gather("Apakah biaya di artikel ini benar?", "biaya lomba esai", DOCS, None)
check("search: status ok", status["status"] == "ok" and status["used"] is True and status["query"] == "kreasi fest lomba esai", status)
check("search: passages are web sources", passages and all(p["kind"] == "web" and p["url"] and p["title"] and p["text"] for p in passages), passages)
check("search: unreadable page falls back to its snippet", any(p["url"] == "https://hasil.com/rusak" and "tidak bisa dibuka" in p["text"] for p in passages), [p["url"] for p in passages])
check("search: document urls are not opened on their own", "https://contoh.id/asli" not in calls["fetch"], calls["fetch"])
check("search: bounded", len(passages) <= web.MAX_PASSAGES and sum(len(p["text"]) for p in passages) <= web.MAX_WEB_CHARS)

# A URL in the question comes first.
passages, status = web.gather("Bandingkan dengan https://contoh.id/asli ya", "bandingkan artikel", DOCS, None)
check("given url: first source", passages[0]["url"] == "https://contoh.id/asli", [p["url"] for p in passages])
check("given url: reported", status["requested_url"] == "https://contoh.id/asli" and status["used_url"] == "https://contoh.id/asli", status)
check("given url: search still fills in", any(p["url"].startswith("https://hasil.com") for p in passages))

# The given URL cannot be read: use the closest one from the documents.
passages, status = web.gather("Bandingkan dengan https://contoh.id/asil ya", "bandingkan artikel", DOCS, None)
check("typo url: document url used", passages[0]["url"] == "https://contoh.id/asli" and status["used_url"] == "https://contoh.id/asli" and status["requested_url"] == "https://contoh.id/asil", status)

passages, status = web.gather("Bandingkan dengan https://tidak-mirip.org/x ya", "bandingkan artikel", DOCS, None)
check("unreadable url, nothing similar: search only", status["used_url"] is None and status["status"] == "ok" and passages, status)


# Provider down.
def down(query, max_results):
    raise RuntimeError("rate limited")


web.search = down
passages, status = web.gather("Apakah biaya di artikel ini benar?", "biaya lomba esai", DOCS, None)
check("provider down: unavailable, no passages", passages == [] and status == {"used": False, "status": "unavailable", "query": "kreasi fest lomba esai"}, status)

passages, status = web.gather("Bandingkan dengan https://contoh.id/asli ya", "bandingkan artikel", DOCS, None)
check("provider down but given url readable: still ok", status["status"] == "ok" and [p["url"] for p in passages] == ["https://contoh.id/asli"] * len(passages) and passages, status)

web.search = lambda query, max_results: []
passages, status = web.gather("Apakah biaya di artikel ini benar?", "biaya lomba esai", DOCS, None)
check("no results", passages == [] and status["status"] == "no_results" and status["used"] is False, status)

# The real search(): DuckDuckGo sometimes answers "No results found" once.
import sys
import types

from ddgs.exceptions import DDGSException

script = []


class FakeDDGS:
    def __init__(self, timeout=None):
        pass

    def text(self, query, max_results):
        outcome = script.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


fake_module = types.ModuleType("ddgs")
fake_module.DDGS = FakeDDGS
real_module = sys.modules.get("ddgs")
sys.modules["ddgs"] = fake_module
sys.modules["ddgs.exceptions"] = sys.modules.get("ddgs.exceptions") or types.SimpleNamespace(DDGSException=DDGSException)
try:
    hit = [{"href": "https://a.com/x", "title": "A", "body": "isi"}]
    empty = DDGSException("No results found.")

    script[:] = [empty]
    check("search: an empty answer is no results, not an error, and is not repeated", real_search("q", 5) == [] and script == [])

    script[:] = [hit]
    check("search: results come back", [r["url"] for r in real_search("q", 5)] == ["https://a.com/x"])

    script[:] = [DDGSException("Timeout")]
    try:
        real_search("q", 5)
        check("search: real provider errors still raise", False)
    except DDGSException:
        pass
finally:
    if real_module is not None:
        sys.modules["ddgs"] = real_module

# A query that finds nothing is retried shorter.
tried = []


def only_short(query, max_results):
    tried.append(query)
    if len(query.split()) > web.SHORT_QUERY_WORDS:
        return []
    return [{"title": "Hasil", "url": "https://hasil.com/a", "snippet": "Alamat kantor pusat ada di Malang, Jawa Timur."}]


web.search = only_short
web.fetch_page = lambda url: None
web.generate = lambda prompt, llm=None: "kantor pusat malang jawa timur alamat lengkap"
passages, status = web.gather("Di mana kantornya?", "kantor pusat malang jawa timur alamat lengkap", DOCS, None)
check("empty search: retried with a shorter query", len(tried) == 2 and len(tried[1].split()) == web.SHORT_QUERY_WORDS, tried)
check("empty search: shorter query worked and is reported", status["status"] == "ok" and status["query"] == tried[1] and passages, status)

tried.clear()
web.search = lambda query, max_results: tried.append(query) or []
passages, status = web.gather("Di mana kantornya?", "kantor pusat malang jawa timur alamat lengkap", DOCS, None)
check("still empty: no_results, not unavailable", passages == [] and status["status"] == "no_results" and len(tried) == 2, (status, tried))

print("all web checks passed")
