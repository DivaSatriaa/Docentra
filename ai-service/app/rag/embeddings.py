from sentence_transformers import SentenceTransformer


MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

_model = SentenceTransformer(MODEL_NAME)


def create_embeddings(texts: list[str]):
    return _model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
