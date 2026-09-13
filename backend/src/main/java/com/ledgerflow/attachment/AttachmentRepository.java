package com.ledgerflow.attachment;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AttachmentRepository {
    private final JdbcTemplate jdbc;

    public AttachmentRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Attachment(long id, long companyId, long transactionId, String storageKey,
                             String originalName, String mimeType, long byteSize, Instant createdAt) {
        public AttachmentView view() { return new AttachmentView(id, originalName, mimeType, byteSize); }
    }

    public Optional<Attachment> find(long companyId, long transactionId) {
        return jdbc.query("""
                SELECT * FROM transaction_attachments WHERE company_id=? AND transaction_id=?
                """, this::map, companyId, transactionId).stream().findFirst();
    }

    public List<Attachment> findForParty(long companyId, long partyId) {
        return jdbc.query("""
                SELECT a.* FROM transaction_attachments a
                JOIN transactions t ON t.id=a.transaction_id AND t.company_id=a.company_id
                WHERE a.company_id=? AND t.party_id=? ORDER BY a.id
                """, this::map, companyId, partyId);
    }

    public void upsert(long companyId, long transactionId, String storageKey,
                       String originalName, String mimeType, long byteSize) {
        jdbc.update("""
                INSERT INTO transaction_attachments(
                    company_id,transaction_id,storage_key,original_name,mime_type,byte_size,created_at
                ) VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(company_id,transaction_id) DO UPDATE SET
                    storage_key=excluded.storage_key,
                    original_name=excluded.original_name,
                    mime_type=excluded.mime_type,
                    byte_size=excluded.byte_size,
                    created_at=excluded.created_at
                """, companyId, transactionId, storageKey, originalName, mimeType, byteSize,
                Instant.now().toString());
    }

    public void delete(long companyId, long transactionId) {
        jdbc.update("DELETE FROM transaction_attachments WHERE company_id=? AND transaction_id=?",
                companyId, transactionId);
    }

    private Attachment map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Attachment(rs.getLong("id"), rs.getLong("company_id"), rs.getLong("transaction_id"),
                rs.getString("storage_key"), rs.getString("original_name"), rs.getString("mime_type"),
                rs.getLong("byte_size"), Instant.parse(rs.getString("created_at")));
    }
}
