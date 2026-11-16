"""Checks for citation verification and highlight selection.

Run with:  python -m app.test_citations

The chunks are modelled on real extracted documents (names changed), and the
answers are what the models actually produced, wrong source labels included.
"""

from app.rag.citations import highlights_for, resolve_citations

TA_CHUNKS = [
    "Jurnal Teknologi Informasi dan Ilmu Komputer (JTIIK) DOI: 10.25126/jtiik… Vol. x, No. x, April 2014, hlm. x-x p-ISSN: 2355-7699 Akreditasi KEMENRISTEKDIKTI, No. 36/E/KPT/2019 e-ISSN: 2528-6579 1 ANALISIS PERBANDINGAN WORD2VEC DAN FASTTEXT PADA MODEL LSTM DAN BI-LSTM UNTUK DETEKSI HOAKS BERBAHASA INDONESIA DI PLATFORM X Rama Wijaya*1, Penulis Dua2 1Universitas Contoh, Kota Contoh 2Afiliasi Penulis Dua Email: 1ramawijaya@students.example.ac.id, 2penulis.dua@xmail.ac.id *Penulis Korespondensi (Naskah masuk: dd mmm yyyy, diterima untuk diterbitkan: dd mmm yyyy) Abstrak Penyebaran informasi palsu atau hoaks berbahasa Indonesia di platform X (sebelumnya Twitter) merupakan permasalahan kritis akibat karakteristik teks media sosial yang tidak terstruktur, penuh singkatan, dan memiliki",
    "This condition poses a complex challenge in t he Natural Language Processing (NLP) domain, especially when dealing wit h highly imbalanced datasets. This study aims to evaluate and compare the performance of Word2Vec and FastText feature extraction algorithms when integrated into Long Short -Term Memory (LSTM) and Bidirectional LSTM (Bi-LSTM) classification architectures. A total of 3,772 tweet data were used in this study, which had undergone a comprehensive preprocessing stage using the Sastrawi library. To prevent predictive bias on the majority class, the Class Weight method was applied during the training phase. The eva luation was conducted through four comparison scenarios. The test results showed that the combination of FastText and Bi -LSTM architectures"
]

