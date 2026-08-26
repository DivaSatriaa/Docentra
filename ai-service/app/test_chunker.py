from app.rag.chunker import chunk_text


sample_text = """
Machine learning is a field of artificial intelligence.
It allows computers to learn patterns from data.
Supervised learning uses labeled data.
Unsupervised learning works with unlabeled data.
"""


chunks = chunk_text(
    sample_text,
    chunk_size=80,
    chunk_overlap=20,
)

print(f"Chunks: {len(chunks)}")

for index, chunk in enumerate(chunks, start=1):
    print(f"\n--- Chunk {index} ---")
    print(chunk)
