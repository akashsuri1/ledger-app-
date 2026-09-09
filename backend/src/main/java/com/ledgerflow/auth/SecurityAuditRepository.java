package com.ledgerflow.auth;

import java.time.Instant;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SecurityAuditRepository {
    private final JdbcTemplate jdbc;
    public SecurityAuditRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void record(long userId, String action) {
        jdbc.update("""
                INSERT INTO audit_log (user_id,action,entity_type,entity_id,metadata_json,created_at)
                VALUES (?,?,'USER',?,'{}',?)
                """, userId, action, userId, Instant.now().toString());
    }
}
