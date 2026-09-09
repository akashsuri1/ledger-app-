package com.ledgerflow.auth;

import java.time.Instant;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class AuthSessionRepository {
    private final JdbcTemplate jdbc;

    public AuthSessionRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Session(long id, long userId, String name, String email,
                          Instant expiresAt, Instant revokedAt) {
        public boolean isExpired(Instant now) { return !expiresAt.isAfter(now); }
        public boolean isRevoked() { return revokedAt != null; }
    }

    public long create(long userId, String tokenHash, Instant expiresAt) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO auth_sessions (user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?)",
                    java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, userId);
            statement.setString(2, tokenHash);
            statement.setString(3, expiresAt.toString());
            statement.setString(4, Instant.now().toString());
            return statement;
        }, keys);
        return keys.getKey().longValue();
    }

    public Optional<Session> findByHash(String tokenHash) {
        return jdbc.query("""
                SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.name, u.email
                FROM auth_sessions s JOIN users u ON u.id = s.user_id
                WHERE s.token_hash = ?
                """, (rs, row) -> new Session(rs.getLong("id"), rs.getLong("user_id"),
                        rs.getString("name"), rs.getString("email"),
                        Instant.parse(rs.getString("expires_at")),
                        rs.getString("revoked_at") == null ? null : Instant.parse(rs.getString("revoked_at"))),
                tokenHash).stream().findFirst();
    }

    public void revoke(long sessionId) {
        jdbc.update("UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
                Instant.now().toString(), sessionId);
    }

    public void rotate(long sessionId, String newHash, Instant expiresAt) {
        jdbc.update("UPDATE auth_sessions SET token_hash = ?, expires_at = ? WHERE id = ? AND revoked_at IS NULL",
                newHash, expiresAt.toString(), sessionId);
    }

    public void revokeAllForUser(long userId) {
        jdbc.update("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
                Instant.now().toString(), userId);
    }
}
