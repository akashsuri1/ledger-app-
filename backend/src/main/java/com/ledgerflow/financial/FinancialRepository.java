package com.ledgerflow.financial;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import com.ledgerflow.attachment.AttachmentView;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class FinancialRepository {
    private final JdbcTemplate jdbc;

    public FinancialRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Counts(long partyCount, long transactionCount) {}
    public record PartyBalance(long partyId, String partyName, long regionId, String regionName, long balance) {}
    public record Activity(long transactionCount, long totalCredit, long totalDebit) {
        public long netMovement() { return totalCredit - totalDebit; }
    }
    public record LedgerRow(long id, long partyId, String partyName, long regionId, String regionName,
                            String type, long amount, LocalDate transactionDate,
                            String description, String notes, AttachmentView attachment) {}
    public record MonthActivity(String month, long credit, long debit) {}
    public record RegionIdentity(long id, String name) {}
    public record PartyPeriod(long partyId, String partyName, String phone, String address, String gstin,
                              String notes, long regionId, String regionName, long transactionCount,
                              long totalCredit, long totalDebit, long openingBalance, long closingBalance) {}

    public Counts counts(long companyId) {
        return jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM parties WHERE company_id=?) AS party_count,
                       (SELECT COUNT(*) FROM transactions WHERE company_id=?) AS transaction_count
                """, (rs, row) -> new Counts(rs.getLong("party_count"), rs.getLong("transaction_count")),
                companyId, companyId);
    }

    public List<PartyBalance> partyBalances(long companyId, LocalDate through) {
        String dateClause = through == null ? "" : " AND t.transaction_date<=?";
        return jdbc.query("""
                SELECT p.id AS party_id,p.name AS party_name,r.id AS region_id,r.name AS region_name,
                       COALESCE(SUM(CASE WHEN t.type='CREDIT' THEN t.amount ELSE -t.amount END),0) AS balance
                FROM parties p
                JOIN regions r ON r.id=p.region_id AND r.company_id=p.company_id
                LEFT JOIN transactions t ON t.party_id=p.id AND t.company_id=p.company_id
                """ + dateClause + """
                WHERE p.company_id=?
                GROUP BY p.id,p.name,r.id,r.name
                ORDER BY r.name COLLATE NOCASE,r.id,p.name COLLATE NOCASE,p.id
                """, (rs, row) -> new PartyBalance(rs.getLong("party_id"), rs.getString("party_name"),
                        rs.getLong("region_id"), rs.getString("region_name"), rs.getLong("balance")),
                orderedDateJoinParameters(companyId, through));
    }

    private Object[] orderedDateJoinParameters(long companyId, LocalDate through) {
        return through == null ? new Object[]{companyId} : new Object[]{through.toString(), companyId};
    }

    public Activity activity(long companyId, Long partyId, Long regionId, LocalDate from, LocalDate to) {
        QueryParts parts = filters(companyId, partyId, regionId, from, to);
        return jdbc.queryForObject("""
                SELECT COUNT(*) AS transaction_count,
                       COALESCE(SUM(CASE WHEN t.type='CREDIT' THEN t.amount ELSE 0 END),0) AS total_credit,
                       COALESCE(SUM(CASE WHEN t.type='DEBIT' THEN t.amount ELSE 0 END),0) AS total_debit
                FROM transactions t
                JOIN parties p ON p.id=t.party_id AND p.company_id=t.company_id
                """ + parts.where(), (rs, row) -> new Activity(rs.getLong("transaction_count"),
                        rs.getLong("total_credit"), rs.getLong("total_debit")), parts.parameters().toArray());
    }

    public List<LedgerRow> transactions(long companyId, Long partyId, Long regionId,
                                        LocalDate from, LocalDate to, boolean newestFirst, Integer limit) {
        QueryParts parts = filters(companyId, partyId, regionId, from, to);
        var parameters = new ArrayList<>(parts.parameters());
        String direction = newestFirst ? "DESC" : "ASC";
        String limitClause = "";
        if (limit != null) {
            limitClause = " LIMIT ?";
            parameters.add(limit);
        }
        List<LedgerRow> rows = jdbc.query("""
                SELECT t.id,t.party_id,p.name AS party_name,p.region_id,r.name AS region_name,
                       t.type,t.amount,t.transaction_date,t.description,t.notes,
                       a.id AS attachment_id,a.original_name AS attachment_original_name,
                       a.mime_type AS attachment_mime_type,a.byte_size AS attachment_byte_size
                FROM transactions t
                JOIN parties p ON p.id=t.party_id AND p.company_id=t.company_id
                JOIN regions r ON r.id=p.region_id AND r.company_id=p.company_id
                LEFT JOIN transaction_attachments a ON a.transaction_id=t.id AND a.company_id=t.company_id
                """ + parts.where() + " ORDER BY t.transaction_date " + direction + ",t.id " + direction
                + limitClause, this::mapLedgerRow, parameters.toArray());
        return rows;
    }

    public long balanceBefore(long companyId, long partyId, LocalDate date, Long transactionId) {
        var parameters = new ArrayList<Object>();
        parameters.add(companyId);
        parameters.add(partyId);
        parameters.add(date.toString());
        String tieClause = "";
        if (transactionId != null) {
            tieClause = " OR (transaction_date=? AND id<?)";
            parameters.add(date.toString());
            parameters.add(transactionId);
        }
        Long result = jdbc.queryForObject("""
                SELECT COALESCE(SUM(CASE WHEN type='CREDIT' THEN amount ELSE -amount END),0)
                FROM transactions
                WHERE company_id=? AND party_id=? AND (transaction_date<?
                """ + tieClause + ")", Long.class, parameters.toArray());
        return result == null ? 0 : result;
    }

    public long openingBalance(long companyId, Long partyId, Long regionId, LocalDate from) {
        if (from == null) return 0;
        QueryParts parts = filters(companyId, partyId, regionId, null, null);
        var parameters = new ArrayList<>(parts.parameters());
        parameters.add(from.toString());
        Long result = jdbc.queryForObject("""
                SELECT COALESCE(SUM(CASE WHEN t.type='CREDIT' THEN t.amount ELSE -t.amount END),0)
                FROM transactions t
                JOIN parties p ON p.id=t.party_id AND p.company_id=t.company_id
                """ + parts.where() + " AND t.transaction_date<?", Long.class, parameters.toArray());
        return result == null ? 0 : result;
    }

    public List<MonthActivity> monthlyActivity(long companyId, String firstMonth, String lastMonth) {
        return jdbc.query("""
                SELECT substr(transaction_date,1,7) AS month,
                       COALESCE(SUM(CASE WHEN type='CREDIT' THEN amount ELSE 0 END),0) AS credit,
                       COALESCE(SUM(CASE WHEN type='DEBIT' THEN amount ELSE 0 END),0) AS debit
                FROM transactions
                WHERE company_id=? AND substr(transaction_date,1,7)>=? AND substr(transaction_date,1,7)<=?
                GROUP BY substr(transaction_date,1,7)
                ORDER BY month
                """, (rs, row) -> new MonthActivity(rs.getString("month"), rs.getLong("credit"),
                        rs.getLong("debit")), companyId, firstMonth, lastMonth);
    }

    public List<RegionIdentity> regionIdentities(long companyId) {
        return jdbc.query("SELECT id,name FROM regions WHERE company_id=? ORDER BY name COLLATE NOCASE,id",
                (rs, row) -> new RegionIdentity(rs.getLong("id"), rs.getString("name")), companyId);
    }

    public List<PartyPeriod> partyPeriods(long companyId, Long regionId, LocalDate from, LocalDate to) {
        String regionClause = regionId == null ? "" : " AND p.region_id=?";
        var parameters = new ArrayList<Object>();
        parameters.add(from == null ? null : from.toString());
        parameters.add(to == null ? null : to.toString());
        parameters.add(companyId);
        if (regionId != null) parameters.add(regionId);
        return jdbc.query("""
                WITH bounds(from_date,to_date) AS (VALUES(?,?))
                SELECT p.id AS party_id,p.name AS party_name,p.phone,p.address,p.gstin,p.notes,
                       r.id AS region_id,r.name AS region_name,
                       COALESCE(SUM(CASE WHEN t.id IS NOT NULL
                           AND (b.from_date IS NULL OR t.transaction_date>=b.from_date)
                           AND (b.to_date IS NULL OR t.transaction_date<=b.to_date) THEN 1 ELSE 0 END),0)
                           AS transaction_count,
                       COALESCE(SUM(CASE WHEN t.type='CREDIT'
                           AND (b.from_date IS NULL OR t.transaction_date>=b.from_date)
                           AND (b.to_date IS NULL OR t.transaction_date<=b.to_date) THEN t.amount ELSE 0 END),0)
                           AS total_credit,
                       COALESCE(SUM(CASE WHEN t.type='DEBIT'
                           AND (b.from_date IS NULL OR t.transaction_date>=b.from_date)
                           AND (b.to_date IS NULL OR t.transaction_date<=b.to_date) THEN t.amount ELSE 0 END),0)
                           AS total_debit,
                       COALESCE(SUM(CASE WHEN b.from_date IS NOT NULL AND t.transaction_date<b.from_date
                           THEN CASE WHEN t.type='CREDIT' THEN t.amount ELSE -t.amount END ELSE 0 END),0)
                           AS opening_balance,
                       COALESCE(SUM(CASE WHEN b.to_date IS NULL OR t.transaction_date<=b.to_date
                           THEN CASE WHEN t.type='CREDIT' THEN t.amount ELSE -t.amount END ELSE 0 END),0)
                           AS closing_balance
                FROM parties p
                JOIN regions r ON r.id=p.region_id AND r.company_id=p.company_id
                CROSS JOIN bounds b
                LEFT JOIN transactions t ON t.party_id=p.id AND t.company_id=p.company_id
                WHERE p.company_id=?
                """ + regionClause + """
                GROUP BY p.id,p.name,p.phone,p.address,p.gstin,p.notes,r.id,r.name
                ORDER BY r.name COLLATE NOCASE,r.id,p.name COLLATE NOCASE,p.id
                """, (rs, row) -> new PartyPeriod(rs.getLong("party_id"), rs.getString("party_name"),
                        rs.getString("phone"), rs.getString("address"), rs.getString("gstin"),
                        rs.getString("notes"), rs.getLong("region_id"), rs.getString("region_name"),
                        rs.getLong("transaction_count"), rs.getLong("total_credit"),
                        rs.getLong("total_debit"), rs.getLong("opening_balance"),
                        rs.getLong("closing_balance")), parameters.toArray());
    }

    private QueryParts filters(long companyId, Long partyId, Long regionId, LocalDate from, LocalDate to) {
        var where = new StringBuilder(" WHERE t.company_id=?");
        var parameters = new ArrayList<Object>();
        parameters.add(companyId);
        if (partyId != null) {
            where.append(" AND t.party_id=?");
            parameters.add(partyId);
        }
        if (regionId != null) {
            where.append(" AND p.region_id=?");
            parameters.add(regionId);
        }
        if (from != null) {
            where.append(" AND t.transaction_date>=?");
            parameters.add(from.toString());
        }
        if (to != null) {
            where.append(" AND t.transaction_date<=?");
            parameters.add(to.toString());
        }
        return new QueryParts(where.toString(), parameters);
    }

    private LedgerRow mapLedgerRow(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new LedgerRow(rs.getLong("id"), rs.getLong("party_id"), rs.getString("party_name"),
                rs.getLong("region_id"), rs.getString("region_name"), rs.getString("type"),
                rs.getLong("amount"), LocalDate.parse(rs.getString("transaction_date")),
                rs.getString("description"), rs.getString("notes"),
                rs.getObject("attachment_id") == null ? null : new AttachmentView(
                        rs.getLong("attachment_id"), rs.getString("attachment_original_name"),
                        rs.getString("attachment_mime_type"), rs.getLong("attachment_byte_size")));
    }

    private record QueryParts(String where, List<Object> parameters) {}
}
