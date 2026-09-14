package com.ledgerflow.backup;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import com.ledgerflow.attachment.AttachmentFileValidator;
import com.ledgerflow.backup.BackupModels.Archive;
import com.ledgerflow.backup.BackupModels.AttachmentData;
import com.ledgerflow.backup.BackupModels.CompanyData;
import com.ledgerflow.backup.BackupModels.Counts;
import com.ledgerflow.backup.BackupModels.PartyData;
import com.ledgerflow.backup.BackupModels.RegionData;
import com.ledgerflow.backup.BackupModels.SettingsData;
import com.ledgerflow.backup.BackupModels.TransactionData;
import com.ledgerflow.common.TextNormalizer;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class BackupDataValidator {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHONE = Pattern.compile("\\d{10}");
    private static final Set<String> LIMITS = Set.of("10", "25", "50", "100", "ALL");
    private static final Set<String> ORIENTATIONS = Set.of("portrait", "landscape");
    private static final Set<String> FONT_SIZES = Set.of("small", "normal", "large");
    private final AttachmentFileValidator attachmentValidator;
    private final BackupProperties properties;

    public BackupDataValidator(AttachmentFileValidator attachmentValidator, BackupProperties properties) {
        this.attachmentValidator = attachmentValidator;
        this.properties = properties;
    }

    public Validated validate(Archive archive) {
        try { Instant.parse(archive.manifest().createdAt()); }
        catch (RuntimeException exception) { throw corrupted("The backup creation time is invalid."); }
        CompanyData company = archive.company();
        if (company == null || company.settings() == null || company.regions() == null
                || company.parties() == null || company.transactions() == null) throw corrupted("Company data is incomplete.");
        String name = required(company.name(), "Company name");
        String phone = optional(company.phone());
        String email = optional(company.email());
        phone(phone);
        if (!email.isEmpty() && !EMAIL.matcher(email).matches()) throw corrupted("Company email is invalid.");
        SettingsData settings = validateSettings(company.settings());

        Set<Long> regionIds = new HashSet<>();
        Set<String> regionNames = new HashSet<>();
        List<RegionData> regions = new ArrayList<>();
        for (RegionData region : company.regions()) {
            positive(region.sourceId(), "Region id");
            String regionName = required(region.name(), "Region name");
            if (!regionIds.add(region.sourceId()) || !regionNames.add(TextNormalizer.comparison(regionName))) {
                throw corrupted("Regions contain duplicate identifiers or names.");
            }
            regions.add(new RegionData(region.sourceId(), regionName));
        }

        Set<Long> partyIds = new HashSet<>();
        Set<String> partyNames = new HashSet<>();
        Set<String> gstins = new HashSet<>();
        List<PartyData> parties = new ArrayList<>();
        for (PartyData party : company.parties()) {
            positive(party.sourceId(), "Party id");
            if (!regionIds.contains(party.sourceRegionId())) throw corrupted("A Party references an unknown Region.");
            String partyName = required(party.name(), "Party name");
            String partyPhone = optional(party.phone());
            phone(partyPhone);
            String gstin = TextNormalizer.gstin(party.gstin());
            String uniqueName = party.sourceRegionId() + ":" + TextNormalizer.comparison(partyName);
            if (!partyIds.add(party.sourceId()) || !partyNames.add(uniqueName)
                    || (!gstin.isEmpty() && !gstins.add(gstin))) {
                throw corrupted("Parties contain duplicate identifiers, names, or GSTIN values.");
            }
            parties.add(new PartyData(party.sourceId(), party.sourceRegionId(), partyName, partyPhone,
                    optional(party.address()), gstin, optional(party.notes())));
        }

        Set<Long> transactionIds = new HashSet<>();
        Set<String> usedEntries = new HashSet<>();
        List<TransactionData> transactions = new ArrayList<>();
        int attachmentCount = 0;
        for (TransactionData transaction : company.transactions()) {
            positive(transaction.sourceId(), "Transaction id");
            if (!transactionIds.add(transaction.sourceId())) throw corrupted("Transactions contain duplicate identifiers.");
            if (!partyIds.contains(transaction.sourcePartyId())) throw corrupted("A Transaction references an unknown Party.");
            if (!("CREDIT".equals(transaction.type()) || "DEBIT".equals(transaction.type()))) {
                throw corrupted("A Transaction type is invalid.");
            }
            positive(transaction.amount(), "Transaction amount");
            validDate(transaction.transactionDate());
            String description = required(transaction.description(), "Transaction description");
            AttachmentData attachment = null;
            if (transaction.attachment() != null) {
                attachmentCount++;
                var source = transaction.attachment();
                if (source.archiveEntry() == null || !usedEntries.add(source.archiveEntry())) {
                    throw attachmentInvalid("Attachment entries are duplicated.");
                }
                byte[] bytes = archive.entries().get(source.archiveEntry());
                if (bytes == null) throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "BACKUP_ATTACHMENT_MISSING", "An attachment file is missing from the backup.");
                if (source.byteSize() != bytes.length || !BackupArchive.sha256(bytes).equalsIgnoreCase(source.sha256())) {
                    throw attachmentInvalid("An attachment failed its size or digest check.");
                }
                try {
                    var valid = attachmentValidator.validate(source.originalName(), source.mimeType(), bytes);
                    attachment = new AttachmentData(valid.originalName(), valid.mimeType(), bytes.length,
                            BackupArchive.sha256(bytes), source.archiveEntry());
                } catch (ApiException exception) {
                    throw attachmentInvalid("An attachment type or signature is invalid.");
                }
            }
            transactions.add(new TransactionData(transaction.sourceId(), transaction.sourcePartyId(),
                    transaction.type(), transaction.amount(), transaction.transactionDate(), description,
                    optional(transaction.notes()), attachment));
        }
        if (attachmentCount > properties.getMaxAttachments() || attachmentCount != archive.entries().size()) {
            throw attachmentInvalid("Attachment counts do not match the backup data.");
        }
        var canonical = new CompanyData(company.sourceId(), name, optional(company.address()), phone,
                TextNormalizer.gstin(company.gstin()), email, settings, List.copyOf(regions),
                List.copyOf(parties), List.copyOf(transactions));
        return new Validated(new Archive(archive.manifest(), canonical, archive.entries()),
                new Counts(1, regions.size(), parties.size(), transactions.size(), attachmentCount));
    }

    private SettingsData validateSettings(SettingsData value) {
        if (!LIMITS.contains(value.defaultTransactionLimit()) || !"A4".equals(value.paperSize())
                || !ORIENTATIONS.contains(value.orientation()) || !FONT_SIZES.contains(value.fontSize())) {
            throw corrupted("Company Settings contain unsupported values.");
        }
        return new SettingsData(optional(value.statementHeader()), optional(value.statementFooter()),
                value.defaultTransactionLimit(), value.showRunningBalance(), value.showNotes(),
                value.showAttachment(), value.showBusinessAddress(), value.showBusinessPhone(),
                value.showBusinessGstin(), value.showGeneratedDate(), value.showPageNumbers(),
                value.paperSize(), value.orientation(), value.fontSize(), optional(value.customFooter()));
    }

    private void validDate(String value) {
        try {
            if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new DateTimeParseException("format", "", 0);
            LocalDate.parse(value);
        } catch (DateTimeParseException exception) { throw corrupted("A Transaction date is invalid."); }
    }
    private void phone(String value) {
        if (!value.isEmpty() && !PHONE.matcher(value).matches()) throw corrupted("A phone number is invalid.");
    }
    private void positive(long value, String label) { if (value <= 0) throw corrupted(label + " is invalid."); }
    private String required(String value, String label) {
        String result = TextNormalizer.display(value);
        if (result.isEmpty()) throw corrupted(label + " is required.");
        return result;
    }
    private String optional(String value) { return TextNormalizer.optional(value); }
    private ApiException corrupted(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_CORRUPTED", message);
    }
    private ApiException attachmentInvalid(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "BACKUP_ATTACHMENT_INVALID", message);
    }

    public record Validated(Archive archive, Counts counts) {}
}
