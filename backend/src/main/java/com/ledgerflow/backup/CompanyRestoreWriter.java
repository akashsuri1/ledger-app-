package com.ledgerflow.backup;

import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import com.ledgerflow.attachment.AttachmentRepository;
import com.ledgerflow.attachment.AttachmentStorage;
import com.ledgerflow.auth.SecurityAuditRepository;
import com.ledgerflow.backup.BackupModels.Archive;
import com.ledgerflow.backup.BackupModels.Counts;
import com.ledgerflow.backup.BackupModels.RestoreResult;
import com.ledgerflow.common.TextNormalizer;
import com.ledgerflow.company.CompanyRepository;
import com.ledgerflow.party.PartyRepository;
import com.ledgerflow.region.RegionRepository;
import com.ledgerflow.settings.CompanySettingsRepository;
import com.ledgerflow.transaction.TransactionRepository;
import com.ledgerflow.transaction.TransactionType;
import com.ledgerflow.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class CompanyRestoreWriter {
    private static final Logger log = LoggerFactory.getLogger(CompanyRestoreWriter.class);
    private final CompanyRepository companies;
    private final RegionRepository regions;
    private final PartyRepository parties;
    private final TransactionRepository transactions;
    private final CompanySettingsRepository settings;
    private final AttachmentRepository attachments;
    private final AttachmentStorage storage;
    private final SecurityAuditRepository audit;
    private final TransactionTemplate transactionTemplate;

    public CompanyRestoreWriter(CompanyRepository companies, RegionRepository regions,
                                PartyRepository parties, TransactionRepository transactions,
                                CompanySettingsRepository settings, AttachmentRepository attachments,
                                AttachmentStorage storage, SecurityAuditRepository audit,
                                TransactionTemplate transactionTemplate) {
        this.companies = companies; this.regions = regions; this.parties = parties;
        this.transactions = transactions; this.settings = settings; this.attachments = attachments;
        this.storage = storage; this.audit = audit; this.transactionTemplate = transactionTemplate;
    }

    public RestoreResult restore(long userId, Archive archive, Counts counts, String companyName,
                                 String auditAction) {
        List<String> storedKeys = new ArrayList<>();
        try {
            return transactionTemplate.execute(status -> {
                String normalizedName = TextNormalizer.comparison(companyName);
                if (companies.accessibleNameExists(userId, normalizedName, null)) {
                    throw new ApiException(HttpStatus.CONFLICT, "RESTORE_CONFLICT",
                            "You already have access to a Company with this name.");
                }
                var source = archive.company();
                long companyId = companies.create(companyName, normalizedName, source.address(), source.phone(),
                        source.gstin(), source.email());
                companies.createOwnerMembership(companyId, userId);
                companies.createDefaultSettings(companyId);
                var configured = source.settings();
                settings.update(new CompanySettingsRepository.CompanySettings(companyId,
                        configured.statementHeader(), configured.statementFooter(),
                        configured.defaultTransactionLimit(), configured.showRunningBalance(),
                        configured.showNotes(), configured.showAttachment(), configured.showBusinessAddress(),
                        configured.showBusinessPhone(), configured.showBusinessGstin(),
                        configured.showGeneratedDate(), configured.showPageNumbers(), configured.paperSize(),
                        configured.orientation(), configured.fontSize(), configured.customFooter(), Instant.now()));

                var regionIds = new HashMap<Long, Long>();
                for (var region : source.regions()) {
                    long id = regions.create(companyId, region.name(), TextNormalizer.comparison(region.name()));
                    regionIds.put(region.sourceId(), id);
                }
                var partyIds = new HashMap<Long, Long>();
                for (var party : source.parties()) {
                    long id = parties.create(companyId, regionIds.get(party.sourceRegionId()), party.name(),
                            TextNormalizer.comparison(party.name()), party.phone(), party.address(),
                            party.gstin(), party.notes());
                    partyIds.put(party.sourceId(), id);
                }
                for (var transaction : source.transactions()) {
                    long id = transactions.create(companyId, partyIds.get(transaction.sourcePartyId()),
                            TransactionType.valueOf(transaction.type()), transaction.amount(),
                            LocalDate.parse(transaction.transactionDate()), transaction.description(), transaction.notes());
                    if (transaction.attachment() != null) {
                        var metadata = transaction.attachment();
                        byte[] bytes = archive.entries().get(metadata.archiveEntry());
                        String extension = metadata.originalName().substring(metadata.originalName().lastIndexOf('.') + 1)
                                .toLowerCase(java.util.Locale.ROOT);
                        var stored = storage.store(companyId, id, extension,
                                new ByteArrayInputStream(bytes), bytes.length);
                        storedKeys.add(stored.storageKey());
                        attachments.upsert(companyId, id, stored.storageKey(), metadata.originalName(),
                                metadata.mimeType(), bytes.length);
                        if (!storage.exists(stored.storageKey())) {
                            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_FAILED",
                                    "A staged attachment could not be verified.");
                        }
                    }
                }
                audit.record(userId, companyId, auditAction, "COMPANY", companyId,
                        "{\"regions\":" + counts.regions() + ",\"parties\":" + counts.parties()
                                + ",\"transactions\":" + counts.transactions() + ",\"attachments\":"
                                + counts.attachments() + "}");
                return new RestoreResult(companyId, companyName, counts, List.of());
            });
        } catch (RuntimeException exception) {
            for (String key : storedKeys) {
                if (!storage.delete(key)) log.warn("Restore compensation could not remove storage key hash {}",
                        Integer.toHexString(key.hashCode()));
            }
            if (exception instanceof ApiException) throw exception;
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_FAILED",
                    "The Company could not be restored safely.");
        }
    }
}
