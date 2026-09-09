package com.ledgerflow.auth;

import java.time.Instant;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PasswordResetTokenRepository {
    private final JdbcTemplate jdbc;
    public PasswordResetTokenRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record ResetToken(long id, long userId, Instant expiresAt, Instant usedAt) {}

    public void create(long userId, String tokenHash, Instant expiresAt) {
        jdbc.update("INSERT INTO password_reset_tokens (user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?)",
                userId, tokenHash, expiresAt.toString(), Instant.now().toString());
    }

    public Optional<ResetToken> findByHash(String tokenHash) {
        return jdbc.query("SELECT id,user_id,expires_at,used_at FROM password_reset_tokens WHERE token_hash = ?",
                (rs, row) -> new ResetToken(rs.getLong("id"), rs.getLong("user_id"),
                        Instant.parse(rs.getString("expires_at")),
                        rs.getString("used_at") == null ? null : Instant.parse(rs.getString("used_at"))), tokenHash)
                .stream().findFirst();
    }

    public int markUsedIfUnused(long id) {
        return jdbc.update("UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL",
                Instant.now().toString(), id);
    }
}