KREASI_CHUNKS = [
    "Kreasi Fest 3.0: Ringkasan Guidebook Lomba Esai Nasional Nov 15, 2026 Lomba ini masih worth dicoba kalau tujuannya sertifikat dan latihan menulis, bukan hadiah uang: biayanya Rp45.000 (Gel. 2), esainya 5-8 halaman, dan hadiah uangnya belum jelas nominalnya. Ringkasan guidebook Format penulisan dan penilaian Naskah wajib PDF dengan format yang cukup ketat, dan 35% nilai ditentukan oleh kualitas isi. Kertas A4, Times New Roman, spasi 1,5, rata kiri-kanan (justify). Margin: kiri 4 cm, atas 3 cm, bawah 3 cm, kanan 3 cm. Isi (pendahuluan, isi, kesimpulan) 5-8 halaman. Total maksimal 15 halaman, termasuk cover, daftar pustaka, dan lampiran. Sitasi dan daftar pustaka format APA. Sumber harus kredibel: jurnal ilmiah, buku/e-book, laporan pemerintah/PBB/NGO, BPS, atau World Bank.",
    "Sumber harus kredibel: jurnal ilmiah, buku/e-book, laporan pemerintah/PBB/NGO, BPS, atau World Bank. Lampiran wajib: Lembar Orisinalitas Karya. Cover memakai template dari panitia. Nama file: NamaKetua_5 kata pertama judul.pdf. Yang perlu diwaspadai Tujuh hal ini sebaiknya dicek atau ditanyakan ke admin sebelum bayar. Nominal uang pembinaan tidak disebut, baik di guidebook maupun poster. \"Jutaan rupiah\" belum bisa dipegang. Medali dan selempang pemenang bertanda bintang: hanya untuk yang \"melakukan Klaim Merchandise\". Belum jelas apakah berbayar atau hanya ongkir. Pemenangnya banyak: 3 juara, 3 harapan, 10 besar, dan 18 Best Paper (3 per subtema × 6). Peluang dapat label pemenang besar, tapi nilainya sebagai prestasi lebih rendah kecuali Juara 1-3.",
    "Peluang dapat label pemenang besar, tapi nilainya sebagai prestasi lebih rendah kecuali Juara 1-3. Plagiarisme tidak dicek pakai Turnitin (tertulis di FAQ). Penilaian subjektif dan keputusan juri mutlak. Ada sisa template lomba lain: format konfirmasi WA menyebut \"Lomba Essay Senada\" dan FAQ menyebut \"kontak resmi panitia senada\". Kemungkinan copy-paste, bukan red flag besar, tapi administrasinya kurang rapi. Upload hanya sekali. Kalau upload dua kali, yang dinilai upload terakhir, dan perubahan setelah submit tidak dijamin boleh. Esai harus final sebelum dikirim. Badan hukum baru tertulis di guidebook mereka sendiri. Belum dicek di AHU Online. Rekomendasi Ikut kalau Dina punya sekitar 10 hari untuk menulis; skip kalau sedang mengejar deadline TA atau berharap uang pembinaan besar.",
    "Sudut pandang: subtema Teknologi/AI, mengangkat temuan soal pengaruh bahasa prompt terhadap kinerja LLM pada teks bahasa Indonesia. Cocok dengan kriteria inovasi (20%) dan analisis berbasis data (25%). Langkah: ☐ Tanya admin soal nominal uang pembinaan dan klaim merchandise ☐ Daftar sebelum 19 Nov 2026 (biaya Gel. 2 Rp45.000) supaya dapat webinar gratis ☐ Selesaikan draft sekitar 28 Nov 2026 ☐ Upload versi final sebelum 2 Des 2026 Sources Guidebook Kreasi Fest 3.0 Postingan @info.lombaind Hal | Isi. Penyelenggara | PT Kurasi Insan Cendekia (Kreasi Fest 3.0). Guidebook mencantumkan sertifikat badan hukum AHU-018093.AH.01.30.. Syarat peserta | WNI, semua usia dan latar belakang. Individu atau tim (maks. 2 orang).. Biaya Gel. 2 | Individu Rp45.000, tim Rp65.000. Bayar via QRIS..",
    "Individu atau tim (maks. 2 orang).. Biaya Gel. 2 | Individu Rp45.000, tim Rp65.000. Bayar via QRIS.. Jadwal | Daftar dan upload karya paling lambat 2 Des 2026. Penilaian 3-12 Des. Pengumuman 13 Des.. Sistem | Full submission (esai PDF saja), tanpa presentasi atau Zoom.. Subtema | 6 pilihan. Paling relevan buat Dina: Teknologi, AI & Transformasi Kehidupan Digital.. Karya lama | Boleh pakai esai yang pernah ikut lomba lain, asal belum pernah menang.. Jumlah karya | Boleh lebih dari 1, tapi bayar ulang tiap karya.. Hadiah | Juara 1-3: medali, selempang, sertifikat, uang pembinaan. Harapan 1-3: medali, selempang, sertifikat. Ada juga 10 Besar dan Best Paper (3 pemenang per subtema).. Aspek penilaian | Bobot | Yang dinilai.",
    "Ada juga 10 Besar dan Best Paper (3 pemenang per subtema).. Aspek penilaian | Bobot | Yang dinilai. Kualitas isi | 35% | Ketepatan substansi, kelengkapan pembahasan, manfaat, kelayakan solusi. Argumentasi dan analisis | 25% | Ketajaman analisis, logika, relevansi data, kekuatan bukti. Inovasi dan orisinalitas | 20% | Kebaruan ide, kreativitas, keunikan solusi. Kesesuaian tema dan subtema | 10% | Kesesuaian gagasan dengan tema, subtema, dan tujuan lomba. Sistematika penulisan | 10% | Struktur, koherensi antarparagraf, bahasa baku, ejaan."
]


def check(name: str, condition: bool, detail: object = "") -> None:
    print(("ok   " if condition else "FAIL ") + name + (f"  -> {detail}" if not condition else ""))
    if not condition:
        raise SystemExit(1)


