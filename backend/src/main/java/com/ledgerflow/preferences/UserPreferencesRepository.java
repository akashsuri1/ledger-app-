package com.ledgerflow.preferences;

import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UserPreferencesRepository {
    private final JdbcTemplate jdbc;
    public UserPreferencesRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Preferences(boolean rememberLastCompany, Long lastActiveCompanyId, String appearanceJson) {
        public static Preferences defaults() { return new Preferences(false, null, "{}"); }
    }

    public Preferences find(long userId) {
        return jdbc.query("""
                SELECT remember_last_company,last_active_company_id,appearance_json
                FROM user_preferences WHERE user_id = ?
                """, (rs, row) -> {
                    Number last = (Number) rs.getObject("last_active_company_id");
                    return new Preferences(rs.getInt("remember_last_company") == 1,
                            last == null ? null : last.longValue(), rs.getString("appearance_json"));
                }, userId)
                .stream().findFirst().orElseGet(Preferences::defaults);
    }

    public void save(long userId, Preferences preferences) {
        jdbc.update("""
                INSERT INTO user_preferences
                    (user_id,remember_last_company,last_active_company_id,appearance_json,updated_at)
                VALUES (?,?,?,?,?)
                ON CONFLICT(user_id) DO UPDATE SET
                    remember_last_company=excluded.remember_last_company,
                    last_active_company_id=excluded.last_active_company_id,
                    appearance_json=excluded.appearance_json,
                    updated_at=excluded.updated_at
                """, userId, preferences.rememberLastCompany() ? 1 : 0,
                preferences.lastActiveCompanyId(), preferences.appearanceJson(), Instant.now().toString());
    }
}
