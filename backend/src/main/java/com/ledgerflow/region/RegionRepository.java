package com.ledgerflow.region;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class RegionRepository {
    private final JdbcTemplate jdbc;
    public RegionRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Region(long id, long companyId, String name, String normalizedName,
                         Instant createdAt, Instant updatedAt) {}

    public long create(long companyId, String name, String normalizedName) {
        String now = Instant.now().toString();
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO regions(company_id,name,normalized_name,created_at,updated_at)
                    VALUES(?,?,?,?,?)
                    """, java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, companyId);
            statement.setString(2, name);
            statement.setString(3, normalizedName);
            statement.setString(4, now);
            statement.setString(5, now);
            return statement;
        }, keys);
        return keys.getKey().longValue();
    }

    public List<Region> list(long companyId) {
        return jdbc.query("SELECT * FROM regions WHERE company_id=? ORDER BY name COLLATE NOCASE,id",
                this::map, companyId);
    }

    public Optional<Region> find(long companyId, long regionId) {
        return jdbc.query("SELECT * FROM regions WHERE company_id=? AND id=?", this::map, companyId, regionId)
                .stream().findFirst();
    }

    public boolean nameExists(long companyId, String normalizedName, Long excludingId) {
        String sql = "SELECT COUNT(*) FROM regions WHERE company_id=? AND normalized_name=?"
                + (excludingId == null ? "" : " AND id<>?");
        Integer count = excludingId == null
                ? jdbc.queryForObject(sql, Integer.class, companyId, normalizedName)
                : jdbc.queryForObject(sql, Integer.class, companyId, normalizedName, excludingId);
        return count != null && count > 0;
    }

    public void update(Region region) {
        jdbc.update("UPDATE regions SET name=?,normalized_name=?,updated_at=? WHERE company_id=? AND id=?",
                region.name(), region.normalizedName(), Instant.now().toString(), region.companyId(), region.id());
    }

    public int partyCount(long companyId, long regionId) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM parties WHERE company_id=? AND region_id=?",
                Integer.class, companyId, regionId);
        return count == null ? 0 : count;
    }

    public void delete(long companyId, long regionId) {
        jdbc.update("DELETE FROM regions WHERE company_id=? AND id=?", companyId, regionId);
    }

    private Region map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Region(rs.getLong("id"), rs.getLong("company_id"), rs.getString("name"),
                rs.getString("normalized_name"), Instant.parse(rs.getString("created_at")),
                Instant.parse(rs.getString("updated_at")));
    }
}
