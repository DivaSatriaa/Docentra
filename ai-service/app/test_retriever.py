from app.rag.embeddings import create_embeddings
from app.rag.retriever import search_chunks


question = "What is machine learning?"

query_embedding = create_embeddings([question])[0]

results = search_chunks(
    query_embedding,
    workspace_id="5400fe40-1e5a-4d63-9ffe-06fb12621540",
    top_k=5,
)

print(f"Results: {len(results)}")

for index, result in enumerate(results, start=1):
    print(f"\n--- Result {index} ---")
    print("Document :", result["document_name"])
    print("Page     :", result["page"])
    print("Similarity:", round(result["similarity"], 4))
    print("Chunk ID  :", result["chunk_id"])
    print("Text     :", result["text"][:300])

print("\n=== DOCUMENT SCOPE ===")

results = search_chunks(
    query_embedding,
    document_ids=[
        "961bf1fc-ca9b-402b-8134-181282697a4a"
    ],
    top_k=5,
)

print(f"Results: {len(results)}")

for index, result in enumerate(results, start=1):
    print(f"\n--- Result {index} ---")
    print("Document  :", result["document_name"])
    print("Page      :", result["page"])
    print("Similarity:", round(result["similarity"], 4))
    print("Chunk ID   :", result["chunk_id"])

print("\n=== COLLECTION SCOPE ===")

results = search_chunks(
    query_embedding,
    collection_id="719aeaa9-a23d-4287-a91f-4162b512d0ff",
    top_k=5,
)

print(f"Results: {len(results)}")

for index, result in enumerate(results, start=1):
    print(f"\n--- Result {index} ---")
    print("Document  :", result["document_name"])
    print("Page      :", result["page"])
    print("Similarity:", round(result["similarity"], 4))
    print("Chunk ID   :", result["chunk_id"])