# --- "Siapa penulisnya?": the model cited the title page and, wrongly, an
# English abstract chunk that never mentions the authors.
answer = "Penulisnya adalah Rama Wijaya dan Penulis Dua, sebagaimana tercantum dalam dokumen TA.pdf [S1][S2]."
result = resolve_citations(answer, TA_CHUNKS, [0.5, 0.14])
check("authors: unsupported source is dropped", result.cited == [1], result.cited)
check("authors: its marker is gone from the answer", "[S2]" not in result.answer and "[S1]" in result.answer, result.answer)

highlights = highlights_for(TA_CHUNKS[0], result.claims[1], "siapa penulisnya", TA_CHUNKS)
check("authors: one highlight", len(highlights) == 1, highlights)
check("authors: highlight is the author line, not the whole title block",
      "Rama Wijaya" in highlights[0] and "Penulis Dua" in highlights[0] and len(highlights[0]) < 80,
      highlights)
check("authors: highlight is verbatim chunk text", highlights[0] in " ".join(TA_CHUNKS[0].split()), highlights)

# --- "Kapan deadline submitnya?" with a small local model: right answer, but
# it cited the scoring table and a stray second label after the full stop.
answer = "Deadline submit esai adalah paling lambat 2 Desember 2026 [S6]. [S4]"
result = resolve_citations(answer, KREASI_CHUNKS, [0.55, 0.31, 0.30, 0.40, 0.43, 0.19])
check("deadline: scoring-table source is dropped", 6 not in result.cited, result.cited)
check("deadline: a single source remains", len(result.cited) == 1, result.cited)
only = result.cited[0]
highlights = highlights_for(KREASI_CHUNKS[only - 1], result.claims[only], "kapan deadline submit", KREASI_CHUNKS)
check("deadline: highlight states the date", any("2 Des 2026" in h for h in highlights), highlights)
check("deadline: no stray marker left", "[S6]" not in result.answer, result.answer)

# --- With an API model: one right source and one unrelated extra.
answer = "Deadline submit karya paling lambat 2 Desember 2026 [S5][S2]."
result = resolve_citations(answer, KREASI_CHUNKS, [0.55, 0.31, 0.30, 0.40, 0.43, 0.19])
check("deadline (api): only the supporting source is kept", result.cited == [5], result.cited)
highlights = highlights_for(KREASI_CHUNKS[4], result.claims[5], "kapan deadline submit", KREASI_CHUNKS)
check("deadline (api): highlight is the schedule row",
      highlights == ["Daftar dan upload karya paling lambat 2 Des 2026."], highlights)

# --- A second chunk that really does state the date is a valid source, and
# its highlight must be that line, not the checklist around it.
claim = "Deadline submit/upload karya Kreasi Fest adalah paling lambat 2 Desember 2026"
highlights = highlights_for(KREASI_CHUNKS[3], [claim], "Kapan deadline submitnya di dokumen Kreasi Fest", KREASI_CHUNKS)
check("deadline: checklist highlight is just the upload line",
      len(highlights) == 1
      and "sebelum 2 Des 2026" in highlights[0]
      and "Sources" not in highlights[0]
      and len(highlights[0]) < 60,
      highlights)

# --- Correct citations must be left alone.
answer = "Biaya gelombang 2 untuk individu Rp45.000 dan tim Rp65.000 [S5]. Plagiarisme tidak dicek pakai Turnitin [S3]."
result = resolve_citations(answer, KREASI_CHUNKS, [0.55, 0.31, 0.30, 0.40, 0.43, 0.19])
check("valid citations are untouched", result.cited == [5, 3] and result.answer == answer, (result.cited, result.answer))

# --- Nothing in the chunks backs the wording (heavy paraphrase): we can't
# verify, so the model's own citation stands.
answer = "The paper looks at spotting fake news [S2]."
result = resolve_citations(answer, TA_CHUNKS, [0.5, 0.14])
check("unverifiable citation is kept", result.cited == [2], result.cited)

