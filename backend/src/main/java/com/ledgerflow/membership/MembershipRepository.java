package com.ledgerflow.membership;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MembershipRepository {
    private final JdbcTemplate jdbc;
    public MembershipRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Membership(long companyId, long userId, MembershipRole role, MembershipStatus status) {}
    public record AccessibleCompany(long id, String name, String address, String phone,
                                    String gstin, String email, MembershipRole role, Instant createdAt) {}

    public Optional<Membership> findActive(long userId, long companyId) {
        return jdbc.query("""
                SELECT company_id,user_id,role,status FROM company_memberships
                WHERE user_id = ? AND company_id = ? AND status = 'ACTIVE'
                """, (rs, row) -> new Membership(rs.getLong("company_id"), rs.getLong("user_id"),
                        MembershipRole.valueOf(rs.getString("role")),
                        MembershipStatus.valueOf(rs.getString("status"))), userId, companyId)
                .stream().findFirst();
    }

    public List<AccessibleCompany> findAccessibleCompanies(long userId) {
        return jdbc.query("""
                SELECT c.id,c.name,c.address,c.phone,c.gstin,c.email,c.created_at,m.role
                FROM companies c JOIN company_memberships m ON m.company_id = c.id
                WHERE m.user_id = ? AND m.status = 'ACTIVE'
                ORDER BY c.name COLLATE NOCASE, c.id
                """, (rs, row) -> new AccessibleCompany(rs.getLong("id"), rs.getString("name"),
                        rs.getString("address"), rs.getString("phone"), rs.getString("gstin"),
                        rs.getString("email"), MembershipRole.valueOf(rs.getString("role")),
                        Instant.parse(rs.getString("created_at"))), userId);
    }

    public int countActiveOwners(long companyId) {
        Integer count = jdbc.queryForObject("""
                SELECT COUNT(*) FROM company_memberships
                WHERE company_id = ? AND role = 'OWNER' AND status = 'ACTIVE'
                """, Integer.class, companyId);
        return count == null ? 0 : count;
    }
}
