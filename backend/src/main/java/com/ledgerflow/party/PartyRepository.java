package com.ledgerflow.party;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.ledgerflow.common.TextNormalizer;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class PartyRepository {
    private final JdbcTemplate jdbc;
    public PartyRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Party(long id, long companyId, long regionId, String regionName, String name,
                        String normalizedName, String phone, String address, String gstin, String notes,
                        Instant createdAt, Instant updatedAt, long balance, long transactionCount) {}
    public record Page(List<Party> items, long total) {}
    public record CascadeCounts(int transactions, int attachments) {}

    public long create(long companyId, long regionId, String name, String normalizedName,
                       String phone, String address, String gstin, String notes) {
        String now = Instant.now().toString();
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO parties(company_id,region_id,name,normalized_name,phone,address,gstin,notes,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,?,?,?,?)
                    """, java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, companyId); statement.setLong(2, regionId);
            statement.setString(3, name); statement.setString(4, normalizedName);
            statement.setString(5, phone); statement.setString(6, address);
            statement.setString(7, gstin); statement.setString(8, notes);
            statement.setString(9, now); statement.setString(10, now);
            return statement;
        }, keys);
        return keys.getKey().longValue();
    }

    public Optional<Party> find(long companyId, long partyId) {
        return jdbc.query(baseSelect() + " WHERE p.company_id=? AND p.id=?",
                this::map, companyId, partyId).stream().findFirst();
    }

    public Page list(long companyId, String search, Long regionId, int page, int pageSize) {
        var where = new StringBuilder(" WHERE p.company_id=?");
        var parameters = new ArrayList<Object>();
        parameters.add(companyId);
        if (regionId != null) {
            where.append(" AND p.region_id=?");
            parameters.add(regionId);
        }
        if (search != null && !search.isBlank()) {
            where.append("""
                     AND (lower(p.name) LIKE ? ESCAPE '\\'
                       OR lower(p.phone) LIKE ? ESCAPE '\\'
                       OR lower(p.gstin) LIKE ? ESCAPE '\\'
                       OR lower(p.address) LIKE ? ESCAPE '\\'
                       OR lower(p.notes) LIKE ? ESCAPE '\\'
                       OR lower(r.name) LIKE ? ESCAPE '\\')
                    """);
            String pattern = TextNormalizer.likePattern(search);
            for (int index = 0; index < 6; index++) parameters.add(pattern);
        }
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM parties p JOIN regions r ON r.id=p.region_id AND r.company_id=p.company_id"
                + where, Long.class, parameters.toArray());
        var pagedParameters = new ArrayList<>(parameters);
        pagedParameters.add(pageSize);
        pagedParameters.add((page - 1L) * pageSize);
        List<Party> items = jdbc.query(baseSelect() + where + " ORDER BY p.name COLLATE NOCASE,p.id LIMIT ? OFFSET ?",
                this::map, pagedParameters.toArray());
        return new Page(items, total == null ? 0 : total);
    }

    public boolean nameExists(long companyId, long regionId, String normalizedName, Long excludingId) {
        String sql = "SELECT COUNT(*) FROM parties WHERE company_id=? AND region_id=? AND normalized_name=?"
                + (excludingId == null ? "" : " AND id<>?");
        Integer count = excludingId == null
                ? jdbc.queryForObject(sql, Integer.class, companyId, regionId, normalizedName)
                : jdbc.queryForObject(sql, Integer.class, companyId, regionId, normalizedName, excludingId);
        return count != null && count > 0;
    }

    public boolean gstinExists(long companyId, String gstin, Long excludingId) {
        if (gstin.isEmpty()) return false;
        String sql = "SELECT COUNT(*) FROM parties WHERE company_id=? AND gstin=?"
                + (excludingId == null ? "" : " AND id<>?");
        Integer count = excludingId == null
                ? jdbc.queryForObject(sql, Integer.class, companyId, gstin)
                : jdbc.queryForObject(sql, Integer.class, companyId, gstin, excludingId);
        return count != null && count > 0;
    }

    public void update(Party party) {
        jdbc.update("""
                UPDATE parties SET region_id=?,name=?,normalized_name=?,phone=?,address=?,gstin=?,notes=?,updated_at=?
                WHERE company_id=? AND id=?
                """, party.regionId(), party.name(), party.normalizedName(), party.phone(), party.address(),
                party.gstin(), party.notes(), Instant.now().toString(), party.companyId(), party.id());
    }

    public CascadeCounts cascadeCounts(long companyId, long partyId) {
        Integer transactions = jdbc.queryForObject(
                "SELECT COUNT(*) FROM transactions WHERE company_id=? AND party_id=?",
                Integer.class, companyId, partyId);
        Integer attachments = jdbc.queryForObject("""
                SELECT COUNT(*) FROM transaction_attachments a
                JOIN transactions t ON t.id=a.transaction_id AND t.company_id=a.company_id
                WHERE t.company_id=? AND t.party_id=?
                """, Integer.class, companyId, partyId);
        return new CascadeCounts(transactions == null ? 0 : transactions, attachments == null ? 0 : attachments);
    }

    public void delete(long companyId, long partyId) {
        jdbc.update("DELETE FROM parties WHERE company_id=? AND id=?", companyId, partyId);
    }

    private String baseSelect() {
        return """
                SELECT p.*,r.name AS region_name,
                    COALESCE((SELECT SUM(CASE t.type WHEN 'CREDIT' THEN t.amount ELSE -t.amount END)
                              FROM transactions t WHERE t.company_id=p.company_id AND t.party_id=p.id),0) AS balance,
                    (SELECT COUNT(*) FROM transactions t WHERE t.company_id=p.company_id AND t.party_id=p.id) AS transaction_count
                FROM parties p JOIN regions r ON r.id=p.region_id AND r.company_id=p.company_id
                """;
    }

    private Party map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Party(rs.getLong("id"), rs.getLong("company_id"), rs.getLong("region_id"),
                rs.getString("region_name"), rs.getString("name"), rs.getString("normalized_name"),
                rs.getString("phone"), rs.getString("address"), rs.getString("gstin"), rs.getString("notes"),
                Instant.parse(rs.getString("created_at")), Instant.parse(rs.getString("updated_at")),
                rs.getLong("balance"), rs.getLong("transaction_count"));
    }
}
