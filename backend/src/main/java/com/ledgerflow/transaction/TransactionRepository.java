package com.ledgerflow.transaction;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.ledgerflow.attachment.AttachmentView;
import com.ledgerflow.common.TextNormalizer;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class TransactionRepository {
    private final JdbcTemplate jdbc;

    public TransactionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record LedgerTransaction(
            long id,
            long companyId,
            long partyId,
            String partyName,
            long regionId,
            String regionName,
            TransactionType type,
            long amount,
            LocalDate transactionDate,
            String description,
            String notes,
            Instant createdAt,
            Instant updatedAt,
            AttachmentView attachment
    ) {}

    public record Page(List<LedgerTransaction> items, long total) {}

    public long create(
            long companyId,
            long partyId,
            TransactionType type,
            long amount,
            LocalDate transactionDate,
            String description,
            String notes
    ) {
        String now = Instant.now().toString();
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO transactions(
                        company_id, party_id, type, amount, transaction_date,
                        description, notes, created_at, updated_at
                    ) VALUES(?,?,?,?,?,?,?,?,?)
                    """, java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, companyId);
            statement.setLong(2, partyId);
            statement.setString(3, type.name());
            statement.setLong(4, amount);
            statement.setString(5, transactionDate.toString());
            statement.setString(6, description);
            statement.setString(7, notes);
            statement.setString(8, now);
            statement.setString(9, now);
            return statement;
        }, keys);
        return keys.getKey().longValue();
    }

    public Optional<LedgerTransaction> find(long companyId, long transactionId) {
        return jdbc.query(baseSelect() + " WHERE t.company_id=? AND t.id=?",
                this::map, companyId, transactionId).stream().findFirst();
    }

    public Page list(
            long companyId,
            String search,
            Long partyId,
            Long regionId,
            TransactionType type,
            LocalDate from,
            LocalDate to,
            int page,
            int pageSize
    ) {
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
        if (type != null) {
            where.append(" AND t.type=?");
            parameters.add(type.name());
        }
        if (from != null) {
            where.append(" AND t.transaction_date>=?");
            parameters.add(from.toString());
        }
        if (to != null) {
            where.append(" AND t.transaction_date<=?");
            parameters.add(to.toString());
        }
        if (search != null && !search.isBlank()) {
            where.append("""
                     AND (lower(p.name) LIKE ? ESCAPE '\\'
                       OR lower(t.description) LIKE ? ESCAPE '\\'
                       OR lower(t.notes) LIKE ? ESCAPE '\\')
                    """);
            String pattern = TextNormalizer.likePattern(search);
            parameters.add(pattern);
            parameters.add(pattern);
            parameters.add(pattern);
        }

        Long total = jdbc.queryForObject(countSelect() + where, Long.class, parameters.toArray());
        var paged = new ArrayList<>(parameters);
        paged.add(pageSize);
        paged.add((page - 1L) * pageSize);
        List<LedgerTransaction> items = jdbc.query(
                baseSelect() + where + " ORDER BY t.transaction_date DESC,t.id DESC LIMIT ? OFFSET ?",
                this::map,
                paged.toArray()
        );
        return new Page(items, total == null ? 0 : total);
    }

    public void update(LedgerTransaction transaction) {
        jdbc.update("""
                UPDATE transactions
                SET party_id=?,type=?,amount=?,transaction_date=?,description=?,notes=?,updated_at=?
                WHERE company_id=? AND id=?
                """, transaction.partyId(), transaction.type().name(), transaction.amount(),
                transaction.transactionDate().toString(), transaction.description(), transaction.notes(),
                Instant.now().toString(), transaction.companyId(), transaction.id());
    }

    public void delete(long companyId, long transactionId) {
        jdbc.update("DELETE FROM transactions WHERE company_id=? AND id=?", companyId, transactionId);
    }

    private String baseSelect() {
        return """
                SELECT t.*,p.name AS party_name,p.region_id,r.name AS region_name,
                       a.id AS attachment_id,a.original_name AS attachment_original_name,
                       a.mime_type AS attachment_mime_type,a.byte_size AS attachment_byte_size
                FROM transactions t
                JOIN parties p ON p.id=t.party_id AND p.company_id=t.company_id
                JOIN regions r ON r.id=p.region_id AND r.company_id=p.company_id
                LEFT JOIN transaction_attachments a ON a.transaction_id=t.id AND a.company_id=t.company_id
                """;
    }

    private String countSelect() {
        return """
                SELECT COUNT(*) FROM transactions t
                JOIN parties p ON p.id=t.party_id AND p.company_id=t.company_id
                JOIN regions r ON r.id=p.region_id AND r.company_id=p.company_id
                """;
    }

    private LedgerTransaction map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new LedgerTransaction(
                rs.getLong("id"),
                rs.getLong("company_id"),
                rs.getLong("party_id"),
                rs.getString("party_name"),
                rs.getLong("region_id"),
                rs.getString("region_name"),
                TransactionType.valueOf(rs.getString("type")),
                rs.getLong("amount"),
                LocalDate.parse(rs.getString("transaction_date")),
                rs.getString("description"),
                rs.getString("notes"),
                Instant.parse(rs.getString("created_at")),
                Instant.parse(rs.getString("updated_at")),
                rs.getObject("attachment_id") == null ? null : new AttachmentView(
                        rs.getLong("attachment_id"), rs.getString("attachment_original_name"),
                        rs.getString("attachment_mime_type"), rs.getLong("attachment_byte_size"))
        );
    }
}
