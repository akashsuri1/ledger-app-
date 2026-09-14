package com.ledgerflow.backup;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.ledgerflow.attachment.AttachmentStorage;
import com.ledgerflow.backup.BackupModels.AttachmentData;
import com.ledgerflow.backup.BackupModels.CompanyData;
import com.ledgerflow.backup.BackupModels.PartyData;
import com.ledgerflow.backup.BackupModels.RegionData;
import com.ledgerflow.backup.BackupModels.SettingsData;
import com.ledgerflow.backup.BackupModels.TransactionData;
import com.ledgerflow.company.CompanyRepository;
import com.ledgerflow.settings.CompanySettingsRepository;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class BackupSnapshotRepository {
    private final JdbcTemplate jdbc;
    private final CompanyRepository companies;
    private final CompanySettingsRepository settings;
    private final AttachmentStorage storage;

    public BackupSnapshotRepository(JdbcTemplate jdbc, CompanyRepository companies,
                                    CompanySettingsRepository settings, AttachmentStorage storage) {
        this.jdbc = jdbc;
        this.companies = companies;
        this.settings = settings;
        this.storage = storage;
    }

    public Snapshot snapshot(long companyId) {
        var company = companies.find(companyId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "COMPANY_NOT_FOUND", "The company is unavailable."));
        var companySettings = settings.find(companyId).orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                "COMPANY_SETTINGS_NOT_FOUND", "Company settings are unavailable."));
        List<RegionData> regions = jdbc.query("SELECT id,name FROM regions WHERE company_id=? ORDER BY id",
                (rs, row) -> new RegionData(rs.getLong("id"), rs.getString("name")), companyId);
        List<PartyData> parties = jdbc.query("""
                SELECT id,region_id,name,phone,address,gstin,notes FROM parties
                WHERE company_id=? ORDER BY id
                """, (rs, row) -> new PartyData(rs.getLong("id"), rs.getLong("region_id"),
                        rs.getString("name"), rs.getString("phone"), rs.getString("address"),
                        rs.getString("gstin"), rs.getString("notes")), companyId);
        Map<String, byte[]> files = new LinkedHashMap<>();
        List<TransactionData> transactions = jdbc.query("""
                SELECT t.id,t.party_id,t.type,t.amount,t.transaction_date,t.description,t.notes,
                       a.storage_key,a.original_name,a.mime_type,a.byte_size
                FROM transactions t LEFT JOIN transaction_attachments a
                  ON a.transaction_id=t.id AND a.company_id=t.company_id
                WHERE t.company_id=? ORDER BY t.id
                """, (rs, row) -> {
                    AttachmentData attachment = null;
                    String key = rs.getString("storage_key");
                    if (key != null) {
                        String entry = "attachments/" + rs.getLong("id") + ".bin";
                        byte[] bytes = load(key);
                        long expectedSize = rs.getLong("byte_size");
                        if (bytes.length != expectedSize) throw new ApiException(HttpStatus.CONFLICT,
                                "BACKUP_ATTACHMENT_INVALID", "An attachment size does not match its metadata.");
                        files.put(entry, bytes);
                        attachment = new AttachmentData(rs.getString("original_name"), rs.getString("mime_type"),
                                expectedSize, BackupArchive.sha256(bytes), entry);
                    }
                    return new TransactionData(rs.getLong("id"), rs.getLong("party_id"), rs.getString("type"),
                            rs.getLong("amount"), rs.getString("transaction_date"), rs.getString("description"),
                            rs.getString("notes"), attachment);
                }, companyId);
        var portableSettings = new SettingsData(companySettings.statementHeader(), companySettings.statementFooter(),
                companySettings.defaultTransactionLimit(), companySettings.showRunningBalance(),
                companySettings.showNotes(), companySettings.showAttachment(),
                companySettings.showBusinessAddress(), companySettings.showBusinessPhone(),
                companySettings.showBusinessGstin(), companySettings.showGeneratedDate(),
                companySettings.showPageNumbers(), companySettings.paperSize(), companySettings.orientation(),
                companySettings.fontSize(), companySettings.customFooter());
        var data = new CompanyData(company.id(), company.name(), company.address(), company.phone(), company.gstin(),
                company.email(), portableSettings, regions, parties, transactions);
        return new Snapshot(data, Map.copyOf(files));
    }

    private byte[] load(String storageKey) {
        try (var loaded = storage.load(storageKey).inputStream()) {
            return loaded.readAllBytes();
        } catch (ApiException exception) {
            if ("ATTACHMENT_FILE_MISSING".equals(exception.code())) {
                throw new ApiException(HttpStatus.CONFLICT, "BACKUP_ATTACHMENT_MISSING",
                        "A stored attachment required by the backup is unavailable.");
            }
            throw exception;
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "BACKUP_ATTACHMENT_MISSING",
                    "A stored attachment required by the backup could not be read.");
        }
    }

    public record Snapshot(CompanyData company, Map<String, byte[]> files) {}
}
