package com.ledgerflow.backup;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.ledgerflow.auth.SecurityAuditRepository;
import com.ledgerflow.backup.BackupModels.CompanyData;
import com.ledgerflow.backup.BackupModels.LegacyPreview;
import com.ledgerflow.backup.BackupModels.LegacyResult;
import com.ledgerflow.backup.BackupModels.LegacyWorkspace;
import com.ledgerflow.common.TextNormalizer;
import com.ledgerflow.company.CompanyRepository;
import com.ledgerflow.party.PartyRepository;
import com.ledgerflow.preferences.UserPreferencesRepository;
import com.ledgerflow.region.RegionRepository;
import com.ledgerflow.security.AuthenticatedUser;
import com.ledgerflow.settings.CompanySettingsRepository;
import com.ledgerflow.transaction.TransactionRepository;
import com.ledgerflow.transaction.TransactionType;
import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

@Service
public class LegacyImportService {
    private final BackupService backups;
    private final LegacyWorkspaceParser parser;
    private final CompanyRepository companies;
    private final RegionRepository regions;
    private final PartyRepository parties;
    private final TransactionRepository transactions;
    private final CompanySettingsRepository settings;
    private final UserPreferencesRepository preferences;
    private final SecurityAuditRepository audit;
    private final TransactionTemplate transactionTemplate;

    public LegacyImportService(BackupService backups, LegacyWorkspaceParser parser,
                               CompanyRepository companies, RegionRepository regions,
                               PartyRepository parties, TransactionRepository transactions,
                               CompanySettingsRepository settings, UserPreferencesRepository preferences,
                               SecurityAuditRepository audit, TransactionTemplate transactionTemplate) {
        this.backups = backups; this.parser = parser; this.companies = companies; this.regions = regions;
        this.parties = parties; this.transactions = transactions; this.settings = settings;
        this.preferences = preferences; this.audit = audit; this.transactionTemplate = transactionTemplate;
    }

    public LegacyPreview preview(AuthenticatedUser user, JsonNode input) {
        backups.requireRestoreAuthority(user.userId());
        LegacyWorkspace workspace = parser.parse(input);
        return new LegacyPreview(true, 1, workspace.counts(), workspace.warnings(),
                conflicts(user.userId(), workspace));
    }

    public LegacyResult commit(AuthenticatedUser user, JsonNode input) {
        backups.requireRestoreAuthority(user.userId());
        LegacyWorkspace workspace = parser.parse(input);
        if (!conflicts(user.userId(), workspace).isEmpty()) throw conflict();
        try {
            return transactionTemplate.execute(status -> {
                if (!conflicts(user.userId(), workspace).isEmpty()) throw conflict();
                List<Long> ids = new ArrayList<>();
                for (CompanyData company : workspace.companies()) ids.add(insert(user.userId(), company));
                var existing = preferences.find(user.userId());
                preferences.save(user.userId(), new UserPreferencesRepository.Preferences(
                        existing.rememberLastCompany(), existing.lastActiveCompanyId(), workspace.appearanceJson()));
                audit.record(user.userId(), null, "LEGACY_IMPORT_COMMITTED", "USER", user.userId(),
                        "{\"companies\":" + workspace.counts().companies() + ",\"regions\":"
                                + workspace.counts().regions() + ",\"parties\":" + workspace.counts().parties()
                                + ",\"transactions\":" + workspace.counts().transactions() + "}");
                return new LegacyResult(List.copyOf(ids), workspace.counts(), workspace.warnings());
            });
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "LEGACY_IMPORT_INVALID",
                    "The legacy workspace could not be imported safely.");
        }
    }

    private long insert(long userId, CompanyData source) {
        long companyId = companies.create(source.name(), TextNormalizer.comparison(source.name()), source.address(),
                source.phone(), source.gstin(), source.email());
        companies.createOwnerMembership(companyId, userId);
        companies.createDefaultSettings(companyId);
        var value = source.settings();
        settings.update(new CompanySettingsRepository.CompanySettings(companyId, value.statementHeader(),
                value.statementFooter(), value.defaultTransactionLimit(), value.showRunningBalance(),
                value.showNotes(), value.showAttachment(), value.showBusinessAddress(), value.showBusinessPhone(),
                value.showBusinessGstin(), value.showGeneratedDate(), value.showPageNumbers(), value.paperSize(),
                value.orientation(), value.fontSize(), value.customFooter(), Instant.now()));
        Map<Long, Long> regionIds = new HashMap<>();
        source.regions().forEach(region -> regionIds.put(region.sourceId(),
                regions.create(companyId, region.name(), TextNormalizer.comparison(region.name()))));
        Map<Long, Long> partyIds = new HashMap<>();
        source.parties().forEach(party -> partyIds.put(party.sourceId(), parties.create(companyId,
                regionIds.get(party.sourceRegionId()), party.name(), TextNormalizer.comparison(party.name()),
                party.phone(), party.address(), party.gstin(), party.notes())));
        source.transactions().forEach(transaction -> transactions.create(companyId,
                partyIds.get(transaction.sourcePartyId()), TransactionType.valueOf(transaction.type()),
                transaction.amount(), LocalDate.parse(transaction.transactionDate()),
                transaction.description(), transaction.notes()));
        return companyId;
    }

    private List<String> conflicts(long userId, LegacyWorkspace workspace) {
        List<String> result = new ArrayList<>();
        for (CompanyData company : workspace.companies()) {
            if (companies.accessibleNameExists(userId, TextNormalizer.comparison(company.name()), null)) {
                result.add("COMPANY_NAME_ALREADY_ACCESSIBLE:" + company.name());
            }
        }
        return List.copyOf(result);
    }

    private ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "LEGACY_IMPORT_CONFLICT",
                "One or more imported Company names already exist in your accessible workspace.");
    }
}
