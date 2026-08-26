from app.rag.chunker import chunk_text
from app.rag.embeddings import create_embeddings
from app.rag.vector_store import store_chunks
from app.services.pdf_loader import load_pdf


DOCUMENT_ID = "792274d8-1626-4e20-a114-87a5356cdbc2"
PDF_PATH = "/tmp/test-docentra.pdf"


pages = load_pdf(PDF_PATH)

all_chunks = []

for page in pages:
    chunks = chunk_text(page["text"])

    for chunk in chunks:
        all_chunks.append(
            {
                "page": page["page"],
                "text": chunk,
            }
        )

texts = [chunk["text"] for chunk in all_chunks]

embeddings = create_embeddings(texts)

print(f"Pages: {len(pages)}")
print(f"Chunks: {len(all_chunks)}")
print(f"Embedding shape: {embeddings.shape}")

stored = store_chunks(
    DOCUMENT_ID,
    all_chunks,
    embeddings,
)

print(f"Stored chunks: {stored}")
