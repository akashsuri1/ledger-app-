package com.ledgerflow.settings;

import java.time.Instant;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CompanySettingsRepository {
    private final JdbcTemplate jdbc;

    public CompanySettingsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record CompanySettings(long companyId, String statementHeader, String statementFooter,
                                  String defaultTransactionLimit, boolean showRunningBalance,
                                  boolean showNotes, boolean showAttachment,
                                  boolean showBusinessAddress, boolean showBusinessPhone,
                                  boolean showBusinessGstin, boolean showGeneratedDate,
                                  boolean showPageNumbers, String paperSize, String orientation,
                                  String fontSize, String customFooter, Instant updatedAt) {}

    public Optional<CompanySettings> find(long companyId) {
        return jdbc.query("SELECT * FROM company_settings WHERE company_id=?", this::map, companyId)
                .stream().findFirst();
    }

    public void update(CompanySettings settings) {
        jdbc.update("""
                UPDATE company_settings SET
                    statement_header=?,statement_footer=?,default_transaction_limit=?,
                    show_running_balance=?,show_notes=?,show_attachment=?,show_business_address=?,
                    show_business_phone=?,show_business_gstin=?,show_generated_date=?,show_page_numbers=?,
                    paper_size=?,orientation=?,font_size=?,custom_footer=?,updated_at=?
                WHERE company_id=?
                """, settings.statementHeader(), settings.statementFooter(), settings.defaultTransactionLimit(),
                bool(settings.showRunningBalance()), bool(settings.showNotes()), bool(settings.showAttachment()),
                bool(settings.showBusinessAddress()), bool(settings.showBusinessPhone()),
                bool(settings.showBusinessGstin()), bool(settings.showGeneratedDate()),
                bool(settings.showPageNumbers()), settings.paperSize(), settings.orientation(),
                settings.fontSize(), settings.customFooter(), Instant.now().toString(), settings.companyId());
    }

    private CompanySettings map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new CompanySettings(rs.getLong("company_id"), rs.getString("statement_header"),
                rs.getString("statement_footer"), rs.getString("default_transaction_limit"),
                rs.getBoolean("show_running_balance"), rs.getBoolean("show_notes"),
                rs.getBoolean("show_attachment"), rs.getBoolean("show_business_address"),
                rs.getBoolean("show_business_phone"), rs.getBoolean("show_business_gstin"),
                rs.getBoolean("show_generated_date"), rs.getBoolean("show_page_numbers"),
                rs.getString("paper_size"), rs.getString("orientation"), rs.getString("font_size"),
                rs.getString("custom_footer"), Instant.parse(rs.getString("updated_at")));
    }

    private int bool(boolean value) { return value ? 1 : 0; }
}
