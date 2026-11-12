-- Keyword (full-text) search over chunks, used together with vector search.
-- 'simple' config: no stemming/stopwords, which suits mixed Indonesian/English text.
ALTER TABLE document_chunks
    ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE INDEX idx_document_chunks_content_tsv
    ON document_chunks
    USING gin (content_tsv);
