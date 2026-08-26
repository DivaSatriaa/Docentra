from app.rag.embeddings import create_embeddings


texts = [
    "Machine learning is a field of artificial intelligence.",
    "Pembelajaran mesin adalah bagian dari kecerdasan buatan.",
]

embeddings = create_embeddings(texts)

print("Shape:", embeddings.shape)
print("Dimension:", embeddings.shape[1])
print("First vector values:", embeddings[0][:5])
