package com.ledgerflow.auth;

import java.time.Instant;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SecurityAuditRepository {
    private final JdbcTemplate jdbc;
    public SecurityAuditRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void record(long userId, String action) {
        record(userId, null, action, "USER", userId, "{}");
    }

    public void record(long userId, Long companyId, String action, String entityType,
                       Long entityId, String metadataJson) {
        jdbc.update("""
                INSERT INTO audit_log (company_id,user_id,action,entity_type,entity_id,metadata_json,created_at)
                VALUES (?,?,?,?,?,?,?)
                """, companyId, userId, action, entityType, entityId, metadataJson, Instant.now().toString());
    }
}
