CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================
-- USERS
-- =========================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password_hash TEXT,
    avatar_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- WORKSPACES
-- =========================

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name VARCHAR(150) NOT NULL,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspaces_owner_id
    ON workspaces(owner_id);

-- =========================
-- DOCUMENTS
-- =========================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID NOT NULL
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,

    mime_type VARCHAR(100) NOT NULL,
    extension VARCHAR(20),
    file_size BIGINT NOT NULL,

    storage_path TEXT NOT NULL,

    processing_status VARCHAR(30) NOT NULL DEFAULT 'pending',

    page_count INT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT documents_processing_status_check
        CHECK (processing_status IN (
            'pending',
            'processing',
            'ready',
            'failed'
        ))
);

CREATE INDEX idx_documents_workspace_id
    ON documents(workspace_id);

CREATE INDEX idx_documents_processing_status
    ON documents(processing_status);

-- =========================
-- COLLECTIONS
-- =========================

CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID NOT NULL
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    name VARCHAR(150) NOT NULL,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collections_workspace_id
    ON collections(workspace_id);

-- =========================
-- COLLECTION ↔ DOCUMENT
-- =========================

CREATE TABLE collection_documents (
    collection_id UUID NOT NULL
        REFERENCES collections(id)
        ON DELETE CASCADE,

    document_id UUID NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (collection_id, document_id)
);

CREATE INDEX idx_collection_documents_document_id
    ON collection_documents(document_id);

-- =========================
-- CONVERSATIONS
-- =========================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID NOT NULL
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    title VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_workspace_id
    ON conversations(workspace_id);

-- =========================
-- MESSAGES
-- =========================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    conversation_id UUID NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_role_check
        CHECK (role IN (
            'system',
            'user',
            'assistant'
        ))
);

CREATE INDEX idx_messages_conversation_id_created_at
    ON messages(conversation_id, created_at);

-- =========================
-- DOCUMENT CHUNKS
-- =========================

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    chunk_index INT NOT NULL,
    content TEXT NOT NULL,

    page_number INT,

    embedding vector(384),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_document_chunks_document_id
    ON document_chunks(document_id);

CREATE INDEX idx_document_chunks_embedding
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops);
