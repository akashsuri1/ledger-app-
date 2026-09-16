ALTER TABLE transaction_attachments ADD COLUMN sha256 TEXT
    CHECK (sha256 IS NULL OR (length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*'));
