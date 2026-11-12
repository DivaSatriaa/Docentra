-- Why a document failed to process, shown to the user.
ALTER TABLE documents
    ADD COLUMN processing_error TEXT;
