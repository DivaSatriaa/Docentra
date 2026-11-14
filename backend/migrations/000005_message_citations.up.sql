-- Sources an assistant answer cited, so they survive a page reload.
ALTER TABLE messages
    ADD COLUMN citations JSONB;
