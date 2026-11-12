"""Tiny Indonesian/English detector, enough to tell the model which language to answer in.

Small local models ignore "answer in the same language" but follow an explicit
"Answer in Indonesian", so we name the language.
"""

import re

_WORD = re.compile(r"[a-z]+")

_INDONESIAN = {
    "apa", "apakah", "siapa", "kapan", "dimana", "di", "ke", "dari", "mengapa",
    "kenapa", "bagaimana", "berapa", "mana", "yang", "dan", "atau", "ini", "itu",
    "untuk", "dengan", "adalah", "saya", "aku", "kamu", "anda", "bisa", "tolong",
    "jelaskan", "jelasin", "rangkum", "ringkas", "sebutkan", "isi", "tentang",
    "dalam", "pada", "ada", "tidak", "bukan", "akan", "sudah", "belum", "juga",
    "secara", "lebih", "lanjut", "gimana", "dokumen", "cari", "carikan", "buat",
    "bandingkan", "perbedaan", "contoh", "sebagai", "oleh", "karena", "jika",
}

_ENGLISH = {
    "the", "is", "are", "was", "were", "what", "who", "when", "where", "why",
    "how", "which", "of", "and", "or", "to", "in", "on", "for", "with", "this",
    "that", "these", "those", "explain", "summarize", "summary", "describe",
    "list", "tell", "me", "about", "does", "do", "did", "can", "could", "please",
    "compare", "difference", "between", "example", "from", "by", "as", "it",
    "its", "his", "her", "their", "has", "have", "any", "all", "more", "details",
}

# Words that carry no search value (question words, articles, ...).
STOPWORDS = _INDONESIAN | _ENGLISH | {"yg", "dg", "nya", "lah", "kah"}


def detect_language(text: str) -> str | None:
    """"Indonesian", "English", or None when unsure."""
    words = _WORD.findall(text.lower())

    indonesian = sum(word in _INDONESIAN for word in words)
    english = sum(word in _ENGLISH for word in words)

    if indonesian > english:
        return "Indonesian"

    if english > indonesian:
        return "English"

    return None


def language_instruction(text: str) -> str:
    language = detect_language(text)

    if language:
        return f"Write your entire answer in {language}."

    return "Write your answer in the same language as the user's question."


NOT_FOUND = {
    "Indonesian": (
        "Saya tidak menemukan informasi yang cukup di dokumen yang tersedia "
        "untuk menjawab pertanyaan itu."
    ),
    "English": (
        "I couldn't find enough information in the provided documents to "
        "answer that question."
    ),
}


def not_found_message(question: str) -> str:
    return NOT_FOUND.get(detect_language(question) or "English", NOT_FOUND["English"])
