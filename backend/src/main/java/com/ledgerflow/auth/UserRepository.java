package com.ledgerflow.auth;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {
    private final JdbcTemplate jdbc;

    public UserRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Optional<UserAccount> findByNormalizedEmail(String normalizedEmail) {
        return jdbc.query(
                "SELECT id, name, email, password_hash FROM users WHERE normalized_email = ?",
                (rs, row) -> new UserAccount(rs.getLong("id"), rs.getString("name"),
                        rs.getString("email"), rs.getString("password_hash")), normalizedEmail
        ).stream().findFirst();
    }

    public Optional<UserAccount> findById(long id) {
        return jdbc.query(
                "SELECT id, name, email, password_hash FROM users WHERE id = ?",
                (rs, row) -> new UserAccount(rs.getLong("id"), rs.getString("name"),
                        rs.getString("email"), rs.getString("password_hash")), id
        ).stream().findFirst();
    }

    public UserAccount create(String name, String email, String passwordHash) {
        String now = Instant.now().toString();
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO users (name,email,normalized_email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                    java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, name);
            statement.setString(2, email);
            statement.setString(3, normalizeEmail(email));
            statement.setString(4, passwordHash);
            statement.setString(5, now);
            statement.setString(6, now);
            return statement;
        }, keys);
        return new UserAccount(keys.getKey().longValue(), name, email, passwordHash);
    }

    public void updatePassword(long userId, String passwordHash) {
        jdbc.update("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                passwordHash, Instant.now().toString(), userId);
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }
}
