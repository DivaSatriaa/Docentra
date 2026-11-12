DROP INDEX IF EXISTS idx_document_chunks_content_tsv;

ALTER TABLE document_chunks
    DROP COLUMN IF EXISTS content_tsv;
