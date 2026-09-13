CREATE UNIQUE INDEX uq_transaction_attachments_company_transaction
    ON transaction_attachments (company_id, transaction_id);
