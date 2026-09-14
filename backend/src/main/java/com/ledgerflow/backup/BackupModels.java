package com.ledgerflow.backup;

import java.util.List;
import java.util.Map;

public final class BackupModels {
    private BackupModels() {}

    public record Manifest(String format, int formatVersion, String createdAt, String applicationVersion,
                           String scope, int companyCount, int attachmentCount,
                           Map<String, String> sha256) {}
    public record CompanyData(long sourceId, String name, String address, String phone, String gstin,
                              String email, SettingsData settings, List<RegionData> regions,
                              List<PartyData> parties, List<TransactionData> transactions) {}
    public record SettingsData(String statementHeader, String statementFooter,
                               String defaultTransactionLimit, boolean showRunningBalance,
                               boolean showNotes, boolean showAttachment, boolean showBusinessAddress,
                               boolean showBusinessPhone, boolean showBusinessGstin,
                               boolean showGeneratedDate, boolean showPageNumbers, String paperSize,
                               String orientation, String fontSize, String customFooter) {}
    public record RegionData(long sourceId, String name) {}
    public record PartyData(long sourceId, long sourceRegionId, String name, String phone,
                            String address, String gstin, String notes) {}
    public record TransactionData(long sourceId, long sourcePartyId, String type, long amount,
                                  String transactionDate, String description, String notes,
                                  AttachmentData attachment) {}
    public record AttachmentData(String originalName, String mimeType, long byteSize,
                                 String sha256, String archiveEntry) {}
    public record Counts(int companies, int regions, int parties, int transactions, int attachments) {}
    public record CompanySummary(String name) {}
    public record Preview(boolean valid, int formatVersion, String createdAt, CompanySummary company,
                          Counts counts, List<String> warnings, List<String> conflicts) {}
    public record RestoreResult(long companyId, String companyName, Counts counts, List<String> warnings) {}
    public record LegacyPreview(boolean valid, int formatVersion, Counts counts,
                                List<String> warnings, List<String> conflicts) {}
    public record LegacyResult(List<Long> companyIds, Counts counts, List<String> warnings) {}
    public record LegacyWorkspace(List<CompanyData> companies, String appearanceJson,
                                  Counts counts, List<String> warnings) {}
    public record Archive(Manifest manifest, CompanyData company, Map<String, byte[]> entries) {}
}