# --- The model cited nothing: attribute by content, not by similarity rank.
answer = "Deadline submit karya paling lambat 2 Desember 2026."
result = resolve_citations(answer, KREASI_CHUNKS, [0.55, 0.31, 0.30, 0.40, 0.43, 0.19])
check("uncited answer gets the supporting source", result.cited == [5], result.cited)
check("uncited answer gets a marker", result.answer.endswith("[S5]."), result.answer)

# --- A small model that labels one sentence with every source it was given.
everything = ", ".join(f"S{n}" for n in range(1, 7))
answer = f"Deadline submit karya paling lambat 2 Desember 2026 [{everything}]."
result = resolve_citations(answer, KREASI_CHUNKS, [0.55, 0.31, 0.30, 0.40, 0.43, 0.19])
check("label dump is cut down to the supporting source", result.cited == [5], result.cited)
check("label dump leaves one marker", result.answer.endswith("2026 [S5]."), result.answer)

print("all citation checks passed")

# --- Web sources are verified strictly (strict = their source numbers).
MIXED = [
    "Biaya pendaftaran lomba esai adalah Rp45.000 per orang untuk gelombang dua.",
    "Pendaftaran lomba esai ditutup pada 2 Desember 2026 menurut situs resmi panitia.",
    "Resep nasi goreng: bawang putih, kecap manis, dan telur dadar.",
]

answer = "Biaya pendaftaran lomba esai adalah Rp45.000 per orang [S1][S3]."
result = resolve_citations(answer, MIXED, [0.8, 0.4, 0.3], strict={2, 3})
check("web: unsupported web label dropped", result.cited == [1] and "[S3]" not in result.answer, result.answer)

answer = "Pendaftaran lomba esai ditutup pada 2 Desember 2026 [S2]."
result = resolve_citations(answer, MIXED, [0.8, 0.4, 0.3], strict={2, 3})
check("web: supported web label kept", result.cited == [2] and "[S2]" in result.answer, result.answer)

# The only label is a web one the page doesn't support, while a document
# plainly says it: the label is dropped, not turned into a document label.
answer = "Biaya pendaftaran lomba esai adalah Rp45.000 per orang [S3]."
result = resolve_citations(answer, MIXED, [0.8, 0.4, 0.3], strict={2, 3})
check("web: wrong web label is not moved to a document", result.cited == [] and "[S" not in result.answer, result.answer)

# A document label is never replaced by a web source.
answer = "Pendaftaran lomba esai ditutup pada 2 Desember 2026 menurut situs resmi [S1]."
result = resolve_citations(answer, MIXED, [0.8, 0.4, 0.3], strict={2, 3})
check("web: document label is not moved to a web source", 2 not in result.cited and 3 not in result.cited, result.cited)

# A paraphrase nothing verifies: a document label is kept on trust, a web one is not.
answer = "The entry fee is forty-five thousand [S1]. The deadline is early December [S2]."
result = resolve_citations(answer, MIXED, [0.8, 0.4, 0.3], strict={2, 3})
check("web: unverifiable web label dropped, document one kept", result.cited == [1], (result.cited, result.answer))

# A sentence comparing both keeps one label of each kind.
answer = "Biaya pendaftaran Rp45.000 per orang, dan pendaftaran ditutup 2 Desember 2026 menurut situs resmi [S1][S2]."
result = resolve_citations(answer, MIXED, [0.8, 0.4, 0.3], strict={2, 3})
check("web: comparison keeps both kinds", result.cited == [1, 2], result.cited)

# Nothing cited at all: content attribution and the closest-source fallback
# only ever pick documents.
answer = "Pendaftaran lomba esai ditutup pada 2 Desember 2026 menurut situs resmi panitia."
result = resolve_citations(answer, MIXED, [0.2, 0.9, 0.3], strict={2, 3})
check("web: uncited text is never attributed to the web", all(n == 1 for n in result.cited), result.cited)

# Without strict sources nothing changes.
answer = "Biaya pendaftaran lomba esai adalah Rp45.000 per orang [S3]."
result = resolve_citations(answer, MIXED, [0.8, 0.4, 0.3])
check("no strict: wrong label still moved to the right chunk", result.cited == [1], result.cited)

print("all web citation checks passed")
