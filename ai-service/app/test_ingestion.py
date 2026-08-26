from app.services.pdf_loader import load_pdf
from app.rag.chunker import chunk_text


pdf_path = "/tmp/test-docentra.pdf"

pages = load_pdf(pdf_path)

all_chunks: list[dict] = []

for page in pages:
    chunks = chunk_text(page["text"])

    for chunk in chunks:
        all_chunks.append(
            {
                "page": page["page"],
                "text": chunk,
            }
        )

print(f"Pages: {len(pages)}")
print(f"Chunks: {len(all_chunks)}")

for index, chunk in enumerate(all_chunks[:5], start=1):
    print(f"\n--- Chunk {index} | Page {chunk['page']} ---")
    print(chunk["text"][:300])
