package com.ledgerflow.company;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.ledgerflow.membership.MembershipRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class CompanyRepository {
    private final JdbcTemplate jdbc;
    public CompanyRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Company(long id, String name, String normalizedName, String address, String phone,
                          String gstin, String email, Instant createdAt, Instant updatedAt) {}
    public record AccessibleCompany(Company company, MembershipRole role) {}

    public long create(String name, String normalizedName, String address, String phone, String gstin, String email) {
        String now = Instant.now().toString();
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO companies(name,normalized_name,address,phone,gstin,email,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,?,?)
                    """, java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, name); statement.setString(2, normalizedName);
            statement.setString(3, address); statement.setString(4, phone);
            statement.setString(5, gstin); statement.setString(6, email);
            statement.setString(7, now); statement.setString(8, now);
            return statement;
        }, keys);
        return keys.getKey().longValue();
    }

    public void createOwnerMembership(long companyId, long userId) {
        String now = Instant.now().toString();
        jdbc.update("""
                INSERT INTO company_memberships(company_id,user_id,role,status,created_at,updated_at)
                VALUES(?,?,'OWNER','ACTIVE',?,?)
                """, companyId, userId, now, now);
    }

    public void createDefaultSettings(long companyId) {
        jdbc.update("INSERT INTO company_settings(company_id,updated_at) VALUES(?,?)",
                companyId, Instant.now().toString());
    }

    public Optional<Company> find(long companyId) {
        return jdbc.query("SELECT * FROM companies WHERE id=?", this::map, companyId).stream().findFirst();
    }

    public List<AccessibleCompany> findAccessible(long userId) {
        return jdbc.query("""
                SELECT c.*,m.role AS membership_role
                FROM companies c JOIN company_memberships m ON m.company_id=c.id
                WHERE m.user_id=? AND m.status='ACTIVE'
                ORDER BY c.name COLLATE NOCASE,c.id
                """, (rs, row) -> new AccessibleCompany(map(rs, row),
                        MembershipRole.valueOf(rs.getString("membership_role"))), userId);
    }

    public boolean accessibleNameExists(long userId, String normalizedName, Long excludingCompanyId) {
        String sql = """
                SELECT COUNT(*) FROM companies c JOIN company_memberships m ON m.company_id=c.id
                WHERE m.user_id=? AND m.status='ACTIVE' AND c.normalized_name=?
                """ + (excludingCompanyId == null ? "" : " AND c.id<>?");
        Integer count = excludingCompanyId == null
                ? jdbc.queryForObject(sql, Integer.class, userId, normalizedName)
                : jdbc.queryForObject(sql, Integer.class, userId, normalizedName, excludingCompanyId);
        return count != null && count > 0;
    }

    public void update(Company company) {
        jdbc.update("""
                UPDATE companies SET name=?,normalized_name=?,address=?,phone=?,gstin=?,email=?,updated_at=?
                WHERE id=?
                """, company.name(), company.normalizedName(), company.address(), company.phone(),
                company.gstin(), company.email(), Instant.now().toString(), company.id());
    }

    public boolean isEmpty(long companyId) {
        Integer count = jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM regions WHERE company_id=?)
                     + (SELECT COUNT(*) FROM parties WHERE company_id=?)
                     + (SELECT COUNT(*) FROM transactions WHERE company_id=?)
                """, Integer.class, companyId, companyId, companyId);
        return count != null && count == 0;
    }

    public void delete(long companyId) { jdbc.update("DELETE FROM companies WHERE id=?", companyId); }

    private Company map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Company(rs.getLong("id"), rs.getString("name"), rs.getString("normalized_name"),
                rs.getString("address"), rs.getString("phone"), rs.getString("gstin"),
                rs.getString("email"), Instant.parse(rs.getString("created_at")),
                Instant.parse(rs.getString("updated_at")));
    }
}
